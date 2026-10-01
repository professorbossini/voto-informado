"""Publica o banco local (SQLite gerado pelo ETL) num Postgres remoto, ex.: Neon.

Uso: DATABASE_URL=postgresql://usuario:senha@host/db?sslmode=require .venv/bin/python -m etl.neon

- Carrega cada tabela como `<tabela>__novo` e, numa única transação, troca pelas
  atuais: a API nunca enxerga um banco pela metade.
- Não envia CPF: ele só serve para cruzamentos feitos aqui, no ETL.
- Recria os índices do SQLite e uma função round(double precision, int), para que
  as mesmas consultas da API funcionem nos dois bancos.
"""

from __future__ import annotations

import os
import re
import sqlite3
import sys
import time

import pandas as pd
from sqlalchemy import BigInteger, Float, Text, create_engine, text

from .common import DB_PATH

# Colunas que nunca saem da máquina onde o ETL roda.
COLUNAS_PRIVADAS = {"candidatos": ["cpf"], "parlamentares": ["cpf"]}
SUFIXO = "__novo"


def _pg_url(url: str) -> str:
    # SQLAlchemy precisa do driver explícito (psycopg 3).
    return re.sub(r"^postgres(ql)?://", "postgresql+psycopg://", url)


def run() -> None:
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url.startswith(("postgres://", "postgresql://")):
        sys.exit("Defina DATABASE_URL=postgresql://... (string de conexão do Neon).")
    src = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    tabelas = [r[0] for r in src.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
    indices = [
        (r[0], r[1])
        for r in src.execute("SELECT tbl_name, sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")
    ]
    engine = create_engine(_pg_url(url), pool_pre_ping=True)

    t0 = time.time()
    with engine.begin() as pg:
        pg.execute(
            text(
                "CREATE OR REPLACE FUNCTION round(double precision, integer) RETURNS double precision "
                "AS $$ SELECT round($1::numeric, $2)::double precision $$ LANGUAGE sql IMMUTABLE"
            )
        )
    for t in tabelas:
        df = pd.read_sql(f'SELECT * FROM "{t}"', src)
        df = df.drop(columns=[c for c in COLUNAS_PRIVADAS.get(t, []) if c in df.columns])
        # Postgres aceita até 65.535 parâmetros por comando: o lote depende do nº de colunas.
        lote = max(1, 60_000 // max(1, len(df.columns)))
        # Tipos vêm do esquema do SQLite (tabelas vazias, como a da apuração, não têm o que inferir).
        tipos = {}
        for _cid, nome, tipo, *_ in src.execute(f'PRAGMA table_info("{t}")'):
            tipo = (tipo or "").upper()
            if nome in df.columns:
                tipos[nome] = BigInteger() if "INT" in tipo else Float() if tipo in ("REAL", "FLOAT", "DOUBLE") else Text()
        df.to_sql(f"{t}{SUFIXO}", engine, if_exists="replace", index=False, chunksize=lote, method="multi", dtype=tipos)
        print(f"  {t}: {len(df)} linhas")

    with engine.begin() as pg:  # troca atômica
        for t in tabelas:
            pg.execute(text(f'DROP TABLE IF EXISTS "{t}" CASCADE'))
            pg.execute(text(f'ALTER TABLE "{t}{SUFIXO}" RENAME TO "{t}"'))
        for tabela, sql in indices:
            colunas_idx = re.search(r"\(([^)]*)\)", sql)
            privadas = set(COLUNAS_PRIVADAS.get(tabela, []))
            if colunas_idx and privadas & {c.strip().strip('"') for c in colunas_idx.group(1).split(",")}:
                continue  # índice de coluna que não é publicada
            if tabela in tabelas:
                sql = re.sub(r"^CREATE (UNIQUE )?INDEX ", lambda m: f"CREATE {m.group(1) or ''}INDEX IF NOT EXISTS ", sql)
                pg.execute(text(sql))
    print(f"✓ {len(tabelas)} tabelas publicadas no Postgres em {time.time() - t0:.0f}s (sem CPF)")


if __name__ == "__main__":
    run()
