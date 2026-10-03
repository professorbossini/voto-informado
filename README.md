# Voto Informado · Eleições 2026

**No ar:** https://professorbossini.dev/voto-informado/

Site de transparência eleitoral que reúne **somente dados públicos oficiais** (TSE, Câmara dos
Deputados e Senado Federal) sobre todas as candidaturas de 2026 e sobre os gastos de mandato de
deputados federais e senadores. Não produz opinião, não exibe pesquisas e não recomenda votos.

## O que tem

| Página | Rota | Conteúdo |
|---|---|---|
| Início | `/` | Contagem regressiva, seletor de estado, presidenciáveis, ordem dos votos na urna |
| Candidatos | `/eleicao/:uf/:cargo` | Presidente, governador, Senado e deputados de todas as UFs, com filtros |
| Perfil | `/candidato/:sq` | Perfil, situação do registro, patrimônio (2026 × 2022), campanha, trajetória, mandato, plano de governo |
| Comparar | `/comparar` | Até 4 candidaturas lado a lado (link compartilhável `?c=sq1,sq2`) |
| Minha cola | `/cola` | Números na ordem da urna, para imprimir. Fica só no aparelho |
| Simulador | `/simulador` | Urna educativa com fotos e números reais |
| 2º turno | `/segundo-turno` | Apuração oficial e finalistas lado a lado (preenche sozinho com o feed do TSE) |
| Gastos de mandato | `/gastos`, `/parlamentar/:id` | Cota parlamentar (CEAP/CEAPS) desde 2023, ranking com comparação mensal justa por UF |
| Em números | `/numeros` | Perfil das candidaturas: gênero, idade, instrução, financiamento, concorrência por vaga |
| Fontes e método | `/sobre` | Todas as fontes com links e datas, metodologia e limitações |

## Princípios de neutralidade (aplicados no código)

- Mesmos campos, mesmo layout e ordem alfabética para todos; outras ordenações só por escolha do usuário.
- Nenhuma cor de partido: gráficos com uma única cor neutra (paleta validada para daltonismo).
- Cada bloco de dados tem um selo **Fonte oficial** com o arquivo de origem, a data em que o órgão o
  gerou/publicou e a data da coleta (`fontes` no banco, alimentada pelo `Last-Modified` dos servidores).
- Dados ausentes = "Não informado". Valores autodeclarados são exibidos como publicados.
- CPF e título de eleitor ficam só no banco, para cruzamentos; um teste garante que nunca saem na API.
- Visão "partidos com 5+ parlamentares" (critério objetivo do art. 46 da Lei 9.504/97) com a opção
  "Todos na urna" sempre a um clique.

## Arquitetura

```
backend/   Python: ETL (TSE + Câmara + Senado) → SQLite → API FastAPI somente leitura
  etl/tse.py            candidaturas, bens, histórico, redes, vagas, prestação de contas, fotos, planos
  etl/parlamentares.py  cota parlamentar da Câmara e do Senado (2023–2026)
  etl/derivados.py      vínculo parlamentar↔candidatura, bancadas, fontes e avisos
  etl/resultados.py     apuração oficial (resultados.tse.jus.br), 1º e 2º turnos
  app/queries.py        formato público da API (uma função por endpoint)
  app/main.py           FastAPI (GET /api/*.json, /fotos, /propostas)
  app/export.py         grava a mesma API como arquivos estáticos
frontend/  React 19 + MUI 9 (template Faísca), login Google pronto mas desligado
```

A API tem formato estático: todo endpoint é um GET sem query string (`/api/uf/SP.json`). Por isso
o mesmo site roda com o FastAPI (desenvolvimento) ou como arquivos estáticos em qualquer hospedagem.

## Rodando localmente

Pré-requisitos: Python 3.11+, Node 20.19+.

```bash
make setup     # venv + npm install
make dados     # baixa e processa tudo (~4 min na primeira vez; cache em backend/data/raw)
make dev       # API em :8077 + site em http://localhost:5173
make testes    # pytest (privacidade, fontes, ordem, 2º turno) + typecheck + vitest
```

No dia da eleição, `make apuracao` consulta o feed oficial do TSE a cada 5 minutos.

## Publicando como site estático

```bash
make publicar  # build + export + push para gh-pages (GitHub Pages)
```

O export gera também uma página HTML por candidatura (título, descrição e foto oficial nas meta tags),
para que links compartilhados abram com status 200 e prévia correta. Para outra hospedagem, `make exportar`
gera `frontend/dist` (~600 MB); configure fallback de SPA (rota → `index.html`).

## App Android (e iOS)

O mesmo frontend vira app nativo com Capacitor (`frontend/android/`), lendo os dados do site público. Política de
Privacidade e Termos em `/privacidade` e `/termos`. Gerar o pacote: `make app-release`. Guia de publicação na
Google Play (e caminho para a App Store) em [loja/README.md](loja/README.md), com kit de preenchimento em
`loja/kit-google-play.html`.

## Pesquisas eleitorais (pendente, fora do ar)

O código da aba de pesquisas e os dados curados (`backend/curadoria/pesquisas.json`) estão no repositório,
mas a funcionalidade está **desligada** até que cada número de registro seja conferido no PesqEle/TSE.
Passo a passo para religar em [backend/curadoria/PESQUISAS_PENDENTE.md](backend/curadoria/PESQUISAS_PENDENTE.md).

## Backend no Cloud Run + banco no Neon

A API também roda contra Postgres (`DATABASE_URL`). `make neon` publica o banco (sem CPF, troca atômica)
e `backend/Dockerfile` empacota a API para o Cloud Run. Passo a passo em [DEPLOY.md](DEPLOY.md).

## Login (desligado)

Todo o site é público. Para ligar o login com Google: `VITE_ENABLE_LOGIN=true` e configure o adaptador
(`VITE_AUTH_PROVIDER=firebase` ou `backend`) conforme `frontend/docs/configuracao-google.md`.

## Limitações conhecidas

- Os arquivos anuais da Câmara não trazem passagens aéreas (SIGEPA) a partir de ago/2025; o ranking abre
  em 2024 e permite excluir passagens para comparar anos.
- Gastos de deputados estaduais, governadores e presidente não têm base aberta padronizada única.
- O Senado não publica o teto da cota por UF em formato aberto.
- Prestação de contas de campanha é parcial até a entrega final.

Interface construída com o template [Faísca](https://github.com/professorbossini/faisca-auth-starter).
