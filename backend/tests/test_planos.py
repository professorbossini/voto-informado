"""Busca nos planos de governo (etl.planos): PDFs sintéticos pequenos, sem rede."""

from __future__ import annotations

import json

import pytest

pytest.importorskip("pypdf")

from etl import planos as P  # noqa: E402


def _escapar(linha: str) -> bytes:
    return linha.encode("cp1252").replace(b"\\", b"\\\\").replace(b"(", b"\\(").replace(b")", b"\\)")


def pdf(*paginas: list[str]) -> bytes:
    """PDF mínimo e válido: uma lista de linhas por página (Helvetica, WinAnsi para os acentos)."""
    n = len(paginas)
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        f"<< /Type /Pages /Kids [{' '.join(f'{4 + 2 * i} 0 R' for i in range(n))}] /Count {n} >>".encode(),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    ]
    for i, linhas in enumerate(paginas):
        stream = b"BT /F1 12 Tf 72 720 Td 14 TL " + b" ".join(b"(" + _escapar(l) + b") '" for l in linhas) + b" ET"
        objs.append(f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents {5 + 2 * i} 0 R >>".encode())
        objs.append(b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
    out, offsets = b"%PDF-1.4\n", []
    for i, obj in enumerate(objs, 1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1) + b"".join(b"%010d 00000 n \n" % o for o in offsets)
    return out + b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)


def cartao(sq, nome, numero, *pdfs):
    return {"sq": sq, "nome_urna": nome, "partido": "PX", "numero": numero, "foto": f"/fotos/{sq}.jpg",
            "divulgacand": f"https://divulgacandcontas.tse.jus.br/x/{sq}", "propostas": list(pdfs), "cpf": "não deve sair"}


SEGUNDO_TURNO = {
    "disputas": [
        {"uf": "SP", "nome_uf": "São Paulo", "cargo": "governador", "candidatos": [cartao("2", "ZÉLIA", "40", "/propostas/2_01.pdf"), cartao("1", "ÁLVARO", "10", "/propostas/1_01.pdf")]},
        {"uf": "AC", "nome_uf": "Acre", "cargo": "governador", "candidatos": [cartao("3", "BETO", "20", "/propostas/3_01.pdf", "/propostas/3_02.pdf"), cartao("4", "ANA", "30")]},
        {"uf": "BR", "nome_uf": "Brasil", "cargo": "presidente", "candidatos": [cartao("5", "MARIA", "50", "/propostas/5_01.pdf")]},
    ]
}
PDFS = {
    "/propostas/1_01.pdf": pdf(["Plano de governo"], ["Mais escolas e educa-", "ção em tempo integral.", "Saúde   perto de casa."]),
    "/propostas/2_01.pdf": pdf(["Segurança pública e bem-estar."]),
    "/propostas/3_01.pdf": pdf([], []),  # só imagem: nenhuma letra
    "/propostas/3_02.pdf": pdf(["Transporte coletivo integrado em todas as cidades do estado."]),
    "/propostas/5_01.pdf": pdf(["Emprego e renda."]),
}


def test_normaliza_espacos_hifenizacao_e_ligaduras():
    assert P.normalizar("educa-\nção  em\n\ntempo") == "educação em tempo"
    assert P.normalizar("bem-estar e saú-\n de") == "bem-estar e saúde"
    assert P.normalizar("Saúde-\nSUS") == "Saúde- SUS"  # maiúscula depois do hífen: mantém
    assert P.normalizar("eﬁciência­ social\xa0já") == "eficiência social já"
    assert P.normalizar("Saúde ............ 21\nEducação . . . . . 30") == "Saúde … 21 Educação … 30"
    assert P.normalizar(None) == ""


def test_extrai_texto_por_pagina():
    paginas = P.extrair(PDFS["/propostas/1_01.pdf"])
    assert paginas == ["Plano de governo", "Mais escolas e educação em tempo integral. Saúde perto de casa."]
    assert not P.sem_texto(paginas)
    assert P.sem_texto(P.extrair(PDFS["/propostas/3_01.pdf"]))


def test_pdf_ilegivel_falha_com_aviso():
    with pytest.raises(P.FonteIndisponivel):
        P.extrair(b"<html>erro</html>")


def test_monta_disputas_em_ordem_neutra():
    arquivos = P.montar(SEGUNDO_TURNO, PDFS.__getitem__)
    assert sorted(arquivos) == ["ac-governador.json", "br-presidente.json", "indice.json", "sp-governador.json"]
    # Presidente primeiro, depois os estados pelo nome.
    assert [d["arquivo"] for d in arquivos["indice.json"]["disputas"]] == ["br-presidente.json", "ac-governador.json", "sp-governador.json"]
    sp = arquivos["sp-governador.json"]
    # Ordem alfabética do nome de urna, ignorando acento.
    assert [c["nome_urna"] for c in sp["candidatos"]] == ["ÁLVARO", "ZÉLIA"]
    alvaro = sp["candidatos"][0]
    assert alvaro["documentos"][0]["pdf"] == "/propostas/1_01.pdf"
    assert alvaro["documentos"][0]["paginas"][1].startswith("Mais escolas e educação")
    assert "cpf" not in json.dumps(arquivos)
    ac = arquivos["ac-governador.json"]
    assert [c["nome_urna"] for c in ac["candidatos"]] == ["ANA", "BETO"]
    assert ac["candidatos"][0]["documentos"] == []  # sem plano publicado
    assert [d["sem_texto"] for d in ac["candidatos"][1]["documentos"]] == [True, False]
    assert ac["fonte"]["orgao"].startswith("Tribunal Superior Eleitoral")


def test_grava_so_quando_muda_e_apaga_disputa_encerrada(tmp_path):
    raiz = tmp_path / "api" / "planos"
    arquivos = P.montar(SEGUNDO_TURNO, PDFS.__getitem__)
    assert P.gravar(raiz, arquivos, "2026-10-08T05:00:00-03:00") == {"gravados": 4, "apagados": 0}
    # Mesma coleta no dia seguinte: nada muda (nem a data).
    assert P.gravar(raiz, arquivos, "2026-10-09T05:00:00-03:00") == {"gravados": 0, "apagados": 0}
    assert json.loads((raiz / "indice.json").read_text())["gerado_em"] == "2026-10-08T05:00:00-03:00"
    menos = {**SEGUNDO_TURNO, "disputas": SEGUNDO_TURNO["disputas"][1:]}
    r = P.gravar(raiz, P.montar(menos, PDFS.__getitem__), "2026-10-10T05:00:00-03:00")
    assert r == {"gravados": 1, "apagados": 1}  # índice novo; SP removido
    assert not (raiz / "sp-governador.json").exists()


def test_le_pdf_do_checkout_antes_de_baixar(tmp_path, monkeypatch):
    (tmp_path / "propostas").mkdir()
    (tmp_path / "propostas" / "1_01.pdf").write_bytes(PDFS["/propostas/1_01.pdf"])

    def sem_rede(*a, **k):
        raise AssertionError("não deveria baixar")

    monkeypatch.setattr(P.requests, "get", sem_rede)
    assert P.leitor_de_pdfs(tmp_path)("/propostas/1_01.pdf") == PDFS["/propostas/1_01.pdf"]


def test_run_completo(tmp_path, monkeypatch):
    (tmp_path / "api").mkdir()
    (tmp_path / "api" / "segundo-turno.json").write_text(json.dumps(SEGUNDO_TURNO), encoding="utf-8")
    monkeypatch.setattr(P, "leitor_de_pdfs", lambda site: PDFS.__getitem__)
    assert P.run(tmp_path) is True
    assert P.run(tmp_path) is False
    with pytest.raises(P.FonteIndisponivel):
        P.run(tmp_path / "vazio")
