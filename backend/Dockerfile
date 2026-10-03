# API pública do Tá na Urna para o Google Cloud Run (somente leitura, Postgres/Neon).
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8080

WORKDIR /app
COPY requirements-api.txt .
RUN pip install --no-cache-dir -r requirements-api.txt

# Só o necessário para servir a API: nada de dados brutos nem do SQLite local.
COPY app ./app
COPY etl/__init__.py etl/common.py ./etl/

RUN useradd --create-home --uid 10001 api
USER api

# DATABASE_URL vem do Secret Manager (veja DEPLOY.md). Sem ela, a API não tem banco.
CMD exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT}" --workers 2 --proxy-headers --forwarded-allow-ips="*"
