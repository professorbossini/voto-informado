"""Gera o mapa dos estados dos EUA para o site a partir da malha oficial do Census Bureau.

Fonte: Cartographic Boundary Files, U.S. Census Bureau (domínio público),
       https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_20m.zip

Projeção igual à usada nos mapas oficiais americanos (Albers de áreas iguais, com o Alasca e o Havaí
em quadros à parte, nas mesmas proporções do d3.geoAlbersUsa), simplificada para pesar pouco.
Roda uma vez (as divisas não mudam) e grava frontend/src/components/eua/usaMapData.ts.

Uso: python -m etl.eua.malha
"""

from __future__ import annotations

import io
import math
import struct
import zipfile
from pathlib import Path

from .comum import baixar

URL = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_state_20m.zip"
SAIDA = Path(__file__).resolve().parents[3] / "frontend" / "src" / "components" / "eua" / "usaMapData.ts"
K = 1070  # escala e quadro de 960 × 600, como no d3.geoAlbersUsa
TX, TY = 480, 250
TOLERANCIA = 0.35  # simplificação (pixels do quadro)


def ler_dbf(b: bytes) -> list[dict]:
    n, cab = struct.unpack("<I", b[4:8])[0], struct.unpack("<H", b[8:10])[0]
    tam = struct.unpack("<H", b[10:12])[0]
    campos, pos = [], 32
    while b[pos] != 0x0D:
        nome = b[pos : pos + 11].split(b"\0")[0].decode()
        campos.append((nome, b[pos + 16]))
        pos += 32
    out = []
    for i in range(n):
        reg = b[cab + i * tam + 1 : cab + (i + 1) * tam]
        d, p = {}, 0
        for nome, largura in campos:
            d[nome] = reg[p : p + largura].decode("latin-1").strip()
            p += largura
        out.append(d)
    return out


def ler_shp(b: bytes) -> list[list[list[tuple[float, float]]]]:
    pos, out = 100, []
    while pos < len(b):
        _, tam = struct.unpack(">ii", b[pos : pos + 8])
        conteudo = b[pos + 8 : pos + 8 + tam * 2]
        pos += 8 + tam * 2
        tipo = struct.unpack("<i", conteudo[:4])[0]
        if tipo != 5:
            out.append([])
            continue
        npartes, npontos = struct.unpack("<ii", conteudo[36:44])
        partes = list(struct.unpack(f"<{npartes}i", conteudo[44 : 44 + 4 * npartes])) + [npontos]
        base = 44 + 4 * npartes
        pts = [struct.unpack("<dd", conteudo[base + 16 * i : base + 16 * (i + 1)]) for i in range(npontos)]
        out.append([pts[partes[i] : partes[i + 1]] for i in range(npartes)])
    return out


def conica(lon0: float, p1: float, p2: float, centro: tuple[float, float], escala: float, transl: tuple[float, float]):
    """Cônica de Albers (áreas iguais), como d3.geoConicEqualArea com rotate/center/scale/translate."""
    y0, y1 = math.radians(p1), math.radians(p2)
    n = (math.sin(y0) + math.sin(y1)) / 2
    c = 1 + math.sin(y0) * (2 * n - math.sin(y0))
    r0 = math.sqrt(c) / n

    def bruta(lam: float, phi: float) -> tuple[float, float]:
        r = math.sqrt(max(c - 2 * n * math.sin(phi), 0)) / n
        return r * math.sin(lam * n), r0 - r * math.cos(lam * n)

    cx, cy = bruta(math.radians(centro[0]), math.radians(centro[1]))

    def proj(lon: float, lat: float) -> tuple[float, float]:
        lam = math.radians(((lon - lon0 + 180) % 360) - 180)
        x, y = bruta(lam, math.radians(lat))
        return transl[0] + escala * (x - cx), transl[1] - escala * (y - cy)

    return proj


BAIXOS48 = conica(-96, 29.5, 45.5, (-0.6, 38.7), K, (TX, TY))
ALASCA = conica(-154, 55, 65, (-2, 58.5), 0.35 * K, (TX - 0.307 * K, TY + 0.201 * K))
HAVAI = conica(-157, 8, 18, (-3, 19.9), K, (TX - 0.205 * K, TY + 0.212 * K))


def _dp(pts: list[tuple[float, float]], eps: float) -> list[tuple[float, float]]:
    """Douglas–Peucker iterativo."""
    if len(pts) < 4:
        return pts
    manter = [False] * len(pts)
    manter[0] = manter[-1] = True
    pilha = [(0, len(pts) - 1)]
    while pilha:
        a, b = pilha.pop()
        (x1, y1), (x2, y2) = pts[a], pts[b]
        dx, dy = x2 - x1, y2 - y1
        norma = math.hypot(dx, dy) or 1e-9
        idx, dmax = -1, eps
        for i in range(a + 1, b):
            x0, y0 = pts[i]
            d = abs(dy * x0 - dx * y0 + x2 * y1 - y2 * x1) / norma
            if d > dmax:
                idx, dmax = i, d
        if idx >= 0:
            manter[idx] = True
            pilha += [(a, idx), (idx, b)]
    return [p for p, m in zip(pts, manter) if m]


def _area(pts: list[tuple[float, float]]) -> float:
    return abs(sum(x1 * y2 - x2 * y1 for (x1, y1), (x2, y2) in zip(pts, pts[1:] + pts[:1]))) / 2


def gerar() -> list[dict]:
    r = baixar(URL)
    r.raise_for_status()
    with zipfile.ZipFile(io.BytesIO(r.content)) as z:
        shp = ler_shp(z.read(next(n for n in z.namelist() if n.endswith(".shp"))))
        dbf = ler_dbf(z.read(next(n for n in z.namelist() if n.endswith(".dbf"))))
    estados = []
    for reg, aneis in zip(dbf, shp):
        uf = reg.get("STUSPS")
        if uf in ("PR", "VI", "GU", "AS", "MP") or not aneis:
            continue
        proj = ALASCA if uf == "AK" else HAVAI if uf == "HI" else BAIXOS48
        partes, maior = [], (0.0, (0.0, 0.0))
        for anel in aneis:
            if uf == "AK" and any(lon > 0 for lon, _ in anel):
                continue  # ilhas Aleutas além do antimeridiano: ficam fora do quadro
            p = [proj(lon, lat) for lon, lat in anel]
            a = _area(p)
            if a < 0.6 and len(aneis) > 1:
                continue  # ilhotas que nem aparecem no tamanho do mapa
            # Anel fechado (1º ponto = último): simplifica as duas metades, senão a reta de referência some.
            if p[0] == p[-1]:
                p = p[:-1]
            meio = len(p) // 2
            p = _dp(p[: meio + 1], TOLERANCIA)[:-1] + _dp(p[meio:] + p[:1], TOLERANCIA)[:-1]
            if len(p) < 3:
                continue
            if a > maior[0]:
                sx = sum(x for x, _ in p) / len(p)
                sy = sum(y for _, y in p) / len(p)
                maior = (a, (sx, sy))
            partes.append("M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in p) + "Z")
        estados.append({"uf": uf, "d": "".join(partes), "cx": round(maior[1][0], 1), "cy": round(maior[1][1], 1)})
    return sorted(estados, key=lambda e: e["uf"])


def main() -> None:
    estados = gerar()
    import re as _re

    nums = [float(v) for e in estados for v in _re.findall(r"-?\d+\.\d", e["d"])]
    xs, ys = nums[0::2], nums[1::2]
    # Margem à direita para os rótulos dos estados pequenos do nordeste (com linha de chamada).
    caixa = f"{min(xs) - 4:.0f} {min(ys) - 4:.0f} {max(xs) - min(xs) + 70:.0f} {max(ys) - min(ys) + 8:.0f}"
    linhas = ",\n".join(f"  {{ uf: '{e['uf']}', cx: {e['cx']}, cy: {e['cy']}, d: '{e['d']}' }}" for e in estados)
    SAIDA.parent.mkdir(parents=True, exist_ok=True)
    SAIDA.write_text(
        "/**\n"
        " * Contornos dos 50 estados e do Distrito de Colúmbia: malha oficial do U.S. Census Bureau\n"
        f" * (Cartographic Boundary Files 2023, 1:20.000.000, domínio público), {URL}\n"
        " * Projeção Albers de áreas iguais com o Alasca e o Havaí em quadros à parte (como d3.geoAlbersUsa),\n"
        " * num quadro de 960 × 600. Arquivo gerado por backend/etl/eua/malha.py; não editar à mão.\n"
        " */\n"
        f"export const USA_VIEWBOX = '{caixa}';\n"
        f"export const CENSUS_MALHA_URL = '{URL}';\n\n"
        "export const USA_SHAPES: { uf: string; cx: number; cy: number; d: string }[] = [\n"
        f"{linhas},\n];\n",
        encoding="utf-8",
    )
    print(f"{len(estados)} estados em {SAIDA} ({SAIDA.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
