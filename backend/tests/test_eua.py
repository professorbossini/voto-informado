"""Estados Unidos: leitura das amostras oficiais (Clerk, Senado, FEC, NARA, SOD, USAGov, Suprema
Corte), agenda e regras de privacidade. Sem rede."""

from __future__ import annotations

import json
from datetime import date, datetime, timezone

from etl.eua import comum, eleicoes, fec, gastos, montar, suprema, votacoes
from etl.eua.congresso import ler_clerk

CLERK = b"""<?xml version="1.0" encoding="UTF-8"?><MemberData publish-date="October 1, 2026"><title-info><congress-num>119</congress-num></title-info>
<members>
<member><statedistrict>AK00</statedistrict><member-info><bioguideID>B001323</bioguideID><lastname>Begich</lastname><firstname>Nicholas</firstname>
<official-name>Nicholas J. Begich III</official-name><party>R</party><caucus>R</caucus><state postal-code="AK"><state-fullname>Alaska</state-fullname></state>
<district>At Large</district><office-building>CHOB</office-building><office-room>153</office-room><phone>(202) 225-5765</phone><sworn-date date="20250103">x</sworn-date></member-info>
<committee-assignments><committee comcode="II00" rank="22"/><subcommittee subcomcode="II06" rank="13" leadership="Vice Chair"/></committee-assignments></member>
<member><statedistrict>FL20</statedistrict><member-info><bioguideID /><state postal-code="FL"><state-fullname>Florida</state-fullname></state><district>20th</district></member-info></member>
</members>
<committees><committee comcode="II00"><committee-fullname>Committee on Natural Resources</committee-fullname>
<subcommittee subcomcode="II06"><subcommittee-fullname>Indian and Insular Affairs</subcommittee-fullname></subcommittee></committee></committees></MemberData>"""

VOTO_CAMARA = b"""<?xml version="1.0" encoding="utf-8"?>
<rollcall-vote><vote-metadata><congress>119</congress><session>1st</session><rollcall-num>362</rollcall-num><legis-num>H R 498</legis-num>
<vote-question>On Passage</vote-question><vote-type>YEA-AND-NAY</vote-type><vote-result>Passed</vote-result><action-date>18-Dec-2025</action-date>
<action-time time-etz="14:59">2:59 PM</action-time><vote-desc>Do No Harm in Medicaid Act</vote-desc></vote-metadata>
<vote-data>
<recorded-vote><legislator name-id="A000370" party="D" state="NC">Adams</legislator><vote>Nay</vote></recorded-vote>
<recorded-vote><legislator name-id="A000055" party="R" state="AL">Aderholt</legislator><vote>Yea</vote></recorded-vote>
<recorded-vote><legislator name-id="Z000018" party="R" state="MT">Zinke</legislator><vote>Not Voting</vote></recorded-vote>
<recorded-vote><legislator name-id="J000299" party="R" state="LA">Johnson</legislator><vote>Johnson (LA)</vote></recorded-vote>
</vote-data></rollcall-vote>"""

VOTO_SENADO = b"""<?xml version="1.0" encoding="UTF-8"?>
<roll_call_vote><congress>119</congress><session>1</session><congress_year>2025</congress_year><vote_number>7</vote_number>
<vote_date>January 20, 2025,  06:01 PM</vote_date><vote_question_text>On the Nomination PN11-6</vote_question_text><question>On the Nomination</question>
<vote_title>Confirmation: Marco Rubio, of Florida, to be Secretary of State</vote_title><majority_requirement>1/2</majority_requirement>
<vote_result>Nomination Confirmed</vote_result><document><document_type>PN</document_type><document_number>11-6</document_number></document>
<members>
<member><member_full>Alsobrooks (D-MD)</member_full><vote_cast>Yea</vote_cast><lis_member_id>S428</lis_member_id></member>
<member><member_full>Banks (R-IN)</member_full><vote_cast>Not Voting</vote_cast><lis_member_id>S429</lis_member_id></member>
</members></roll_call_vote>"""


def test_clerk_membros_vagas_e_comissoes():
    d = ler_clerk(CLERK)
    assert d["congresso"] == 119 and d["publicado"] == "October 1, 2026"
    m = d["membros"]["B001323"]
    assert m["uf"] == "AK" and m["distrito"] == 0 and m["posse"] == "2025-01-03"
    assert {c["nome"] for c in m["comissoes"]} == {"Committee on Natural Resources", "Indian and Insular Affairs"}
    assert next(c for c in m["comissoes"] if c["sub"])["cargo"] == "Vice Chair"
    assert d["vagas"] == [{"uf": "FL", "distrito": 20, "nota": None}]


def test_voto_camara_codigos_e_links():
    v = votacoes.ler_voto_camara(VOTO_CAMARA, 2025)
    assert v["id"] == "h2025-362" and v["data"] == "2025-12-18T14:59:00-05:00"
    assert v["votos"] == {"A000370": "N", "A000055": "S", "Z000018": "A", "J000299": "O:Johnson (LA)"}
    assert v["_nomes"]["A000370"] == "Adams (D-NC)"
    assert v["url_proposicao"] == "https://www.congress.gov/bill/119th-congress/house-bill/498"
    assert votacoes.ler_voto_camara(b'<xml>Error sanitizing file "roll999.xml".</xml>', 2025) is None  # número ainda não usado


def test_voto_senado_liga_lis_ao_bioguide():
    v = votacoes.ler_voto_senado(VOTO_SENADO, {"S428": "A000382", "S429": "B001299"})
    assert v["id"] == "s119-1-7" and v["data"].startswith("2025-01-20T18:01")
    assert v["votos"] == {"A000382": "S", "B001299": "A"}
    assert v["url_proposicao"] is None  # indicação (PN) não é proposição legislativa


def test_resumo_participacao():
    vs = [
        {"id": "a", "data": "2025-01-01", "votos": {"X": "S"}},
        {"id": "b", "data": "2025-01-02", "votos": {"X": "A"}},
        {"id": "c", "data": "2025-01-03", "votos": {"Y": "N"}},  # X não estava em exercício
        {"id": "d", "data": "2025-01-04", "votos": {"X": "O:Jeffries"}},
    ]
    r = votacoes.resumo_membro("X", vs)
    assert r["total"] == 3 and r["participou"] == 2 and r["pct_participou"] == 66.7
    assert [i["id"] for i in r["itens"]] == ["d", "b", "a"]


def test_url_proposicao_tipos():
    assert votacoes.url_proposicao(119, "H RES 12") == "https://www.congress.gov/bill/119th-congress/house-resolution/12"
    assert votacoes.url_proposicao(119, "S J RES 5") == "https://www.congress.gov/bill/119th-congress/senate-joint-resolution/5"
    assert votacoes.url_proposicao(121, "S. 3") == "https://www.congress.gov/bill/121st-congress/senate-bill/3"
    assert votacoes.url_proposicao(119, None) is None


def test_nomes_fec():
    assert fec.nome_legivel("PELTOLA, MARY S. MRS.") == "Mary S. Peltola"
    assert fec.nome_legivel("MCCAIN, JOHN") == "John McCain"
    assert fec.nome_legivel("CORNYN, JOHN SEN") == "John Cornyn"
    assert fec.nome_legivel("BUSH, GEORGE H.W.") == "George H.W. Bush"
    assert fec.nome_legivel("BIDEN, JOSEPH R. JR") == "Joseph R. Biden Jr"


def test_fec_sem_doadores_nem_endereco():
    """Só totais por candidatura: nada de doador pessoa física nem endereço (52 U.S.C. § 30111(a)(4))."""
    linha = dict(zip(fec.WEBALL, ["H2AK01158", "PELTOLA, MARY", "C", "1", "DEM", "152304.86", "0", "232791.29", "0", "83969.49", "3483.06", "0", "0", "0", "0", "0", "0", "63252.17", "AK", "00", "", "", "", "", "", "13500", "0", "02/13/2026", "18521.85", "0"]))
    f = fec._financas(linha)
    assert f["receitas"] == 152304.86 and f["pessoas_fisicas"] == 63252.17 and f["ate"] == "2026-02-13"
    proibidos = {"CAND_ST1", "CAND_ST2", "CAND_CITY", "CAND_ZIP", "endereco", "doadores"}
    assert not proibidos & set(json.dumps(f))


def _pagina_colegio(eleitores: dict[str, int]) -> str:
    linhas = ""
    for i, (uf, n) in enumerate(sorted(eleitores.items())):
        a, b = (n, "-") if i % 2 else ("-", n)
        nome = comum.NOMES_EN[uf] + (" *" if uf == "HI" else "")  # marca de nota de rodapé, como no site oficial
        linhas += f"<tr><td>{nome}</td><td>{n}</td><td>{a}</td><td>{b}</td><td>{a}</td><td>{b}</td></tr>"
    return ("<table><tr><th>State</th><th>N</th><th>For President</th><th>For Vice-President</th></tr>"
            "<tr><td>Ann A, of X</td><td>Bob B, of Y</td><td>Cid C, of X</td><td>Dan D, of Y</td></tr>" + linhas + "</table>")


def test_colegio_eleitoral_separa_presidente_e_vice():
    eleitores = {uf: 10 for uf in comum.ESTADOS}
    eleitores["DC"] = 38  # 50 × 10 + 38 = 538
    c = eleicoes.ler_colegio(_pagina_colegio(eleitores))
    assert c["candidatos"] == ["Ann A", "Bob B"] and c["total"] == 538 and len(c["estados"]) == 51
    assert c["estados"]["HI"] in ([10, 0], [0, 10])
    # Soma fora do intervalo plausível (530–538): rejeita em vez de publicar errado.
    assert eleicoes.ler_colegio(_pagina_colegio({uf: 10 for uf in comum.ESTADOS})) is None


def test_escritorios_e_data_da_eleicao():
    pag = '<a class="url" id="CA" href="https://www.sos.ca.gov/elections">California (CA)</a><a class="url" id="GU" href="https://gec.guam.gov/">Guam (GU)</a>'
    assert eleicoes.ler_escritorios(pag) == {"CA": {"url": "https://www.sos.ca.gov/elections", "nome": "California"}, "GU": {"url": "https://gec.guam.gov/", "nome": "Guam"}}
    assert eleicoes.dia_da_eleicao(2026) == date(2026, 11, 3)
    assert eleicoes.dia_da_eleicao(2028) == date(2028, 11, 7)
    assert eleicoes.dia_da_eleicao(2030) == date(2030, 11, 5)


def test_calendario_conta_cadeiras_do_senado():
    cong = {"senado": {"membros": [
        {"uf": "TX", "classe": 2, "proxima_eleicao": 2026, "mandato_fim": "2027-01-03"},
        {"uf": "OH", "classe": 3, "proxima_eleicao": 2026, "mandato_fim": "2026-11-03"},
        {"uf": "CA", "classe": 3, "proxima_eleicao": 2028, "mandato_fim": "2029-01-03"},
    ]}}
    c = eleicoes.calendario(date(2026, 10, 12), cong)
    assert c["proxima"] == "2026-11-03" and c["em_disputa"]["senado"] == 2 and c["em_disputa"]["senado_especiais"] == ["OH"]
    assert c["em_disputa"]["presidente"] is False
    assert eleicoes.calendario(date(2026, 11, 4), cong)["proxima"] == "2028-11-07"


SOD = """ORGANIZATION,PROGRAM,DESCRIPTION,YTD AMOUNT,QTD AMOUNT
2026 OFFICE OF THE SPEAKER,GENERAL EXPENDITURES,TRAVEL,10903.42,1099.46
2026 HON. ALMA S. ADAMS,OFFICIAL EXPENSES OF MEMBERS,PERSONNEL COMPENSATION,627625.07,309294.48
2026 HON. ALMA S. ADAMS,OFFICIAL EXPENSES OF MEMBERS,RENT  COMMUNICATION  UTILITIES,73936.41,40516.52
2026 HON. ALMA S. ADAMS,OFFICIAL EXPENSES OF MEMBERS,OFFICIAL EXPENSES OF MEMBERS TOTALS:,792969.99,407762.4
2026 HON. ALMA S. ADAMS,INTERN ALLOWANCES,PERSONNEL COMPENSATION,10920.01,5546.67
2025 HON. JOHN SMITH,OFFICIAL EXPENSES OF MEMBERS,TRAVEL,100,20
"""


def test_sod_so_gabinetes_de_parlamentares_por_categoria():
    g = gastos.ler_sod(SOD)
    assert set(g) == {"2026 HON. ALMA S. ADAMS", "2025 HON. JOHN SMITH"}  # sem órgãos da Câmara
    adams = g["2026 HON. ALMA S. ADAMS"]
    assert adams["ano"] == 2026 and adams["categorias"] == {"pessoal": (627625.07, 309294.48), "aluguel_comunicacao": (73936.41, 40516.52)}  # sem linha de total nem estagiários


def test_sod_liga_gabinete_so_com_nome_unico():
    membros = [{"id": "A1", "nome": "Alma S. Adams", "sobrenome": "Adams"}, {"id": "S1", "nome": "John Smith", "sobrenome": "Smith"}, {"id": "S2", "nome": "John A. Smith", "sobrenome": "Smith"}]
    v = gastos.ligar_gabinetes(["ALMA S. ADAMS", "JOHN SMITH", "GREGORY FRANCIS MURPHY MD"], membros)
    assert v == {"ALMA S. ADAMS": "A1", "JOHN SMITH": "S1"}


def test_links_sod_por_trimestre():
    html = ('<a href="/sites/default/files/2026-08/grids/APRIL-JUNE%202026%20SOD%20SUMM%20GRID-FINAL.csv">x</a>'
            '<a href="/sites/default/files/2026-08/grids/APRIL-JUNE%202026%20SOD%20DETAIL%20GRID-FINAL.csv">x</a>'
            '<a href="/sites/default/files/2026-02/OCT-DEC-2025-SOD-SUMMARY-GRID-FINAL.csv">x</a>')
    assert [(a, t) for a, t, _ in gastos.links_sod(html, "https://www.house.gov/x")] == [(2025, 4), (2026, 2)]


def test_suprema_decisoes_e_historico():
    pag = ("<tr><td>72</td><td>9/25/26</td><td>26A308</td><td><a href='/opinions/25pdf/26a308_pok0.pdf' target='_blank' "
           'title="The Court grants the application.">DHS v. League</a></td><td>PC</td><td>609/2</td></tr>')
    d = suprema.ler_decisoes(pag, 2025)[0]
    assert d["data"] == "2026-09-25" and d["autor_nome"].startswith("Per curiam") and d["resumo_en"] == "The Court grants the application."
    assert d["pdf"] == "https://www.supremecourt.gov/opinions/25pdf/26a308_pok0.pdf"
    hist = ("<table><tr><th>Name</th><th>Judicial Oath Taken</th></tr><tr><th scope='row'></th><td>Roberts, John G., Jr.</td><td>Maryland</td>"
            "<td>Bush, G. W.</td><td>September 29, 2005</td><td></td></tr></table>")
    h = suprema.ler_historico(hist)
    assert h == [{"nome": "John G. Roberts Jr.", "nome_oficial": "Roberts, John G., Jr.", "cargo": "presidente", "estado": "Maryland",
                  "nomeado_por": "Bush, G. W.", "juramento": "2005-09-29", "saida": None}]
    assert suprema.termo_atual(datetime(2026, 10, 5)) == 2026 and suprema.termo_atual(datetime(2026, 6, 30)) == 2025


def test_agenda():
    u = lambda *a: datetime(*a, tzinfo=timezone.utc)  # noqa: E731
    assert montar.partes_da_hora(u(2026, 10, 13, 10, 17)) == montar.PARTES
    assert montar.partes_da_hora(u(2026, 10, 13, 15, 47)) == ["votacoes", "suprema"]  # terça, horário das decisões
    assert montar.partes_da_hora(u(2026, 8, 4, 15, 47)) == ["votacoes"]  # recesso da Corte
    assert "eleicoes" in montar.partes_da_hora(u(2026, 11, 4, 2, 37))
    assert "congresso" in montar.partes_da_hora(u(2027, 1, 3, 23, 37))
    assert montar.partes_da_hora(u(2026, 10, 13, 15, 47), "workflow_dispatch") == montar.PARTES


def test_congresso_atual():
    assert comum.congresso_atual(datetime(2026, 10, 12)) == 119
    assert comum.congresso_atual(datetime(2027, 1, 3)) == 120
    assert comum.anos_do_congresso(119) == (2025, 2026)


def test_biografia_sem_familia():
    t = "John G. Roberts, Jr., was born in Buffalo, New York, January 27, 1955. He married Jane Sullivan in 1996 and they have two children - Josephine and Jack. He received an A.B. from Harvard College in 1976."
    out = suprema.sem_familia(t)
    assert "Jane" not in out and "Josephine" not in out and "Harvard College" in out and "Buffalo" in out
