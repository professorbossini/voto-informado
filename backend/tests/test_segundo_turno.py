"""Second-round mode, exercised on an in-memory copy of the DB with synthetic results.

The real database is never modified: fake rows exist only inside this test.
"""

from __future__ import annotations

import sqlite3
from datetime import date

import pytest

from app import queries as q
from etl.common import DB_PATH

pytestmark = pytest.mark.skipif(not DB_PATH.exists(), reason="banco não gerado")


@pytest.fixture()
def mem():
    src = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn = sqlite3.connect(":memory:")
    src.backup(conn)
    src.close()
    conn.row_factory = sqlite3.Row
    yield conn
    conn.close()


def _presidentes(conn, n=3):
    return [r["sq"] for r in conn.execute("SELECT sq FROM candidatos WHERE cargo='presidente' AND na_urna=1 ORDER BY nome_urna LIMIT ?", (n,))]


def test_sem_apuracao_fase_pre_eleicao(mem):
    mem.execute("DELETE FROM resultados")
    mem.execute("DELETE FROM resultados_status")
    assert q.fase(mem, hoje=date(2026, 10, 1)) == "pre-1turno"
    assert q.segundo_turno(mem)["disputas"] == []


def test_finalistas_aparecem_quando_tse_publica(mem):
    a, b, c = _presidentes(mem)
    mem.execute("DELETE FROM resultados")
    mem.execute("DELETE FROM resultados_status")
    mem.executemany(
        "INSERT INTO resultados VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [
            (1, "BR", "presidente", a, "1", "A", 100.0, 45.0, "2º turno", 0, 1),
            (1, "BR", "presidente", b, "2", "B", 90.0, 40.0, "2º turno", 0, 2),
            (1, "BR", "presidente", c, "3", "C", 30.0, 15.0, "Não eleito", 0, 3),
        ],
    )
    mem.execute("INSERT OR REPLACE INTO resultados_status VALUES (1,'BR','presidente',100.0,'04/10/2026 21:00','x')")
    assert q.fase(mem, hoje=date(2026, 10, 5)) == "pre-2turno"
    st = q.segundo_turno(mem)
    assert len(st["disputas"]) == 1
    finalistas = {x["sq"] for x in st["disputas"][0]["candidatos"]}
    assert finalistas == {a, b}
    assert all(x["resultados"][0]["pct"] in (45.0, 40.0) for x in st["disputas"][0]["candidatos"])
    res = q.resultados(mem)
    assert res["disputas"][0]["candidatos"][0]["sq"] == a  # ordered by votes, as published
