# Publicação

Duas formas, que podem conviver:

| Modo | Frontend | API | Banco | Quando usar |
|---|---|---|---|---|
| **Estático** (atual) | GitHub Pages | arquivos JSON exportados | nenhum | rápido, gratuito, aguenta picos de acesso |
| **Com backend** | GitHub Pages (ou outro) | Google Cloud Run | Neon (Postgres) | atualizar dados sem republicar o site; base para recursos futuros |

Em ambos, fotos e planos de governo (≈450 MB) ficam no host estático.

---

## 1. Estático (GitHub Pages)

```bash
make dados       # atualiza tudo a partir das fontes oficiais
make publicar    # build + export + push para a branch gh-pages
```

## 2. Banco no Neon

1. Crie um projeto em https://neon.tech (região `sa-east-1`, São Paulo, se disponível) e copie a
   *connection string* (formato `postgresql://usuario:senha@ep-xxx.sa-east-1.aws.neon.tech/neondb?sslmode=require`).
   Para a API, use a string **com pooling** (host com `-pooler`).
2. Publique os dados (o mesmo SQLite que o ETL gera, **sem CPF**; troca atômica, a API nunca vê o banco pela metade):

```bash
export DATABASE_URL='postgresql://...'
make neon
```

Repita `make dados && make neon` sempre que quiser atualizar. No dia da eleição, `make apuracao`
seguido de `make neon` leva a apuração para o banco.

## 3. API no Google Cloud Run

Pré-requisitos: `gcloud` instalado e autenticado, projeto com faturamento ativo.

```bash
gcloud config set project SEU_PROJETO
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com

# a string do Neon vai para o Secret Manager (nunca em variável de ambiente em texto puro)
printf '%s' "$DATABASE_URL" | gcloud secrets create voto-informado-db --data-file=-
gcloud secrets add-iam-policy-binding voto-informado-db \
  --member="serviceAccount:$(gcloud projects describe $(gcloud config get project) --format='value(projectNumber)')-compute@developer.gserviceaccount.com" \
  --role=roles/secretmanager.secretAccessor

cd backend
gcloud run deploy voto-informado-api \
  --source . \
  --region southamerica-east1 \
  --allow-unauthenticated \
  --set-secrets DATABASE_URL=voto-informado-db:latest \
  --set-env-vars CACHE_TTL=300,DB_POOL_MAX=5 \
  --cpu 1 --memory 512Mi --min-instances 0 --max-instances 10 --concurrency 80
```

Teste: `curl https://voto-informado-api-XXXX.a.run.app/healthz` → `{"ok":true,"db":"postgres"}`.

A API é somente leitura, com CORS aberto para GET, `Cache-Control: public, max-age=300` e cache em
memória: cada instância consulta o Neon no máximo uma vez a cada 5 minutos por rota.

## 4. Apontar o frontend para a API

No build do frontend:

```bash
cd frontend
VITE_BASE_PATH=/voto-informado/ \
VITE_DATA_URL=https://voto-informado-api-XXXX.a.run.app \
VITE_ASSETS_URL=https://professorbossini.github.io/voto-informado \
npx vite build
```

`VITE_DATA_URL` → JSON da API; `VITE_ASSETS_URL` → fotos e PDFs no host estático.

## Cuidados no período eleitoral

- Não publicar conteúdo novo sobre candidaturas nem fazer anúncios pagos em 4/10 (dia da votação);
  atualizar resultados oficiais após as 17h é informação, não propaganda.
- O site não tem enquetes, rankings de "mais acessados" nem uso de IA para ordenar ou recomendar
  candidaturas (Res. TSE 23.755/2026).
