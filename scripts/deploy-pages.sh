#!/usr/bin/env bash
# Publica o site estático (app + dados oficiais) no GitHub Pages, branch gh-pages.
#
# Uso: scripts/deploy-pages.sh [owner/repo]
# Pré-requisitos: `make dados` já rodado e `gh` autenticado.
#
# A branch gh-pages é recriada a cada publicação (um único commit), para o
# repositório não acumular centenas de MB de dados antigos no histórico.
set -euo pipefail

#
# Variáveis opcionais:
#   SITE_DOMAIN=www.tanaurna.com.br   domínio próprio: site na raiz + arquivo CNAME do GitHub Pages
#   API_URL=https://...run.app        API no Cloud Run (o site lê os JSON dela; fotos e PDFs seguem no Pages)
REPO="${1:-professorbossini/voto-informado}"
NAME="${REPO#*/}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/dist"
SITE_DOMAIN="${SITE_DOMAIN:-}"
API_URL="${API_URL:-}"

if [ -n "$SITE_DOMAIN" ]; then
  BASE="/"
  SITE_URL="https://$SITE_DOMAIN/"
else
  BASE="/$NAME/"
  # URL pública real (respeita domínio próprio configurado no GitHub Pages da conta)
  SITE_URL="$(gh api "repos/$REPO/pages" --jq .html_url 2>/dev/null || true)"
  SITE_URL="${SITE_URL:-https://${REPO%%/*}.github.io/$NAME/}"
  SITE_URL="${SITE_URL/http:\/\//https://}"
fi

echo "→ build do frontend (base $BASE${API_URL:+, API em $API_URL})"
(cd "$ROOT/frontend" && VITE_BASE_PATH="$BASE" VITE_DATA_URL="$API_URL" VITE_ASSETS_URL="${API_URL:+$BASE}" npx vite build)

echo "→ exportando a API estática, fotos, planos de governo e páginas por rota ($SITE_URL)"
(cd "$ROOT/backend" && .venv/bin/python -m app.export "$OUT" --site-url "$SITE_URL")

# SPA no GitHub Pages: rotas profundas caem no 404.html, que é o próprio app.
cp "$OUT/index.html" "$OUT/404.html"
touch "$OUT/.nojekyll"
[ -n "$SITE_DOMAIN" ] && echo "$SITE_DOMAIN" > "$OUT/CNAME"
rm -f "$OUT/_redirects" "$OUT/_headers"
find "$OUT" -name "*.map" -delete

echo "→ publicando $(du -sh "$OUT" | cut -f1) em $REPO (gh-pages)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
cp -a "$OUT/." "$TMP/"
cd "$TMP"
git init -q -b gh-pages
git add -A
git -c core.quotepath=off commit -q -m "Publicação $(date -u +%Y-%m-%dT%H:%MZ)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
git remote add origin "https://github.com/$REPO.git"
git -c http.postBuffer=524288000 push -q -f origin gh-pages

echo "✓ publicado: $SITE_URL"
