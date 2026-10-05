"""Malha dos municípios por UF (IBGE), com o código do município no TSE, para o site descobrir
no próprio aparelho em que município a pessoa está (Câmara Municipal no plenário).

Fontes oficiais:
  - IBGE, API de malhas v3 (qualidade mínima, divisão por município): contorno de cada município;
  - TSE, configuração de municípios da apuração (mun-e006257-cm.json): código IBGE → código TSE.

Gera (versionado) curadoria/legislativos/malhas/<UF>.json:
  {"uf", "fonte", "municipios": {"<código TSE>": [anel, ...]}}
cada anel é uma lista plana de inteiros em graus × 10⁴: x0, y0 absolutos e depois as diferenças
(dx, dy) de cada ponto, para o arquivo ficar pequeno. O plenario.yml copia para api/legislativos/.

Uso: .venv/bin/python -m etl.malhas_municipais
"""

from __future__ import annotations

import json

import requests

from .common import ROOT
from .legislativos import NOMES_UF

SAIDA = ROOT / "curadoria" / "legislativos" / "malhas"
IBGE = "https://servicodados.ibge.gov.br/api/v3/malhas/estados/{uf}?formato=application/vnd.geo+json&qualidade=minima&intrarregiao=municipio"
TSE = "https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json"


def anel(coords: list) -> list[int]:
    out: list[int] = []
    px = py = 0
    for i, (lon, lat) in enumerate(coords):
        x, y = round(lon * 1e4), round(lat * 1e4)
        out += [x, y] if i == 0 else [x - px, y - py]
        px, py = x, y
    return out


def aneis(geom: dict) -> list[list[int]]:
    poligonos = [geom["coordinates"]] if geom["type"] == "Polygon" else geom["coordinates"]
    return [anel(r) for p in poligonos for r in p]


def run() -> None:
    s = requests.Session()
    tse = s.get(TSE, timeout=60).json()
    ibge_tse = {m["cdi"]: m["cd"] for a in tse["abr"] for m in a.get("mu", [])}
    total = 0
    for uf in sorted(NOMES_UF):
        if uf == "DF":
            continue  # o DF não tem municípios nem Câmara Municipal
        geo = s.get(IBGE.format(uf=uf), timeout=120).json()
        muns = {}
        for f in geo["features"]:
            cd = ibge_tse.get(f["properties"]["codarea"])
            if cd:
                muns[cd] = aneis(f["geometry"])
        faltam = len(geo["features"]) - len(muns)
        SAIDA.mkdir(parents=True, exist_ok=True)
        (SAIDA / f"{uf}.json").write_text(
            json.dumps(
                {"uf": uf, "fonte": "IBGE (malha municipal, qualidade mínima) · códigos TSE", "municipios": dict(sorted(muns.items()))},
                separators=(",", ":"),
            )
            + "\n",
            encoding="utf-8",
        )
        total += len(muns)
        print(f"malhas: {uf} {len(muns)} municípios" + (f" ({faltam} sem código TSE)" if faltam else ""))
    print(f"malhas: {total} municípios")


if __name__ == "__main__":
    run()
