"""Plenário (etl.plenario): composição, presidência e símbolos, com as fontes simuladas."""

from __future__ import annotations

import json

import pytest

from etl import plenario as P


def _deputados(n: int) -> list[dict]:
    partidos = ["PT", "PL", "UNIÃO", "PSD"]
    return [{"id": i, "nome": f"Deputado {i:03d}", "siglaPartido": partidos[i % 4], "siglaUf": "SP", "urlFoto": None} for i in range(n)]


def _senadores(n: int) -> dict:
    lista = [
        {"IdentificacaoParlamentar": {"CodigoParlamentar": str(1000 + i), "NomeParlamentar": f"Senador {i:02d}", "SiglaPartidoParlamentar": ["PT", "PL", "MDB"][i % 3], "UfParlamentar": "RJ"}}
        for i in range(n)
    ]
    return {"ListaParlamentarEmExercicio": {"Parlamentares": {"Parlamentar": lista}}}


MESA_SF = {
    "MesaSenado": {
        "Colegiados": {
            "Colegiado": [
                {"Cargos": {"Cargo": [{"Cargo": ["1º VICE-PRESIDENTE"], "NomeParlamentar": "Senador X", "Bancada": "(PL-TO)", "Http": "1001"}, {"Cargo": ["PRESIDENTE"], "NomeParlamentar": "Senadora Senador 02", "Bancada": "(MDB-RJ)", "Http": "1002"}]}}
            ]
        }
    }
}


@pytest.fixture()
def site(tmp_path):
    (tmp_path / "api").mkdir()
    (tmp_path / "index.html").write_text("<html><head><title>x</title></head><body></body></html>", encoding="utf-8")
    pub = {"parlamentares": [{"id": "camara-1", "casa": "camara", "nome": "Deputado 001", "partido": "PL", "uf": "SP", "em_exercicio": True}]}
    (tmp_path / "api" / "parlamentares.json").write_text(json.dumps(pub), encoding="utf-8")
    (tmp_path / "api" / "partidos.json").write_text(json.dumps([{"partido": "MDB", "partido_nome": "MOVIMENTO DEMOCRÁTICO BRASILEIRO"}]), encoding="utf-8")
    return tmp_path


def _fontes(monkeypatch, camara_no_ar=True):
    def fake_get(url, params=None, **_):
        if "camara" in url and not camara_no_ar:
            raise RuntimeError("fora do ar")
        if url.endswith("/legislaturas"):
            return {"dados": [{"id": 57}]}
        if url.endswith("/deputados"):
            return {"dados": _deputados(513), "links": []}
        if url.endswith("/legislaturas/57/mesa"):
            return {"dados": [
                {"id": 7, "nome": "Antigo", "siglaPartido": "PT", "siglaUf": "BA", "titulo": "Presidente", "dataInicio": "2023-02-01", "dataFim": "2025-02-01"},
                {"id": 1, "nome": "Deputado 001", "siglaPartido": "PL", "siglaUf": "SP", "titulo": "Presidente", "dataInicio": "2025-02-01", "dataFim": None},
                {"id": 2, "nome": "Vice", "siglaPartido": "PT", "siglaUf": "SP", "titulo": "1º Vice-Presidente", "dataInicio": "2025-02-01", "dataFim": None},
            ]}
        if url.endswith("/partidos"):
            return {"dados": [{"id": 1, "sigla": "PT", "nome": "Partido dos Trabalhadores"}], "links": []}
        if "/partidos/" in url:
            return {"dados": {"nome": "Partido dos Trabalhadores", "urlLogo": None}}
        if url.endswith("/senador/lista/atual.json"):
            return _senadores(81)
        if url.endswith("/composicao/mesaSF.json"):
            return MESA_SF
        if url.endswith("/senador/1002/cargos.json"):
            return {"CargoParlamentar": {"Parlamentar": {"Cargos": {"Cargo": [
                {"IdentificacaoComissao": {"SiglaComissao": "CDIR"}, "DescricaoCargo": "PRESIDENTE", "DataInicio": "2019-02-02", "DataFim": "2021-02-01"},
                {"IdentificacaoComissao": {"SiglaComissao": "CCJ"}, "DescricaoCargo": "PRESIDENTE", "DataInicio": "2025-03-01"},
                {"IdentificacaoComissao": {"SiglaComissao": "CDIR"}, "DescricaoCargo": "PRESIDENTE", "DataInicio": "2025-02-01"},
            ]}}}}
        raise AssertionError(url)

    monkeypatch.setattr(P, "_get", fake_get)


def test_composicao_e_presidencia(site, monkeypatch):
    _fontes(monkeypatch)
    assert P.montar(site) is True
    d = json.loads((site / "api" / "plenario.json").read_text(encoding="utf-8"))
    assert len(d["camara"]["membros"]) == 513
    assert d["camara"]["presidente"]["nome"] == "Deputado 001"  # o mandato atual, não o encerrado
    assert d["camara"]["presidente"]["perfil"] is True
    assert (d["camara"]["presidente"]["desde"], d["camara"]["presidente"]["ate"]) == ("2025-02-01", None)
    assert (d["senado"]["presidente"]["desde"], d["senado"]["presidente"]["ate"]) == ("2025-02-01", None)
    assert len(d["senado"]["membros"]) == 81
    assert d["senado"]["presidente"] == {**d["senado"]["presidente"], "id": "senado-1002", "nome": "Senador 02", "partido": "MDB", "uf": "RJ"}
    assert d["partidos"]["MDB"]["nome"] == "MOVIMENTO DEMOCRÁTICO BRASILEIRO"  # nome do TSE como reserva
    assert (site / "plenario" / "index.html").exists()
    # Mesma composição: nada a publicar (a hora da coleta não conta).
    assert P.montar(site) is False


def test_camara_fora_do_ar_mantem_ultimo_dado(site, monkeypatch):
    _fontes(monkeypatch)
    P.montar(site)
    _fontes(monkeypatch, camara_no_ar=False)
    assert P.montar(site) is False
    d = json.loads((site / "api" / "plenario.json").read_text(encoding="utf-8"))
    assert len(d["camara"]["membros"]) == 513 and d["camara"]["presidente"]["nome"] == "Deputado 001"


def test_primeira_vez_sem_camara_usa_parlamentares_publicados(site, monkeypatch):
    _fontes(monkeypatch, camara_no_ar=False)
    assert P.montar(site) is True
    d = json.loads((site / "api" / "plenario.json").read_text(encoding="utf-8"))
    assert [m["nome"] for m in d["camara"]["membros"]] == ["Deputado 001"]
    assert d["camara"]["presidente"] is None


def test_lista_incompleta_nao_substitui(site, monkeypatch):
    _fontes(monkeypatch)
    P.montar(site)
    monkeypatch.setattr(P, "_paginado", lambda url, params: _deputados(10) if url.endswith("/deputados") else [])
    P.montar(site)
    d = json.loads((site / "api" / "plenario.json").read_text(encoding="utf-8"))
    assert len(d["camara"]["membros"]) == 513
