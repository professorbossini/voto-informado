"""The poll loader must refuse anything that is not complete, registered and consistent."""

from __future__ import annotations

import copy
import sqlite3

import pytest

from etl.common import DB_PATH
from etl.pesquisas import validar

pytestmark = pytest.mark.skipif(not DB_PATH.exists(), reason="banco não gerado")

BASE = {
    "id": "teste-1", "cargo": "presidente", "turno": 1, "cenario": "estimulado", "abrangencia": "BR",
    "instituto": "Instituto Teste", "contratante": "Contratante Teste", "registro_tse": "BR-01234/2026",
    "campo_inicio": "2026-09-25", "campo_fim": "2026-09-27", "divulgacao": "2026-09-28",
    "entrevistas": 2000, "margem_erro_pp": 2.0, "confianca_pct": 95,
    "resultados": [{"nome": "Lula", "pct": 40.0}, {"nome": "Zema", "pct": 50.0}],
    "outros": [{"rotulo": "Brancos/nulos", "pct": 10.0}],
    "fontes": [{"titulo": "Divulgação", "url": "https://exemplo.org/p", "tipo": "instituto"}],
}


@pytest.fixture(scope="module")
def conn():
    c = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    yield c
    c.close()


def _com(**mudancas):
    p = copy.deepcopy(BASE)
    p.update(mudancas)
    return p


def test_pesquisa_completa_passa(conn):
    assert validar(conn, [BASE]) == []


@pytest.mark.parametrize(
    "mudanca, trecho",
    [
        ({"registro_tse": "1234/2026"}, "registro"),
        ({"contratante": ""}, "obrigatórios"),
        ({"campo_fim": "2026-09-30"}, "datas"),
        ({"resultados": [{"nome": "Lula", "pct": 40.0}]}, "soma"),
        ({"resultados": [{"nome": "Fulano Inexistente", "pct": 90.0}]}, "não corresponde"),
        ({"fontes": [{"titulo": "x", "url": "http://inseguro"}]}, "https"),
        ({"margem_erro_pp": 25}, "implausíveis"),
    ],
)
def test_pesquisa_invalida_e_recusada(conn, mudanca, trecho):
    erros = validar(conn, [_com(**mudanca)])
    assert any(trecho in e for e in erros), erros
