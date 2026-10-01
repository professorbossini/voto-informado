"""Apuração oficial do TSE (1º e 2º turnos de 2026).

Lê os arquivos "dados simplificados" publicados pelo TSE em
https://resultados.tse.jus.br/oficial/ele2026/<eleicao>/dados-simplificados/<uf>/...
Antes da eleição esses arquivos não existem (HTTP 404): o módulo apenas registra
isso e o site continua mostrando "apuração ainda não iniciada".

Uso: .venv/bin/python -m etl.resultados
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

import requests

from . import common
from .common import (
    ELEICAO_ESTADUAL_T1,
    ELEICAO_ESTADUAL_T2,
    ELEICAO_FEDERAL_T1,
    ELEICAO_FEDERAL_T2,
    UFS,
    USER_AGENT,
)

BASE = "https://resultados.tse.jus.br/oficial/ele2026"
CARGO_CODIGO = {
    "presidente": 1,
    "governador": 3,
    "senador": 5,
    "deputado-federal": 6,
    "deputado-estadual": 7,
    "deputado-distrital": 8,
}


def _targets():
    """(turno, eleicao, uf, cargo) de cada arquivo de resultado a consultar."""
    for turno, federal, estadual in ((1, ELEICAO_FEDERAL_T1, ELEICAO_ESTADUAL_T1), (2, ELEICAO_FEDERAL_T2, ELEICAO_ESTADUAL_T2)):
        yield turno, federal, "br", "presidente"
        for uf in UFS:
            yield turno, estadual, uf.lower(), "governador"
            if turno == 1:
                yield turno, estadual, uf.lower(), "senador"
                yield turno, estadual, uf.lower(), "deputado-federal"
                yield turno, estadual, uf.lower(), "deputado-distrital" if uf == "DF" else "deputado-estadual"


def url_for(eleicao: str, uf: str, cargo: str) -> str:
    return f"{BASE}/{eleicao}/dados-simplificados/{uf}/{uf}-c{CARGO_CODIGO[cargo]:04d}-e{int(eleicao):06d}-r.json"


def _num(value) -> float | None:
    if value in (None, ""):
        return None
    try:
        return float(str(value).replace(".", "").replace(",", ".")) if "," in str(value) else float(value)
    except ValueError:
        return None


def fetch(session: requests.Session, target):
    turno, eleicao, uf, cargo = target
    url = url_for(eleicao, uf, cargo)
    try:
        r = session.get(url, timeout=30)
    except requests.RequestException:
        return target, url, None
    if r.status_code != 200:
        return target, url, None
    try:
        return target, url, r.json()
    except json.JSONDecodeError:
        return target, url, None


def run() -> None:
    conn = common.connect()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS resultados (
            turno INTEGER, uf TEXT, cargo TEXT, sq TEXT, numero TEXT, nome TEXT,
            votos REAL, pct REAL, situacao TEXT, eleito INTEGER, seq INTEGER
        );
        CREATE TABLE IF NOT EXISTS resultados_status (
            turno INTEGER, uf TEXT, cargo TEXT, pct_secoes REAL, atualizado TEXT, url TEXT,
            PRIMARY KEY (turno, uf, cargo)
        );
        """
    )
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda t: fetch(session, t), list(_targets())))

    found = 0
    for (turno, _eleicao, uf, cargo), url, data in results:
        if not data:
            continue
        found += 1
        uf_up = uf.upper()
        conn.execute("DELETE FROM resultados WHERE turno=? AND uf=? AND cargo=?", (turno, uf_up, cargo))
        rows = []
        for c in data.get("cand", []):
            situacao = c.get("st") or None
            rows.append(
                (
                    turno, uf_up, cargo, str(c.get("sqcand") or ""), str(c.get("n") or ""), c.get("nm"),
                    _num(c.get("vap")), _num(c.get("pvap")), situacao,
                    1 if str(c.get("e", "")).lower() == "s" or (situacao or "").lower().startswith("eleito") else 0,
                    int(c.get("seq") or 0),
                )
            )
        conn.executemany("INSERT INTO resultados VALUES (?,?,?,?,?,?,?,?,?,?,?)", rows)
        atualizado = f"{data.get('dg', '')} {data.get('hg', '')}".strip()
        conn.execute(
            "INSERT OR REPLACE INTO resultados_status VALUES (?,?,?,?,?,?)",
            (turno, uf_up, cargo, _num(data.get("pst")), atualizado, url),
        )

    common.register_source(
        conn,
        "tse_resultados",
        nome="Resultados oficiais da apuração 2026",
        orgao="Tribunal Superior Eleitoral (TSE) · Divulgação de Resultados",
        url=f"{BASE}/",
        pagina="https://resultados.tse.jus.br/",
        descricao="Votos por candidato publicados pelo TSE durante e após a apuração (arquivos 'dados simplificados').",
    )
    common.set_meta(conn, "resultados_consultado_em", datetime.now().astimezone().isoformat(timespec="seconds"))
    common.set_meta(conn, "resultados_arquivos", str(found))
    conn.commit()
    conn.close()
    print(f"resultados: {found} arquivos publicados encontrados")


if __name__ == "__main__":
    run()
