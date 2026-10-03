#!/usr/bin/env bash
# Publica o banco no Neon e a API no Google Cloud Run, de ponta a ponta (DEPLOY.md, seções 2 e 3).
# Pode ser repetido: o que já existe é reaproveitado, e só o que mudou é atualizado.
#
# Uso: GCP_PROJECT=meu-projeto scripts/deploy-nuvem.sh
# Pré-requisitos (uma vez): `make dados`, `gcloud auth login` e `npx neonctl auth`.
#
# Variáveis opcionais:
#   GCP_PROJECT=...            projeto do Google Cloud (padrão: o do `gcloud config`); é criado se não existir
#   BILLING_ACCOUNT=XXXXXX-... conta de faturamento a vincular ao projeto (só se ele ainda não tiver)
#   NEON_PROJECT=voto-informado  nome do projeto no Neon (criado em São Paulo se não existir)
#   NEON_ORG_ID=org-...        organização do Neon, se a conta tiver mais de uma
#   SO_API=1                   pula o envio do banco (só reimplanta a API)
#
# A string de conexão do Neon nunca é impressa nem gravada em disco: vai direto para o
# Secret Manager e para o `etl.neon`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="southamerica-east1"
SERVICE="voto-informado-api"
SECRET="voto-informado-db"
NEON_PROJECT="${NEON_PROJECT:-voto-informado}"
NEON_REGION="aws-sa-east-1"

GCLOUD="$(command -v gcloud || echo "$HOME/google-cloud-sdk/bin/gcloud")"
[ -x "$GCLOUD" ] || { echo "Falta o gcloud: https://cloud.google.com/sdk/docs/install"; exit 1; }
neon() { (cd "$ROOT/frontend" && npx -y neonctl "$@" ${NEON_ORG_ID:+--org-id "$NEON_ORG_ID"}); }
json() { python3 -c "import json,sys; d=json.load(sys.stdin); $1"; }

# ── 0. Logins ────────────────────────────────────────────────────────────────
"$GCLOUD" auth list --filter=status:ACTIVE --format='value(account)' | grep -q . \
  || { echo "Faça login no Google Cloud: gcloud auth login"; exit 1; }
neon me --output json >/dev/null 2>&1 \
  || { echo "Faça login no Neon: (cd frontend && npx neonctl auth)"; exit 1; }

# ── 1. Neon: projeto e string de conexão (com pooling, para a API) ───────────
NEON_ID="$(neon projects list --output json | json "
ps = d['projects'] if isinstance(d, dict) else d
print(next((p['id'] for p in ps if p['name'] == '$NEON_PROJECT'), ''))")"
if [ -z "$NEON_ID" ]; then
  echo "→ criando o projeto '$NEON_PROJECT' no Neon ($NEON_REGION, São Paulo)"
  NEON_ID="$(neon projects create --name "$NEON_PROJECT" --region-id "$NEON_REGION" --output json \
    | json "print(d['project']['id'])")"
fi
echo "→ Neon: projeto $NEON_ID"
DATABASE_URL="$(neon connection-string --project-id "$NEON_ID" --pooled)"
case "$DATABASE_URL" in postgres*) ;; *) echo "Não consegui a string de conexão do Neon"; exit 1 ;; esac
export DATABASE_URL

# ── 2. Dados no Neon (sem CPF, troca atômica) ────────────────────────────────
if [ -z "${SO_API:-}" ]; then
  echo "→ enviando o banco para o Neon"
  (cd "$ROOT/backend" && .venv/bin/python -m etl.neon)
fi

# ── 3. Google Cloud: projeto, faturamento e APIs ─────────────────────────────
PROJECT="${GCP_PROJECT:-$("$GCLOUD" config get-value project 2>/dev/null || true)}"
[ -n "$PROJECT" ] || { echo "Defina GCP_PROJECT=<id-do-projeto> (letras minúsculas, números e hífen)"; exit 1; }
if ! "$GCLOUD" projects describe "$PROJECT" >/dev/null 2>&1; then
  echo "→ criando o projeto $PROJECT no Google Cloud"
  "$GCLOUD" projects create "$PROJECT" --name "Tá na Urna"
fi
"$GCLOUD" config set project "$PROJECT" >/dev/null 2>&1

if [ "$("$GCLOUD" billing projects describe "$PROJECT" --format='value(billingEnabled)' 2>/dev/null)" != "True" ]; then
  if [ -n "${BILLING_ACCOUNT:-}" ]; then
    echo "→ vinculando a conta de faturamento $BILLING_ACCOUNT"
    "$GCLOUD" billing projects link "$PROJECT" --billing-account "$BILLING_ACCOUNT"
  else
    echo "O projeto $PROJECT não tem faturamento ativo (o Cloud Run exige, mesmo no nível gratuito)."
    echo "Contas disponíveis:"
    "$GCLOUD" billing accounts list --filter=open=true --format='table(name.basename(),displayName)' || true
    echo "Rode de novo com BILLING_ACCOUNT=<id>, ou ative em https://console.cloud.google.com/billing/linkedaccount?project=$PROJECT"
    exit 1
  fi
fi

echo "→ ativando as APIs (Cloud Run, Cloud Build, Artifact Registry, Secret Manager)"
"$GCLOUD" services enable run.googleapis.com cloudbuild.googleapis.com \
  artifactregistry.googleapis.com secretmanager.googleapis.com

NUM="$("$GCLOUD" projects describe "$PROJECT" --format='value(projectNumber)')"
SA="$NUM-compute@developer.gserviceaccount.com"

# ── 4. Segredo com a string do Neon ──────────────────────────────────────────
if ! "$GCLOUD" secrets describe "$SECRET" >/dev/null 2>&1; then
  echo "→ criando o segredo $SECRET"
  printf '%s' "$DATABASE_URL" | "$GCLOUD" secrets create "$SECRET" --replication-policy=automatic --data-file=-
elif [ "$("$GCLOUD" secrets versions access latest --secret "$SECRET" 2>/dev/null)" != "$DATABASE_URL" ]; then
  echo "→ atualizando o segredo $SECRET"
  printf '%s' "$DATABASE_URL" | "$GCLOUD" secrets versions add "$SECRET" --data-file=-
fi
"$GCLOUD" secrets add-iam-policy-binding "$SECRET" --member="serviceAccount:$SA" \
  --role=roles/secretmanager.secretAccessor >/dev/null
# Projetos novos: o build do `--source` roda com a conta de serviço padrão, que precisa deste papel.
"$GCLOUD" projects add-iam-policy-binding "$PROJECT" --member="serviceAccount:$SA" \
  --role=roles/run.builder --condition=None >/dev/null

# ── 5. API no Cloud Run ──────────────────────────────────────────────────────
echo "→ implantando a API ($SERVICE, $REGION)"
(cd "$ROOT/backend" && "$GCLOUD" run deploy "$SERVICE" \
  --source . \
  --region "$REGION" \
  --allow-unauthenticated \
  --set-secrets DATABASE_URL="$SECRET:latest" \
  --set-env-vars CACHE_TTL=300,DB_POOL_MAX=5 \
  --cpu 1 --memory 512Mi --min-instances 0 --max-instances 10 --concurrency 80 \
  --quiet)

URL="$("$GCLOUD" run services describe "$SERVICE" --region "$REGION" --format='value(status.url)')"
echo "→ conferindo $URL"
curl -fsS "$URL/healthz" | grep -q '"db":"postgres"' || { echo "✗ /healthz não respondeu com o Postgres"; exit 1; }
curl -fsS "$URL/api/meta.json" >/dev/null || { echo "✗ /api/meta.json falhou"; exit 1; }

echo "✓ API no ar: $URL"
echo "  Para o site ler dela: API_URL=$URL make publicar"
