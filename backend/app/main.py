"""Public read-only API. Every route maps 1:1 to a static file written by app.export.

Run: .venv/bin/uvicorn app.main:app --reload --port 8077
"""

from __future__ import annotations

import os
import time

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.staticfiles import StaticFiles

from etl.common import PESQUISAS_ATIVAS, PHOTOS, PROPOSTAS

from . import queries as q
from .db import DATABASE_URL, connection

app = FastAPI(title="Tá na Urna · API pública", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(GZipMiddleware, minimum_size=1024)
# Somente leitura e dados públicos: qualquer origem pode consultar (GET).
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])

# The data changes at most a few times a day: cache responses in memory and tell
# browsers/CDNs they may reuse them. Keeps Neon queries rare on Cloud Run.
CACHE_TTL = int(os.environ.get("CACHE_TTL", "300"))
_cache: dict[str, tuple[float, object]] = {}


@app.middleware("http")
async def cache_headers(request: Request, call_next):
    response = await call_next(request)
    if request.method == "GET" and request.url.path.startswith("/api/") and response.status_code == 200:
        response.headers.setdefault("Cache-Control", f"public, max-age={CACHE_TTL}")
    return response


def db():
    yield from connection()


def cached(key: str, build):
    hit = _cache.get(key)
    now = time.monotonic()
    if hit and hit[0] > now:
        return hit[1]
    value = build()
    if value is not None:
        _cache[key] = (now + CACHE_TTL, value)
    return value


def _found(value):
    if value is None:
        raise HTTPException(status_code=404, detail="Não encontrado")
    return value


# O Cloud Run reserva caminhos terminados em "z" (/healthz não chega à API): use /api/saude.
@app.get("/api/saude", include_in_schema=False)
@app.get("/healthz", include_in_schema=False)
def healthz():
    return {"ok": True, "db": "postgres" if DATABASE_URL else "sqlite"}


@app.get("/api/meta.json")
def meta(conn=Depends(db)):
    return cached("meta", lambda: q.meta(conn))


@app.get("/api/presidente.json")
def presidente(conn=Depends(db)):
    return cached("presidente", lambda: q.presidente(conn))


@app.get("/api/uf/{uf}.json")
def uf_majoritarios(uf: str, conn=Depends(db)):
    if uf.upper() not in q.UF_NOMES:
        raise HTTPException(404, "UF inválida")
    return cached(f"uf:{uf.upper()}", lambda: q.uf_majoritarios(conn, uf))


@app.get("/api/uf/{uf}/deputados.json")
def uf_deputados(uf: str, conn=Depends(db)):
    if uf.upper() not in q.UF_NOMES:
        raise HTTPException(404, "UF inválida")
    return cached(f"dep:{uf.upper()}", lambda: q.uf_deputados(conn, uf))


@app.get("/api/candidato/{sq}.json")
def candidato(sq: str, conn=Depends(db)):
    return _found(cached(f"cand:{sq}", lambda: q.candidato(conn, sq)))


@app.get("/api/busca.json")
def busca(conn=Depends(db)):
    return cached("busca", lambda: q.busca(conn))


@app.get("/api/partidos.json")
def partidos(conn=Depends(db)):
    return cached("partidos", lambda: q.partidos(conn))


@app.get("/api/estatisticas.json")
def estatisticas(conn=Depends(db)):
    return cached("estatisticas", lambda: q.estatisticas(conn))


@app.get("/api/parlamentares.json")
def parlamentares(conn=Depends(db)):
    return cached("parlamentares", lambda: q.parlamentares(conn))


@app.get("/api/parlamentar/{pid}.json")
def parlamentar(pid: str, conn=Depends(db)):
    return _found(cached(f"parl:{pid}", lambda: q.parlamentar(conn, pid)))


@app.get("/api/pesquisas.json")
def pesquisas(conn=Depends(db)):
    if not PESQUISAS_ATIVAS:  # pendente de conferência no PesqEle
        raise HTTPException(status_code=404, detail="Não encontrado")
    return cached("pesquisas", lambda: q.pesquisas(conn))


@app.get("/api/resultados.json")
def resultados(conn=Depends(db)):
    return cached("resultados", lambda: q.resultados(conn))


@app.get("/api/segundo-turno.json")
def segundo_turno(conn=Depends(db)):
    return cached("segundo_turno", lambda: q.segundo_turno(conn))


# Photos and government plans are served here only when present (local dev). In
# production they live on the static host (VITE_ASSETS_URL) to keep the image small.
if PHOTOS.is_dir():
    app.mount("/fotos", StaticFiles(directory=PHOTOS), name="fotos")
if PROPOSTAS.is_dir():
    app.mount("/propostas", StaticFiles(directory=PROPOSTAS), name="propostas")
