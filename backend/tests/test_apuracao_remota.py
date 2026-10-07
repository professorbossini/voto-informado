"""A apuração remota (JSON do site publicado) tem de produzir o mesmo que o caminho do banco.

Monta um "site" mínimo a partir de uma cópia em memória do banco, aplica um resultado final
sintético pelos dois caminhos e compara: perfis, resultados.json, segundo-turno.json e fase.
"""

from __future__ import annotations

import json
import sqlite3
from datetime import date, datetime

import pytest

from app import export
from app import queries as q
from etl.apuracao_remota import BRT, MARCA, aplicar, assinatura
from etl.common import DB_PATH

sem_banco = pytest.mark.skipif(not DB_PATH.exists(), reason="banco não gerado")


@pytest.fixture()
def mem():
    src = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn = sqlite3.connect(":memory:")
    src.backup(conn)
    src.close()
    conn.row_factory = sqlite3.Row
    conn.execute("DELETE FROM resultados")
    conn.execute("DELETE FROM resultados_status")
    yield conn
    conn.close()


def _final(conn):
    """Presidente, 1º turno, totalização final: dois vão ao 2º turno, o resto não."""
    sqs = [r["sq"] for r in conn.execute("SELECT sq FROM candidatos WHERE cargo='presidente' AND na_urna=1 ORDER BY nome_urna LIMIT 4")]
    votos = [450.0, 400.0, 100.0, 50.0]
    linhas = []
    for pos, (sq, v) in enumerate(zip(sqs, votos), 1):
        num, nome = conn.execute("SELECT numero, nome FROM candidatos WHERE sq=?", (sq,)).fetchone()
        linhas.append((1, "BR", "presidente", sq, num, nome, v, v / 10, "2º turno" if pos <= 2 else "Não eleito", 0, pos))
    return sqs, [{
        "turno": 1, "uf": "BR", "cargo": "presidente", "url": "https://x/br.json", "pct_secoes": 100.0,
        "atualizado": "04/10/2026 22:10:00", "linhas": linhas, "partidos": {}, "nomes_urna": {},
    }]


@sem_banco
def test_remoto_igual_ao_banco(mem, tmp_path):
    sqs, finais = _final(mem)
    site = tmp_path / "site"
    # Site "publicado" antes do resultado: o que app.export grava hoje.
    export._write(site, "meta.json", q.meta(mem))
    export._write(site, "resultados.json", q.resultados(mem))
    export._write(site, "segundo-turno.json", q.segundo_turno(mem))
    for sq in sqs:
        export._write(site, f"candidato/{sq}.json", q.candidato(mem, sq))

    agora = datetime(2026, 10, 5, 9, 0, tzinfo=BRT)
    assert aplicar(site, finais, parciais=0, agora=agora) > 0

    # Mesmo resultado pelo caminho do banco.
    d = finais[0]
    mem.executemany("INSERT INTO resultados VALUES (?,?,?,?,?,?,?,?,?,?,?)", d["linhas"])
    mem.execute("INSERT INTO resultados_status VALUES (?,?,?,?,?,?)", (1, "BR", "presidente", d["pct_secoes"], d["atualizado"], d["url"]))

    ler = lambda rel: json.loads((site / "api" / rel).read_text(encoding="utf-8"))  # noqa: E731
    for sq in sqs:
        assert ler(f"candidato/{sq}.json")["resultados"] == q.candidato(mem, sq)["resultados"]
    assert ler("resultados.json")["disputas"] == q.resultados(mem)["disputas"]
    assert ler("segundo-turno.json")["disputas"] == q.segundo_turno(mem)["disputas"]
    assert {c["sq"] for c in ler("segundo-turno.json")["disputas"][0]["candidatos"]} == set(sqs[:2])
    assert ler("meta.json")["eleicao"]["fase"] == q.fase(mem, hoje=date(2026, 10, 5)) == "pre-2turno"
    assert ler(MARCA)["assinatura"] == assinatura(finais)

    # Reaplicar o mesmo resultado não muda nada além da hora da consulta.
    assert aplicar(site, finais, parciais=0, agora=agora) == 0


def test_finalista_do_2turno_nao_conta_como_eleito():
    # O TSE publica e = "s" também para quem vai ao 2º turno (AC, DF, ES, TO em 04/10/2026).
    from etl.resultados import _eleito

    assert _eleito("s", "2º turno") == 0
    assert _eleito("s", "Eleito") == 1
    assert _eleito("n", "Eleito por QP") == 1
    assert _eleito("n", "Não eleito") == 0
    assert _eleito("s", None) == 1


def test_fase_muda_com_a_data_mesmo_sem_resultado_novo():
    # Depois do resultado final do 2º turno não chega nada novo do TSE, mas a fase ainda passa a "encerrada".
    from etl.apuracao_remota import _fase_hoje

    t1 = {"turno": 1, "cargo": "presidente", "linhas": [(1, "BR", "presidente", "1", "13", "A", 10, 45.0, "2º turno", 0, 1)]}
    t2 = {"turno": 2, "cargo": "presidente", "linhas": [(2, "BR", "presidente", "1", "13", "A", 10, 51.0, "Eleito", 1, 1)]}
    assert _fase_hoje([t1], date(2026, 10, 7)) == "pre-2turno"
    assert _fase_hoje([t1], date(2026, 10, 25)) == "apuracao-2turno"
    assert _fase_hoje([t1, t2], date(2026, 10, 25)) == "apuracao-2turno"
    assert _fase_hoje([t1, t2], date(2026, 10, 26)) == "encerrada"
