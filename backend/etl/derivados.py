"""Cruzamentos entre as bases (roda depois de etl.tse e etl.parlamentares).

- parlamentar_candidato: liga o mandato atual (Câmara/Senado) à candidatura de 2026,
  por CPF (Câmara) ou nome civil completo + UF/candidatura (Senado, que não publica CPF).
- partidos: tamanho das bancadas no Congresso na data da coleta, por partido e por
  federação (federações atuam como um único partido, Lei 14.208/2021).
- candidatos.mandato_atual / candidatos.eleito_ultima: fatos objetivos, sem juízo de valor.

Uso: .venv/bin/python -m etl.derivados
"""

from __future__ import annotations

import re
import sqlite3

import pandas as pd

from . import common
from .tse import normalize

MINIMO_DEBATE = 5  # Lei 9.504/97, art. 46: partidos com representação de, no mínimo, 5 parlamentares


def _has_table(conn: sqlite3.Connection, name: str) -> bool:
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None


def sigla_key(sigla: str | None) -> str:
    return normalize(sigla).replace(" ", "") if sigla else ""


def link_parlamentares(conn: sqlite3.Connection) -> None:
    if _has_table(conn, "parlamentares"):
        # Câmara e Senado grafam "sem partido" de formas diferentes.
        conn.execute("UPDATE parlamentares SET partido='Sem partido' WHERE partido IN ('S.PART.', 'S/Partido', 'S/PARTIDO', 'SEM PARTIDO')")
    conn.execute("DROP TABLE IF EXISTS parlamentar_candidato")
    conn.execute("CREATE TABLE parlamentar_candidato (parlamentar_id TEXT, sq TEXT, metodo TEXT)")
    if not _has_table(conn, "parlamentares"):
        print("  (sem tabela parlamentares; pulando vínculo)")
        return
    cand = pd.read_sql("SELECT sq, cpf, nome, uf, cargo, na_urna FROM candidatos", conn)
    cand["nome_n"] = cand.nome.map(normalize)
    parl = pd.read_sql("SELECT id, casa, nome, nome_civil, uf, cpf FROM parlamentares", conn)

    links = []
    by_cpf = cand[cand.cpf.notna()].sort_values("na_urna", ascending=False).drop_duplicates("cpf").set_index("cpf").sq
    by_nome = cand.sort_values("na_urna", ascending=False)
    for p in parl.itertuples():
        sq, metodo = None, None
        if p.cpf and p.cpf in by_cpf.index:
            sq, metodo = by_cpf[p.cpf], "cpf"
        elif p.nome_civil:
            hits = by_nome[by_nome.nome_n == normalize(p.nome_civil)]
            if len(hits) > 1:  # homônimos: exige a mesma UF ou candidatura nacional
                hits = hits[(hits.uf == p.uf) | (hits.uf == "BR")]
            if len(hits["nome_n"].unique()) == 1 and len(hits):
                sq, metodo = hits.iloc[0].sq, "nome_civil"
        if sq:
            links.append((p.id, sq, metodo))
    conn.executemany("INSERT INTO parlamentar_candidato VALUES (?,?,?)", links)
    conn.execute("CREATE INDEX ix_pc_sq ON parlamentar_candidato(sq)")
    print(f"  parlamentar ↔ candidato: {len(links)} vínculos")


def build_partidos(conn: sqlite3.Connection) -> None:
    cand = pd.read_sql(
        "SELECT DISTINCT partido, partido_nome, partido_numero, federacao, federacao_nome, federacao_composicao FROM candidatos",
        conn,
    )
    cand = cand.sort_values("federacao", na_position="last").drop_duplicates("partido")
    bancada = pd.DataFrame(columns=["partido", "casa", "n"])
    if _has_table(conn, "parlamentares"):
        bancada = pd.read_sql("SELECT partido, casa, COUNT(*) n FROM parlamentares WHERE em_exercicio=1 GROUP BY partido, casa", conn)
        # Siglas iguais com grafia diferente entre Câmara/Senado e TSE (ex.: 'PCdoB' x 'PCDOB').
        bancada["partido"] = bancada.partido.map(sigla_key)
    piv = bancada.pivot_table(index="partido", columns="casa", values="n", aggfunc="sum").fillna(0)
    cand["_k"] = cand.partido.map(sigla_key)
    cand["deputados"] = cand._k.map(piv.get("camara", pd.Series(dtype=float))).fillna(0).astype(int)
    cand["senadores"] = cand._k.map(piv.get("senado", pd.Series(dtype=float))).fillna(0).astype(int)
    cand["congresso"] = cand.deputados + cand.senadores
    fed_total = cand[cand.federacao.notna()].groupby("federacao").congresso.sum()
    cand["congresso_agremiacao"] = cand.apply(lambda r: int(fed_total[r.federacao]) if pd.notna(r.federacao) else int(r.congresso), axis=1)
    cand["criterio_debate"] = (cand.congresso_agremiacao >= MINIMO_DEBATE).astype(int)
    cand = cand.drop(columns=["_k"])
    conn.execute("DROP TABLE IF EXISTS partidos")
    cand.to_sql("partidos", conn, index=False)
    print(f"  partidos: {len(cand)} ({int(cand.criterio_debate.sum())} atendem ao critério de {MINIMO_DEBATE}+ parlamentares)")


def _partidos_da_chapa(partido: str, federacao: str | None, composicao: str | None) -> set[str]:
    """Siglas (normalizadas) de todos os partidos da coligação/federação de uma candidatura.

    Ex.: 'PSB / PDT / FEDERAÇÃO BRASIL DA ESPERANÇA - FE BRASIL (13-PT / 65-PC do B / 43-PV)'.
    """
    siglas = {sigla_key(partido)}
    if federacao:  # '13-PT/65-PC do B/43-PV'
        siglas |= {sigla_key(re.sub(r"^\d+-", "", x.strip())) for x in federacao.split("/")}
    if composicao:
        for grupo in re.findall(r"\(([^)]*)\)", composicao):
            siglas |= {sigla_key(re.sub(r"^\d+-", "", x.strip())) for x in grupo.split("/")}
        fora = re.sub(r"FEDERA[ÇC][ÃA]O[^(/]*\([^)]*\)", "", composicao, flags=re.I)
        siglas |= {sigla_key(x.strip()) for x in fora.split("/") if x.strip()}
    return {x for x in siglas if x}


def criterio_debate(conn: sqlite3.Connection) -> None:
    """Parlamentares em exercício somados por chapa (partido + federação + coligação).

    Inspirado no art. 46 da Lei 9.504/97 (5+ parlamentares no Congresso). Usa a composição
    na data da coleta, não a data de referência legal: isso é informado no site.
    """
    cols = {r[1] for r in conn.execute("PRAGMA table_info(candidatos)")}
    for col in ("congresso_chapa", "criterio_debate"):
        if col not in cols:
            conn.execute(f"ALTER TABLE candidatos ADD COLUMN {col} INTEGER")
    bancada: dict[str, int] = {}
    if _has_table(conn, "parlamentares"):
        for partido, n in conn.execute("SELECT partido, COUNT(*) FROM parlamentares WHERE em_exercicio=1 GROUP BY partido"):
            bancada[sigla_key(partido)] = bancada.get(sigla_key(partido), 0) + n
    rows = conn.execute(
        "SELECT sq, partido, federacao, coligacao_composicao FROM candidatos WHERE cargo IN ('presidente','governador','senador')"
    ).fetchall()
    updates = []
    for sq, partido, federacao, composicao in rows:
        total = sum(bancada.get(k, 0) for k in _partidos_da_chapa(partido, federacao, composicao))
        updates.append((total, int(total >= MINIMO_DEBATE), sq))
    conn.execute("UPDATE candidatos SET congresso_chapa=NULL, criterio_debate=0")
    conn.executemany("UPDATE candidatos SET congresso_chapa=?, criterio_debate=? WHERE sq=?", updates)
    print(f"  critério dos debates: {sum(u[1] for u in updates)} de {len(updates)} candidaturas majoritárias")


def flag_candidatos(conn: sqlite3.Connection) -> None:
    cols = {r[1] for r in conn.execute("PRAGMA table_info(candidatos)")}
    for col, typ in (("mandato_atual", "TEXT"), ("parlamentar_id", "TEXT"), ("eleito_ultima", "TEXT")):
        if col not in cols:
            conn.execute(f"ALTER TABLE candidatos ADD COLUMN {col} {typ}")
    conn.execute("UPDATE candidatos SET mandato_atual=NULL, parlamentar_id=NULL, eleito_ultima=NULL")
    if _has_table(conn, "parlamentares"):
        conn.execute(
            """
            UPDATE candidatos SET
              parlamentar_id = (SELECT pc.parlamentar_id FROM parlamentar_candidato pc WHERE pc.sq = candidatos.sq LIMIT 1),
              mandato_atual = (
                SELECT CASE p.casa WHEN 'camara' THEN 'Deputado(a) federal' ELSE 'Senador(a)' END || ' (' || p.uf || ')'
                FROM parlamentar_candidato pc JOIN parlamentares p ON p.id = pc.parlamentar_id
                WHERE pc.sq = candidatos.sq AND p.em_exercicio = 1 LIMIT 1)
            """
        )
    # Última vitória eleitoral registrada pelo TSE (2018 em diante), descrita como fato.
    conn.execute(
        """
        UPDATE candidatos SET eleito_ultima = (
          SELECT h.cargo || ' (' || h.ue || ', ' || h.ano || ')'
          FROM historico h WHERE h.sq = candidatos.sq AND h.eleito = 1 AND h.ano >= 2018
          ORDER BY h.ano DESC LIMIT 1)
        """
    )


AVISOS_CEAP = [
    {
        "casa": "camara",
        "anos": [2025, 2026],
        "texto": (
            "Lacuna na fonte oficial: os arquivos anuais da Câmara não trazem as passagens aéreas emitidas pelo "
            "sistema SIGEPA a partir de agosto de 2025. Por isso os totais de deputados em 2025 e 2026 aparecem "
            "menores do que o painel da Câmara. Para comparar anos, use a opção que exclui passagens aéreas."
        ),
    },
    {
        "casa": "camara",
        "anos": [],
        "texto": "Valores líquidos (vlrLiquido) de deputados da 57ª legislatura (desde fev/2023). Despesas de lideranças partidárias não entram.",
    },
    {
        "casa": "senado",
        "anos": [],
        "texto": "Valores reembolsados publicados pelo Senado (desde fev/2023). O Senado não publica, em formato aberto, o teto mensal por UF.",
    },
    {
        "casa": "ambas",
        "anos": [],
        "texto": (
            "A cota parlamentar é uma verba prevista em lei para custear o mandato. Gastar mais ou menos não indica, "
            "por si só, irregularidade. O teto mensal varia por estado (passagens para Brasília custam mais para quem "
            "mora longe); compare preferencialmente parlamentares do mesmo estado."
        ),
    },
]


def register_ceap_sources(conn: sqlite3.Connection) -> None:
    if not _has_table(conn, "parlamentares"):
        return
    raw = common.RAW
    reg = common.register_source
    camara = "Câmara dos Deputados · Dados Abertos"
    senado = "Senado Federal · Dados Abertos"
    reg(conn, "camara_ceap", nome="Cota parlamentar (CEAP) dos deputados", orgao=camara,
        url="https://www.camara.leg.br/cotas/Ano-2026.csv.zip", pagina="https://dadosabertos.camara.leg.br/swagger/api.html#staticfile",
        descricao="Arquivos anuais oficiais com cada despesa reembolsada pela Cota para o Exercício da Atividade Parlamentar (2023–2026).",
        arquivo=raw / "camara" / "Ano-2026.csv.zip")
    reg(conn, "camara_deputados", nome="Deputados da 57ª legislatura", orgao=camara,
        url="https://dadosabertos.camara.leg.br/api/v2/deputados?idLegislatura=57", pagina="https://dadosabertos.camara.leg.br/",
        descricao="Lista oficial de deputados, partido, UF e foto; teto mensal da cota por UF publicado em camara.leg.br/transparencia/gastos-parlamentares.")
    reg(conn, "senado_ceaps", nome="Cota parlamentar (CEAPS) dos senadores", orgao=senado,
        url="https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/2026",
        pagina="https://www12.senado.leg.br/transparencia/dados-abertos-transparencia",
        descricao="Despesas reembolsadas pela Cota para o Exercício da Atividade Parlamentar dos Senadores (2023–2026).",
        arquivo=raw / "senado" / "despesas_ceaps_2026.json")
    reg(conn, "senado_senadores", nome="Senadores da 57ª legislatura", orgao=senado,
        url="https://legis.senado.leg.br/dadosabertos/senador/lista/legislatura/57", pagina="https://legis.senado.leg.br/dadosabertos/",
        descricao="Lista oficial de senadores, partido, UF e foto.")
    import json
    common.set_meta(conn, "ceap_avisos", json.dumps(AVISOS_CEAP, ensure_ascii=False))


def _titulo_local(texto: str) -> str:
    minusculas = {"da", "de", "do", "das", "dos", "e"}
    palavras = texto.lower().split(" ")
    return " ".join(w if (i and w in minusculas) else w[:1].upper() + w[1:] for i, w in enumerate(palavras))


def format_eleito(conn: sqlite3.Connection) -> None:
    rows = conn.execute("SELECT sq, eleito_ultima FROM candidatos WHERE eleito_ultima IS NOT NULL").fetchall()
    out = []
    for sq, txt in rows:
        cargo, _, resto = txt.partition(" (")
        local, _, ano = resto.rstrip(")").rpartition(", ")
        cargo = re.sub(r"^(Senador|Deputado|Governador|Prefeito|Vereador|Presidente)\b(?!\()", lambda m: m.group(1) if m.group(1) == "Presidente" else f"{m.group(1)}(a)", cargo)
        cargo = re.sub(r"^Vice-(prefeito|governador)\b", lambda m: f"Vice-{m.group(1)}(a)", cargo)
        out.append((f"{cargo} ({_titulo_local(local)}, {ano})", sq))
    conn.executemany("UPDATE candidatos SET eleito_ultima=? WHERE sq=?", out)


def run() -> None:
    conn = common.connect()
    print("Derivados")
    link_parlamentares(conn)
    build_partidos(conn)
    flag_candidatos(conn)
    criterio_debate(conn)
    format_eleito(conn)
    register_ceap_sources(conn)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    run()
