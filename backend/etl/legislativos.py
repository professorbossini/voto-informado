"""Plenários estaduais e municipais: eleitos para as Assembleias (2022) e Câmaras Municipais (2024).

Não há base oficial unificada da composição ATUAL de assembleias e câmaras municipais; a fonte
oficial disponível é o TSE com os eleitos de cada eleição (situação ELEITO / ELEITO POR QP /
ELEITO POR MÉDIA), com o partido pelo qual se elegeram. O site deixa isso claro.

Gera (versionado; sem CPF):
  curadoria/legislativos/estaduais.json             UF → eleitos para a Assembleia (Câmara Legislativa no DF)
  curadoria/legislativos/vereadores/<UF>.json       município → vereadores eleitos
O plenario.yml copia para api/legislativos/ no site.

Uso: .venv/bin/python -m etl.legislativos
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from .common import RAW, ROOT

SAIDA = ROOT / "curadoria" / "legislativos"
ELEITO = {"ELEITO", "ELEITO POR QP", "ELEITO POR MÉDIA", "ELEITO POR MEDIA"}
NOMES_UF = {
    "AC": "Acre", "AL": "Alagoas", "AM": "Amazonas", "AP": "Amapá", "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal",
    "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MG": "Minas Gerais", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso",
    "PA": "Pará", "PB": "Paraíba", "PE": "Pernambuco", "PI": "Piauí", "PR": "Paraná", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RO": "Rondônia", "RR": "Roraima", "RS": "Rio Grande do Sul", "SC": "Santa Catarina", "SE": "Sergipe", "SP": "São Paulo", "TO": "Tocantins",
}


def _linhas(zip_path: Path, cargos: set[str]):
    z = zipfile.ZipFile(zip_path)
    nome = next(n for n in z.namelist() if n.endswith("_BRASIL.csv"))
    with z.open(nome) as f:
        for row in csv.DictReader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";"):
            if row["DS_CARGO"] in cargos and row["DS_SIT_TOT_TURNO"].strip().upper() in ELEITO:
                yield row


def _membro(row: dict, prefixo: str) -> dict:
    return {
        "id": f"{prefixo}-{row['SQ_CANDIDATO']}",
        "nome": (row.get("NM_SOCIAL_CANDIDATO") or "").strip() if (row.get("NM_SOCIAL_CANDIDATO") or "").strip() not in ("", "#NULO#", "#NULO") else row["NM_URNA_CANDIDATO"],
        "partido": row["SG_PARTIDO"],
        "uf": row["SG_UF"],
        "numero": row["NR_CANDIDATO"],
        "situacao": row["DS_SIT_TOT_TURNO"].strip().capitalize(),
    }


def _gravar(p: Path, dados) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")


def run() -> None:
    agora = datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds")

    # Assembleias Legislativas (e Câmara Legislativa do DF), eleitos em 2022.
    est: dict[str, list] = defaultdict(list)
    for row in _linhas(RAW / "consulta_cand_2022.zip", {"DEPUTADO ESTADUAL", "DEPUTADO DISTRITAL"}):
        est[row["SG_UF"]].append(_membro(row, "est"))
    estaduais = {
        "eleicao": 2022,
        "mandato": "2023–2027",
        "fonte": "TSE · consulta_cand_2022 (situação de eleito)",
        "gerado_em": agora,
        "casas": {
            uf: {
                "nome": "Câmara Legislativa do Distrito Federal" if uf == "DF" else f"Assembleia Legislativa · {NOMES_UF[uf]}",
                "membros": sorted(ms, key=lambda m: m["nome"]),
            }
            for uf, ms in sorted(est.items())
        },
    }
    _gravar(SAIDA / "estaduais.json", estaduais)
    print(f"legislativos: {sum(len(c['membros']) for c in estaduais['casas'].values())} deputados estaduais/distritais em {len(est)} UFs")

    # Câmaras Municipais, vereadores eleitos em 2024.
    z24 = RAW / "consulta_cand_2024.zip"
    if not z24.exists():
        print("legislativos: consulta_cand_2024.zip ausente; vereadores não gerados")
        return
    por_uf: dict[str, dict[str, dict]] = defaultdict(dict)
    for row in _linhas(z24, {"VEREADOR"}):
        mun = por_uf[row["SG_UF"]].setdefault(row["SG_UE"], {"nome": row["NM_UE"], "membros": []})
        mun["membros"].append(_membro(row, "ver"))
    total = 0
    for uf, muns in sorted(por_uf.items()):
        for m in muns.values():
            m["membros"].sort(key=lambda x: x["nome"])
            total += len(m["membros"])
        _gravar(
            SAIDA / "vereadores" / f"{uf}.json",
            {
                "uf": uf,
                "eleicao": 2024,
                "mandato": "2025–2028",
                "fonte": "TSE · consulta_cand_2024 (situação de eleito)",
                "gerado_em": agora,
                "municipios": dict(sorted(muns.items(), key=lambda kv: kv[1]["nome"])),
            },
        )
    print(f"legislativos: {total} vereadores em {sum(len(m) for m in por_uf.values())} municípios")


if __name__ == "__main__":
    run()
