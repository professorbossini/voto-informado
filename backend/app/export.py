"""Writes the whole API as static JSON files (same paths as app.main), plus photos and
government plans, so the site can be hosted without a Python server.

Uso: .venv/bin/python -m app.export [destino]   (padrão: ../frontend/dist, depois do `npm run build`)
"""

from __future__ import annotations

import html
import json
import re
import shutil
import sqlite3
from pathlib import Path

from etl.common import DB_PATH, PESQUISAS_ATIVAS, PHOTOS, PROPOSTAS, ROOT

from . import queries as q


def _write(base: Path, rel: str, data) -> None:
    path = base / "api" / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _sync_dir(src: Path, dest: Path) -> int:
    dest.mkdir(parents=True, exist_ok=True)
    count = 0
    for f in src.iterdir():
        target = dest / f.name
        if not target.exists() or target.stat().st_size != f.stat().st_size:
            shutil.copy2(f, target)
        count += 1
    return count


def run(dest: Path) -> None:
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    shutil.rmtree(dest / "api", ignore_errors=True)

    _write(dest, "meta.json", q.meta(conn))
    _write(dest, "presidente.json", q.presidente(conn))
    _write(dest, "busca.json", q.busca(conn))
    _write(dest, "partidos.json", q.partidos(conn))
    _write(dest, "estatisticas.json", q.estatisticas(conn))
    _write(dest, "parlamentares.json", q.parlamentares(conn))
    _write(dest, "resultados.json", q.resultados(conn))
    if PESQUISAS_ATIVAS:  # pendente de conferência no PesqEle: desligado por padrão
        _write(dest, "pesquisas.json", q.pesquisas(conn))
    _write(dest, "segundo-turno.json", q.segundo_turno(conn))
    for uf in q.UF_NOMES:
        if uf == "BR":
            continue
        _write(dest, f"uf/{uf}.json", q.uf_majoritarios(conn, uf))
        _write(dest, f"uf/{uf}/deputados.json", q.uf_deputados(conn, uf))

    sqs = [r[0] for r in conn.execute("SELECT sq FROM candidatos")]
    for i, sq in enumerate(sqs, 1):
        _write(dest, f"candidato/{sq}.json", q.candidato(conn, sq))
        if i % 5000 == 0:
            print(f"  candidatos: {i}/{len(sqs)}")
    pids = [r[0] for r in conn.execute("SELECT id FROM parlamentares")] if q._has(conn, "parlamentares") else []
    for pid in pids:
        _write(dest, f"parlamentar/{q.pub_id(pid)}.json", q.parlamentar(conn, pid))

    fotos = _sync_dir(PHOTOS, dest / "fotos")
    props = _sync_dir(PROPOSTAS, dest / "propostas")
    print(f"export: {len(sqs)} candidatos, {len(pids)} parlamentares, {fotos} fotos, {props} propostas → {dest}")


CARGO_LABEL = {
    "presidente": "Presidente", "vice-presidente": "Vice-presidente", "governador": "Governador(a)",
    "vice-governador": "Vice-governador(a)", "senador": "Senador(a)", "1-suplente": "1º suplente",
    "2-suplente": "2º suplente", "deputado-federal": "Deputado(a) federal",
    "deputado-estadual": "Deputado(a) estadual", "deputado-distrital": "Deputado(a) distrital",
}


def _page(template: str, dest: Path, rel: str, title: str, description: str, url: str, image: str | None = None) -> None:
    """Static copy of the SPA shell for a deep link: 200 status and proper link previews."""
    t, d = html.escape(title, quote=True), html.escape(description, quote=True)
    meta = [
        f'<meta property="og:title" content="{t}" />',
        f'<meta property="og:description" content="{d}" />',
        f'<meta property="og:url" content="{html.escape(url, quote=True)}" />',
        '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="Voto Informado" />',
        '<meta name="twitter:card" content="summary" />',
    ]
    if image:
        meta.append(f'<meta property="og:image" content="{html.escape(image, quote=True)}" />')
    page = re.sub(r'\s*<meta property="og:[^>]*>', "", template)  # as da página inicial dão lugar às desta rota
    page = re.sub(r"<title>.*?</title>", f"<title>{t}</title>", page, count=1, flags=re.S)
    page = re.sub(r'(<meta\s+name="description"\s+content=")[^"]*(")', lambda m: m.group(1) + d + m.group(2), page, count=1, flags=re.S)
    page = page.replace("</head>", "    " + "\n    ".join(meta) + "\n  </head>", 1)
    out = dest / rel / "index.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page, encoding="utf-8")


def write_pages(dest: Path, site_url: str) -> None:
    """One HTML per route (candidates, parliamentarians, lists), all built from dist/index.html."""
    site = site_url.rstrip("/")
    template = (dest / "index.html").read_text(encoding="utf-8")
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    resumo = "Dados oficiais do TSE, da Câmara e do Senado. Sem opinião e sem recomendação de voto."
    estaticas = {
        "eleicao": "Candidaturas 2026 por estado",
        "comparar": "Comparar candidaturas",
        "cola": "Minha cola para a urna",
        "simulador": "Simulador de urna (educativo)",
        "segundo-turno": "2º turno",
        "gastos": "Gastos de mandato (cota parlamentar)",
        "numeros": "A eleição em números",
        "sobre": "Fontes e método",
        "privacidade": "Política de Privacidade",
        "termos": "Termos de Uso",
    }
    if PESQUISAS_ATIVAS:
        estaticas["pesquisas"] = "Pesquisas registradas no TSE"
    for rel, titulo in estaticas.items():
        _page(template, dest, rel, f"{titulo} · Voto Informado", resumo, f"{site}/{rel}")
    cargos = ["presidente", "governador", "senador", "deputado-federal", "deputado-estadual", "deputado-distrital"]
    for uf, nome in q.UF_NOMES.items():
        _page(template, dest, f"eleicao/{uf}", f"Candidaturas · {nome} · Voto Informado", resumo, f"{site}/eleicao/{uf}")
        for cargo in cargos:
            _page(template, dest, f"eleicao/{uf}/{cargo}", f"Candidaturas · {nome} · Voto Informado", resumo, f"{site}/eleicao/{uf}/{cargo}")
    n = 0
    for r in conn.execute("SELECT c.sq, c.nome_urna, c.numero, c.partido, c.cargo, c.uf, EXISTS(SELECT 1 FROM fotos f WHERE f.sq=c.sq) foto FROM candidatos c"):
        cargo = CARGO_LABEL.get(r["cargo"], r["cargo"])
        local = "Brasil" if r["uf"] == "BR" else r["uf"]
        titulo = f"{r['nome_urna'].title()} ({r['numero']}, {r['partido']}) · {cargo} · {local}"
        desc = f"Perfil oficial: situação do registro, patrimônio declarado, campanha e trajetória. {resumo}"
        foto = f"{site}/fotos/{r['sq']}.jpg" if r["foto"] else None
        _page(template, dest, f"candidato/{r['sq']}", titulo, desc, f"{site}/candidato/{r['sq']}", foto)
        n += 1
    for r in conn.execute("SELECT id, nome, partido, uf, casa, foto_url FROM parlamentares"):
        casa = "Câmara dos Deputados" if r["casa"] == "camara" else "Senado Federal"
        pid = q.pub_id(r["id"])
        _page(template, dest, f"parlamentar/{pid}", f"{r['nome']} ({r['partido']}-{r['uf']}) · cota parlamentar · {casa}",
              f"Gastos de mandato publicados pela {casa}. {resumo}", f"{site}/parlamentar/{pid}", r["foto_url"])
    print(f"páginas: {n} candidaturas + rotas fixas com título e prévia de link")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("destino", nargs="?", default=str(ROOT.parent / "frontend" / "dist"))
    ap.add_argument("--site-url", help="URL pública do site: gera uma página HTML por rota (prévia de links, status 200)")
    args = ap.parse_args()
    run(Path(args.destino))
    if args.site_url:
        write_pages(Path(args.destino), args.site_url)
