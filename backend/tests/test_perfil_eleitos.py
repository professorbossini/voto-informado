"""Perfil do Congresso eleito (etl.perfil_eleitos): ZIPs pequenos no formato do TSE, sem rede."""

from __future__ import annotations

import io
import json
import zipfile

import pytest

from etl import perfil_eleitos as P

# Colunas como no arquivo do TSE, inclusive as que nunca podem ir para o site.
COLS = [
    "DT_GERACAO", "ANO_ELEICAO", "CD_TIPO_ELEICAO", "SG_UF", "CD_CARGO", "DS_CARGO", "SQ_CANDIDATO", "NM_CANDIDATO", "NM_URNA_CANDIDATO",
    "NM_SOCIAL_CANDIDATO", "NR_CPF_CANDIDATO", "DS_EMAIL", "DT_NASCIMENTO", "NR_TITULO_ELEITORAL_CANDIDATO", "DS_GENERO",
    "DS_GRAU_INSTRUCAO", "DS_COR_RACA", "DS_OCUPACAO", "DS_SIT_TOT_TURNO",
]
CPF = "12345678901"
TITULO = "098765432109"


def cand(ano, sq, cargo, uf, nome, nasc, genero="MASCULINO", instrucao="SUPERIOR COMPLETO", cor="BRANCA", ocup="ADVOGADO",
         sit="ELEITO POR QP", urna=None, tipo="2"):
    return dict(zip(COLS, ["01/10/2026", str(ano), tipo, uf, "6", cargo, sq, nome, urna or nome.split()[0], "#NULO#", CPF,
                           "fulano@exemplo.com", nasc, TITULO, genero, instrucao, cor, ocup, sit]))


def zip_csv(caminho, ano, linhas, cols=COLS, nome="consulta_cand"):
    buf = io.StringIO()
    buf.write(";".join(f'"{c}"' for c in cols) + "\n")
    for r in linhas:
        buf.write(";".join(f'"{r.get(c, "")}"' for c in cols) + "\n")
    with zipfile.ZipFile(caminho, "w") as zf:
        zf.writestr(f"{nome}_{ano}_BRASIL.csv", buf.getvalue().encode("latin-1"))
        zf.writestr(f"{nome}_{ano}_SP.csv", b"")  # por UF: ignorado


def compl(sq, st):
    return {"SQ_CANDIDATO": sq, "ST_REELEICAO": st}


@pytest.fixture
def pasta(tmp_path):
    z = tmp_path / "zips"
    z.mkdir()
    zip_csv(z / "consulta_cand_2026.zip", 2026, [
        # Reeleita (mesmo nome completo em 2022), mulher, 39 anos na posse (01/02/2027).
        cand(2026, "1", "DEPUTADO FEDERAL", "SP", "MARIA DA SILVA", "02/02/1987", genero="FEMININO", cor="PARDA", ocup="DEPUTADO"),
        # Mudou o nome completo, mas o nome de urna é o mesmo de 2022 na mesma Casa e UF: reeleito.
        cand(2026, "2", "DEPUTADO FEDERAL", "SP", "JOAO PEREIRA NETO", "01/02/1957", urna="JOÃO DO POVO"),
        # Eleito em 2022, mas para deputado estadual: novo na Câmara.
        cand(2026, "3", "DEPUTADO FEDERAL", "RJ", "CARLOS SOUZA", "15/05/1990", ocup="DEPUTADO", sit="ELEITO POR MÉDIA"),
        # Mesmo nome de um eleito de 2022, mas por outra UF: novo.
        cand(2026, "4", "DEPUTADO FEDERAL", "MG", "ANA LIMA", "", genero="FEMININO", cor="NÃO DIVULGÁVEL", instrucao="ENSINO MÉDIO COMPLETO"),
        # Não eleitos e suplentes não contam.
        cand(2026, "5", "DEPUTADO FEDERAL", "SP", "PEDRO ALVES", "01/01/1970", sit="SUPLENTE"),
        cand(2026, "6", "DEPUTADO FEDERAL", "SP", "PAULA ALVES", "01/01/1970", sit="NÃO ELEITO"),
        # Senado: eleito em 2018 (8 anos antes) pela mesma UF: reeleito.
        cand(2026, "7", "SENADOR", "SP", "RITA MENDES", "10/10/1960", genero="FEMININO", sit="ELEITO", ocup="SENADOR"),
        cand(2026, "8", "SENADOR", "SP", "LUIS ROCHA", "10/10/1975", sit="ELEITO"),
        # Distrital soma às Assembleias.
        cand(2026, "9", "DEPUTADO DISTRITAL", "DF", "BEATRIZ COSTA", "01/03/1980", genero="FEMININO"),
        cand(2026, "10", "DEPUTADO ESTADUAL", "RJ", "CARLOS SOUZA", "15/05/1990"),
        # Governador fica de fora.
        cand(2026, "11", "GOVERNADOR", "SP", "OUTRO NOME", "01/01/1970", sit="ELEITO"),
    ])
    zip_csv(z / "consulta_cand_2022.zip", 2022, [
        cand(2022, "21", "DEPUTADO FEDERAL", "SP", "MARIA DA SILVA", "02/02/1987", genero="FEMININO", cor="PARDA"),
        cand(2022, "22", "DEPUTADO FEDERAL", "SP", "JOAO PEREIRA", "01/02/1957", urna="JOÃO DO POVO", ocup="EMPRESARIO"),
        cand(2022, "23", "DEPUTADO FEDERAL", "SP", "ANA LIMA", "01/01/1980", genero="FEMININO"),
        cand(2022, "24", "DEPUTADO ESTADUAL", "RJ", "CARLOS SOUZA", "15/05/1990"),
        cand(2022, "25", "SENADOR", "RJ", "JORGE NUNES", "01/01/1950", sit="ELEITO"),
        # Eleição suplementar no arquivo de 2022: fica de fora.
        cand(2022, "26", "DEPUTADO FEDERAL", "SP", "SUPLEMENTAR", "01/01/1970", tipo="1"),
    ])
    zip_csv(z / "consulta_cand_2018.zip", 2018, [
        cand(2018, "31", "SENADOR", "SP", "RITA MENDES", "10/10/1960", genero="FEMININO", sit="ELEITO"),
        cand(2018, "32", "SENADOR", "SP", "OUTRO SENADOR", "10/10/1950", sit="ELEITO"),
        cand(2018, "33", "DEPUTADO FEDERAL", "SP", "MARIA DA SILVA", "02/02/1987", genero="FEMININO"),
    ])
    zip_csv(z / "consulta_cand_2014.zip", 2014, [cand(2014, "41", "SENADOR", "RJ", "JORGE NUNES", "01/01/1950", sit="ELEITO")])
    cc = ["SQ_CANDIDATO", "ST_REELEICAO"]
    zip_csv(z / "consulta_cand_complementar_2026.zip", 2026, [compl("1", "#NE"), compl("2", "#NE")], cc, "consulta_cand_complementar")
    zip_csv(z / "consulta_cand_complementar_2022.zip", 2022, [compl("21", "S"), compl("22", "N"), compl("23", "S"), compl("25", "S")], cc, "consulta_cand_complementar")
    return z


def _site(tmp_path, eleitos=None):
    site = tmp_path / "site"
    (site / "api").mkdir(parents=True)
    if eleitos is not None:
        (site / "api" / "eleitos.json").write_text(json.dumps(eleitos), encoding="utf-8")
    return site


def _n(lista, nome):
    return next((x["n"] for x in lista if x["nome"] == nome), 0)


def test_perfil_e_renovacao(tmp_path, pasta):
    site = _site(tmp_path)
    assert P.run(site, pasta) is True
    texto = (site / "api" / "perfil-eleitos.json").read_text(encoding="utf-8")
    d = json.loads(texto)

    cam26, cam22 = d["casas"]["camara"]["anos"]["2026"], d["casas"]["camara"]["anos"]["2022"]
    assert cam26["total"] == 4 and cam22["total"] == 3
    assert _n(cam26["genero"], "Feminino") == 2 and _n(cam26["genero"], "Masculino") == 2
    # Ordem neutra: alfabética, com "Não informado" no fim.
    assert [x["nome"] for x in cam26["cor_raca"]] == ["Branca", "Parda", "Não informado"]
    # Instrução do menor para o maior grau.
    assert [x["nome"] for x in cam26["instrucao"]] == ["Ensino médio completo", "Superior completo"]
    # Idade na posse (01/02/2027): 39 (faz 40 no dia seguinte), 70 (aniversário no dia), 36; sem data: não informado.
    faixas = {x["nome"]: x["n"] for x in cam26["faixa_etaria"]}
    assert faixas["30–39"] == 2 and faixas["70+"] == 1 and faixas["Não informado"] == 1
    assert cam26["idade_mediana"] == 39
    # Empate na contagem: ordem alfabética.
    assert cam26["ocupacoes"] == [{"nome": "Advogado", "n": 2}, {"nome": "Deputado", "n": 2}]
    assert cam26["ocupacoes_outras"] == 0

    # Renovação: Maria (nome completo) e João (nome de urna) reeleitos; Carlos (outra Casa) e Ana (outra UF) novos.
    assert cam26["renovacao"] == {"reeleitos": 2, "novos": 2, "declararam_reeleicao": None}
    # 2022: Maria foi eleita em 2018; ST_REELEICAO publicado (Maria e Ana declararam).
    assert cam22["renovacao"] == {"reeleitos": 1, "novos": 2, "declararam_reeleicao": 2}

    sen = d["casas"]["senado"]
    assert sen["anos"]["2026"]["vagas"] == 54 and sen["anos"]["2022"]["vagas"] == 27
    assert sen["anos"]["2026"]["renovacao"]["reeleitos"] == 1  # Rita, eleita em 2018 (8 anos antes)
    assert sen["anos"]["2022"]["renovacao"]["reeleitos"] == 1  # Jorge, eleito em 2014
    # Composição completa: eleitos no ano + 4 anos antes.
    assert sen["composicao"]["2026"]["total"] == 3 and sen["composicao"]["2026"]["eleitos_em"] == [2022, 2026]
    assert sen["composicao"]["2022"]["total"] == 3

    ass = d["casas"]["assembleias"]["anos"]["2026"]
    assert ass["total"] == 2 and ass["renovacao"]["reeleitos"] == 1  # Carlos, estadual no RJ em 2022

    # Contagem menor que as vagas: incompleto.
    assert d["completo"] is False and d["casas"]["camara"]["completo"] is False
    assert {"renovacao", "idade", "eleitos", "senado"} <= set(d["criterio"])
    assert all(f["url"].startswith("https://cdn.tse.jus.br/") for f in d["fontes"])
    assert d["gerado_em"]

    # Nada de nomes, CPF, título, e-mail ou data de nascimento no arquivo publicado.
    for proibido in (CPF, TITULO, "exemplo.com", "MARIA", "Maria", "1987", "SQ_CANDIDATO", "JOÃO DO POVO"):
        assert proibido not in texto


def test_sem_mudanca_nao_regrava(tmp_path, pasta):
    site = _site(tmp_path)
    assert P.run(site, pasta) is True
    assert P.run(site, pasta) is False


def test_completo_segue_eleitos_json(tmp_path, monkeypatch, pasta):
    # Com as vagas batendo, quem decide é a totalização publicada no eleitos.json.
    monkeypatch.setattr(P, "vagas", lambda casa, ano: {"camara": 4, "senado": 2, "assembleias": 2}[casa] if ano == 2026 else 1)
    ok = {"camara": {"completo": True}, "senado": {"completo": True}, "assembleias": {"SP": {"completo": True}, "DF": {"completo": True}}}
    d = P.montar(*_entradas(pasta), ok, [])
    assert d["completo"] is True
    falta = {**ok, "assembleias": {"SP": {"completo": True}, "DF": {"completo": False}}}
    d = P.montar(*_entradas(pasta), falta, [])
    assert d["completo"] is False and d["casas"]["camara"]["completo"] is True and d["casas"]["assembleias"]["completo"] is False


def _entradas(pasta):
    por_ano, declarou = {}, {}
    for ano in (2026, 2022, 2018, 2014):
        with zipfile.ZipFile(pasta / f"consulta_cand_{ano}.zip") as zf:
            por_ano[ano] = P.eleitos(P.ler_csv(zf, P.COLUNAS), ano)
    for ano in (2026, 2022):
        with zipfile.ZipFile(pasta / f"consulta_cand_complementar_{ano}.zip") as zf:
            declarou[ano] = P.st_reeleicao(P.ler_csv(zf, P.COLUNAS_COMPL))
    return por_ano, declarou


def test_cpf_nunca_e_lido(pasta):
    with zipfile.ZipFile(pasta / "consulta_cand_2026.zip") as zf:
        linha = next(iter(P.ler_csv(zf, P.COLUNAS)))
    assert "NR_CPF_CANDIDATO" not in linha and "NR_TITULO_ELEITORAL_CANDIDATO" not in linha and "DS_EMAIL" not in linha


def test_formato_mudou(tmp_path):
    z = tmp_path / "x.zip"
    zip_csv(z, 2026, [], cols=["SQ_CANDIDATO", "DS_CARGO"])
    with zipfile.ZipFile(z) as zf, pytest.raises(P.FonteIndisponivel):
        list(P.ler_csv(zf, P.COLUNAS))


def test_rotulos_e_faixas():
    assert P.rotulo("SUPERIOR COMPLETO") == "Superior completo"
    assert P.rotulo("NÃO DIVULGÁVEL") == P.NAO_INFORMADO
    assert P.rotulo("#NULO#") == P.NAO_INFORMADO
    assert [P.faixa(i) for i in (21, 29, 30, 69, 70, None)] == ["18–29", "18–29", "30–39", "60–69", "70+", P.NAO_INFORMADO]
    assert P.vagas("senado", 2026) == 54 and P.vagas("senado", 2022) == 27 and P.vagas("senado", 2018) == 54
