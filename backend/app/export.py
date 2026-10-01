"""Writes the whole API as static JSON files (same paths as app.main), plus photos and
government plans, so the site can be hosted without a Python server.

Uso: .venv/bin/python -m app.export [destino]   (padrão: ../frontend/dist, depois do `npm run build`)
"""

from __future__ import annotations

import json
import shutil
import sqlite3
import sys
from pathlib import Path

from etl.common import DB_PATH, PHOTOS, PROPOSTAS, ROOT

from . import queries as q


def _write(base: Path, rel: str, data) -> None:
    path = base / "api" / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def _sync_dir(src: Path, dest: Path) -> int:
    dest.mkdir(parents=True, exist_ok=True)
    count = 0
    for f in src.iterdir():
        target = dest / f.name
        if not target.exists() or target.stat().st_size != f.stat().st_size:
            shutil.copy2(f, target)
        count += 1
    return count


def run(dest: Path) -> None:
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    shutil.rmtree(dest / "api", ignore_errors=True)

    _write(dest, "meta.json", q.meta(conn))
    _write(dest, "presidente.json", q.presidente(conn))
    _write(dest, "busca.json", q.busca(conn))
    _write(dest, "partidos.json", q.partidos(conn))
    _write(dest, "estatisticas.json", q.estatisticas(conn))
    _write(dest, "parlamentares.json", q.parlamentares(conn))
    _write(dest, "resultados.json", q.resultados(conn))
    _write(dest, "segundo-turno.json", q.segundo_turno(conn))
    for uf in q.UF_NOMES:
        if uf == "BR":
            continue
        _write(dest, f"uf/{uf}.json", q.uf_majoritarios(conn, uf))
        _write(dest, f"uf/{uf}/deputados.json", q.uf_deputados(conn, uf))

    sqs = [r[0] for r in conn.execute("SELECT sq FROM candidatos")]
    for i, sq in enumerate(sqs, 1):
        _write(dest, f"candidato/{sq}.json", q.candidato(conn, sq))
        if i % 5000 == 0:
            print(f"  candidatos: {i}/{len(sqs)}")
    pids = [r[0] for r in conn.execute("SELECT id FROM parlamentares")] if q._has(conn, "parlamentares") else []
    for pid in pids:
        _write(dest, f"parlamentar/{q.pub_id(pid)}.json", q.parlamentar(conn, pid))

    fotos = _sync_dir(PHOTOS, dest / "fotos")
    props = _sync_dir(PROPOSTAS, dest / "propostas")
    print(f"export: {len(sqs)} candidatos, {len(pids)} parlamentares, {fotos} fotos, {props} propostas → {dest}")


if __name__ == "__main__":
    run(Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "frontend" / "dist")
