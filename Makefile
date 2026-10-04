# Tá na Urna: atalhos do dia a dia. Rode `make help`.
BACK := backend
FRONT := frontend
PY := $(BACK)/.venv/bin/python
API_PORT ?= 8077
# Domínio próprio do site (GitHub Pages). Vazio = professorbossini.dev/voto-informado.
SITE_DOMAIN ?= www.tanaurna.com.br

.PHONY: help setup dados api web dev apuracao apuracao-remota site-remoto exportar build testes publicar nuvem neon api-pg app app-release app-loja

help:
	@echo "make setup     instala dependências (venv Python + npm)"
	@echo "make dados     baixa e processa todos os dados oficiais (TSE, Câmara, Senado)"
	@echo "make api       sobe a API em http://127.0.0.1:$(API_PORT)"
	@echo "make web       sobe o site em http://localhost:5173 (precisa da API)"
	@echo "make dev       API + site juntos"
	@echo "make apuracao  consulta a apuração do TSE a cada 5 min (dia da eleição)"
	@echo "make apuracao-remota  roda agora, no GitHub Actions, a passada da apuração final (normalmente a cada 10 min)"
	@echo "make site-remoto      republica agora, no GitHub Actions, só a interface (normalmente a cada push na main)"
	@echo "make exportar  gera o site estático completo em frontend/dist"
	@echo "make testes    testes do backend e do frontend"
	@echo "make publicar  publica no GitHub Pages (branch gh-pages)"
	@echo "make nuvem     Neon + API no Cloud Run, de ponta a ponta (GCP_PROJECT=..., DEPLOY.md)"
	@echo "make neon      publica o banco no Postgres/Neon (DATABASE_URL)"
	@echo "make api-pg    API local lendo do Postgres (DATABASE_URL)"
	@echo "make app       build do app e abre o projeto Android (Android Studio)"
	@echo "make app-release  gera o .aab assinado para a Google Play (loja/README.md)"
	@echo "make app-loja  regenera artes e kit da loja (loja/fontes)"

setup:
	test -d $(BACK)/.venv || python3 -m venv $(BACK)/.venv
	$(BACK)/.venv/bin/pip install -q -r $(BACK)/requirements.txt
	cd $(FRONT) && npm install && test -f .env || cp .env.example .env

dados:
	cd $(BACK) && .venv/bin/python -m etl.run_all

api:
	cd $(BACK) && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port $(API_PORT) --reload --reload-dir app --reload-dir etl

web:
	cd $(FRONT) && npm run dev

dev:
	$(MAKE) -j2 api web

apuracao:
	while true; do (cd $(BACK) && .venv/bin/python -m etl.resultados && .venv/bin/python -m etl.derivados >/dev/null); sleep 300; done

apuracao-remota:
	gh workflow run apuracao.yml && sleep 3 && gh run list --workflow apuracao.yml --limit 1

site-remoto:
	gh workflow run site.yml && sleep 3 && gh run list --workflow site.yml --limit 1

exportar:
	cd $(FRONT) && npm run build
	cd $(BACK) && .venv/bin/python -m app.export ../$(FRONT)/dist

testes:
	cd $(BACK) && .venv/bin/python -m pytest -q
	cd $(FRONT) && npx tsc -b --noEmit && npm test

publicar:
	SITE_DOMAIN=$(SITE_DOMAIN) scripts/deploy-pages.sh

nuvem:
	scripts/deploy-nuvem.sh

neon:
	@test -n "$$DATABASE_URL" || (echo "Defina DATABASE_URL (string de conexão do Neon)"; exit 1)
	cd $(BACK) && .venv/bin/python -m etl.neon

api-pg:
	@test -n "$$DATABASE_URL" || (echo "Defina DATABASE_URL"; exit 1)
	cd $(BACK) && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port $(API_PORT)

# ── Aplicativos (Capacitor) ── guia completo em loja/README.md
app:
	cd $(FRONT) && npm run app:android

app-release:
	@test -f $(FRONT)/android/keystore.properties || (echo "Falta frontend/android/keystore.properties (chave de upload): veja loja/README.md"; exit 1)
	cd $(FRONT) && npm run app:build
	cd $(FRONT)/android && ./gradlew bundleRelease
	@echo "✓ $(FRONT)/android/app/build/outputs/bundle/release/app-release.aab"
	@grep -E "versionCode|versionName" $(FRONT)/android/app/build.gradle | sed 's/^ */  /'

app-loja:
	python3 loja/fontes/gerar-kit.py
	@echo "Artes: com o Chrome em --remote-debugging-port=9334, rode node loja/fontes/gerar-artes.mjs"
