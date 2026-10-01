"""Database access for the API: SQLite locally, Postgres (e.g. Neon) in production.

Set DATABASE_URL=postgresql://... to use Postgres; otherwise the local SQLite file
built by the ETL is used. Queries are written once (sqlite style, `?` placeholders)
and translated here, so app.queries works unchanged on both.
"""

from __future__ import annotations

import os
import sqlite3
from collections.abc import Iterator, Sequence
from typing import Any

from etl.common import DB_PATH

DATABASE_URL = os.environ.get("DATABASE_URL", "").strip()


class PgConnection:
    """Minimal sqlite3-like facade over a psycopg connection (dict rows)."""

    dialect = "postgres"

    def __init__(self, raw: Any):
        self.raw = raw

    def execute(self, sql: str, params: Sequence[Any] = ()):
        if params:
            # psycopg uses %s and treats a literal % as a placeholder marker.
            sql = sql.replace("%", "%%").replace("?", "%s")
        return self.raw.execute(sql, tuple(params) if params else None)

    def close(self) -> None:  # connections go back to the pool instead
        pass


_pool = None


def _get_pool():
    global _pool
    if _pool is None:
        from psycopg.rows import dict_row
        from psycopg_pool import ConnectionPool

        _pool = ConnectionPool(
            DATABASE_URL,
            min_size=1,
            max_size=int(os.environ.get("DB_POOL_MAX", "5")),
            kwargs={"row_factory": dict_row, "autocommit": True, "prepare_threshold": None},
            open=True,
        )
    return _pool


def connection() -> Iterator[Any]:
    """FastAPI dependency: yields a read-only connection for one request."""
    if DATABASE_URL:
        with _get_pool().connection() as raw:
            yield PgConnection(raw)
        return
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def table_exists(conn: Any, name: str) -> bool:
    if getattr(conn, "dialect", "sqlite") == "postgres":
        row = conn.execute("SELECT to_regclass(?) IS NOT NULL AS ok", (name,)).fetchone()
        return bool(row and row["ok"])
    return conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (name,)).fetchone() is not None
