"""Finanças de campanha atualizadas in-place no site (etl.contas), com amostras pequenas e sem rede."""

from __future__ import annotations

import io
import json
import zipfile
from datetime import datetime
from pathlib import Path

import pandas as pd
import pytest

from app import queries as q
from etl import contas, tse
from etl.contas import BRT, MARCA, Financas, aplicar, atualizar, mesma_versao

AGORA = datetime(2026, 10, 12, 6, 41, tzinfo=BRT)
GERADO = "2026-10-06T07:34:12+00:00"

REC_COLS = ["SQ_CANDIDATO", "SQ_RECEITA", "DS_FONTE_RECEITA", "DS_ORIGEM_RECEITA", "NR_CPF_CNPJ_DOADOR", "NM_DOADOR", "NM_DOADOR_RFB", "VR_RECEITA"]
RECEITAS = [
    # sq, id, fonte, origem, documento, nome, nome RFB, valor
    ("A", "1", "FUNDO ESPECIAL", "Recursos de partido político", "12345678000199", "DIRETORIO", "DIRETORIO NACIONAL", "1.000,00"),
    ("A", "2", "OUTROS RECURSOS", "Recursos de pessoas físicas", "12345678901", "MARIA", "MARIA DA SILVA", "250,50"),
    ("A", "2", "OUTROS RECURSOS", "Recursos de pessoas físicas", "12345678901", "MARIA", "MARIA DA SILVA", "250,50"),  # repetida
    ("A", "3", "OUTROS RECURSOS", "Recursos de outros candidatos", "98765432000155", "CAND B", "#NULO", "100,00"),
    ("A", "4", "#NULO", "#NULO", "#NULO", "#NULO", "#NULO", "0,00"),  # linha-modelo vazia
    ("B", "5", "FUNDO PARTIDARIO", "Recursos de partido político", "12345678000199", "DIRETORIO", "DIRETORIO ESTADUAL", "40,00"),
    ("Z", "6", "OUTROS RECURSOS", "Recursos próprios", "11122233344", "FULANO", "FULANO", "5,00"),  # fora do site
]
DESPESAS = [
    # SQ_CANDIDATO, SQ_DESPESA, DS_ORIGEM_DESPESA, DS_DESPESA, NR_DOCUMENTO, NM_FORNECEDOR, NM_FORNECEDOR_RFB, VR_DESPESA_CONTRATADA
    ("A", "10", "Publicidade por materiais impressos", "santinhos", "11", "GRAFICA", "GRAFICA LTDA", "300,00"),
    ("A", "11", "Serviços prestados por terceiros", "motorista", "12", "JOAO", "JOAO SOUZA 12345678901", "200,00"),
    ("A", "12", "#NULO", "#NULO", "#NULO", "#NULO", "#NULO", "0,00"),
    ("B", "13", "Publicidade por materiais impressos", "adesivos", "13", "GRAFICA", "#NULO", "15,00"),
]


def _rec() -> pd.DataFrame:
    return pd.DataFrame(RECEITAS, columns=REC_COLS)


def _desp() -> pd.DataFrame:
    return pd.DataFrame(DESPESAS, columns=tse.DESPESAS_COLS)


def _tabelas():
    d = _desp()
    # Em dois blocos, com a mesma linha nos dois: a repetição entre blocos também conta uma vez.
    return tse.calcular_financas(_rec(), [d.iloc[:2], d.iloc[1:]], log=lambda *_: None)


# ── Função pura compartilhada com o build local ───────────────────────────────


def test_calcular_financas_totais_e_limpeza():
    t = _tabelas()
    tot = t["fin_totais"].set_index("sq")
    assert tot.loc["A", "receitas"] == pytest.approx(1350.50)  # repetida e linha-modelo fora
    assert tot.loc["A", "despesas"] == pytest.approx(500.00)
    assert tot.loc["B", "receitas"] == pytest.approx(40.0) and tot.loc["B", "despesas"] == pytest.approx(15.0)
    agregado = t["fin_receita_fonte_agregado"].query("sq == 'A'").set_index("fonte").valor
    assert agregado["OUTROS RECURSOS"] == pytest.approx(250.50)  # sem o repasse de outro candidato
    doadores = t["fin_doadores"].query("sq == 'A'").set_index("doador")
    assert doadores.loc["MARIA DA SILVA", "tipo"] == "Pessoa física"
    assert doadores.loc["DIRETORIO NACIONAL", "tipo"] == "Pessoa jurídica / partido / candidato"
    assert "CAND B" in doadores.index  # sem nome RFB, usa o nome declarado


def test_documentos_nao_saem_das_tabelas():
    t = _tabelas()
    texto = " ".join(frame.astype(str).to_csv() for frame in t.values())
    for doc in ("12345678901", "12345678000199", "98765432000155", "11122233344"):
        assert doc not in texto
    assert "JOAO SOUZA ***.***.***-**" in set(t["fin_fornecedores"].fornecedor)
    assert tse.mask_doc_nome("ANA 123.456.789-01") == "ANA ***.***.***-**"
    assert tse.mask_doc_nome("EMPRESA 12345678000199 LTDA") == "EMPRESA 12345678000199 LTDA"  # CNPJ, 14 dígitos


def test_top10_por_candidatura():
    linhas = [("A", str(i), "OUTROS RECURSOS", "Recursos de pessoas físicas", "12345678901", f"P{i:02d}", f"P{i:02d}", f"{i},00") for i in range(1, 15)]
    t = tse.calcular_financas(pd.DataFrame(linhas, columns=REC_COLS), [_desp()], log=lambda *_: None)
    top = t["fin_doadores"].query("sq == 'A'")
    assert len(top) == 10 and top.valor.min() == 5.0


def _zip_tse(path: Path) -> Path:
    def csv(cols, rows) -> bytes:
        buf = io.StringIO()
        pd.DataFrame(rows, columns=cols).to_csv(buf, sep=";", index=False, quoting=1)
        return buf.getvalue().encode("latin1")

    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr(zipfile.ZipInfo("receitas_candidatos_2026_BRASIL.csv", (2026, 10, 6, 7, 29, 0)), csv(REC_COLS, RECEITAS))
        zf.writestr(zipfile.ZipInfo("receitas_candidatos_doador_originario_2026_BRASIL.csv", (2026, 10, 6, 7, 38, 0)), csv(REC_COLS, RECEITAS[:1]))
        zf.writestr(zipfile.ZipInfo("despesas_contratadas_candidatos_2026_BRASIL.csv", (2026, 10, 6, 7, 34, 12)), csv(tse.DESPESAS_COLS, DESPESAS))
    return path


def test_financas_do_zip(tmp_path):
    tabelas, gerado = tse.financas_do_zip(zipfile.ZipFile(_zip_tse(tmp_path / "p.zip")), log=lambda *_: None)
    assert gerado == GERADO  # horário do arquivo de despesas, em UTC
    assert tabelas["fin_totais"].set_index("sq").loc["A", "receitas"] == pytest.approx(1350.50)


# ── Custo por voto ────────────────────────────────────────────────────────────


def test_custo_por_voto():
    eleito = {"receitas": 1000.0, "resultados": [{"turno": 1, "votos": 400.0, "eleito": 1}]}
    assert q.custo_por_voto(eleito) == {"valor": 2.5, "receitas": 1000.0, "votos": 400, "turno": 1}
    segundo = {"receitas": 900.0, "resultados": [{"turno": 1, "votos": 100.0, "eleito": 0}, {"turno": 2, "votos": 300.0, "eleito": 1}]}
    assert q.custo_por_voto(segundo)["turno"] == 2 and q.custo_por_voto(segundo)["valor"] == 3.0
    assert q.custo_por_voto({"receitas": 900.0, "resultados": [{"turno": 1, "votos": 100.0, "eleito": 0}]}) is None
    assert q.custo_por_voto({"receitas": None, "resultados": eleito["resultados"]}) is None
    assert q.custo_por_voto({"receitas": 0.0, "resultados": eleito["resultados"]}) is None
    assert q.custo_por_voto({"receitas": 10.0, "resultados": []}) is None


# ── Atualização in-place do site ──────────────────────────────────────────────


def _w(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _r(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


VAZIO = {"receitas_por_origem": [], "receitas_por_fonte": [], "maiores_doadores": [], "despesas_por_categoria": [], "maiores_fornecedores": []}


def _site(tmp_path: Path) -> Path:
    site = tmp_path / "site"
    api = site / "api"
    perfis = {
        "A": {"sq": "A", "uf": "SP", "cargo": "governador", "nome_urna": "CAND A", "receitas": 1.0, "despesas": 1.0, "financas": VAZIO,
              "resultados": [{"turno": 1, "votos": 500.0, "pct": 50.1, "situacao": "Eleito", "eleito": 1}], "fontes": ["tse_prestacao"]},
        "B": {"sq": "B", "uf": "SP", "cargo": "deputado-federal", "nome_urna": "CAND B", "receitas": None, "despesas": None, "financas": VAZIO,
              "resultados": [{"turno": 1, "votos": 10.0, "pct": 0.1, "situacao": "Suplente", "eleito": 0}], "fontes": []},
        "C": {"sq": "C", "uf": "SP", "cargo": "vice-governador", "nome_urna": "VICE", "receitas": 3.0, "despesas": 3.0, "financas": VAZIO, "resultados": [], "fontes": []},
    }
    for sq, c in perfis.items():
        _w(api / "candidato" / f"{sq}.json", c)
    _w(api / "busca.json", [["A", "CAND A", "A", "10", "SP", "governador", "P"], ["B", "CAND B", "B", "1010", "SP", "deputado-federal", "P"]])
    _w(api / "presidente.json", {"uf": "BR", "candidatos": [], "fontes": []})
    _w(api / "uf" / "SP.json", {"uf": "SP", "governador": [{"sq": "A", "receitas": 1.0, "despesas": 1.0, "companheiros": []}], "senador": []})
    _w(api / "uf" / "SP" / "deputados.json", {"uf": "SP", "candidatos": [{"sq": "B", "receitas": None, "despesas": None}]})
    _w(api / "segundo-turno.json", {"fase": "pre-2turno", "disputas": [{"uf": "SP", "cargo": "governador", "candidatos": [dict(perfis["A"])]}]})
    _w(api / "estatisticas.json", {"genero": {}, "receitas_por_fonte": {}})
    _w(api / "meta.json", {"atualizacao": {"prestacao_gerada_em": "2026-10-02T07:24:22+00:00"},
                           "fontes": [{"chave": "tse_prestacao", "publicado_em": "x", "coletado_em": "y"}, {"chave": "outra"}]})
    return site


def test_aplicar_in_place(tmp_path):
    site = _site(tmp_path)
    api = site / "api"
    n = aplicar(site, Financas(_tabelas(), GERADO), agora=AGORA, publicado_em="2026-10-06T05:59:33-03:00")
    assert n["perfis"] == 3 and n["perfis_alterados"] == 3 and n["eleitos_com_custo"] == 1

    a = _r(api / "candidato" / "A.json")
    assert a["receitas"] == pytest.approx(1350.50) and a["despesas"] == pytest.approx(500.0)
    assert a["contas_atualizadas_em"] == GERADO
    assert a["custo_por_voto"] == {"valor": 2.7, "receitas": 1350.5, "votos": 500, "turno": 1}
    assert [r["fonte"] for r in a["financas"]["receitas_por_fonte"]] == ["FUNDO ESPECIAL", "OUTROS RECURSOS"]  # valor DESC
    assert a["financas"]["maiores_fornecedores"][0] == {"fornecedor": "GRAFICA LTDA", "valor": 300.0}
    assert a["resultados"][0]["votos"] == 500.0 and a["nome_urna"] == "CAND A"  # o resto do perfil fica igual
    assert list(a)[:4] == ["sq", "uf", "cargo", "nome_urna"]  # ordem das chaves preservada

    b = _r(api / "candidato" / "B.json")
    assert b["receitas"] == pytest.approx(40.0) and b["custo_por_voto"] is None  # não eleito
    c = _r(api / "candidato" / "C.json")
    assert c["receitas"] is None and c["financas"] == VAZIO  # sem movimentação no arquivo: como o LEFT JOIN do export

    assert _r(api / "uf" / "SP.json")["governador"][0]["receitas"] == pytest.approx(1350.50)
    assert _r(api / "uf" / "SP" / "deputados.json")["candidatos"][0] == {"sq": "B", "receitas": 40.0, "despesas": 15.0}
    st = _r(api / "segundo-turno.json")["disputas"][0]["candidatos"][0]
    assert st["custo_por_voto"]["valor"] == 2.7 and st["financas"] == a["financas"]
    est = _r(api / "estatisticas.json")["receitas_por_fonte"]
    assert est["governador"] == {"FUNDO ESPECIAL": 1000.0, "OUTROS RECURSOS": 250.5}  # sem repasse de candidato
    assert est["deputado-federal"] == {"FUNDO PARTIDARIO": 40.0}
    meta = _r(api / "meta.json")
    assert meta["atualizacao"]["prestacao_gerada_em"] == GERADO
    assert meta["fontes"][0] == {"chave": "tse_prestacao", "publicado_em": "2026-10-06T05:59:33-03:00", "coletado_em": AGORA.isoformat()}

    # Idempotente: a mesma versão aplicada de novo não muda nenhum arquivo.
    n2 = aplicar(site, Financas(_tabelas(), GERADO), agora=AGORA, publicado_em="2026-10-06T05:59:33-03:00")
    assert n2["perfis_alterados"] == 0 and n2["agregados_alterados"] == 0


def test_estatisticas_mantidas_com_amostra(tmp_path):
    site = _site(tmp_path)
    (site / "api" / "candidato" / "B.json").unlink()  # perfil listado na busca e ausente na pasta
    aplicar(site, Financas(_tabelas(), GERADO), agora=AGORA)
    assert _r(site / "api" / "estatisticas.json")["receitas_por_fonte"] == {}


def test_mesma_versao():
    v = {"etag": '"abc"', "last_modified": "Tue, 06 Oct 2026 08:59:33 GMT", "bytes": 10}
    assert mesma_versao(v, dict(v))
    assert not mesma_versao(v, {**v, "etag": '"outro"'})
    assert not mesma_versao(v, None)
    sem_etag = {**v, "etag": None}
    assert mesma_versao(sem_etag, dict(sem_etag)) and not mesma_versao(sem_etag, {**sem_etag, "bytes": 11})


def test_atualizar_sem_mudanca_no_tse_nao_baixa(tmp_path, monkeypatch):
    site = _site(tmp_path)
    marca = {"url": contas.URL, "etag": '"abc"', "last_modified": "Tue, 06 Oct 2026 08:59:33 GMT", "bytes": 10}
    _w(site / "api" / MARCA, {**marca, "campanhas": 2})
    monkeypatch.setattr(contas, "marca_remota", lambda: dict(marca))
    monkeypatch.setattr(contas, "baixar", lambda *_: pytest.fail("não devia baixar"))
    antes = (site / "api" / "candidato" / "A.json").read_text()
    assert atualizar(site, agora=AGORA) is False
    assert (site / "api" / "candidato" / "A.json").read_text() == antes


def test_atualizar_com_zip_grava_marca(tmp_path):
    site = _site(tmp_path)
    assert atualizar(site, zip_path=_zip_tse(tmp_path / "p.zip"), agora=AGORA) is True
    m = _r(site / "api" / MARCA)
    assert m["gerado_em"] == GERADO and m["campanhas"] == 3 and m["perfis"] == 3 and m["eleitos_com_custo"] == 1
    assert _r(site / "api" / "candidato" / "A.json")["contas_atualizadas_em"] == GERADO


def test_atualizar_recusa_arquivo_encolhido(tmp_path):
    site = _site(tmp_path)
    _w(site / "api" / MARCA, {"etag": None, "campanhas": 1000})
    antes = (site / "api" / "candidato" / "A.json").read_text()
    with pytest.raises(SystemExit):
        atualizar(site, zip_path=_zip_tse(tmp_path / "p.zip"), agora=AGORA)
    assert (site / "api" / "candidato" / "A.json").read_text() == antes
