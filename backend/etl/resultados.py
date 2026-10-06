"""Apuração oficial do TSE (1º e 2º turnos de 2026).

Lê o arquivo "unificado" publicado pelo TSE (o mesmo que o app Resultados usa) em
https://resultados.tse.jus.br/oficial/ele2026/<eleicao>/dados/<uf>/<uf>-c<cargo>-e<eleicao>-u.json
(em 2026 o TSE deixou de publicar os antigos "dados-simplificados"). Antes da eleição
esses arquivos não existem (HTTP 404): o módulo apenas registra isso.

O site mostra a apuração ao vivo lendo esses mesmos arquivos direto no navegador
(frontend/src/data/apuracao.ts); esta cópia no banco serve à página de 2º turno.

Uso: .venv/bin/python -m etl.resultados
"""

from __future__ import annotations

import json
import os
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

BASE = f"https://resultados.tse.jus.br/oficial/{os.environ.get('TSE_CICLO', 'ele2026')}"
CARGO_CODIGO = {
    "presidente": 1,
    "governador": 3,
    "senador": 5,
    "deputado-federal": 6,
    "deputado-estadual": 7,
    "deputado-distrital": 8,
}



def _eleito(e, situacao: str | None) -> int:
    """1 se o TSE declarou eleito(a). O TSE também marca e = "s" em quem vai ao 2º turno,
    então a situação "2º turno" prevalece sobre a marca."""
    st = (situacao or "").strip().lower()
    if st.startswith("2") and st.endswith("turno"):
        return 0
    return 1 if str(e or "").lower() == "s" or st.startswith("eleit") else 0

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
    return f"{BASE}/{eleicao}/dados/{uf}/{uf}-c{CARGO_CODIGO[cargo]:04d}-e{int(eleicao):06d}-u.json"


def candidatos(data: dict) -> list[dict]:
    """Candidaturas do arquivo unificado (agremiação → partido → candidato), com a sigla do partido."""
    out = []
    for carg in data.get("carg", [])[:1]:
        for agr in carg.get("agr", []):
            for par in agr.get("par", []):
                for c in par.get("cand", []):
                    out.append({**c, "_partido": par.get("sg")})
    return out


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


def coletar() -> tuple[list[dict], int]:
    """Consulta todos os arquivos do TSE e devolve só as disputas com totalização FINAL.

    Cada disputa: {turno, uf, cargo, url, pct_secoes, atualizado, linhas}, com `linhas` no formato
    da tabela `resultados`. Parciais são só contados: o site estático é publicado de tempos em
    tempos, e um parcial gravado ficaria congelado nas páginas de perfil (o parcial é mostrado ao
    vivo pelo navegador, direto do TSE). Usado por run() (banco local) e por etl.apuracao_remota.
    """
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = list(pool.map(lambda t: fetch(session, t), list(_targets())))

    finais: list[dict] = []
    parciais = 0
    for (turno, _eleicao, uf, cargo), url, data in results:
        if not data:
            continue
        if str(data.get("tf", "")).lower() != "s":
            parciais += 1
            continue
        uf_up = uf.upper()
        linhas = []
        # Posição pelos votos: o "seq" do TSE repete a ordem nacional nos arquivos por UF.
        cands = sorted(candidatos(data), key=lambda c: (-(_num(c.get("vap")) or 0), int(c.get("seq") or 0)))
        for pos, c in enumerate(cands, 1):
            situacao = c.get("st") or None
            linhas.append(
                (
                    turno, uf_up, cargo, str(c.get("sqcand") or ""), str(c.get("n") or ""), c.get("nm"),
                    _num(c.get("vap")), _num(c.get("pvap")), situacao,
                    _eleito(c.get("e"), situacao),
                    pos,
                )
            )
        finais.append({
            "turno": turno, "uf": uf_up, "cargo": cargo, "url": url,
            "pct_secoes": _num((data.get("s") or {}).get("pst")),
            # dg/hg: horário de Brasília (dt/ht vêm no fuso local de cada UF)
            "atualizado": f"{data.get('dg', '')} {data.get('hg', '')}".strip(),
            "linhas": linhas,
            "partidos": {str(c.get("sqcand") or ""): c.get("_partido") for c in cands},
            "nomes_urna": {str(c.get("sqcand") or ""): c.get("nmu") for c in cands},
        })
    return finais, parciais


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
    finais, parciais = coletar()
    found = len(finais)
    for d in finais:
        conn.execute("DELETE FROM resultados WHERE turno=? AND uf=? AND cargo=?", (d["turno"], d["uf"], d["cargo"]))
        conn.executemany("INSERT INTO resultados VALUES (?,?,?,?,?,?,?,?,?,?,?)", d["linhas"])
        conn.execute(
            "INSERT OR REPLACE INTO resultados_status VALUES (?,?,?,?,?,?)",
            (d["turno"], d["uf"], d["cargo"], d["pct_secoes"], d["atualizado"], d["url"]),
        )

    common.register_source(
        conn,
        "tse_resultados",
        nome="Resultados oficiais da apuração 2026",
        orgao="Tribunal Superior Eleitoral (TSE) · Divulgação de Resultados",
        url=f"{BASE}/",
        pagina="https://resultados.tse.jus.br/",
        descricao="Votos por candidato publicados pelo TSE durante e após a apuração (arquivo unificado de divulgação).",
    )
    common.set_meta(conn, "resultados_consultado_em", datetime.now().astimezone().isoformat(timespec="seconds"))
    common.set_meta(conn, "resultados_arquivos", str(found))
    common.set_meta(conn, "resultados_parciais", str(parciais))
    conn.commit()
    conn.close()
    print(f"resultados: {found} arquivos com totalização final gravados; {parciais} ainda parciais (ignorados)")


if __name__ == "__main__":
    run()
