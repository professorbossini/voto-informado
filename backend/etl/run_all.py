"""Pipeline completo: TSE → Câmara/Senado → cruzamentos → apuração.

O banco é montado numa cópia temporária e só substitui o oficial no fim, com uma
troca atômica de arquivo: a API continua servindo a versão anterior, inteira,
durante toda a reconstrução.

Uso: .venv/bin/python -m etl.run_all
"""

from __future__ import annotations

import importlib
import os
import sqlite3
import time
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"
OFICIAL = Path(os.environ.get("VI_DB") or DATA / "politicos.db")


def run() -> None:
    tmp = OFICIAL.with_name(OFICIAL.name + ".novo")
    for f in (tmp, tmp.with_name(tmp.name + "-wal"), tmp.with_name(tmp.name + "-shm")):
        f.unlink(missing_ok=True)
    if OFICIAL.exists():
        # parte da versão atual: passos que falharem não deixam tabelas faltando
        with sqlite3.connect(OFICIAL) as src, sqlite3.connect(tmp) as dst:
            src.backup(dst)

    os.environ["VI_DB"] = str(tmp)  # lido por etl.common ao importar
    from . import common

    importlib.reload(common)
    steps = [importlib.reload(importlib.import_module(f"etl.{m}")) for m in ("tse", "parlamentares", "derivados", "resultados")]
    for step in steps:
        t = time.time()
        step.run()
        print(f"✓ {step.__name__.split('.')[-1]} ({time.time() - t:.0f}s)\n")

    with sqlite3.connect(tmp) as conn:  # consolida o WAL antes da troca
        conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
        conn.execute("PRAGMA journal_mode=DELETE")
    os.replace(tmp, OFICIAL)
    for suffix in ("-wal", "-shm"):
        Path(str(OFICIAL) + suffix).unlink(missing_ok=True)
    print(f"✓ banco atualizado: {OFICIAL}")


if __name__ == "__main__":
    run()
