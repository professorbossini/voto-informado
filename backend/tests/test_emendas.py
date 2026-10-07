"""Emendas parlamentares (etl.emendas): amostra pequena no formato da CGU, sem rede."""

from __future__ import annotations

import csv
import io
import json
import zipfile

import pytest

from etl import emendas as E

COLS_EMENDAS = [
    "Código da Emenda", "Ano da Emenda", "Tipo de Emenda", "Código do Autor da Emenda", "Nome do Autor da Emenda", "Número da emenda",
    "Localidade de aplicação do recurso", "Código Município IBGE", "Município", "Código UF IBGE", "UF", "Região", "Código Função", "Nome Função",
    "Código Subfunção", "Nome Subfunção", "Código Programa", "Nome Programa", "Código Ação", "Nome Ação", "Código Plano Orçamentário",
    "Nome Plano Orçamentário", "Valor Empenhado", "Valor Liquidado", "Valor Pago", "Valor Restos A Pagar Inscritos",
    "Valor Restos A Pagar Cancelados", "Valor Restos A Pagar Pagos",
]
COLS_FAV = [
    "Código da Emenda", "Código do Autor da Emenda", "Nome do Autor da Emenda", "Número da emenda", "Tipo de Emenda", "Ano/Mês",
    "Código do Favorecido", "Favorecido", "Natureza Jurídica", "Tipo Favorecido", "UF Favorecido", "Município Favorecido", "Valor Recebido",
]
IND = "Emenda Individual - Transferências com Finalidade Definida"
ESP = "Emenda Individual - Transferências Especiais"
BAN = "Emenda de Bancada"
SI = "Sem informação"


def emenda(cod, ano, tipo, autor_cod, autor, local, ibge, mun, uf_ibge, funcao, acao, emp, liq, pago, rp="0,00"):
    vals = [cod, ano, tipo, autor_cod, autor, cod[-4:] if cod.isdigit() else "S/I", local, ibge, mun, uf_ibge, "", "", "10", funcao, "301", "Atenção básica",
            "5019", "PROGRAMA", "2E89", acao, "0000", "PO", emp, liq, pago, "0,00", "0,00", rp]
    return dict(zip(COLS_EMENDAS, vals))


def pagamento(cod, autor_cod, autor, tipo, anomes, cod_fav, fav, natureza, tipo_fav, uf, mun, valor):
    return dict(zip(COLS_FAV, [cod, autor_cod, autor, cod[-4:], tipo, anomes, cod_fav, fav, natureza, tipo_fav, uf, mun, valor]))


EMENDAS = [
    emenda("202412340001", "2024", IND, "1234", "FULANO DE TAL", "SÃO PAULO - SP", "3550308", "SÃO PAULO", "3500000", "Saúde", "ATENCAO PRIMARIA", "1.000,00", "800,00", "700,00"),
    emenda("202312340002", "2023", ESP, "1234", "FULANO DE TAL", "MÚLTIPLO", SI, "Múltiplo", "3500000", "Encargos especiais", "TRANSFERENCIAS ESPECIAIS", "500,00", "500,00", "500,00"),
    emenda("202471060001", "2024", BAN, "7106", "BANCADA DE SAO PAULO", "SÃO PAULO (UF)", SI, SI, "3500000", "Educação", "APOIO A EDUCACAO", "2000,00", "1000,00", "1000,00"),
    emenda("201812340003", "2018", IND, "1234", "FULANO DE TAL", "CAMPINAS - SP", "3509502", "CAMPINAS", "3500000", "Urbanismo", "PAVIMENTACAO", "300,00", "0,00", "0,00", "300,00"),
    # Nome do município como a CGU escreve, com o código IBGE: vira apelido para casar os pagamentos.
    emenda("202412340004", "2024", IND, "1234", "FULANO DE TAL", "SANTA BARBARA D OESTE - SP", "3545803", "SANTA BARBARA D OESTE", "3500000", "Saúde", "UBS", "50,00", "0,00", "0,00"),
    # Homônimo de outro estado: não pode ganhar o link do parlamentar do site.
    emenda("202455550001", "2024", IND, "5555", "BELTRANO", "SALVADOR - BA", "2927408", "SALVADOR", "2900000", "Saúde", "UBS", "100,00", "100,00", "100,00"),
    emenda(SI, "2020", "Emenda de Relator", "S/I", SI, "Nacional", SI, SI, "-1", "Saúde", "CUSTEIO", "10,00", "0,00", "0,00"),
]

FAV = [
    pagamento("202412340001", "1234", "FULANO DE TAL", IND, "202405", "46395000000139", "MUNICIPIO DE SAO PAULO", "Município", "Pessoa Jurídica", "SP", "SÃO PAULO", "700,00"),
    pagamento("202312340002", "1234", "FULANO DE TAL", ESP, "202303", "51885242000140", "MUNICIPIO DE CAMPINAS", "Município", "Pessoa Jurídica", "SP", "CAMPINAS", "500,00"),
    pagamento("202471060001", "7106", "BANCADA DE SAO PAULO", BAN, "202406", "12345678000199", "CONSTRUTORA X LTDA", "Sociedade Empresária Limitada", "Pessoa Jurídica", "SP", "SAO PAULO", "600,00"),
    pagamento("202471060001", "7106", "BANCADA DE SAO PAULO", BAN, "202407", "46379400000150", "ESTADO DE SAO PAULO", "Estado ou Distrito Federal", "Pessoa Jurídica", "SP", "SÃO PAULO", "400,00"),
    # Pago via Banco do Brasil: não diz o município de destino.
    pagamento("202412340001", "1234", "FULANO DE TAL", IND, "202207", "00000000000191", "BANCO DO BRASIL SA", "Sociedade de Economia Mista", "Pessoa Jurídica", "DF", "BRASÍLIA", "90,00"),
    # Emenda de 2018 paga em 2019 (restos a pagar): entra, porque o pagamento é do recorte.
    pagamento("201812340003", "1234", "FULANO DE TAL", IND, "201902", "51885242000140", "MUNICIPIO DE CAMPINAS", "Município", "Pessoa Jurídica", "SP", "CAMPINAS", "300,00"),
    pagamento("201812340003", "1234", "FULANO DE TAL", IND, "201812", "51885242000140", "MUNICIPIO DE CAMPINAS", "Município", "Pessoa Jurídica", "SP", "CAMPINAS", "999,00"),
    pagamento("202412340004", "1234", "FULANO DE TAL", IND, "202408", "11111111000111", "FUNDO MUNICIPAL DE SAUDE", "Fundo Público da Administração Direta Municipal", "Pessoa Jurídica", "SP", "SANTA BÁRBARA D'OESTE", "50,00"),
    pagamento("202412340001", "1234", "FULANO DE TAL", IND, "202409", "22222222000122", "EMPRESA Y", "Sociedade Empresária Limitada", "Pessoa Jurídica", "SP", "CIDADE INEXISTENTE", "5,00"),
    pagamento("202412340001", "1234", "FULANO DE TAL", IND, "202409", "***.123.456-**", "PESSOA", SI, "Pessoa Fisica", "SP", "SÃO PAULO", "1,50"),
    pagamento("202455550001", "5555", "BELTRANO", IND, "202409", "33333333000133", "MUNICIPIO DE SALVADOR", "Município", "Pessoa Jurídica", "BA", "SALVADOR", "100,00"),
]

TSE = {
    "abr": [
        {"cd": "sp", "mu": [
            {"cd": "71072", "cdi": "3550308", "nm": "SÃO PAULO"},
            {"cd": "62910", "cdi": "3509502", "nm": "CAMPINAS"},
            {"cd": "70386", "cdi": "3545803", "nm": "SANTA BÁRBARA D'OESTE"},
        ]},
        {"cd": "ba", "mu": [{"cd": "38490", "cdi": "2927408", "nm": "SALVADOR"}]},
        {"cd": "df", "mu": [{"cd": "97012", "cdi": "5300108", "nm": "BRASÍLIA"}]},
        {"cd": "zz", "mu": [{"cd": "29254", "cdi": "", "nm": "ABIDJÃ"}]},
    ]
}
PLENARIO = {
    "camara": {"membros": [
        {"id": "camara-1", "nome": "Fulano de Tal", "partido": "AAA", "uf": "SP"},
        {"id": "camara-2", "nome": "Beltrano", "partido": "BBB", "uf": "RJ"},
    ]},
    "senado": {"membros": []},
}
FONTE = {"nome": "Emendas", "orgao": "CGU", "url": E.CGU_ZIP, "pagina": E.PAGINA, "arquivo_atualizado_em": "2026-10-01T17:45:39-03:00", "coletado_em": "2026-10-06T10:00:00-03:00"}


@pytest.fixture(scope="module")
def saida():
    return E.montar(EMENDAS, FAV, TSE, PLENARIO, FONTE)


def test_utilidades():
    assert E.centavos("245850,00") == 24585000
    assert E.centavos("1.234.567,89") == 123456789
    assert E.centavos("-10,5") == -1050
    assert E.centavos("") == 0 and E.centavos("abc") == 0
    assert E.norm("Santa Bárbara d'Oeste") == "SANTA BARBARA D OESTE"
    assert E.norm("  SÃO   PAULO ") == "SAO PAULO"
    assert E.tipo_emenda(IND) == "individual" and E.tipo_emenda(ESP) == "especial"
    assert [E.tipo_autor(t) for t in (IND, ESP, BAN, "Emenda de Comissão", "Emenda de Relator")] == ["parlamentar", "parlamentar", "bancada", "comissao", "relator"]
    assert E.intermediario("00000000000191", "Pessoa Jurídica") == "Banco do Brasil"
    assert E.intermediario("00360305000104", "Pessoa Jurídica") == "Caixa Econômica Federal"
    assert E.intermediario("RB0000104", "Inscrição Genérica")
    assert E.intermediario("46395000000139", "Pessoa Jurídica") is None
    assert E.categoria_favorecido("Fundo Público da Administração Direta Municipal", "Pessoa Jurídica") == E.CAT_MUNICIPAL
    assert E.categoria_favorecido("Estado ou Distrito Federal", "Pessoa Jurídica") == E.CAT_ESTADUAL
    assert E.categoria_favorecido("Autarquia Federal", "Pessoa Jurídica") == E.CAT_FEDERAL
    assert E.categoria_favorecido("Associação Privada", "Pessoa Jurídica") == E.CAT_ENTIDADES
    assert E.categoria_favorecido("Sem informação", "Pessoa Fisica") == E.CAT_PF
    assert E.link_emenda("202412340001").endswith("codigoEmenda=202412340001") and E.link_emenda(SI) is None


def test_municipio(saida):
    arquivos, _ = saida
    sp = arquivos["municipio/SP/71072.json"]
    assert (sp["uf"], sp["cd"], sp["ibge"], sp["nome"]) == ("SP", "71072", "3550308", "SÃO PAULO")
    rec = sp["recebido"]
    # 700 (prefeitura) + 600 (empresa) + 1,50 (pessoa física); o governo do estado (400) fica no estado.
    assert rec["total"] == 1301.5 and rec["prefeitura"] == 700
    assert rec["por_ano"] == [{"ano": 2024, "valor": 1301.5, "prefeitura": 700}]
    assert {f["nome"]: f["valor"] for f in rec["por_favorecido"]} == {E.CAT_MUNICIPAL: 700, E.CAT_EMPRESAS: 600, E.CAT_PF: 1.5}
    assert {f["nome"]: f["valor"] for f in rec["por_funcao"]} == {"Saúde": 701.5, "Educação": 600}
    autores = {a["autor"]: a for a in rec["por_autor"]}
    assert autores["FULANO DE TAL"]["id"] == "camara-1" and autores["FULANO DE TAL"]["autor_tipo"] == "parlamentar"
    assert autores["FULANO DE TAL"]["nome"] == "Fulano de Tal" and autores["FULANO DE TAL"]["valor"] == 701.5
    assert "id" not in autores["BANCADA DE SAO PAULO"] and autores["BANCADA DE SAO PAULO"]["autor_tipo"] == "bancada"
    assert [m["codigo"] for m in sp["maiores"]] == ["202412340001", "202471060001"]
    assert sp["maiores"][0]["tipo"] == "individual" and sp["maiores"][0]["acao"] == "ATENCAO PRIMARIA"
    assert "{codigo}" in sp["fonte"]["link_emenda"]
    # Emendas cuja localidade é o próprio município, com os estágios da despesa.
    assert sp["destinadas"]["por_ano"] == [{"ano": 2024, "empenhado": 1000, "liquidado": 800, "pago": 700, "rp_pago": 0, "emendas": 1}]


def test_casamento_por_nome_e_recorte(saida):
    arquivos, stats = saida
    camp = arquivos["municipio/SP/62910.json"]["recebido"]
    # 500 de 2023 + 300 pagos em 2019 por emenda de 2018; o pagamento de 2018 fica fora do recorte.
    assert camp["total"] == 800 and [a["ano"] for a in camp["por_ano"]] == [2019, 2023]
    # Apóstrofo e acento diferentes casam pelo nome normalizado.
    assert arquivos["municipio/SP/70386.json"]["recebido"]["total"] == 50
    assert stats["nomes_nao_casados"] == 1 and stats["valor_nao_casado"] == 5


def test_estado_e_resumo(saida):
    arquivos, _ = saida
    uf = arquivos["uf/SP.json"]
    assert uf["governo_estadual"]["total"] == 400
    assert uf["recebido_municipios"]["total"] == 1301.5 + 800 + 50
    assert [m["cd"] for m in uf["municipios"]] == ["71072", "62910", "70386"]  # por valor recebido
    assert uf["destinadas"]["total"]["empenhado"] == 1000 + 500 + 2000 + 50
    assert "uf/AC.json" in arquivos and arquivos["uf/AC.json"]["municipios"] == []
    r = arquivos["resumo.json"]
    assert r["periodo"] == {"desde": 2019, "ate": 2024}
    anos = {a["ano"]: a for a in r["pagamentos_por_ano"]}
    assert anos[2022]["sem_municipio"] == 90 and anos[2022]["municipios"] == 0
    assert anos[2024]["governo_estadual"] == 400
    assert {m["motivo"] for m in r["sem_municipio_por_motivo"]} == {"Banco do Brasil", "Município não identificado"}
    assert r["cobertura"]["nao_casados"] == [{"uf": "SP", "municipio": "CIDADE INEXISTENTE", "valor": 5}]
    assert "sem correção monetária" in r["valores"]
    assert {t["tipo"] for t in r["emendas_por_tipo"]} >= {"individual", "especial", "bancada"}


def test_parlamentar(saida):
    arquivos, stats = saida
    p = arquivos["parlamentar/camara-1.json"]
    assert p["autor_cgu"] == ["FULANO DE TAL"]
    assert [a["ano"] for a in p["por_ano"]] == [2023, 2024]  # a emenda de 2018 fica fora do recorte por ano
    assert p["total"]["empenhado"] == 1550 and p["total"]["emendas"] == 3
    assert p["pagamentos"]["sem_municipio"] == 95  # Banco do Brasil + município não identificado
    destinos = {(d["uf"], d["cd"]): d["valor"] for d in p["destinos_municipio"]}
    assert destinos == {("SP", "62910"): 800, ("SP", "71072"): 701.5, ("SP", "70386"): 50}
    # Na UF entra tudo o que foi pago a favorecidos dela, mesmo sem município identificado.
    assert p["destinos_uf"] == [{"uf": "SP", "nome": "São Paulo", "valor": 1556.5}]
    assert {e["codigo"] for e in p["emendas"]} == {"202412340001", "202312340002", "202412340004"}
    # Homônimo: BELTRANO aplicou emendas só na BA; o Beltrano do site é do RJ.
    assert "parlamentar/camara-2.json" not in arquivos
    assert stats["com_emendas"] == 1 and len(stats["homonimos_descartados"]) == 1


def test_gravar_so_o_que_mudou(tmp_path, saida):
    arquivos, _ = saida
    raiz = tmp_path / "api" / "emendas"
    (raiz / "municipio" / "SP").mkdir(parents=True)
    (raiz / "municipio" / "SP" / "99999.json").write_text("{}", encoding="utf-8")  # não existe mais
    r = E.gravar(raiz, arquivos)
    assert r["gravados"] == len(arquivos) and r["apagados"] == 1
    assert not (raiz / "municipio" / "SP" / "99999.json").exists()
    assert E.gravar(raiz, arquivos) == {"gravados": 0, "apagados": 0}
    # Só a data da coleta mudou: nada é regravado (sem commit na passada sem novidade).
    novo = {**arquivos, "resumo.json": {**arquivos["resumo.json"], "fonte": {**FONTE, "coletado_em": "2026-10-13T10:00:00-03:00"}}}
    assert E.gravar(raiz, novo) == {"gravados": 0, "apagados": 0}
    # Novo arquivo da CGU: o resumo é regravado.
    novo["resumo.json"]["fonte"]["arquivo_atualizado_em"] = "2026-10-08T17:00:00-03:00"
    assert E.gravar(raiz, novo)["gravados"] == 1
    assert json.loads((raiz / "resumo.json").read_text(encoding="utf-8"))["fonte"]["arquivo_atualizado_em"].startswith("2026-10-08")


def _csv(linhas: list[dict], colunas: list[str]) -> bytes:
    buf = io.StringIO()
    w = csv.DictWriter(buf, fieldnames=colunas, delimiter=";", quoting=csv.QUOTE_ALL, lineterminator="\r\n")
    w.writeheader()
    w.writerows(linhas)
    return buf.getvalue().encode("latin-1")


def test_run_com_zip_local(tmp_path):
    site = tmp_path / "site"
    (site / "api").mkdir(parents=True)
    (site / "api" / "plenario.json").write_text(json.dumps(PLENARIO), encoding="utf-8")
    z = tmp_path / "EmendasParlamentares.zip"
    with zipfile.ZipFile(z, "w") as zf:
        zf.writestr(E.ARQ_EMENDAS, _csv(EMENDAS, COLS_EMENDAS))
        zf.writestr(E.ARQ_FAVORECIDOS, _csv(FAV, COLS_FAV))
    tse = tmp_path / "tse.json"
    tse.write_text(json.dumps(TSE), encoding="utf-8")
    assert E.run(site, z, tse) is True
    sp = json.loads((site / "api" / "emendas" / "municipio" / "SP" / "71072.json").read_text(encoding="utf-8"))
    assert sp["nome"] == "SÃO PAULO" and sp["recebido"]["total"] == 1301.5  # latin-1 lido corretamente
    assert E.run(site, z, tse) is False  # segunda passada: nada mudou


def test_zip_sem_planilha_e_falha_de_download(tmp_path, monkeypatch, capsys):
    site = tmp_path / "site"
    (site / "api").mkdir(parents=True)
    z = tmp_path / "x.zip"
    with zipfile.ZipFile(z, "w") as zf:
        zf.writestr(E.ARQ_EMENDAS, _csv(EMENDAS, COLS_EMENDAS))
    tse = tmp_path / "tse.json"
    tse.write_text(json.dumps(TSE), encoding="utf-8")
    with pytest.raises(E.FonteIndisponivel):
        E.run(site, z, tse)

    def bloqueado(_):
        raise E.FonteIndisponivel("a CGU recusou o download (HTTP 403)")

    monkeypatch.setattr(E, "baixar_zip", bloqueado)
    monkeypatch.setattr("sys.argv", ["etl.emendas", str(site), "--tse", str(tse)])
    assert E.main() == 1
    assert "HTTP 403" in capsys.readouterr().out
    assert not (site / "api" / "emendas").exists()  # nada publicado


def test_distrito_federal_conta_em_brasilia():
    gdf = pagamento("202412340001", "1234", "FULANO DE TAL", IND, "202405", "00394601000126", "DISTRITO FEDERAL", "Estado ou Distrito Federal", "Pessoa Jurídica", "DF", "BRASÍLIA", "80,00")
    arquivos, _ = E.montar(EMENDAS, [gdf], TSE, PLENARIO, FONTE)
    rec = arquivos["municipio/DF/97012.json"]["recebido"]
    assert rec["total"] == 80 and rec["prefeitura"] == 80
    assert arquivos["uf/DF.json"]["governo_estadual"]["total"] == 0
