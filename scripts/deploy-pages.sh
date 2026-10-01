#!/usr/bin/env bash
# Publica o site estático (app + dados oficiais) no GitHub Pages, branch gh-pages.
#
# Uso: scripts/deploy-pages.sh [owner/repo]
# Pré-requisitos: `make dados` já rodado e `gh` autenticado.
#
# A branch gh-pages é recriada a cada publicação (um único commit), para o
# repositório não acumular centenas de MB de dados antigos no histórico.
set -euo pipefail

REPO="${1:-professorbossini/voto-informado}"
NAME="${REPO#*/}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/frontend/dist"

echo "→ build do frontend com base /$NAME/"
(cd "$ROOT/frontend" && VITE_BASE_PATH="/$NAME/" npx vite build)

echo "→ exportando a API estática, fotos e planos de governo"
(cd "$ROOT/backend" && .venv/bin/python -m app.export "$OUT")

# SPA no GitHub Pages: rotas profundas caem no 404.html, que é o próprio app.
cp "$OUT/index.html" "$OUT/404.html"
touch "$OUT/.nojekyll"
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

echo "✓ publicado: https://${REPO%%/*}.github.io/$NAME/"
