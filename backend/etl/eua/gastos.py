"""Gastos públicos: gabinetes da Câmara dos EUA (equivalente à cota parlamentar) e gasto federal por
estado e distrito.

Fontes oficiais:
  Statement of Disbursements (SOD) da Câmara, publicado a cada trimestre pelo Chief Administrative
  Officer (https://www.house.gov/the-house-explained/open-government/statement-of-disbursements):
  o arquivo "SUMMARY GRID" (CSV) traz, para cada gabinete ("2026 HON. NOME"), os gastos do trimestre
  (QTD) e do ano (YTD) por categoria: pessoal, viagens, aluguel/comunicação, impressão, outros
  serviços, material, equipamento e correspondência oficial (franked mail). Só usamos esse resumo
  por categoria: o detalhamento traz nomes de servidores e de fornecedores pessoas físicas, que
  não publicamos.

  USAspending.gov (Departamento do Tesouro), API pública sem chave: valor de contratos, convênios,
  empréstimos e outros repasses federais pelo local de execução, por estado e por distrito
  congressional, em cada ano fiscal (1º de outubro a 30 de setembro).

O Senado só publica os gastos de gabinete em PDF semestral (Report of the Secretary of the Senate),
sem formato aberto: fica como limitação, com o link oficial.

Grava:
  api/eua/gastos/camara.json            ranking por ano legislativo e categoria; trimestres disponíveis
  api/eua/gastos/membro/<bioguide>.json  série trimestral e por categoria do gabinete
  api/eua/gastos/federal.json           gasto federal por estado (anos fiscais recentes) e por distrito
"""

from __future__ import annotations

import csv
import io
import re
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from urllib.parse import urljoin

from .comum import DOMINIO_PUBLICO, ET, agora, baixar, fonte, gravar, gravar_se_mudou, ler, normalizar, publicado_em

SOD_PAGINA = "https://www.house.gov/the-house-explained/open-government/statement-of-disbursements"
SOD_ARQUIVO = SOD_PAGINA + "/archive"
SENADO_RELATORIO = "https://www.senate.gov/legislative/common/generic/report_secsen.htm"
USASPENDING_GEO = "https://api.usaspending.gov/api/v2/search/spending_by_geography/"
USASPENDING_PAGINA = "https://www.usaspending.gov/search"
INICIO_SERIE = 2025  # trimestres desde o início do 119º Congresso

CATEGORIAS = {
    "PERSONNEL COMPENSATION": "pessoal",
    "PERSONNEL BENEFITS": "beneficios",
    "TRAVEL": "viagens",
    "RENT COMMUNICATION UTILITIES": "aluguel_comunicacao",
    "PRINTING AND REPRODUCTION": "impressao",
    "OTHER SERVICES": "servicos",
    "SUPPLIES AND MATERIALS": "material",
    "EQUIPMENT": "equipamento",
    "FRANKED MAIL": "correspondencia",
    "TRANSPORTATION OF THINGS": "transporte",
}
MESES = {"JAN": 1, "JANUARY": 1, "APR": 2, "APRIL": 2, "JUL": 3, "JULY": 3, "OCT": 4, "OCTOBER": 4}


# ── Câmara: Statement of Disbursements ───────────────────────────────────────


def links_sod(html: str, base: str) -> list[tuple[int, int, str]]:
    """Links dos CSV de resumo → [(ano, trimestre, url)], do mais antigo ao mais novo."""
    out = {}
    for href in re.findall(r'href="([^"]+\.csv)"', html, flags=re.I):
        nome = href.upper().replace("%20", " ").replace("_", " ").replace("-", " ")
        if "SUMM" not in nome:
            continue
        m = re.search(r"/(JAN|JANUARY|APR|APRIL|JUL|JULY|OCT|OCTOBER)[A-Z]*\s.*?(20\d\d)\s+SOD", nome)
        if not m:
            continue
        ano, tri = int(m.group(2)), MESES[m.group(1)]
        out[(ano, tri)] = urljoin(base, href)
    return sorted((a, t, u) for (a, t), u in out.items())


def ler_sod(texto: str) -> dict[str, dict]:
    """CSV de resumo → {gabinete: {ano_legislativo, categorias{cat: (ytd, qtd)}}}, só gabinetes de parlamentares."""
    leitor = csv.reader(io.StringIO(texto))
    cab = [c.strip().upper() for c in next(leitor)]
    i_org, i_prog, i_desc = cab.index("ORGANIZATION"), cab.index("PROGRAM"), cab.index("DESCRIPTION")
    i_ytd = next(i for i, c in enumerate(cab) if c.startswith("YTD"))
    i_qtd = next(i for i, c in enumerate(cab) if c.startswith("QTD"))
    out: dict[str, dict] = {}
    for linha in leitor:
        if len(linha) <= max(i_ytd, i_qtd):
            continue
        org = linha[i_org].strip()
        m = re.match(r"^(\d{4}) HON\. (.+)$", org)
        if not m or linha[i_prog].strip().upper() != "OFFICIAL EXPENSES OF MEMBERS":
            continue
        cat = CATEGORIAS.get(" ".join(re.sub(r"[^A-Z ]", " ", linha[i_desc].upper()).split()))
        if not cat:
            continue
        try:
            ytd, qtd = float(linha[i_ytd] or 0), float(linha[i_qtd] or 0)
        except ValueError:
            continue
        g = out.setdefault(org, {"ano": int(m.group(1)), "nome": m.group(2).strip(), "categorias": {}})
        a, b = g["categorias"].get(cat, (0.0, 0.0))
        g["categorias"][cat] = (a + ytd, b + qtd)
    return out


def _chaves_nome(nome: str) -> list[str]:
    """Formas de comparar 'ALMA S. ADAMS' com o nome oficial ('Alma S. Adams'), da mais à menos exata."""
    n = normalizar(re.sub(r"\b(JR|SR|II|III|IV|MD|DDS|PHD)\b\.?", "", nome, flags=re.I))
    partes = n.split()
    chaves = [n]
    if len(partes) >= 2:
        chaves += [f"{partes[0]} {partes[-1]}", f"{partes[0][0]} {partes[-1]}"]
    return chaves


def ligar_gabinetes(nomes: list[str], membros: list[dict]) -> dict[str, str]:
    """Nome do gabinete no SOD → bioguide. Tenta do mais exato ao mais solto e só aceita correspondência
    única em cada nível (na dúvida, fica de fora e aparece em "sem_vinculo")."""
    niveis: list[dict[str, set[str]]] = [defaultdict(set) for _ in range(3)]
    for m in membros:
        for alvo in {m["nome"], f"{m.get('prenome') or ''} {m.get('sobrenome') or ''}".strip()}:
            for i, k in enumerate(_chaves_nome(alvo)):
                niveis[i][k].add(m["id"])
    out = {}
    for nome in nomes:
        for i, k in enumerate(_chaves_nome(nome)):
            ids = niveis[i].get(k, set()) | (niveis[0].get(k, set()) if i else set())
            if len(ids) == 1:
                out[nome] = next(iter(ids))
                break
            if ids:
                break  # ambíguo neste nível: não arrisca um nível mais solto
    return out


def montar_camara(api: Path, membros: list[dict]) -> tuple[bool, list[dict]]:
    pag = baixar(SOD_PAGINA)
    arq = baixar(SOD_ARQUIVO)
    links = links_sod((pag.text if pag.ok else "") + (arq.text if arq.ok else ""), SOD_PAGINA)
    links = [x for x in links if x[0] >= INICIO_SERIE]
    cache = api / "gastos" / "base"
    trimestres: dict[str, dict] = {}
    pub = None
    for ano, tri, url in links:
        chave = f"{ano}T{tri}"
        destino = cache / f"sod-{chave}.json"
        dados = ler(destino)
        if dados is None or dados.get("url") != url:
            r = baixar(url)
            if r.status_code != 200:
                continue
            gab = ler_sod(r.content.decode("latin-1"))
            dados = {"url": url, "publicado_em": publicado_em(r), "gabinetes": {k: {**v, "categorias": {c: list(t) for c, t in v["categorias"].items()}} for k, v in gab.items()}}
            gravar(destino, dados)
        trimestres[chave] = dados
        pub = dados.get("publicado_em") or pub

    # Liga cada gabinete ao parlamentar (nome oficial do Clerk/compilação).
    perfis = [ler(api / "membro" / f"{m['id']}.json") or m for m in membros if m["casa"] == "camara"]
    nomes = sorted({g["nome"] for t in trimestres.values() for g in t["gabinetes"].values()})
    vinculo = ligar_gabinetes(nomes, perfis)

    # Por parlamentar: série trimestral (gasto do trimestre, pela competência do ano legislativo) e ano a ano (YTD mais recente).
    serie: dict[str, dict[str, dict]] = defaultdict(dict)
    anual: dict[str, dict[int, dict]] = defaultdict(dict)
    for chave in sorted(trimestres):
        for g in trimestres[chave]["gabinetes"].values():
            bio = vinculo.get(g["nome"])
            if not bio:
                continue
            cats = g["categorias"]
            if g["ano"] == int(chave[:4]):  # o trimestre do próprio ano (ajustes de anos anteriores ficam só no total do ano)
                serie[bio][chave] = {c: round(v[1], 2) for c, v in cats.items()}
            anual[bio][g["ano"]] = {c: round(v[0], 2) for c, v in cats.items()}  # YTD: o arquivo mais recente prevalece

    mudou = False
    ranking = defaultdict(list)
    for bio in sorted(set(serie) | set(anual)):
        anos = {str(a): {"total": round(sum(c.values()), 2), "categorias": c} for a, c in sorted(anual[bio].items())}
        tri = [{"trimestre": k, "total": round(sum(v.values()), 2), "categorias": v} for k, v in sorted(serie[bio].items())]
        mudou |= gravar(api / "gastos" / "membro" / f"{bio}.json", {"id": bio, "anos": anos, "trimestres": tri})
        for a, v in anos.items():
            ranking[a].append({"id": bio, "total": v["total"], **v["categorias"]})
    ultimo = max(trimestres) if trimestres else None
    dados = {
        "trimestres": [{"chave": k, "url": trimestres[k]["url"], "publicado_em": trimestres[k].get("publicado_em")} for k in sorted(trimestres)],
        "ultimo": ultimo,
        "categorias": list(dict.fromkeys(CATEGORIAS.values())),
        "anos": {a: sorted(v, key=lambda x: x["id"]) for a, v in sorted(ranking.items())},
        "sem_vinculo": sorted(n for n in nomes if n not in vinculo and any(t["gabinetes"].get(f"{chave[:4]} HON. {n}") for chave, t in trimestres.items() if chave == ultimo)),
        "senado": {"formato": "PDF semestral", "url": SENADO_RELATORIO},
        "coletado_em": agora(),
    }
    mudou |= gravar_se_mudou(api / "gastos" / "camara.json", dados)
    url_fonte = trimestres[ultimo]["url"] if ultimo else SOD_PAGINA
    return mudou, [
        fonte("eua-sod", nome="Statement of Disbursements (resumo por gabinete)", orgao="U.S. House of Representatives · Chief Administrative Officer",
              url=url_fonte, pagina=SOD_PAGINA, licenca=DOMINIO_PUBLICO, publicado=pub,
              descricao="Gastos trimestrais e acumulados no ano de cada gabinete da Câmara, por categoria (verba de representação, MRA). Publicado a cada trimestre, cerca de 45 a 60 dias depois do fim do período."),
    ]


# ── USAspending ──────────────────────────────────────────────────────────────


def ano_fiscal(hoje: datetime | None = None) -> int:
    h = hoje or datetime.now(ET)
    return h.year + 1 if h.month >= 10 else h.year


def _geo(camada: str, af: int) -> list[dict]:
    r = baixar(
        USASPENDING_GEO,
        metodo="POST",
        json={"scope": "place_of_performance", "geo_layer": camada, "filters": {"time_period": [{"start_date": f"{af - 1}-10-01", "end_date": f"{af}-09-30"}]}},
        timeout=(15, 300),
    )
    r.raise_for_status()
    return r.json().get("results", [])


def montar_federal(api: Path) -> tuple[bool, list[dict]]:
    atual = ano_fiscal()
    anos = list(range(atual - 3, atual + 1))
    estados: dict[str, dict] = {}
    for af in anos:
        for x in _geo("state", af):
            uf = x.get("shape_code")
            if uf:
                estados.setdefault(uf, {"nome": x.get("display_name"), "anos": {}})["anos"][str(af)] = {
                    "valor": round(x.get("aggregated_amount") or 0, 2),
                    "per_capita": x.get("per_capita"),
                    "populacao": x.get("population"),
                }
    # Distritos: só o ano fiscal encerrado mais recente (para a página de cada deputado(a)).
    fechado = atual - 1
    distritos = {}
    for x in _geo("district", fechado):
        codigo = x.get("display_name") or ""  # "PA-04"
        if "-" in codigo:
            uf, d = codigo.split("-", 1)
            distritos[f"{uf}-{int(d) if d.isdigit() else 0}"] = {"valor": round(x.get("aggregated_amount") or 0, 2), "per_capita": x.get("per_capita"), "populacao": x.get("population")}
    dados = {"anos": [str(a) for a in anos], "ano_corrente": str(atual), "ano_distritos": str(fechado), "estados": estados, "distritos": distritos, "coletado_em": agora()}
    mudou = gravar_se_mudou(api / "gastos" / "federal.json", dados)
    return mudou, [
        fonte("eua-usaspending", nome="Spending by Geography (gasto federal por local)", orgao="USAspending.gov · U.S. Department of the Treasury",
              url=USASPENDING_GEO, pagina=USASPENDING_PAGINA, licenca=DOMINIO_PUBLICO,
              descricao="Contratos, convênios, empréstimos e outros repasses do governo federal pelo local onde são executados, por estado e por distrito, em cada ano fiscal (out–set). O ano corrente ainda está em andamento."),
    ]


if __name__ == "__main__":
    import sys

    api = Path(sys.argv[1]) / "api" / "eua"
    cong = ler(api / "congresso.json")
    print(montar_camara(api, cong["camara"]["membros"])[0], montar_federal(api)[0])
