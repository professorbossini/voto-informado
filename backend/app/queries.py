"""Read-only queries that shape the public JSON API.

Every function returns plain dicts/lists and takes only path-like arguments, so the
same output can be served by FastAPI or written to static files (app.export).
CPF and voter-ID numbers stay in the database for matching only and are never returned.
"""

from __future__ import annotations

import json
import sqlite3
import unicodedata
from collections import defaultdict
from datetime import date
from statistics import median

from .db import table_exists

UF_NOMES = {
    "BR": "Brasil", "AC": "Acre", "AL": "Alagoas", "AM": "Amazonas", "AP": "Amapá", "BA": "Bahia",
    "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão",
    "MG": "Minas Gerais", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso", "PA": "Pará", "PB": "Paraíba",
    "PE": "Pernambuco", "PI": "Piauí", "PR": "Paraná", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RO": "Rondônia", "RR": "Roraima", "RS": "Rio Grande do Sul", "SC": "Santa Catarina", "SE": "Sergipe",
    "SP": "São Paulo", "TO": "Tocantins",
}
TITULARES = ("presidente", "governador", "senador", "deputado-federal", "deputado-estadual", "deputado-distrital")
MAJORITARIOS = ("presidente", "governador", "senador")
DATA_ELEICAO = date(2026, 10, 4)
DATA_2TURNO = date(2026, 10, 25)
DIVULGA = "https://divulgacandcontas.tse.jus.br/divulga/#/candidato/2026/20322002026/{uf}/{sq}"

# Fontes citadas por cada bloco de informação (chaves da tabela `fontes`).
FONTES_CARD = ["tse_candidatos", "tse_complementar", "tse_bens", "tse_prestacao", "tse_fotos", "tse_historico"]
# Bancadas (critério dos debates) e chips de "mandato atual no Congresso".
FONTES_CONGRESSO = ["camara_deputados", "senado_senadores"]


def pub_id(pid: str | None) -> str | None:
    """'camara:123' -> 'camara-123' (safe in URLs and static file names)."""
    return pid.replace(":", "-", 1) if pid else pid


def db_id(pid: str) -> str:
    return pid.replace("-", ":", 1) if ":" not in pid else pid


def alpha_key(text: str | None) -> tuple[str, str]:
    """Alphabetical key that ignores accents and case (Á sorts with A), identical on SQLite and Postgres."""
    base = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().casefold()
    return (base, text or "")


def _rows(conn: sqlite3.Connection, sql: str, params=()) -> list[dict]:
    return [dict(r) for r in conn.execute(sql, params)]


def _has(conn: sqlite3.Connection, table: str) -> bool:
    return table_exists(conn, table)


def _meta(conn: sqlite3.Connection) -> dict[str, str]:
    return {r["chave"]: r["valor"] for r in conn.execute("SELECT chave, valor FROM meta")}


def fase_de(hoje: date, tem_2turno: bool, tem_resultado_2turno: bool) -> str:
    """Regra da fase, sem banco (também usada por etl.apuracao_remota)."""
    if tem_resultado_2turno:
        return "apuracao-2turno" if hoje <= DATA_2TURNO else "encerrada"
    if hoje < DATA_ELEICAO:
        return "pre-1turno"
    if tem_2turno:
        return "pre-2turno" if hoje < DATA_2TURNO else "apuracao-2turno"
    return "apuracao-1turno"


def fase(conn: sqlite3.Connection, hoje: date | None = None) -> str:
    """Which moment of the election the site should emphasize."""
    hoje = hoje or date.today()
    tem_2turno = bool(_has(conn, "candidatos") and conn.execute(
        "SELECT 1 FROM candidatos WHERE lower(resultado) LIKE '2%turno' LIMIT 1").fetchone())
    tem_t2 = False
    if _has(conn, "resultados"):
        tem_2turno = tem_2turno or bool(conn.execute(
            "SELECT 1 FROM resultados WHERE turno=1 AND lower(situacao) LIKE '2%turno' LIMIT 1").fetchone())
        tem_t2 = bool(conn.execute("SELECT 1 FROM resultados WHERE turno=2 LIMIT 1").fetchone())
    return fase_de(hoje, tem_2turno, tem_t2)


# ── Cards ─────────────────────────────────────────────────────────────────────

CARD_SQL = """
SELECT c.sq, c.uf, c.cargo, c.numero, c.nome, c.nome_urna, c.nome_social, c.partido, c.partido_nome,
       c.federacao, c.federacao_nome, c.coligacao, c.coligacao_composicao, c.idade, c.genero, c.cor_raca,
       c.instrucao, c.ocupacao, c.estado_civil, c.naturalidade, c.situacao, c.na_urna, c.substituido,
       c.limite_gastos, c.declarou_bens, c.resultado, c.titular_sq, c.mandato_atual, c.eleito_ultima,
       c.parlamentar_id,
       (SELECT COALESCE(SUM(valor), 0) FROM bens b WHERE b.sq = c.sq) AS bens_total,
       b22.bens_2022,
       f.receitas, f.despesas,
       EXISTS(SELECT 1 FROM fotos ft WHERE ft.sq = c.sq) AS tem_foto,
       (SELECT arquivo FROM propostas p WHERE p.sq = c.sq ORDER BY arquivo LIMIT 1) AS proposta,
       COALESCE(c.criterio_debate, 0) AS criterio_debate,
       c.congresso_chapa AS congresso_agremiacao
FROM candidatos c
LEFT JOIN bens_2022 b22 ON b22.sq = c.sq
LEFT JOIN fin_totais f ON f.sq = c.sq
"""


def _card(row: dict) -> dict:
    row = dict(row)
    row["foto"] = f"/fotos/{row['sq']}.jpg" if row.pop("tem_foto") else None
    row["proposta"] = f"/propostas/{row['proposta']}" if row.get("proposta") else None
    row["na_urna"] = bool(row["na_urna"])
    row["idade"] = int(row["idade"]) if row.get("idade") is not None else None
    row["substituido"] = bool(row["substituido"])
    row["declarou_bens"] = bool(row["declarou_bens"])
    row["criterio_debate"] = bool(row["criterio_debate"])
    row["divulgacand"] = DIVULGA.format(uf=row["uf"], sq=row["sq"])
    row["parlamentar_id"] = pub_id(row.get("parlamentar_id"))
    return row


def _cards(conn: sqlite3.Connection, where: str, params=()) -> list[dict]:
    rows = _rows(conn, f"{CARD_SQL} WHERE {where}", params)
    return [_card(r) for r in sorted(rows, key=lambda r: (alpha_key(r["nome_urna"]), r["sq"]))]


def _with_companions(conn: sqlite3.Connection, cards: list[dict]) -> list[dict]:
    if not cards:
        return cards
    ids = [c["sq"] for c in cards]
    marks = ",".join("?" * len(ids))
    comp = defaultdict(list)
    for r in _rows(
        conn,
        f"""SELECT c.sq, c.titular_sq, c.cargo, c.nome_urna, c.partido, c.situacao, c.na_urna,
                   EXISTS(SELECT 1 FROM fotos ft WHERE ft.sq=c.sq) AS tem_foto
            FROM candidatos c WHERE c.titular_sq IN ({marks}) ORDER BY c.cargo, c.na_urna DESC, c.nome_urna, c.sq""",
        ids,
    ):
        r["foto"] = f"/fotos/{r['sq']}.jpg" if r.pop("tem_foto") else None
        r["na_urna"] = bool(r["na_urna"])
        comp[r.pop("titular_sq")].append(r)
    for c in cards:
        c["companheiros"] = comp.get(c["sq"], [])
    return cards


# ── Endpoints ─────────────────────────────────────────────────────────────────


def fontes(conn: sqlite3.Connection) -> list[dict]:
    return _rows(conn, "SELECT * FROM fontes ORDER BY orgao, nome") if _has(conn, "fontes") else []


def meta(conn: sqlite3.Connection) -> dict:
    m = _meta(conn)
    vagas = defaultdict(dict)
    for r in _rows(conn, "SELECT uf, cargo, vagas FROM vagas"):
        vagas[r["uf"]][r["cargo"]] = r["vagas"]
    contagem = defaultdict(dict)
    for r in _rows(conn, "SELECT uf, cargo, COUNT(*) n FROM candidatos WHERE na_urna=1 GROUP BY uf, cargo"):
        contagem[r["uf"]][r["cargo"]] = r["n"]
    totais = {r["cargo"]: r["n"] for r in _rows(conn, "SELECT cargo, COUNT(*) n FROM candidatos WHERE na_urna=1 GROUP BY cargo")}
    return {
        "eleicao": {"data_1turno": DATA_ELEICAO.isoformat(), "data_2turno": DATA_2TURNO.isoformat(), "fase": fase(conn)},
        "atualizacao": {
            "tse_gerado_em": m.get("tse_gerado_em"),
            "tse_coletado_em": m.get("tse_atualizado_em"),
            "prestacao_gerada_em": m.get("prestacao_gerada_em"),
            "parlamentares_coletado_em": m.get("parlamentares_atualizado_em"),
            "resultados_consultado_em": m.get("resultados_consultado_em"),
        },
        "ufs": [
            {"uf": uf, "nome": nome, "vagas": vagas.get(uf, {}), "candidatos": contagem.get(uf, {})}
            for uf, nome in UF_NOMES.items()
        ],
        "totais": totais,
        "fontes": fontes(conn),
    }


def presidente(conn: sqlite3.Connection) -> dict:
    cards = _with_companions(conn, _cards(conn, "c.cargo = 'presidente'"))
    return {"uf": "BR", "cargo": "presidente", "candidatos": cards, "fontes": FONTES_CARD + ["tse_propostas"] + FONTES_CONGRESSO}


def uf_majoritarios(conn: sqlite3.Connection, uf: str) -> dict:
    uf = uf.upper()
    gov = _with_companions(conn, _cards(conn, "c.uf = ? AND c.cargo = 'governador'", (uf,)))
    sen = _with_companions(conn, _cards(conn, "c.uf = ? AND c.cargo = 'senador'", (uf,)))
    vagas = {r["cargo"]: r["vagas"] for r in _rows(conn, "SELECT cargo, vagas FROM vagas WHERE uf=?", (uf,))}
    return {"uf": uf, "nome": UF_NOMES.get(uf, uf), "vagas": vagas, "governador": gov, "senador": sen, "fontes": FONTES_CARD + ["tse_propostas"] + FONTES_CONGRESSO}


LITE_SQL = """
SELECT c.sq, c.cargo, c.numero, c.nome_urna, c.partido, c.federacao, c.situacao, c.na_urna, c.genero, c.cor_raca,
       c.idade, c.instrucao, c.ocupacao, c.mandato_atual, c.eleito_ultima, c.resultado,
       ROUND((SELECT COALESCE(SUM(valor),0) FROM bens b WHERE b.sq=c.sq), 2) AS bens_total,
       ROUND(f.receitas, 2) AS receitas, ROUND(f.despesas, 2) AS despesas,
       EXISTS(SELECT 1 FROM fotos ft WHERE ft.sq = c.sq) AS tem_foto
FROM candidatos c LEFT JOIN fin_totais f ON f.sq = c.sq
"""


def uf_deputados(conn: sqlite3.Connection, uf: str) -> dict:
    uf = uf.upper()
    rows = _rows(
        conn,
        f"{LITE_SQL} WHERE c.uf = ? AND c.cargo IN ('deputado-federal','deputado-estadual','deputado-distrital')",
        (uf,),
    )
    rows.sort(key=lambda r: (alpha_key(r["nome_urna"]), r["sq"]))
    for r in rows:
        r["foto"] = f"/fotos/{r['sq']}.jpg" if r.pop("tem_foto") else None
        r["na_urna"] = bool(r["na_urna"])
        r["idade"] = int(r["idade"]) if r.get("idade") is not None else None
    vagas = {r["cargo"]: r["vagas"] for r in _rows(conn, "SELECT cargo, vagas FROM vagas WHERE uf=?", (uf,))}
    return {"uf": uf, "nome": UF_NOMES.get(uf, uf), "vagas": vagas, "candidatos": rows, "fontes": ["tse_candidatos", "tse_complementar", "tse_bens", "tse_prestacao", "tse_fotos", "tse_historico", *FONTES_CONGRESSO]}


def candidato(conn: sqlite3.Connection, sq: str) -> dict | None:
    cards = _cards(conn, "c.sq = ?", (sq,))
    if not cards:
        return None
    c = _with_companions(conn, cards)[0]
    if c.get("titular_sq"):
        t = _cards(conn, "c.sq = ?", (c["titular_sq"],))
        c["titular"] = {k: t[0][k] for k in ("sq", "nome_urna", "cargo", "partido", "foto")} if t else None
    c["bens"] = _rows(conn, "SELECT tipo, descricao, valor FROM bens WHERE sq=? ORDER BY valor DESC, ordem, tipo", (sq,))
    c["bens_por_tipo"] = _rows(conn, "SELECT tipo, SUM(valor) valor, COUNT(*) n FROM bens WHERE sq=? GROUP BY tipo ORDER BY 2 DESC, tipo", (sq,))
    c["historico"] = _rows(conn, "SELECT ano, cargo, uf, ue, partido, numero, resultado, eleito, foi_2turno FROM historico WHERE sq=? ORDER BY ano DESC, cargo", (sq,))
    c["redes"] = [r["url"] for r in _rows(conn, "SELECT url FROM redes WHERE sq=? ORDER BY ordem, url", (sq,))]
    c["propostas"] = [f"/propostas/{r['arquivo']}" for r in _rows(conn, "SELECT arquivo FROM propostas WHERE sq=? ORDER BY arquivo", (sq,))]
    c["financas"] = financas(conn, sq)
    c["mandato"] = parlamentar(conn, c["parlamentar_id"], resumo=True) if c.get("parlamentar_id") else None
    c["resultados"] = _rows(conn, "SELECT turno, votos, pct, situacao, eleito FROM resultados WHERE sq=? ORDER BY turno", (sq,)) if _has(conn, "resultados") else []
    c["fontes"] = FONTES_CARD + ["tse_redes", "tse_bens_2022", "tse_propostas"] + FONTES_CONGRESSO
    c["contas_atualizadas_em"] = _meta(conn).get("prestacao_gerada_em")
    c["custo_por_voto"] = custo_por_voto(c)
    return c


def financas(conn: sqlite3.Connection, sq: str) -> dict:
    """Detalhe das finanças de uma candidatura (também usado por etl.contas, sobre um banco em memória)."""
    return {
        "receitas_por_origem": _rows(conn, "SELECT origem, valor FROM fin_receita_origem WHERE sq=? ORDER BY valor DESC, origem", (sq,)),
        "receitas_por_fonte": _rows(conn, "SELECT fonte, valor FROM fin_receita_fonte WHERE sq=? ORDER BY valor DESC, fonte", (sq,)),
        "maiores_doadores": _rows(conn, "SELECT doador, tipo, origem, valor FROM fin_doadores WHERE sq=? ORDER BY valor DESC, doador", (sq,)),
        "despesas_por_categoria": _rows(conn, "SELECT categoria, valor FROM fin_despesa_categoria WHERE sq=? ORDER BY valor DESC, categoria", (sq,)),
        "maiores_fornecedores": _rows(conn, "SELECT fornecedor, valor FROM fin_fornecedores WHERE sq=? ORDER BY valor DESC, fornecedor", (sq,)),
    }


def custo_por_voto(c: dict) -> dict | None:
    """Receitas declaradas ÷ votos no turno que elegeu a candidatura (só para quem foi eleito em 2026).

    Sem receita declarada, ou sem votos, não há conta a fazer (None). Usado pelo export, por
    etl.contas e por etl.apuracao_remota (quando o resultado do 2º turno chega).
    """
    eleito = [r for r in c.get("resultados") or [] if r.get("eleito") and r.get("votos")]
    receitas = c.get("receitas")
    if not eleito or not receitas or receitas <= 0:
        return None
    r = max(eleito, key=lambda r: r["turno"])
    votos = int(r["votos"])
    return {"valor": round(receitas / votos, 2), "receitas": round(receitas, 2), "votos": votos, "turno": r["turno"]}


def busca(conn: sqlite3.Connection) -> list[list]:
    """Compact search index of every candidacy on the ballot: [sq, nome_urna, nome, numero, uf, cargo, partido]."""
    return [
        [r["sq"], r["nome_urna"], r["nome"], r["numero"], r["uf"], r["cargo"], r["partido"]]
        for r in sorted(
            _rows(conn, "SELECT sq, nome_urna, nome, numero, uf, cargo, partido FROM candidatos WHERE na_urna=1 AND cargo IN %s" % (TITULARES,)),
            key=lambda r: (alpha_key(r["nome_urna"]), r["sq"]),
        )
    ]


def partidos(conn: sqlite3.Connection) -> list[dict]:
    return _rows(conn, "SELECT * FROM partidos ORDER BY partido") if _has(conn, "partidos") else []


def receitas_por_fonte_por_cargo(conn: sqlite3.Connection) -> dict:
    """Soma das receitas por fonte e cargo (estatisticas.json; também usado por etl.contas)."""
    fontes_fin = defaultdict(dict)
    for r in _rows(
        conn,
        # Sem "Recursos de outros candidatos": o repasse entre campanhas seria contado duas vezes.
        f"SELECT c.cargo, f.fonte, SUM(f.valor) v FROM fin_receita_fonte_agregado f JOIN candidatos c ON c.sq=f.sq WHERE c.cargo IN {TITULARES} GROUP BY 1, 2",
    ):
        fontes_fin[r["cargo"]][r["fonte"]] = r["v"]
    return fontes_fin


def estatisticas(conn: sqlite3.Connection) -> dict:
    """'A eleição em números': perfil de quem está na urna, por cargo."""
    base = f"FROM candidatos c WHERE c.na_urna=1 AND c.cargo IN {TITULARES}"

    def dist(col: str) -> dict:
        out = defaultdict(dict)
        for r in _rows(conn, f"SELECT c.cargo, COALESCE(c.{col}, 'Não informado') k, COUNT(*) n {base} GROUP BY 1, 2"):
            out[r["cargo"]][r["k"]] = r["n"]
        return out

    faixas = defaultdict(lambda: defaultdict(int))
    for r in _rows(conn, f"SELECT c.cargo, c.idade {base}"):
        i = r["idade"]
        k = "Não informado" if i is None else "18–29" if i < 30 else "30–39" if i < 40 else "40–49" if i < 50 else "50–59" if i < 60 else "60–69" if i < 70 else "70+"
        faixas[r["cargo"]][k] += 1

    bens = defaultdict(list)
    for r in _rows(conn, f"SELECT c.cargo, (SELECT COALESCE(SUM(valor),0) FROM bens b WHERE b.sq=c.sq) v {base}"):
        bens[r["cargo"]].append(r["v"])
    bens_resumo = {
        k: {"mediana": median(v), "zero": sum(1 for x in v if x == 0), "acima_1mi": sum(1 for x in v if x >= 1_000_000), "n": len(v)}
        for k, v in bens.items()
    }

    fontes_fin = receitas_por_fonte_por_cargo(conn)

    ocup = defaultdict(list)
    for r in _rows(conn, f"SELECT c.cargo, c.ocupacao k, COUNT(*) n {base} GROUP BY 1, 2 ORDER BY 3 DESC, 2"):
        if len(ocup[r["cargo"]]) < 10:
            ocup[r["cargo"]].append({"ocupacao": r["k"] or "Não informado", "n": r["n"]})

    situacao = defaultdict(dict)
    for r in _rows(conn, f"SELECT cargo, COALESCE(situacao,'Não informado') k, COUNT(*) n FROM candidatos WHERE cargo IN {TITULARES} GROUP BY 1, 2"):
        situacao[r["cargo"]][r["k"]] = r["n"]

    concorrencia = _rows(
        conn,
        f"""SELECT v.uf, v.cargo, v.vagas, COUNT(c.sq) candidatos, ROUND(1.0*COUNT(c.sq)/v.vagas, 1) por_vaga
            FROM vagas v LEFT JOIN candidatos c ON c.uf=v.uf AND c.cargo=v.cargo AND c.na_urna=1
            WHERE v.cargo IN {TITULARES} GROUP BY v.uf, v.cargo, v.vagas ORDER BY v.uf, v.cargo""",
    )
    por_partido = _rows(
        conn,
        f"SELECT c.partido, c.cargo, COUNT(*) n {base} GROUP BY 1, 2 ORDER BY c.partido, c.cargo",
    )
    return {
        "genero": dist("genero"),
        "cor_raca": dist("cor_raca"),
        "instrucao": dist("instrucao"),
        "faixa_etaria": {k: dict(v) for k, v in faixas.items()},
        "ocupacoes": ocup,
        "bens": bens_resumo,
        "receitas_por_fonte": fontes_fin,
        "situacao_registro": situacao,
        "concorrencia": concorrencia,
        "por_partido": por_partido,
        "fontes": ["tse_candidatos", "tse_complementar", "tse_bens", "tse_prestacao", "tse_vagas"],
    }


# ── Mandatos (cota parlamentar) ───────────────────────────────────────────────


def parlamentares(conn: sqlite3.Connection) -> dict:
    if not _has(conn, "parlamentares"):
        return {"parlamentares": [], "anos": [], "limites": [], "fontes": []}
    anos = [r["ano"] for r in _rows(conn, "SELECT DISTINCT ano FROM ceap_mensal ORDER BY ano")]
    totais = defaultdict(dict)
    for r in _rows(
        conn,
        """SELECT parlamentar_id, ano, SUM(valor) v, COUNT(DISTINCT mes) meses,
                  SUM(CASE WHEN categoria LIKE 'Passagens%' THEN valor ELSE 0 END) passagens
           FROM ceap_mensal GROUP BY 1, 2""",
    ):
        totais[pub_id(r["parlamentar_id"])][str(r["ano"])] = {
            "valor": round(r["v"], 2),
            "meses": r["meses"],
            "passagens": round(r["passagens"], 2),
            # Média por mês com lançamento: compara de forma justa quem exerceu o mandato por menos tempo.
            "media_mensal": round(r["v"] / r["meses"], 2) if r["meses"] else None,
        }
    cats = defaultdict(dict)
    for r in _rows(conn, "SELECT parlamentar_id, categoria, SUM(valor) v FROM ceap_mensal GROUP BY 1, 2"):
        cats[pub_id(r["parlamentar_id"])][r["categoria"]] = round(r["v"], 2)
    out = []
    for p in _rows(
        conn,
        """SELECT p.id, p.casa, p.nome, p.partido, p.uf, p.foto_url, p.pagina_oficial, p.em_exercicio,
                  pc.sq AS candidato_sq, c.cargo AS candidato_cargo, c.uf AS candidato_uf, c.na_urna AS candidato_na_urna
           FROM parlamentares p
           LEFT JOIN parlamentar_candidato pc ON pc.parlamentar_id = p.id
           LEFT JOIN candidatos c ON c.sq = pc.sq""",
    ):
        p["em_exercicio"] = bool(p["em_exercicio"])
        p["id"] = pub_id(p["id"])
        p["candidato_na_urna"] = bool(p["candidato_na_urna"]) if p["candidato_na_urna"] is not None else None
        p["por_ano"] = totais.get(p["id"], {})
        p["por_categoria"] = cats.get(p["id"], {})
        p["total"] = round(sum(v["valor"] for v in p["por_ano"].values()), 2)
        out.append(p)
    out.sort(key=lambda p: (alpha_key(p["nome"]), p["id"]))
    limites = _rows(conn, "SELECT * FROM ceap_limite") if _has(conn, "ceap_limite") else []
    avisos = json.loads(_meta(conn).get("ceap_avisos", "[]"))
    return {
        "parlamentares": out,
        "anos": anos,
        "limites": limites,
        "avisos": avisos,
        "fontes": ["camara_ceap", "senado_ceaps", "camara_deputados", "senado_senadores"],
    }


def parlamentar(conn: sqlite3.Connection, pid: str, resumo: bool = False) -> dict | None:
    if not _has(conn, "parlamentares"):
        return None
    pid = db_id(pid)
    rows = _rows(conn, "SELECT id, casa, id_casa, nome, nome_civil, partido, uf, foto_url, pagina_oficial, em_exercicio FROM parlamentares WHERE id=?", (pid,))
    if not rows:
        return None
    p = rows[0]
    p["em_exercicio"] = bool(p["em_exercicio"])
    p["id"] = pub_id(p["id"])
    p["mensal"] = _rows(conn, "SELECT ano, mes, ROUND(SUM(valor),2) valor FROM ceap_mensal WHERE parlamentar_id=? GROUP BY ano, mes ORDER BY ano, mes", (pid,))
    p["por_categoria"] = _rows(conn, "SELECT ano, categoria, ROUND(SUM(valor),2) valor, SUM(n_documentos) n FROM ceap_mensal WHERE parlamentar_id=? GROUP BY ano, categoria ORDER BY ano, valor DESC, categoria", (pid,))
    p["fornecedores"] = _rows(conn, "SELECT ano, fornecedor, cnpj_cpf, ROUND(valor,2) valor, n_documentos FROM ceap_fornecedor WHERE parlamentar_id=? ORDER BY ano DESC, valor DESC, fornecedor", (pid,))
    p["total"] = round(sum(m["valor"] for m in p["mensal"]), 2)
    # Referência neutra: média MENSAL dos colegas da mesma casa e UF no mesmo ano (total ÷ meses com
    # lançamento de cada um), para não distorcer a comparação com suplentes que exerceram poucos meses.
    pares = _rows(
        conn,
        """SELECT ano, AVG(v / meses) media_mensal, COUNT(*) n FROM (
             SELECT m.parlamentar_id, m.ano, SUM(m.valor) v, COUNT(DISTINCT m.mes) meses
             FROM ceap_mensal m JOIN parlamentares p ON p.id = m.parlamentar_id
             WHERE p.casa = ? AND p.uf = ? GROUP BY m.parlamentar_id, m.ano)
           GROUP BY ano ORDER BY ano""",
        (p["casa"], p["uf"]),
    )
    p["media_uf_por_ano"] = [{"ano": r["ano"], "media_mensal": round(r["media_mensal"], 2), "n": r["n"]} for r in pares]
    p["por_ano"] = _rows(
        conn,
        """SELECT ano, ROUND(SUM(valor), 2) valor, COUNT(DISTINCT mes) meses,
                  ROUND(SUM(valor) / COUNT(DISTINCT mes), 2) media_mensal
           FROM ceap_mensal WHERE parlamentar_id=? GROUP BY ano ORDER BY ano""",
        (pid,),
    )
    if not resumo:
        link = _rows(conn, "SELECT sq FROM parlamentar_candidato WHERE parlamentar_id=?", (pid,))
        p["candidato"] = _cards(conn, "c.sq = ?", (link[0]["sq"],))[0] if link else None
    p["fontes"] = ["camara_ceap", "camara_deputados"] if p["casa"] == "camara" else ["senado_ceaps", "senado_senadores"]
    p["avisos"] = [a for a in json.loads(_meta(conn).get("ceap_avisos", "[]")) if a["casa"] in (p["casa"], "ambas")]
    limite = _rows(conn, "SELECT valor_mensal, vigencia, fonte_url FROM ceap_limite WHERE casa=? AND uf=?", (p["casa"], p["uf"])) if _has(conn, "ceap_limite") else []
    p["limite_mensal"] = limite[0] if limite else None
    return p


# ── Pesquisas registradas ─────────────────────────────────────────────────────


def pesquisas(conn: sqlite3.Connection) -> dict:
    """Polls registered at the TSE, exactly as published (no averages or projections)."""
    if not _has(conn, "pesquisas"):
        return {"pesquisas": [], "fontes": []}
    fotos = {r["sq"] for r in _rows(conn, "SELECT sq FROM fotos")} if _has(conn, "fotos") else set()
    resultados = defaultdict(list)
    na_urna = {r["sq"]: bool(r["na_urna"]) for r in _rows(conn, "SELECT sq, na_urna FROM candidatos WHERE cargo IN ('presidente','governador','senador')")}
    for r in _rows(conn, "SELECT pesquisa_id, nome, partido, pct, sq FROM pesquisa_resultados"):
        r["foto"] = f"/fotos/{r['sq']}.jpg" if r["sq"] in fotos else None
        r["na_urna"] = na_urna.get(r["sq"], True)
        resultados[r.pop("pesquisa_id")].append(r)
    out = []
    for p in _rows(conn, "SELECT * FROM pesquisas ORDER BY campo_fim DESC, divulgacao DESC, instituto"):
        p["fontes"] = json.loads(p.pop("fontes_json") or "[]")
        p["outros"] = json.loads(p.pop("outros_json") or "[]")
        p["resultados"] = sorted(resultados.get(p["id"], []), key=lambda r: alpha_key(r["nome"]))
        out.append(p)
    return {"pesquisas": out, "fontes": ["pesquisas_registradas"]}


# ── Apuração / 2º turno ───────────────────────────────────────────────────────


def resultados(conn: sqlite3.Connection) -> dict:
    """Majoritários: status da apuração e votos por candidato (somente dados oficiais publicados)."""
    out = {"fase": fase(conn), "disputas": [], "fontes": ["tse_resultados"]}
    if not _has(conn, "resultados"):
        return out
    status = {(r["turno"], r["uf"], r["cargo"]): r for r in _rows(conn, "SELECT * FROM resultados_status")}
    for (turno, uf, cargo), st in sorted(status.items()):
        if cargo not in MAJORITARIOS:
            continue
        cands = _rows(
            conn,
            """SELECT r.sq, r.numero, r.nome, r.votos, r.pct, r.situacao, r.eleito, c.nome_urna, c.partido,
                      EXISTS(SELECT 1 FROM fotos ft WHERE ft.sq=r.sq) tem_foto
               FROM resultados r LEFT JOIN candidatos c ON c.sq = r.sq
               WHERE r.turno=? AND r.uf=? AND r.cargo=? ORDER BY r.votos DESC, r.sq""",
            (turno, uf, cargo),
        )
        for c in cands:
            c["foto"] = f"/fotos/{c['sq']}.jpg" if c.pop("tem_foto") else None
        out["disputas"].append({"turno": turno, "uf": uf, "cargo": cargo, "pct_secoes": st["pct_secoes"], "atualizado": st["atualizado"], "url": st["url"], "candidatos": cands})
    return out


def segundo_turno(conn: sqlite3.Connection) -> dict:
    """Disputas que vão (ou foram) ao 2º turno, com o perfil completo dos finalistas lado a lado."""
    sqs: dict[tuple[str, str], list[str]] = defaultdict(list)
    for r in _rows(conn, "SELECT sq, uf, cargo FROM candidatos WHERE lower(resultado) LIKE '2%turno' AND cargo IN ('presidente','governador')"):
        sqs[(r["uf"], r["cargo"])].append(r["sq"])
    if _has(conn, "resultados"):
        for r in _rows(conn, "SELECT sq, uf, cargo FROM resultados WHERE turno=1 AND lower(situacao) LIKE '2%turno'"):
            if r["sq"] not in sqs[(r["uf"], r["cargo"])]:
                sqs[(r["uf"], r["cargo"])].append(r["sq"])
    disputas = []
    for (uf, cargo), ids in sorted(sqs.items(), key=lambda kv: (kv[0][1] != "presidente", kv[0][0])):
        cards = [c for c in (candidato(conn, sq) for sq in ids) if c]
        disputas.append({"uf": uf, "nome_uf": UF_NOMES.get(uf, uf), "cargo": cargo, "candidatos": cards})
    return {"fase": fase(conn), "disputas": disputas, "fontes": FONTES_CARD + ["tse_resultados", "tse_historico"]}
