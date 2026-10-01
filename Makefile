# Voto Informado: atalhos do dia a dia. Rode `make help`.
BACK := backend
FRONT := frontend
PY := $(BACK)/.venv/bin/python
API_PORT ?= 8077

.PHONY: help setup dados api web dev apuracao exportar build testes publicar neon api-pg

help:
	@echo "make setup     instala dependências (venv Python + npm)"
	@echo "make dados     baixa e processa todos os dados oficiais (TSE, Câmara, Senado)"
	@echo "make api       sobe a API em http://127.0.0.1:$(API_PORT)"
	@echo "make web       sobe o site em http://localhost:5173 (precisa da API)"
	@echo "make dev       API + site juntos"
	@echo "make apuracao  consulta a apuração do TSE a cada 5 min (dia da eleição)"
	@echo "make exportar  gera o site estático completo em frontend/dist"
	@echo "make testes    testes do backend e do frontend"
	@echo "make publicar  publica no GitHub Pages (branch gh-pages)"
	@echo "make neon      publica o banco no Postgres/Neon (DATABASE_URL)"
	@echo "make api-pg    API local lendo do Postgres (DATABASE_URL)"

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

exportar:
	cd $(FRONT) && npm run build
	cd $(BACK) && .venv/bin/python -m app.export ../$(FRONT)/dist

testes:
	cd $(BACK) && .venv/bin/python -m pytest -q
	cd $(FRONT) && npx tsc -b --noEmit && npm test

publicar:
	scripts/deploy-pages.sh

neon:
	@test -n "$$DATABASE_URL" || (echo "Defina DATABASE_URL (string de conexão do Neon)"; exit 1)
	cd $(BACK) && .venv/bin/python -m etl.neon

api-pg:
	@test -n "$$DATABASE_URL" || (echo "Defina DATABASE_URL"; exit 1)
	cd $(BACK) && .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port $(API_PORT)
