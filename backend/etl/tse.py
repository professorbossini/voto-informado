"""ETL das candidaturas de 2026 a partir dos dados abertos do TSE.

Fonte: https://dadosabertos.tse.jus.br (CDN cdn.tse.jus.br). Gera as tabelas
candidatos, bens, historico, redes, financas_* e vagas no SQLite.

Uso: .venv/bin/python -m etl.tse
"""

from __future__ import annotations

import re
import sqlite3
import unicodedata
import zipfile
from collections.abc import Iterable
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd

from . import common
from .common import ANO, PHOTOS, PROPOSTAS, RAW, TSE_CDN, UFS

CARGOS = {
    "PRESIDENTE": "presidente",
    "VICE-PRESIDENTE": "vice-presidente",
    "GOVERNADOR": "governador",
    "VICE-GOVERNADOR": "vice-governador",
    "SENADOR": "senador",
    "1º SUPLENTE": "1-suplente",
    "2º SUPLENTE": "2-suplente",
    "DEPUTADO FEDERAL": "deputado-federal",
    "DEPUTADO ESTADUAL": "deputado-estadual",
    "DEPUTADO DISTRITAL": "deputado-distrital",
}
TITULARES = {"presidente", "governador", "senador", "deputado-federal", "deputado-estadual", "deputado-distrital"}
COMPANHEIROS = {
    "vice-presidente": "presidente",
    "vice-governador": "governador",
    "1-suplente": "senador",
    "2-suplente": "senador",
}

DATASETS = {
    "consulta_cand": f"{TSE_CDN}/odsele/consulta_cand/consulta_cand_{ANO}.zip",
    "consulta_cand_complementar": f"{TSE_CDN}/odsele/consulta_cand_complementar/consulta_cand_complementar_{ANO}.zip",
    "bem_candidato": f"{TSE_CDN}/odsele/bem_candidato/bem_candidato_{ANO}.zip",
    "bem_candidato_2022": f"{TSE_CDN}/odsele/bem_candidato/bem_candidato_2022.zip",
    "rede_social": f"{TSE_CDN}/odsele/consulta_cand/rede_social_candidato_{ANO}.zip",
    "historico": f"{TSE_CDN}/odsele/historico_candidatura/historico_candidatura_{ANO}.zip",
    "vagas": f"{TSE_CDN}/odsele/consulta_vagas/consulta_vagas_{ANO}.zip",
    "prestacao": f"{TSE_CDN}/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_{ANO}.zip",
}

NULOS = {"#NULO", "#NULO#", "#NE", "-1", "-3", "-4", "NÃO DIVULGÁVEL", ""}


def _zip(name: str, max_age_hours: float = 12) -> zipfile.ZipFile:
    path = common.download(DATASETS[name], RAW / f"{name}.zip", max_age_hours=max_age_hours)
    return zipfile.ZipFile(path)


def _read(zf: zipfile.ZipFile, suffix: str, usecols: list[str] | None = None, **kw) -> pd.DataFrame:
    member = next(n for n in zf.namelist() if n.endswith(suffix))
    with zf.open(member) as fh:
        return pd.read_csv(fh, sep=";", encoding="latin1", dtype=str, usecols=usecols, **kw)


def _clean(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    value = str(value).strip()
    return None if value.upper() in NULOS else value


def _money(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series.str.replace(".", "", regex=False).str.replace(",", ".", regex=False), errors="coerce").fillna(0.0)


_MASCARAS = [
    (re.compile(r"(?<!\d)\d{3}\.\d{3}\.\d{3}-\d{2}(?!\d)"), "***.***.***-**"),  # CPF formatado (mesmo colado a texto)
    (re.compile(r"(?i)(CPF[^0-9]{0,6})\d{11}(?!\d)"), r"\1***********"),  # CPF sem pontuação
    (re.compile(r"(?i)\b(placa[:\s]*)[A-Z]{3}-?\d[A-Z0-9]\d{2}\b"), r"\1***-****"),
    (re.compile(r"(?i)\b(renavam|chassi)([:\s]*)[A-Z0-9]{9,17}\b"), r"\1\2*****"),
    (re.compile(r"(?i)\b(c/?c|conta(?: corrente)?|ag[eê]ncia|ag\.?)([:\s nº°]*)[\d.\-xX]{3,}"), r"\1\2****"),
]


def mask_ids(text: str | None) -> str | None:
    """Masks third-party CPFs, plates, vehicle and bank-account numbers in TSE free text."""
    if not text:
        return text
    text = text.replace("\u00bf", "–")  # TSE usa '¿' no lugar de travessão (latin-1)
    for pattern, repl in _MASCARAS:
        text = pattern.sub(repl, text)
    return text


_CPF_EM_NOME = re.compile(r"(?<!\d)\d{3}\.?\d{3}\.?\d{3}-?\d{2}(?!\d)")


def mask_doc_nome(nome: str | None) -> str | None:
    """Doadores e fornecedores MEI vêm com o CPF do titular no nome ('FULANO DE TAL 12345678901')."""
    return _CPF_EM_NOME.sub("***.***.***-**", nome) if nome else nome


def _title(text: str | None) -> str | None:
    """'SUPERIOR COMPLETO' -> 'Superior completo' (labels only, never names)."""
    if not text:
        return None
    return text[:1].upper() + text[1:].lower()


def normalize(text: str | None) -> str:
    if not text:
        return ""
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return " ".join(text.upper().split())


def _idade(nascimento: str | None, ref: date) -> int | None:
    try:
        d = datetime.strptime(nascimento, "%d/%m/%Y").date()
    except (TypeError, ValueError):
        return None
    return ref.year - d.year - ((ref.month, ref.day) < (d.month, d.day))


# ──────────────────────────────────────────────────────────────────────────────


def load_candidatos() -> pd.DataFrame:
    base = _read(_zip("consulta_cand"), "_BRASIL.csv")
    comp = _read(_zip("consulta_cand_complementar"), "_BRASIL.csv")
    df = base.merge(comp.drop(columns=["DT_GERACAO", "HH_GERACAO", "ANO_ELEICAO", "CD_ELEICAO"]), on="SQ_CANDIDATO", how="left")
    df = df[df.DS_CARGO.isin(CARGOS)].copy()
    df["cargo"] = df.DS_CARGO.map(CARGOS)
    return df


def build_candidatos(conn: sqlite3.Connection, df: pd.DataFrame) -> None:
    eleicao = date(2026, 10, 4)
    rows = []
    for r in df.itertuples(index=False):
        sit = _clean(r.DS_SITUACAO_JULGAMENTO) or _clean(r.DS_SITUACAO_CANDIDATO_TOT)
        rows.append(
            {
                "sq": r.SQ_CANDIDATO,
                "uf": r.SG_UF,
                "cargo": r.cargo,
                "numero": r.NR_CANDIDATO,
                "nome": r.NM_CANDIDATO,
                "nome_urna": r.NM_URNA_CANDIDATO,
                "nome_social": _clean(r.NM_SOCIAL_CANDIDATO),
                "partido": r.SG_PARTIDO,
                "partido_numero": r.NR_PARTIDO,
                "partido_nome": r.NM_PARTIDO,
                "federacao": _clean(r.SG_FEDERACAO),
                "federacao_nome": _clean(r.NM_FEDERACAO),
                "federacao_composicao": _clean(r.DS_COMPOSICAO_FEDERACAO),
                "coligacao": _clean(r.NM_COLIGACAO) if r.TP_AGREMIACAO != "PARTIDO ISOLADO" else None,
                "coligacao_composicao": _clean(r.DS_COMPOSICAO_COLIGACAO),
                "nascimento": _clean(r.DT_NASCIMENTO),
                "idade": _idade(_clean(r.DT_NASCIMENTO), eleicao),
                "genero": _title(_clean(r.DS_GENERO)),
                "cor_raca": _title(_clean(r.DS_COR_RACA)),
                "instrucao": _title(_clean(r.DS_GRAU_INSTRUCAO)),
                "estado_civil": _title(_clean(r.DS_ESTADO_CIVIL)),
                "ocupacao": _title(_clean(r.DS_OCUPACAO)),
                "naturalidade": " / ".join(x for x in [_clean(r.NM_MUNICIPIO_NASCIMENTO), _clean(r.SG_UF_NASCIMENTO)] if x) or None,
                "situacao": _title(sit),
                "na_urna": 1 if r.ST_CANDIDATO_INSERIDO_URNA == "SIM" else 0,
                "substituido": 1 if r.ST_SUBSTITUIDO == "S" else 0,
                "limite_gastos": float(r.VR_DESPESA_MAX_CAMPANHA) if _clean(r.VR_DESPESA_MAX_CAMPANHA) else None,
                "declarou_bens": 1 if r.ST_DECLARAR_BENS == "S" else 0,
                "processo": _clean(r.NR_PROCESSO),
                "cpf": _clean(r.NR_CPF_CANDIDATO),
                "sq_substituido": _clean(r.SQ_SUBSTITUIDO),
                "resultado": _clean(r.DS_SIT_TOT_TURNO),
                "nome_busca": normalize(f"{r.NM_URNA_CANDIDATO} {r.NM_CANDIDATO}"),
            }
        )
    out = pd.DataFrame(rows)

    # Substituição: quando o TSE marca o substituído e o substituto como "na urna" com o mesmo
    # número, os votos são do substituto. O substituído passa a contar como fora da urna.
    ativos = out[(out.na_urna == 1) & (out.substituido == 0)]
    chaves_ativas = set(zip(ativos.uf, ativos.cargo, ativos.numero))
    tem_ativo = pd.Series([k in chaves_ativas for k in zip(out.uf, out.cargo, out.numero)], index=out.index)
    dup = (out.na_urna == 1) & (out.substituido == 1) & tem_ativo
    out.loc[dup, "na_urna"] = 0
    if dup.any():
        print(f"  substituídos ainda marcados na urna: {int(dup.sum())} (ajustados para fora da urna)")

    # Liga titular ↔ vice/suplentes: mesma UF e mesmo número. Quem está na urna se liga a
    # quem está na urna; chapas substituídas (fora da urna) se ligam entre si.
    out["titular_sq"] = None
    titulares = out[out.cargo.isin(COMPANHEIROS.values())]
    lookup: dict[tuple, dict[int, str]] = {}
    for t in titulares.itertuples():
        lookup.setdefault((t.uf, t.cargo, t.numero), {}).setdefault(t.na_urna, t.sq)
    mask = out.cargo.isin(COMPANHEIROS)

    def find(uf, cargo, numero, na_urna):
        options = lookup.get((uf, COMPANHEIROS[cargo], numero), {})
        return options.get(na_urna) or next(iter(options.values()), None)

    out.loc[mask, "titular_sq"] = [
        find(*args) for args in zip(out.loc[mask, "uf"], out.loc[mask, "cargo"], out.loc[mask, "numero"], out.loc[mask, "na_urna"])
    ]
    # Vice/suplente substituído pertence à mesma chapa de quem o substituiu (cadeia SQ_SUBSTITUIDO).
    titular_de = dict(zip(out.sq, out.titular_sq))
    for _ in range(3):
        for sq, substituido_sq, cargo in zip(out.sq, out.sq_substituido, out.cargo):
            if cargo in COMPANHEIROS and substituido_sq and substituido_sq in titular_de and titular_de.get(sq):
                titular_de[substituido_sq] = titular_de[sq]
    out["titular_sq"] = out.sq.map(titular_de)

    conn.execute("DROP TABLE IF EXISTS candidatos")
    out.to_sql("candidatos", conn, index=False)
    conn.executescript(
        """
        CREATE UNIQUE INDEX ix_cand_sq ON candidatos(sq);
        CREATE INDEX ix_cand_uf_cargo ON candidatos(uf, cargo);
        CREATE INDEX ix_cand_titular ON candidatos(titular_sq);
        CREATE INDEX ix_cand_cpf ON candidatos(cpf);
        """
    )
    print(f"  candidatos: {len(out)} ({int(out.na_urna.sum())} na urna)")


def build_bens(conn: sqlite3.Connection) -> None:
    zf = _zip("bem_candidato")
    bens = _read(zf, "_BRASIL.csv", usecols=["SQ_CANDIDATO", "NR_ORDEM_BEM_CANDIDATO", "DS_TIPO_BEM_CANDIDATO", "DS_BEM_CANDIDATO", "VR_BEM_CANDIDATO"])
    bens["valor"] = _money(bens.VR_BEM_CANDIDATO)
    out = pd.DataFrame(
        {
            "sq": bens.SQ_CANDIDATO,
            "ordem": pd.to_numeric(bens.NR_ORDEM_BEM_CANDIDATO, errors="coerce"),
            "tipo": bens.DS_TIPO_BEM_CANDIDATO.fillna("Outros"),
            "descricao": bens.DS_BEM_CANDIDATO.map(_clean).map(mask_ids),
            "valor": bens.valor,
        }
    )
    conn.execute("DROP TABLE IF EXISTS bens")
    out.to_sql("bens", conn, index=False)
    conn.execute("CREATE INDEX ix_bens_sq ON bens(sq)")
    print(f"  bens: {len(out)} itens")


def build_historico(conn: sqlite3.Connection) -> None:
    """Candidaturas anteriores (desde 2004) de cada candidato de 2026 + bens declarados em 2022."""
    h = _read(_zip("historico"), "_BRASIL.csv")
    h = h[h.ANO_ELEICAO != str(ANO)].copy()
    h["NR_TURNO"] = pd.to_numeric(h.NR_TURNO, errors="coerce").fillna(1)
    # Uma linha por (candidato atual, eleição, cargo): o resultado final é o do último turno disputado.
    h["res"] = h.DS_SIT_TOT_TURNO.map(_clean)
    h = h.sort_values(["SQ_CANDIDATO_ATUAL", "ANO_ELEICAO", "CD_CARGO", "CD_TIPO_ELEICAO", "NR_TURNO"])
    rows = []
    # Eleições suplementares (CD_TIPO_ELEICAO=1) viram linhas próprias: não se misturam à ordinária do mesmo ano.
    for (atual, ano, cargo, _tipo), g in h.groupby(["SQ_CANDIDATO_ATUAL", "ANO_ELEICAO", "CD_CARGO", "CD_TIPO_ELEICAO"], sort=False):
        valid = g[g.res.notna()]
        last = valid.iloc[-1] if len(valid) else g.iloc[-1]
        first = g.iloc[0]
        resultado = last.res
        turno2 = g[g.NR_TURNO == 2]
        if resultado == "2º turno" and len(turno2) and turno2.res.isna().all():
            # A base do TSE não traz o resultado do 2º turno desta eleição: dizemos isso explicitamente.
            resultado = "2º turno (resultado final não informado na base do TSE)"
        if resultado is None or (isinstance(resultado, float) and pd.isna(resultado)):
            situacao = _clean(first.DS_SITUACAO_JULGAMENTO) or _clean(first.DS_SITUACAO_CANDIDATURA)
            if situacao is None:
                resultado = None
            elif situacao in ("Apto", "Deferido", "Cadastrado"):
                resultado = f"Registro {situacao.lower()} · resultado final não informado na base do TSE"
            else:
                resultado = f"Situação do registro: {situacao}"
        rows.append(
            {
                "sq": atual,
                "ano": int(ano),
                "cargo": _title(first.DS_CARGO) + (" (eleição suplementar)" if first.CD_TIPO_ELEICAO == "1" else ""),
                "uf": first.SG_UF,
                "ue": first.NM_UE,
                "partido": first.SG_PARTIDO,
                "numero": first.NR_CANDIDATO,
                "resultado": resultado,
                "sq_antigo": first.SQ_CANDIDATO,
                "foi_2turno": int((g.NR_TURNO == 2).any()),
            }
        )
    out = pd.DataFrame(rows)
    out["eleito"] = out.resultado.fillna("").str.startswith("Eleito").astype(int)
    conn.execute("DROP TABLE IF EXISTS historico")
    out.to_sql("historico", conn, index=False)
    conn.execute("CREATE INDEX ix_hist_sq ON historico(sq)")
    print(f"  historico: {len(out)} candidaturas anteriores")

    # Patrimônio declarado em 2022 (mesmo candidato, via SQ antigo do histórico)
    sq2022 = out[out.ano == 2022][["sq", "sq_antigo"]]
    b22 = _read(_zip("bem_candidato_2022", max_age_hours=24 * 30), "_BRASIL.csv", usecols=["SQ_CANDIDATO", "VR_BEM_CANDIDATO"])
    b22["valor"] = _money(b22.VR_BEM_CANDIDATO)
    tot = b22.groupby("SQ_CANDIDATO").valor.sum().rename("bens_2022").reset_index()
    m = sq2022.merge(tot, left_on="sq_antigo", right_on="SQ_CANDIDATO", how="inner")[["sq", "sq_antigo", "bens_2022"]]
    m = m.sort_values("sq_antigo").groupby("sq").tail(1)[["sq", "bens_2022"]] if "sq_antigo" in m else m
    conn.execute("DROP TABLE IF EXISTS bens_2022")
    m.to_sql("bens_2022", conn, index=False)
    conn.execute("CREATE INDEX ix_b22 ON bens_2022(sq)")
    print(f"  bens_2022: {len(m)} candidatos com declaração em 2022")


def build_redes(conn: sqlite3.Connection) -> None:
    r = _read(_zip("rede_social"), "_BRASIL.csv", usecols=["SQ_CANDIDATO", "NR_ORDEM_REDE_SOCIAL", "DS_URL"])
    r = r[r.DS_URL.notna()]
    out = pd.DataFrame({"sq": r.SQ_CANDIDATO, "ordem": pd.to_numeric(r.NR_ORDEM_REDE_SOCIAL, errors="coerce"), "url": r.DS_URL.str.strip()})
    out = out[out.url.str.match(r"^https?://", case=False)].drop_duplicates(["sq", "url"])
    conn.execute("DROP TABLE IF EXISTS redes")
    out.to_sql("redes", conn, index=False)
    conn.execute("CREATE INDEX ix_redes_sq ON redes(sq)")
    print(f"  redes: {len(out)} links")


def build_vagas(conn: sqlite3.Connection) -> None:
    v = _read(_zip("vagas"), "_BRASIL.csv", usecols=["SG_UF", "DS_CARGO", "QT_VAGA"])
    v["cargo"] = v.DS_CARGO.str.upper().map(CARGOS)
    v = v[v.cargo.isin(TITULARES)]
    out = pd.DataFrame({"uf": v.SG_UF, "cargo": v.cargo, "vagas": pd.to_numeric(v.QT_VAGA)})
    conn.execute("DROP TABLE IF EXISTS vagas")
    out.to_sql("vagas", conn, index=False)


DESPESAS_COLS = ["SQ_CANDIDATO", "SQ_DESPESA", "DS_ORIGEM_DESPESA", "DS_DESPESA", "NR_DOCUMENTO", "NM_FORNECEDOR", "NM_FORNECEDOR_RFB", "VR_DESPESA_CONTRATADA"]
TABELAS_FIN = (
    "fin_receita_fonte_agregado", "fin_receita_origem", "fin_receita_fonte", "fin_doadores",
    "fin_despesa_categoria", "fin_fornecedores",
)


def _despesas_reduzidas(chunk: pd.DataFrame) -> pd.DataFrame:
    """Só o que as finanças usam de cada bloco do CSV de despesas contratadas (cabe na memória)."""
    chunk = chunk.copy()
    chunk["valor"] = _money(chunk.VR_DESPESA_CONTRATADA)
    chunk["fornecedor"] = chunk.NM_FORNECEDOR_RFB.map(_clean).fillna(chunk.NM_FORNECEDOR.map(_clean)).fillna("Não informado")
    return chunk[["SQ_CANDIDATO", "SQ_DESPESA", "DS_DESPESA", "NR_DOCUMENTO", "DS_ORIGEM_DESPESA", "fornecedor", "valor"]]


def calcular_financas(rec: pd.DataFrame, desp_blocos: Iterable[pd.DataFrame], log=print) -> dict[str, pd.DataFrame]:
    """Finanças por candidatura, sem banco e sem rede (build local e etl.contas usam esta mesma função).

    rec: CSV de receitas com TODAS as colunas (só uma linha idêntica em todos os campos é tratada
    como repetição); desp_blocos: blocos do CSV de despesas contratadas com DESPESAS_COLS.
    Devolve as tabelas fin_* (mesmos nomes e colunas do banco), incluindo fin_totais.
    CPF/CNPJ só servem para classificar o tipo de doador: nenhuma tabela devolvida os contém.
    """
    antes = len(rec)
    rec = rec.drop_duplicates()  # linhas idênticas repetidas no arquivo contam uma vez
    rec = rec[rec.DS_ORIGEM_RECEITA.map(_clean).notna()].copy()  # linhas-modelo vazias (#NULO, valor 0)
    log(f"  receitas: {antes - len(rec)} linhas repetidas ou vazias descartadas")
    rec["valor"] = _money(rec.VR_RECEITA)
    rec_origem = rec.groupby(["SQ_CANDIDATO", "DS_ORIGEM_RECEITA"]).valor.sum().reset_index()
    rec_origem.columns = ["sq", "origem", "valor"]
    rec_fonte = rec.groupby(["SQ_CANDIDATO", "DS_FONTE_RECEITA"]).valor.sum().reset_index()
    rec_fonte.columns = ["sq", "fonte", "valor"]

    doc = rec.NR_CPF_CNPJ_DOADOR.fillna("").str.replace(r"\D", "", regex=True)
    rec["tipo_doador"] = "Não informado"
    rec.loc[doc.str.len() == 11, "tipo_doador"] = "Pessoa física"
    rec.loc[doc.str.len() == 14, "tipo_doador"] = "Pessoa jurídica / partido / candidato"
    rec["doador"] = rec.NM_DOADOR_RFB.map(_clean).fillna(rec.NM_DOADOR.map(_clean)).fillna("Não informado")
    top = (
        rec.groupby(["SQ_CANDIDATO", "doador", "tipo_doador", "DS_ORIGEM_RECEITA"]).valor.sum().reset_index().sort_values("valor", ascending=False)
    )
    top = top.groupby("SQ_CANDIDATO").head(10)
    top.columns = ["sq", "doador", "tipo", "origem", "valor"]
    top["doador"] = top.doador.map(mask_doc_nome)  # depois de somar: dois MEIs homônimos não se fundem

    desp = pd.concat([_despesas_reduzidas(b) for b in desp_blocos])
    antes = len(desp)
    desp = desp.drop_duplicates()  # mesmas colunas, mesmo valor: linha repetida no arquivo
    desp = desp[desp.DS_ORIGEM_DESPESA.map(_clean).notna()]
    log(f"  despesas: {antes - len(desp)} linhas repetidas ou vazias descartadas")
    desp_origem = desp.groupby(["SQ_CANDIDATO", "DS_ORIGEM_DESPESA"]).valor.sum().reset_index()
    desp_origem.columns = ["sq", "categoria", "valor"]
    forn = desp.groupby(["SQ_CANDIDATO", "fornecedor"]).valor.sum().reset_index().sort_values("valor", ascending=False)
    forn = forn.groupby("SQ_CANDIDATO").head(10)
    forn.columns = ["sq", "fornecedor", "valor"]
    forn["fornecedor"] = forn.fornecedor.map(mask_doc_nome)

    sem_transf = rec[rec.DS_ORIGEM_RECEITA != "Recursos de outros candidatos"]
    rec_fonte_agregado = sem_transf.groupby(["SQ_CANDIDATO", "DS_FONTE_RECEITA"]).valor.sum().reset_index()
    rec_fonte_agregado.columns = ["sq", "fonte", "valor"]

    totals = pd.DataFrame({"receitas": rec.groupby("SQ_CANDIDATO").valor.sum(), "despesas": desp.groupby("SQ_CANDIDATO").valor.sum()}).fillna(0)
    totals.index.name = "sq"
    return {
        "fin_receita_fonte_agregado": rec_fonte_agregado,
        "fin_receita_origem": rec_origem,
        "fin_receita_fonte": rec_fonte,
        "fin_doadores": top,
        "fin_despesa_categoria": desp_origem,
        "fin_fornecedores": forn,
        "fin_totais": totals.reset_index(),
    }


def gravar_financas(conn: sqlite3.Connection, tabelas: dict[str, pd.DataFrame]) -> None:
    """Grava as tabelas de calcular_financas no SQLite (o banco local ou um banco em memória)."""
    for name in TABELAS_FIN:
        conn.execute(f"DROP TABLE IF EXISTS {name}")
        tabelas[name].to_sql(name, conn, index=False)
        conn.execute(f"CREATE INDEX ix_{name} ON {name}(sq)")
    conn.execute("DROP TABLE IF EXISTS fin_totais")
    tabelas["fin_totais"].to_sql("fin_totais", conn, index=False)
    conn.execute("CREATE UNIQUE INDEX ix_fin_totais ON fin_totais(sq)")


def financas_do_zip(zf: zipfile.ZipFile, log=print) -> tuple[dict[str, pd.DataFrame], str]:
    """Lê o zip da prestação de contas: (tabelas fin_*, data do arquivo de despesas, em UTC)."""
    # Lê todas as colunas das receitas: só uma linha idêntica em TODOS os campos é repetição.
    rec = _read(zf, f"receitas_candidatos_{ANO}_BRASIL.csv")
    member = next(n for n in zf.namelist() if n.endswith(f"despesas_contratadas_candidatos_{ANO}_BRASIL.csv"))
    with zf.open(member) as fh:
        blocos = pd.read_csv(fh, sep=";", encoding="latin1", dtype=str, usecols=DESPESAS_COLS, chunksize=400_000)
        tabelas = calcular_financas(rec, blocos, log=log)
    info = zf.getinfo(member)
    # O horário dentro do zip do TSE está em UTC (confere com o Last-Modified do servidor).
    return tabelas, datetime(*info.date_time, tzinfo=timezone.utc).isoformat()


def build_financas(conn: sqlite3.Connection) -> None:
    """Receitas e despesas contratadas declaradas pelas campanhas (prestação parcial/final)."""
    tabelas, gerado_em = financas_do_zip(_zip("prestacao"))
    gravar_financas(conn, tabelas)
    common.set_meta(conn, "prestacao_gerada_em", gerado_em)
    print(f"  finanças: {len(tabelas['fin_totais'])} campanhas com movimentação")


def extract_fotos(conn: sqlite3.Connection) -> None:
    PHOTOS.mkdir(parents=True, exist_ok=True)
    wanted = {r[0] for r in conn.execute("SELECT sq FROM candidatos")}
    count = 0
    for uf in ["BR", *UFS]:
        url = f"{TSE_CDN}/eleicoes/eleicoes{ANO}/fotos/foto_cand{ANO}_{uf}_div.zip"
        path = common.download(url, RAW / "fotos_zip" / f"foto_cand{ANO}_{uf}_div.zip", max_age_hours=24)
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                stem = Path(name).stem  # FSP250002532324_div
                sq = stem[3:].removesuffix("_div")
                if sq in wanted:
                    target = PHOTOS / f"{sq}.jpg"
                    if not target.exists() or target.stat().st_size != zf.getinfo(name).file_size:
                        target.write_bytes(zf.read(name))
                    count += 1
    conn.execute("DROP TABLE IF EXISTS fotos")
    conn.execute("CREATE TABLE fotos (sq TEXT PRIMARY KEY)")
    conn.executemany("INSERT OR IGNORE INTO fotos VALUES (?)", [(p.stem,) for p in PHOTOS.glob("*.jpg")])
    print(f"  fotos: {count}")


def extract_propostas(conn: sqlite3.Connection) -> None:
    """Planos de governo (PDF) de presidente e governadores que estão na urna."""
    PROPOSTAS.mkdir(parents=True, exist_ok=True)
    wanted = {r[0] for r in conn.execute("SELECT sq FROM candidatos WHERE cargo IN ('presidente','governador')")}
    found = []
    for uf in ["BR", *UFS]:
        url = f"{TSE_CDN}/odsele/proposta_governo/proposta_governo_{ANO}_{uf}.zip"
        path = common.download(url, RAW / "propostas_zip" / f"proposta_governo_{ANO}_{uf}.zip", max_age_hours=24)
        with zipfile.ZipFile(path) as zf:
            for name in zf.namelist():
                if not name.lower().endswith(".pdf"):
                    continue
                stem = Path(name).stem  # 2026BR280002538811_01
                sq = stem.split("_")[0][6:]
                if sq in wanted:
                    target = PROPOSTAS / f"{stem[6:]}.pdf"
                    if not target.exists():
                        target.write_bytes(zf.read(name))
                    found.append((sq, target.name))
    conn.execute("DROP TABLE IF EXISTS propostas")
    conn.execute("CREATE TABLE propostas (sq TEXT, arquivo TEXT)")
    conn.executemany("INSERT INTO propostas VALUES (?, ?)", found)
    conn.execute("CREATE INDEX ix_prop_sq ON propostas(sq)")
    print(f"  propostas: {len(found)} PDFs")


PAGINA_CAND = f"https://dadosabertos.tse.jus.br/dataset/candidatos-{ANO}"
PAGINA_CONTAS = f"https://dadosabertos.tse.jus.br/dataset/prestacao-de-contas-eleitorais-{ANO}"


def register_sources(conn: sqlite3.Connection, gerado: str) -> None:
    tse = "Tribunal Superior Eleitoral (TSE) · Portal de Dados Abertos"
    reg = common.register_source
    reg(conn, "tse_candidatos", nome="Candidatos 2026", orgao=tse, url=DATASETS["consulta_cand"], pagina=PAGINA_CAND,
        descricao="Registro de candidaturas: nome, número, partido, federação, coligação, idade, gênero, cor/raça, instrução, ocupação.",
        arquivo=RAW / "consulta_cand.zip", gerado_em=gerado)
    reg(conn, "tse_complementar", nome="Candidatos 2026 · informações complementares", orgao=tse, url=DATASETS["consulta_cand_complementar"], pagina=PAGINA_CAND,
        descricao="Situação do registro (deferido, indeferido, renúncia...), presença na urna, limite de gastos de campanha, naturalidade.",
        arquivo=RAW / "consulta_cand_complementar.zip", gerado_em=gerado)
    reg(conn, "tse_bens", nome="Bens declarados pelos candidatos 2026", orgao=tse, url=DATASETS["bem_candidato"], pagina=PAGINA_CAND,
        descricao="Declaração de bens entregue pelo próprio candidato à Justiça Eleitoral no registro da candidatura (valores autodeclarados).",
        arquivo=RAW / "bem_candidato.zip", gerado_em=gerado)
    reg(conn, "tse_bens_2022", nome="Bens declarados pelos candidatos 2022", orgao=tse, url=DATASETS["bem_candidato_2022"],
        pagina="https://dadosabertos.tse.jus.br/dataset/candidatos-2022",
        descricao="Declaração de bens de 2022, usada para comparar com 2026 quando a mesma pessoa foi candidata nas duas eleições.",
        arquivo=RAW / "bem_candidato_2022.zip")
    reg(conn, "tse_historico", nome="Histórico de candidaturas", orgao=tse, url=DATASETS["historico"], pagina=PAGINA_CAND,
        descricao="Candidaturas anteriores (desde 2004) de cada candidato de 2026 e o resultado de cada uma, segundo o TSE.",
        arquivo=RAW / "historico.zip", gerado_em=gerado)
    reg(conn, "tse_redes", nome="Redes sociais de candidatos", orgao=tse, url=DATASETS["rede_social"], pagina=PAGINA_CAND,
        descricao="Endereços de sites e redes sociais informados pelo próprio candidato à Justiça Eleitoral.",
        arquivo=RAW / "rede_social.zip", gerado_em=gerado)
    reg(conn, "tse_vagas", nome="Vagas por cargo 2026", orgao=tse, url=DATASETS["vagas"], pagina=PAGINA_CAND,
        descricao="Quantidade de vagas em disputa por cargo e unidade da federação.", arquivo=RAW / "vagas.zip", gerado_em=gerado)
    reg(conn, "tse_prestacao", nome="Prestação de contas eleitorais de candidatos 2026", orgao=tse, url=DATASETS["prestacao"], pagina=PAGINA_CONTAS,
        descricao="Receitas e despesas contratadas declaradas pelas campanhas. Dados parciais: as campanhas seguem enviando informações até a prestação final.",
        arquivo=RAW / "prestacao.zip")
    reg(conn, "tse_fotos", nome="Fotos de candidatos 2026", orgao=tse, url=f"{TSE_CDN}/eleicoes/eleicoes{ANO}/fotos/", pagina=PAGINA_CAND,
        descricao="Fotos enviadas pelos candidatos no registro da candidatura (um arquivo por UF).", arquivo=RAW / "fotos_zip" / f"foto_cand{ANO}_BR_div.zip")
    reg(conn, "tse_propostas", nome="Propostas de governo 2026", orgao=tse, url=f"{TSE_CDN}/odsele/proposta_governo/", pagina=PAGINA_CAND,
        descricao="Planos de governo entregues por candidatos a presidente e governador (PDF original, sem edição).",
        arquivo=RAW / "propostas_zip" / f"proposta_governo_{ANO}_BR.zip")


def run() -> None:
    conn = common.connect()
    print("TSE: candidaturas")
    df = load_candidatos()
    build_candidatos(conn, df)
    build_bens(conn)
    build_historico(conn)
    build_redes(conn)
    build_vagas(conn)
    print("TSE: prestação de contas")
    build_financas(conn)
    print("TSE: fotos e propostas")
    extract_fotos(conn)
    extract_propostas(conn)
    gerado = df.DT_GERACAO.iloc[0] + " " + df.HH_GERACAO.iloc[0]
    common.set_meta(conn, "tse_gerado_em", gerado)
    register_sources(conn, gerado)
    common.set_meta(conn, "tse_atualizado_em", datetime.now().astimezone().isoformat(timespec="seconds"))
    conn.commit()
    conn.close()


if __name__ == "__main__":
    run()
