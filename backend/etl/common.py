"""Shared paths and helpers for every ETL step.

All sources are official (TSE, Câmara dos Deputados, Senado Federal). Raw files are
cached under data/raw so a rerun only downloads what changed upstream.
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
RAW = DATA / "raw"
DB_PATH = Path(os.environ.get("VI_DB") or DATA / "politicos.db")  # VI_DB: alternate DB (tests/previews)
PHOTOS = DATA / "fotos"
PROPOSTAS = DATA / "propostas"

TSE_CDN = "https://cdn.tse.jus.br/estatistica/sead"
ANO = 2026
# Códigos oficiais do TSE para 2026 (resultados.tse.jus.br/oficial/comum/config/ele-c.json)
ELEICAO_FEDERAL_T1, ELEICAO_FEDERAL_T2 = "6257", "6258"
ELEICAO_ESTADUAL_T1, ELEICAO_ESTADUAL_T2 = "6259", "6260"
SQ_ELEICAO = "20322002026"  # usado nos links do DivulgaCandContas

UFS = [
    "AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA",
    "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO",
]

USER_AGENT = "Mozilla/5.0 (compatible; transparencia-eleitoral/1.0; dados abertos)"


def _meta_path(dest: Path) -> Path:
    return dest.with_name(dest.name + ".meta.json")


def _write_meta(dest: Path, url: str, last_modified: str | None) -> None:
    lm = None
    if last_modified:
        try:
            lm = parsedate_to_datetime(last_modified).astimezone().isoformat(timespec="seconds")
        except (TypeError, ValueError):
            lm = last_modified
    meta = {
        "url": url,
        "publicado_em": lm,  # Last-Modified informado pelo servidor oficial
        "coletado_em": datetime.fromtimestamp(dest.stat().st_mtime).astimezone().isoformat(timespec="seconds"),
        "bytes": dest.stat().st_size,
    }
    _meta_path(dest).write_text(json.dumps(meta, ensure_ascii=False, indent=2))


def download(url: str, dest: Path, *, max_age_hours: float = 12, retries: int = 3) -> Path:
    """Downloads url to dest unless a fresh-enough copy already exists.

    Next to each file a `<file>.meta.json` records the official URL, the server's
    Last-Modified date and when we fetched it, so every number can be traced back.
    """
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and dest.stat().st_size > 0:
        age_h = (time.time() - dest.stat().st_mtime) / 3600
        if age_h < max_age_hours:
            if not _meta_path(dest).exists():
                try:
                    head = requests.head(url, timeout=30, allow_redirects=True, headers={"User-Agent": USER_AGENT})
                    _write_meta(dest, url, head.headers.get("Last-Modified"))
                except requests.RequestException:
                    _write_meta(dest, url, None)
            return dest
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            with requests.get(url, stream=True, timeout=120, headers={"User-Agent": USER_AGENT}) as r:
                r.raise_for_status()
                tmp = dest.with_suffix(dest.suffix + ".part")
                with open(tmp, "wb") as fh:
                    for chunk in r.iter_content(1 << 20):
                        fh.write(chunk)
                tmp.replace(dest)
                _write_meta(dest, url, r.headers.get("Last-Modified"))
                return dest
        except Exception as exc:  # noqa: BLE001 - retry any network failure
            last_error = exc
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"Falha ao baixar {url}: {last_error}")


def file_meta(dest: Path) -> dict:
    path = _meta_path(dest)
    return json.loads(path.read_text()) if path.exists() else {}


def connect() -> sqlite3.Connection:
    DATA.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    return conn


def set_meta(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor TEXT)")
    conn.execute("INSERT OR REPLACE INTO meta (chave, valor) VALUES (?, ?)", (key, value))


def register_source(
    conn: sqlite3.Connection,
    chave: str,
    *,
    nome: str,
    orgao: str,
    url: str,
    descricao: str,
    pagina: str | None = None,
    arquivo: Path | None = None,
    gerado_em: str | None = None,
) -> None:
    """Records an official source used by the site (shown on every data block)."""
    conn.execute(
        """CREATE TABLE IF NOT EXISTS fontes (
            chave TEXT PRIMARY KEY, nome TEXT, orgao TEXT, url TEXT, pagina TEXT,
            descricao TEXT, gerado_em TEXT, publicado_em TEXT, coletado_em TEXT)"""
    )
    meta = file_meta(arquivo) if arquivo else {}
    conn.execute(
        "INSERT OR REPLACE INTO fontes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            chave, nome, orgao, url, pagina, descricao, gerado_em,
            meta.get("publicado_em"),
            meta.get("coletado_em") or datetime.now().astimezone().isoformat(timespec="seconds"),
        ),
    )
