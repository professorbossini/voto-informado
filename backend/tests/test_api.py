"""Integration checks against the built database (run `make dados` first)."""

from __future__ import annotations

import json
import re
import sqlite3

import pytest
from fastapi.testclient import TestClient

from app import queries as q
from app.main import app
from etl.common import DB_PATH
from etl.resultados import _num, candidatos, url_for

pytestmark = pytest.mark.skipif(not DB_PATH.exists(), reason="banco não gerado")


@pytest.fixture(scope="module")
def conn():
    c = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    c.row_factory = sqlite3.Row
    yield c
    c.close()


@pytest.fixture(scope="module")
def client():
    return TestClient(app)


def test_cpf_e_titulo_nunca_sao_expostos(conn, client):
    """CPF and voter-ID numbers are internal (matching only): no endpoint may return them."""
    cpfs = {r[0] for r in conn.execute("SELECT cpf FROM candidatos WHERE cpf IS NOT NULL AND cargo='presidente'")}
    titulos: set[str] = set()  # título de eleitor não é nem armazenado
    assert cpfs
    sq = conn.execute("SELECT sq FROM candidatos WHERE cargo='presidente' AND na_urna=1 LIMIT 1").fetchone()[0]
    for path in ["/api/presidente.json", f"/api/candidato/{sq}.json", "/api/busca.json", "/api/uf/SP.json", "/api/uf/SP/deputados.json"]:
        body = client.get(path).text
        assert '"cpf"' not in body and '"titulo"' not in body, path
        for secret in cpfs | titulos:
            assert secret not in body, path


def test_cpf_de_pessoa_fisica_mascarado_nos_fornecedores(conn):
    rows = conn.execute("SELECT cnpj_cpf FROM ceap_fornecedor WHERE cnpj_cpf IS NOT NULL").fetchall()
    for (doc,) in rows:
        digits = re.sub(r"\D", "", doc)
        assert len(digits) in (6, 14), doc  # CNPJ completo ou CPF mascarado (***.XXX.XXX-**)


def test_toda_fonte_citada_existe_no_catalogo(conn, client):
    catalogo = {f["chave"] for f in q.fontes(conn)}
    sq = conn.execute("SELECT sq FROM candidatos WHERE cargo='governador' AND na_urna=1 LIMIT 1").fetchone()[0]
    pid = conn.execute("SELECT id FROM parlamentares LIMIT 1").fetchone()[0]
    for path in ["/api/presidente.json", "/api/uf/MG.json", "/api/uf/MG/deputados.json", f"/api/candidato/{sq}.json",
                 "/api/estatisticas.json", "/api/parlamentares.json", f"/api/parlamentar/{q.pub_id(pid)}.json"]:
        citadas = client.get(path).json()["fontes"]
        assert citadas and set(citadas) <= catalogo, (path, set(citadas) - catalogo)
    for f in q.fontes(conn):
        assert f["url"].startswith("https://") and f["orgao"]


def test_listas_em_ordem_alfabetica(client):
    for path, key in [("/api/presidente.json", "candidatos"), ("/api/uf/BA.json", "governador"), ("/api/uf/SP/deputados.json", "candidatos")]:
        nomes = [c["nome_urna"] for c in client.get(path).json()[key]]
        assert nomes == sorted(nomes, key=q.alpha_key), path  # ignora acentos: "Á" fica junto do "A"


def test_mesmos_campos_para_todos(client):
    cands = client.get("/api/uf/RJ.json").json()["governador"]
    chaves = {frozenset(c.keys()) for c in cands}
    assert len(chaves) == 1


def test_404_para_inexistentes(client):
    assert client.get("/api/candidato/000.json").status_code == 404
    assert client.get("/api/uf/XX.json").status_code == 404
    assert client.get("/api/parlamentar/camara-0.json").status_code == 404


def test_chapa_ligada_ao_titular_na_urna(conn):
    """Vices/suplentes on the ballot point to a titular that is also on the ballot."""
    bad = conn.execute(
        """SELECT v.nome_urna FROM candidatos v JOIN candidatos t ON t.sq = v.titular_sq
           WHERE v.na_urna = 1 AND t.na_urna = 0"""
    ).fetchall()
    assert not bad


def test_resultados_parse():
    assert _num("48,43") == pytest.approx(48.43)
    assert _num("60345999") == 60345999
    assert _num("") is None
    assert url_for("6257", "br", "presidente").endswith("/6257/dados/br/br-c0001-e006257-u.json")
    assert url_for("6259", "df", "deputado-distrital").endswith("/6259/dados/df/df-c0008-e006259-u.json")


def test_resultados_unificado_ordem_por_votos():
    """O 'seq' do TSE repete a ordem nacional nos arquivos por UF; a posição vem dos votos."""
    data = {"carg": [{"agr": [
        {"par": [{"sg": "AA", "cand": [{"sqcand": "1", "n": "11", "nm": "A", "seq": "1", "vap": "100", "pvap": "30,0"}]}]},
        {"par": [{"sg": "BB", "cand": [{"sqcand": "2", "n": "22", "nm": "B", "seq": "2", "vap": "250", "pvap": "70,0"}]}]},
    ]}]}
    cands = candidatos(data)
    assert [c["_partido"] for c in cands] == ["AA", "BB"]
    ordem = sorted(cands, key=lambda c: (-(_num(c.get("vap")) or 0), int(c.get("seq") or 0)))
    assert ordem[0]["sqcand"] == "2"


def test_export_paths_match_routes(client):
    """Every static path written by app.export is also served by the API."""
    for path in ["meta.json", "presidente.json", "busca.json", "partidos.json", "estatisticas.json",
                 "parlamentares.json", "resultados.json", "segundo-turno.json", "uf/AC.json", "uf/AC/deputados.json"]:
        r = client.get(f"/api/{path}")
        assert r.status_code == 200, path
        json.loads(r.text)


def test_descricoes_de_bens_sem_cpf_de_terceiros(conn):
    rows = conn.execute("SELECT descricao FROM bens WHERE descricao LIKE '%CPF%'").fetchall()
    for (d,) in rows:
        assert not re.search(r"\d{3}\.\d{3}\.\d{3}-\d{2}", d), d


def test_um_unico_candidato_por_numero_na_urna(conn):
    dups = conn.execute(
        "SELECT uf, cargo, numero, COUNT(*) n FROM candidatos WHERE na_urna=1 AND cargo NOT IN ('vice-presidente','vice-governador','1-suplente','2-suplente') GROUP BY 1,2,3 HAVING n > 1"
    ).fetchall()
    assert not dups, [tuple(d) for d in dups]
