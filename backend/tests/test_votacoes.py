"""Votações nominais: leitura das amostras oficiais (Câmara em CSV, Senado em JSON), períodos de
exercício e resumo por parlamentar. Sem rede."""

from __future__ import annotations

import io
import json
from datetime import date

from etl import votacoes as vt
from etl.votacoes import (
    SEM_REGISTRO,
    camara_votacoes,
    em_exercicio_na,
    inicio_legislatura,
    montar_parlamentar,
    periodos_exercicio,
    senado_votacoes,
)

VOTACOES = '''﻿"id";"uri";"data";"dataHoraRegistro";"idOrgao";"uriOrgao";"siglaOrgao";"idEvento";"uriEvento";"aprovacao";"votosSim";"votosNao";"votosOutros";"descricao";"ultimaAberturaVotacao_dataHoraRegistro";"ultimaAberturaVotacao_descricao";"ultimaApresentacaoProposicao_dataHoraRegistro";"ultimaApresentacaoProposicao_descricao";"ultimaApresentacaoProposicao_idProposicao";"ultimaApresentacaoProposicao_uriProposicao"
"2438467-47";"u";"2025-02-12";"2025-02-12T19:54:47";"180";"u";"PLEN";"75404";"u";"1";"273";"136";"1";"Aprovado o Projeto de Lei nº 2.215, de 2024. Sim: 273; Não: 136; Total: 409.";"";"";"";"";"0";""
"2438467-41";"u";"2025-02-12";"2025-02-12T16:42:30";"180";"u";"PLEN";"75404";"u";"0";"125";"236";"4";"Rejeitado o Requerimento.";"";"";"";"";"0";""
"2576389-4";"u";"2025-10-29";"2025-10-29T11:50:00";"180";"u";"PLEN";"76000";"u";"";"388";"22";"11";"Votos:
Sra. Fulana: Sim: 388";"";"";"";"";"0";""
"9999-1";"u";"2025-03-01";"2025-03-01T10:00:00";"180";"u";"PLEN";"75500";"u";"1";"0";"0";"0";"Aprovado (votação simbólica).";"";"";"";"";"0";""
"1302214-131";"u";"2025-05-01";"2025-05-01T10:00:00";"2003";"u";"CCJC";"75600";"u";"1";"44";"14";"0";"Comissão.";"";"";"";"";"0";""
'''

PROPOSICOES = '''﻿"idVotacao";"uriVotacao";"data";"descricao";"proposicao_id";"proposicao_uri";"proposicao_titulo";"proposicao_ementa";"proposicao_codTipo";"proposicao_siglaTipo";"proposicao_numero";"proposicao_ano"
"2438467-47";"u";"2025-02-12";"d";"9000";"u";"REQ 1/2025";"Requerimento qualquer.";"1";"REQ";"1";"2025"
"2438467-47";"u";"2025-02-12";"d";"2438467";"u";"PL 2215/2024";"Altera a lei tal.";"139";"PL";"2215";"2024"
"2438467-41";"u";"2025-02-12";"d";"2438467";"u";"PL 2215/2024";"Altera a lei tal.";"139";"PL";"2215";"2024"
'''

VOTOS = '''﻿"idVotacao";"uriVotacao";"dataHoraVoto";"voto";"deputado_id";"deputado_uri";"deputado_nome";"deputado_siglaPartido";"deputado_uriPartido";"deputado_siglaUf";"deputado_idLegislatura";"deputado_urlFoto"
"2438467-47";"u";"t";"Sim";"1";"u";"A";"P";"u";"SP";"57";"u"
"2438467-47";"u";"t";"Artigo 17";"2";"u";"B";"P";"u";"SP";"57";"u"
"2438467-41";"u";"t";"Obstrução";"1";"u";"A";"P";"u";"SP";"57";"u"
"2576389-4";"u";"t";"";"1";"u";"A";"P";"u";"SP";"57";"u"
"1302214-131";"u";"t";"Não";"1";"u";"A";"P";"u";"SP";"57";"u"
'''


def _camara():
    return camara_votacoes(io.StringIO(VOTACOES.lstrip("﻿")), io.StringIO(PROPOSICOES.lstrip("﻿")), io.StringIO(VOTOS.lstrip("﻿")), "2023-02-01")


def test_camara_so_nominais_do_plenario_com_proposicao_e_links():
    vs = _camara()
    assert [v["id"] for v in vs] == ["2438467-41", "2438467-47", "2576389-4"]  # sem simbólica nem comissão; em ordem
    v = vs[1]
    assert v["proposicao"] == "PL 2215/2024" and v["proposicao_id"] == "2438467"  # a que bate com o id da votação
    assert v["ementa"] == "Altera a lei tal." and v["resultado"] == "Aprovado"
    assert v["placar"] == "Sim: 273 · Não: 136 · Outros: 1"
    assert v["url"] == "https://www.camara.leg.br/propostas-legislativas/2438467"
    assert v["url_sessao"] == "https://www.camara.leg.br/presenca-comissoes/votacao-portal?reuniao=75404"
    assert v["votos"] == {"1": "Sim", "2": "Artigo 17"}
    secreta = vs[2]
    assert secreta["votos"] == {"1": "Votou"}  # voto em branco no arquivo = votou, opção não divulgada
    assert secreta["resultado"] is None and secreta["proposicao"] is None
    assert secreta["descricao"] == "Votos: Sra. Fulana: Sim: 388"
    assert secreta["url"] == secreta["url_sessao"]


HISTORICO = [
    {"idLegislatura": 57, "dataHora": "2022-03-31T00:00", "situacao": "Exercício", "descricaoStatus": "Alteração de partido"},  # suplente fora do cargo
    {"idLegislatura": 57, "dataHora": "2023-02-01T00:00", "situacao": None},
    {"idLegislatura": 57, "dataHora": "2023-02-01T12:05", "situacao": "Exercício"},
    {"idLegislatura": 57, "dataHora": "2023-04-10T10:00", "situacao": "Exercício", "descricaoStatus": "Alteração de partido"},
    {"idLegislatura": 57, "dataHora": "2025-02-12T17:00", "situacao": "Licença"},
    {"idLegislatura": 57, "dataHora": "2025-03-01T08:00", "situacao": "Exercício", "descricaoStatus": "Alteração de partido"},  # licenciado
    {"idLegislatura": 57, "dataHora": "2025-10-01T08:00", "situacao": "CONVOCADO"},
    {"idLegislatura": 57, "dataHora": "2025-10-01T09:00", "situacao": "Exercício"},
    {"idLegislatura": 56, "dataHora": "2019-02-01T11:45", "situacao": "Exercício"},
]


def test_periodos_de_exercicio_pelo_historico():
    per = periodos_exercicio(HISTORICO, 57)
    assert per == [["2023-02-01T12:05", "2025-02-12T17:00"], ["2025-10-01T09:00", None]]
    assert em_exercicio_na(per, "2025-02-12T16:42:30")
    assert not em_exercicio_na(per, "2025-02-12T19:54:47")
    assert em_exercicio_na(per, "2026-01-01T00:00")
    assert inicio_legislatura(57) == "2023-02-01" and inicio_legislatura(58) == "2027-02-01"


def test_resumo_camara_conta_so_em_exercicio_e_sem_registro():
    vs = _camara()
    # Deputado 3: não votou em nada; licenciado às 17h de 12/02 → só a votação das 16h42 conta.
    per = periodos_exercicio(HISTORICO, 57)
    r = montar_parlamentar(vs, "3", per, {}, "camara")
    assert r["resumo"]["total"] == 2  # 16h42 de 12/02 e a de 29/10 (de volta ao exercício)
    assert r["resumo"]["participou"] == 0 and r["resumo"]["percentual"] == 0
    assert r["resumo"]["votos"] == {SEM_REGISTRO: 2}
    assert [i["id"] for i in r["itens"]] == ["2576389-4", "2438467-41"]  # mais recentes primeiro

    # Deputado 1: sempre em exercício; Obstrução e "Votou" contam como voto registrado.
    r1 = montar_parlamentar(vs, "1", [["2023-02-01T12:05", None]], {}, "camara")
    assert r1["resumo"] == {
        "total": 3, "participou": 3, "votou": 3, "presidiu": 0, "percentual": 1.0,
        "votos": {"Obstrução": 1, "Sim": 1, "Votou": 1},
    }
    # Deputado 2: presidiu (Art. 17) uma votação, faltou registro nas outras duas.
    r2 = montar_parlamentar(vs, "2", [["2023-02-01T12:05", None]], {}, "camara")
    assert r2["resumo"]["participou"] == 1 and r2["resumo"]["presidiu"] == 1 and r2["resumo"]["votou"] == 0
    assert r2["resumo"]["percentual"] == round(1 / 3, 4)
    assert r2["por_ano"] == [{"ano": 2025, "total": 3, "participou": 1}]


def test_camara_sem_historico_nao_inventa_total():
    r = montar_parlamentar(_camara(), "2", None, {}, "camara")
    assert r["resumo"]["total"] is None and r["resumo"]["percentual"] is None
    assert r["resumo"]["participou"] == 1 and r["itens"] == [{"id": "2438467-47", "voto": "Artigo 17"}]
    assert r["sem_periodo"] is True
    assert r["por_ano"] == [{"ano": 2025, "total": None, "participou": 1}]


SENADO = [
    {
        "casaSessao": "SF", "codigoMateria": 167182, "codigoSessao": 450520, "codigoSessaoVotacao": 6918, "dataSessao": "2025-02-19",
        "descricaoVotacao": "Votação nominal da Emenda nº 1.", "ementa": "Dispõe sobre prazo.", "identificacao": "PLP 22/2025",
        "resultadoVotacao": "A", "sequencialSessao": 1, "sequencialVotacao": 4234, "votacaoSecreta": "N",
        "totalVotosSim": None, "totalVotosNao": None, "totalVotosAbstencao": None,
        "votos": [
            {"codigoParlamentar": 5672, "siglaVotoParlamentar": "Sim", "descricaoVotoParlamentar": None},
            {"codigoParlamentar": 6358, "siglaVotoParlamentar": "AP", "descricaoVotoParlamentar": "Atividade parlamentar"},
            {"codigoParlamentar": 3830, "siglaVotoParlamentar": "Presidente (art. 51 RISF)", "descricaoVotoParlamentar": None},
            {"codigoParlamentar": 22, "siglaVotoParlamentar": "Não", "descricaoVotoParlamentar": None},
        ],
    },
    {
        "casaSessao": "SF", "codigoMateria": None, "codigoSessao": 457111, "codigoSessaoVotacao": 6930, "dataSessao": "2025-05-21",
        "descricaoVotacao": "Votação nominal da Mensagem nº 3.", "ementa": None, "identificacao": "MSF 3/2025",
        "resultadoVotacao": "A", "sequencialSessao": 1, "sequencialVotacao": 4247, "votacaoSecreta": "S",
        "totalVotosSim": 41, "totalVotosNao": 1, "totalVotosAbstencao": 1,
        "votos": [
            {"codigoParlamentar": 5672, "siglaVotoParlamentar": "P-NRV", "descricaoVotoParlamentar": "Presente – Não registrou voto"},
            {"codigoParlamentar": 6358, "siglaVotoParlamentar": "Votou", "descricaoVotoParlamentar": None},
        ],
    },
    {"casaSessao": "SF", "codigoSessao": 1, "codigoSessaoVotacao": 1, "dataSessao": "2023-01-10", "votos": [{"codigoParlamentar": 22, "siglaVotoParlamentar": "Sim"}]},
]


def test_senado_votacoes_legenda_e_links():
    vs, legenda = senado_votacoes(SENADO, "2023-02-01")
    assert [v["id"] for v in vs] == ["6918", "6930"]  # a de janeiro de 2023 é da legislatura anterior
    a, b = vs
    assert a["placar"] == "Sim: 1 · Não: 1 · Abstenção: 0" and a["resultado"] == "Aprovado"
    assert a["url"] == "https://www25.senado.leg.br/web/atividade/materias/-/materia/167182"
    assert b["secreta"] is True and b["placar"] == "Sim: 41 · Não: 1 · Abstenção: 1"
    assert b["url"] == b["url_sessao"] == "https://www25.senado.leg.br/web/atividade/sessao-plenaria/-/pauta/457111"
    assert legenda == {"AP": "Atividade parlamentar", "P-NRV": "Presente – Não registrou voto"}

    r = montar_parlamentar(vs, "5672", None, legenda, "senado")
    assert r["resumo"]["total"] == 2 and r["resumo"]["participou"] == 1 and r["resumo"]["percentual"] == 0.5
    assert r["legenda"] == {"P-NRV": "Presente – Não registrou voto"}
    assert r["itens"] == [{"id": "6930", "voto": "P-NRV"}, {"id": "6918", "voto": "Sim"}]
    assert r["exercicio"] is None and r["sem_periodo"] is False
    cat = vt.catalogo(vs, {"6930"})
    assert list(cat) == ["6930"] and cat["6930"]["secreta"] is True and cat["6930"]["proposicao"] == "MSF 3/2025"

    pres = montar_parlamentar(vs, "3830", None, legenda, "senado")
    assert pres["resumo"]["total"] == 1 and pres["resumo"]["presidiu"] == 1 and pres["resumo"]["percentual"] == 1.0
    # Senador que não aparece em nenhuma lista (não estava em exercício): nada conta.
    assert montar_parlamentar(vs, "999", None, legenda, "senado")["resumo"]["total"] == 0


def test_run_grava_por_parlamentar_e_reaproveita_anos_encerrados(tmp_path, monkeypatch):
    api = tmp_path / "api"
    api.mkdir()
    (api / "plenario.json").write_text(json.dumps({
        "camara": {"legislatura": 57, "membros": [{"id": "camara-1", "nome": "A"}, {"id": "camara-3", "nome": "C"}]},
        "senado": {"membros": [{"id": "senado-5672", "nome": "Alan Rick"}]},
    }))
    chamadas: list[tuple[str, int]] = []

    def camara_ano(ano, inicio, pasta):
        chamadas.append(("camara", ano))
        return {"casa": "camara", "ano": ano, "votacoes": _camara() if ano == 2025 else [], "legenda": {}}

    def senado_ano(ano, inicio):
        chamadas.append(("senado", ano))
        vs, legenda = senado_votacoes(SENADO, inicio) if ano == 2025 else ([], {})
        return {"casa": "senado", "ano": ano, "votacoes": vs, "legenda": legenda}

    monkeypatch.setattr(vt, "camara_ano", camara_ano)
    monkeypatch.setattr(vt, "senado_ano", senado_ano)
    monkeypatch.setattr(vt, "camara_periodos", lambda ids, leg: {"1": [["2023-02-01T12:05", None]]})

    assert vt.run(tmp_path, hoje=date(2026, 3, 1)) is True
    d1 = json.loads((api / "votacoes/parlamentar/camara-1.json").read_text())
    assert d1["resumo"]["total"] == 3 and d1["atualizado_em"]
    d3 = json.loads((api / "votacoes/parlamentar/camara-3.json").read_text())
    assert d3["resumo"]["total"] is None and d3["sem_periodo"] is True  # histórico indisponível
    cat = json.loads((api / "votacoes/camara.json").read_text())
    assert cat["fonte"]["nome"].startswith("Câmara") and "Sem registro" in cat["criterio"]
    assert list(cat["votacoes"]) == ["2576389-4", "2438467-47", "2438467-41"]  # as listadas, mais recentes primeiro
    assert cat["votacoes"]["2438467-47"]["proposicao"] == "PL 2215/2024"
    s = json.loads((api / "votacoes/parlamentar/senado-5672.json").read_text())
    assert s["resumo"]["votos"] == {"P-NRV": 1, "Sim": 1}
    resumo = json.loads((api / "votacoes/resumo.json").read_text())
    assert resumo["casas"]["camara"]["votacoes"] == 3 and resumo["inicio"] == "2023-02-01"
    assert sorted(chamadas) == sorted([(c, a) for c in ("camara", "senado") for a in (2023, 2024, 2025, 2026)])

    # Segunda passada: anos encerrados não são baixados de novo; nada mudou → nada regravado.
    chamadas.clear()
    assert vt.run(tmp_path, hoje=date(2026, 3, 1)) is False
    assert sorted(chamadas) == [("camara", 2026), ("senado", 2026)]
    assert json.loads((api / "votacoes/parlamentar/camara-1.json").read_text())["atualizado_em"] == d1["atualizado_em"]
