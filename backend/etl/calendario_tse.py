"""Qual eleição geral está em apuração agora, segundo a configuração oficial do TSE.

O TSE publica em resultados.tse.jus.br/oficial/comum/config/ele-c.json todas as eleições do
ciclo, com data e código (ex.: 2026: 6257 federal e 6259 estadual no 1º turno). Daqui saem o
ciclo (ele2026, ele2030…), os códigos dos dois turnos e se é período de divulgação, para a
apuração (apuracao.yml) funcionar em qualquer eleição geral sem mudar o código.

Só eleições gerais (presidente, governador, senador, deputados): o site não cobre as municipais.

Uso: python -m etl.calendario_tse   (escreve ativo=0|1 em GITHUB_OUTPUT e os códigos em GITHUB_ENV)
"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import requests

CONFIG = "https://resultados.tse.jus.br/oficial/comum/config/ele-c.json"
TIPO_FEDERAL, TIPO_ESTADUAL = "8", "1"  # "tp" no ele-c.json: ordinária federal / estadual
ANTES = timedelta(days=1)  # a divulgação começa no dia da votação
DEPOIS = timedelta(days=10)  # margem para a totalização final e recontagens


def _data(txt: str) -> date:
    return datetime.strptime(txt, "%d/%m/%Y").date()


def ultimo_domingo_de_outubro(ano: int) -> date:
    d = date(ano, 10, 31)
    return d - timedelta(days=(d.weekday() + 1) % 7)


def eleicoes_gerais(config: dict) -> dict[str, dict]:
    """ciclo → {ano, t1, t2, federal:[c1,c2], estadual:[c1,c2]} das eleições gerais ordinárias."""
    out: dict[str, dict] = {}
    for pl in config.get("pl", []):
        for e in pl.get("e", []):
            if "ordin" not in (e.get("nm") or "").lower() or e.get("tp") not in (TIPO_FEDERAL, TIPO_ESTADUAL):
                continue
            c = out.setdefault(pl["c"], {"ciclo": pl["c"], "federal": [None, None], "estadual": [None, None], "t1": None, "t2": None})
            turno = int(e.get("t") or 1)
            chave = "federal" if e["tp"] == TIPO_FEDERAL else "estadual"
            c[chave][turno - 1] = e["cd"]
            c[f"t{turno}"] = _data(pl["dt"])
    for c in out.values():
        c["ano"] = c["t1"].year if c["t1"] else int(c["ciclo"][-4:])
        # O 2º turno entra no arquivo do TSE só perto da data; até lá vale a regra (último domingo
        # de outubro, CF art. 77) e o código seguinte ao do 1º turno (6257 → 6258, como sempre).
        c["t2"] = c["t2"] or ultimo_domingo_de_outubro(c["ano"])
        for chave in ("federal", "estadual"):
            if c[chave][0] and not c[chave][1]:
                c[chave][1] = str(int(c[chave][0]) + 1)
    return {k: v for k, v in out.items() if v["t1"] and v["federal"][0] and v["estadual"][0]}


def em_apuracao(hoje: date, config: dict) -> dict | None:
    for c in sorted(eleicoes_gerais(config).values(), key=lambda c: c["t1"], reverse=True):
        if c["t1"] - ANTES <= hoje <= c["t2"] + DEPOIS:
            return c
    return None


def main() -> None:
    hoje = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
    c = em_apuracao(hoje, requests.get(CONFIG, timeout=60).json())
    saida, amb = os.environ.get("GITHUB_OUTPUT"), os.environ.get("GITHUB_ENV")
    if not c:
        print(f"{hoje}: nenhuma eleição geral em divulgação; nada a fazer.")
        if saida:
            with open(saida, "a", encoding="utf-8") as f:
                f.write("ativo=0\n")
        return
    print(f"{hoje}: {c['ciclo']} (1º turno {c['t1']}, 2º turno {c['t2']}); federal {c['federal']}, estadual {c['estadual']}")
    if saida:
        with open(saida, "a", encoding="utf-8") as f:
            f.write("ativo=1\n")
    if amb:
        with open(amb, "a", encoding="utf-8") as f:
            f.write(f"TSE_CICLO={c['ciclo']}\nTSE_ANO={c['ano']}\n")
            f.write(f"TSE_FEDERAL_T1={c['federal'][0]}\nTSE_FEDERAL_T2={c['federal'][1]}\n")
            f.write(f"TSE_ESTADUAL_T1={c['estadual'][0]}\nTSE_ESTADUAL_T2={c['estadual'][1]}\n")


if __name__ == "__main__":
    main()
