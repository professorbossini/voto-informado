"""Eleições nos EUA: resultados oficiais por estado, Colégio Eleitoral, calendário e onde ver o
resultado oficial de cada estado.

Nos EUA não existe um órgão nacional que apure a eleição (como o TSE): cada estado apura e
certifica os próprios resultados. Por isso:

  Resultados por estado (votos populares), 1976 em diante:
    MIT Election Data and Science Lab (MEDSL), Harvard Dataverse, licença CC0, compilado a partir dos
    resultados CERTIFICADOS publicados por cada estado (a lista de fontes vem junto com os dados):
      U.S. President 1976–2024        doi:10.7910/DVN/42MVDX
      U.S. Senate statewide 1976–2024 doi:10.7910/DVN/PEJ5QU
    A coleta confere a versão publicada e incorpora sozinha a eleição seguinte quando o MEDSL a publicar.
  Colégio Eleitoral: National Archives (NARA), Office of the Federal Register, certificados de cada
    estado (https://www.archives.gov/electoral-college/<ano>).
  Onde ver o resultado oficial: USAGov (GSA), lista dos órgãos eleitorais de cada estado e território
    (https://www.usa.gov/state-election-office).
  Datas fixadas em lei: 2 U.S.C. § 7 (eleição na terça-feira seguinte à primeira segunda-feira de
    novembro dos anos pares) e 20ª Emenda (posse do Congresso em 3 de janeiro).

Grava:
  api/eua/eleicoes/presidente.json   votos por estado e Colégio Eleitoral, 1976 em diante
  api/eua/eleicoes/senado.json       eleições para o Senado por estado, 1976 em diante
  api/eua/eleicoes/escritorios.json  órgão eleitoral oficial de cada estado e território
  api/eua/eleicoes/calendario.json   próxima eleição geral, o que está em disputa e datas seguintes
"""

from __future__ import annotations

import csv
import html
import io
import re
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

from .comum import (
    CC0,
    DOMINIO_PUBLICO,
    ESTADOS,
    SIGLA_POR_NOME_EN,
    TERRITORIOS,
    agora,
    baixar,
    fonte,
    gravar_se_mudou,
    ler,
)
from .fec import nome_legivel

DATAVERSE = "https://dataverse.harvard.edu/api/datasets/:persistentId/?persistentId=doi:10.7910/DVN/{doi}"
DATAVERSE_ARQUIVO = "https://dataverse.harvard.edu/api/access/datafile/{id}?format=original"
DATAVERSE_PAGINA = "https://doi.org/10.7910/DVN/{doi}"
DOI_PRESIDENTE = "42MVDX"
DOI_SENADO = "PEJ5QU"
ARQUIVOS_NARA = "https://www.archives.gov/electoral-college/{ano}"
ESCRITORIOS = "https://www.usa.gov/state-election-office"
MINIMO_PCT = 1.0  # candidaturas com menos de 1% no país (e sem voto no Colégio) entram em "Outras"


def _dataset(doi: str) -> tuple[str, int | None]:
    """(versão publicada, id do arquivo de dados) de um conjunto do Harvard Dataverse."""
    r = baixar(DATAVERSE.format(doi=doi))
    r.raise_for_status()
    v = r.json()["data"]["latestVersion"]
    versao = f"{v.get('versionNumber')}.{v.get('versionMinorNumber')}"
    arq = next((f["dataFile"]["id"] for f in v["files"] if re.search(r"\d{4}-\d{4}-.*\.(csv|tab)$", f["dataFile"]["filename"])), None)
    return versao, arq


def _linhas(arquivo_id: int) -> list[dict]:
    r = baixar(DATAVERSE_ARQUIVO.format(id=arquivo_id), timeout=(15, 300))
    r.raise_for_status()
    texto = r.content.decode("utf-8", errors="replace")
    delim = "\t" if texto.split("\n", 1)[0].count("\t") > texto.split("\n", 1)[0].count(",") else ","
    return list(csv.DictReader(io.StringIO(texto), delimiter=delim))


def _int(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


# ── Colégio Eleitoral (NARA) ────────────────────────────────────────────────


def _celulas(linha: str) -> list[str]:
    linha = re.sub(r"<sup.*?</sup>", "", linha, flags=re.S)
    return [re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", c))).strip() for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", linha, flags=re.S)]


def ler_colegio(pagina: str) -> dict | None:
    """Tabela de votos do Colégio Eleitoral → {candidatos[], estados{UF: [votos por candidato]}, total}. None se não bater."""
    for tabela in re.findall(r"<table.*?</table>", pagina, flags=re.S):
        linhas = [_celulas(x) for x in re.findall(r"<tr.*?</tr>", tabela, flags=re.S)]
        if len(linhas) < 50 or not linhas[0] or linhas[0][0] != "State":
            continue
        nomes = linhas[1]
        estados = {}
        for c in linhas[2:]:
            uf = SIGLA_POR_NOME_EN.get(re.sub(r"[\s*†‡0-9]+$", "", c[0] if c else "").upper())
            if not uf or len(c) < 2 + len(nomes):
                continue
            estados[uf] = [_int(x) for x in c[-len(nomes):]]  # as colunas dos candidatos são sempre as últimas
        if len(estados) < 51:
            continue
        # Separa as colunas de Presidente das de Vice: o corte em que as duas somas mais se aproximam.
        soma = [sum(v[i] for v in estados.values()) for i in range(len(nomes))]
        k = min(range(1, len(nomes)), key=lambda i: abs(sum(soma[:i]) - sum(soma[i:])))
        candidatos = [re.sub(r",\s*of\s+.*$", "", n).strip() for n in nomes[:k]]
        total = sum(soma[:k])
        if not 530 <= total <= 538:
            return None
        return {"candidatos": candidatos, "estados": {uf: v[:k] for uf, v in estados.items()}, "total": total}
    return None


# ── Presidente ──────────────────────────────────────────────────────────────


def montar_presidente(linhas: list[dict], colegios: dict[int, dict]) -> dict:
    por_ano: dict[int, dict] = {}
    anos = sorted({_int(x["year"]) for x in linhas})
    for ano in anos:
        rows = [x for x in linhas if _int(x["year"]) == ano and x.get("state_po") in ESTADOS]
        nac: dict[str, int] = defaultdict(int)
        partido: dict[str, str] = {}
        for x in rows:
            nome = (x.get("candidate") or "").strip()
            if not nome or x.get("writein") == "True":
                continue
            nac[nome] += _int(x["candidatevotes"])
            partido.setdefault(nome, x.get("party_simplified") or x.get("party_detailed") or "")
        total_nac = sum({x["state_po"]: _int(x["totalvotes"]) for x in rows}.values())
        col = colegios.get(ano)
        # Candidaturas com eleitores no Colégio sempre aparecem (ligadas pelo sobrenome).
        com_eleitores = set()
        if col:
            for c in col["candidatos"]:
                sob = normal(c.split()[-1] if c.split()[-1] not in ("Jr.", "Jr") else c.split()[-2])
                for nome in nac:
                    if normal(nome.split(",")[0]) == sob:
                        com_eleitores.add(nome)
        principais = sorted([n for n in nac if 100 * nac[n] / max(total_nac, 1) >= MINIMO_PCT or n in com_eleitores], key=lambda n: -nac[n])
        estados = {}
        for uf in ESTADOS:
            linhas_uf = [x for x in rows if x["state_po"] == uf]
            if not linhas_uf:
                continue
            total = _int(linhas_uf[0]["totalvotes"])
            votos = [sum(_int(x["candidatevotes"]) for x in linhas_uf if x["candidate"].strip() == n and x.get("writein") != "True") for n in principais]
            estados[uf] = {"total": total, "votos": votos, "outros": max(0, total - sum(votos))}
        cands = []
        for n in principais:
            eleitores = None
            if col:
                sob = normal(n.split(",")[0])
                for i, c in enumerate(col["candidatos"]):
                    partes = c.replace("Jr.", "").replace(" Jr", "").split()
                    if partes and normal(partes[-1]) == sob:
                        eleitores = {uf: v[i] for uf, v in col["estados"].items() if v[i]}
            cands.append({
                "nome": nome_legivel(n.replace('""', '"')),
                "partido": partido.get(n) or None,
                "votos": nac[n],
                "pct": round(100 * nac[n] / total_nac, 2) if total_nac else None,
                "eleitores": sum(eleitores.values()) if eleitores else 0 if col else None,
                "eleitores_por_estado": eleitores,
            })
        por_ano[ano] = {"total": total_nac, "candidatos": cands, "estados": estados, "colegio_total": col["total"] if col else None, "url_colegio": ARQUIVOS_NARA.format(ano=ano)}
    return {"anos": anos, "por_ano": {str(a): v for a, v in por_ano.items()}}


def normal(s: str) -> str:
    from .comum import normalizar

    return normalizar(s)


# ── Senado ──────────────────────────────────────────────────────────────────


def montar_senado(linhas: list[dict]) -> dict:
    disputas: dict[tuple, dict] = {}
    for x in linhas:
        if x.get("stage") not in ("gen", "GEN") or x.get("state_po") not in ESTADOS:
            continue
        if x.get("mode") and x["mode"].lower() not in ("total", ""):
            continue  # alguns estados vêm também por modalidade (antecipado, correio...): fica só o total
        especial = x.get("special") in ("True", "TRUE", "1")
        chave = (_int(x["year"]), x["state_po"], especial)
        d = disputas.setdefault(chave, {"uf": x["state_po"], "especial": especial, "total": _int(x["totalvotes"]), "c": defaultdict(int), "p": {}})
        nome = (x.get("candidate") or "").strip()
        if nome and x.get("writein") != "True":
            d["c"][nome] += _int(x["candidatevotes"])
            d["p"].setdefault(nome, x.get("party_simplified") or x.get("party_detailed") or "")
    por_ano: dict[str, list] = defaultdict(list)
    for (ano, uf, esp), d in sorted(disputas.items()):
        cands = sorted(d["c"].items(), key=lambda kv: -kv[1])
        top = [{"nome": nome_legivel(n) if "," in n else n.title(), "partido": d["p"][n] or None, "votos": v, "pct": round(100 * v / d["total"], 2) if d["total"] else None} for n, v in cands[:5]]
        resto = sum(v for _, v in cands[5:])
        por_ano[str(ano)].append({"uf": uf, "especial": esp, "total": d["total"], "candidatos": top, "outros": resto or None})
    return {"anos": sorted(por_ano), "por_ano": dict(por_ano)}


# ── Escritórios e calendário ───────────────────────────────────────────────


def ler_escritorios(pagina: str) -> dict[str, dict]:
    out = {}
    for uf, url, nome in re.findall(r'<a class="url" id="([A-Z]{2})" href="([^"]+)">([^<]+)</a>', pagina):
        if uf in ESTADOS or uf in TERRITORIOS:
            out[uf] = {"url": html.unescape(url), "nome": html.unescape(re.sub(r"\s*\([A-Z]{2}\)\s*$", "", nome)).strip()}
    return out


def dia_da_eleicao(ano: int) -> date:
    """2 U.S.C. § 7: terça-feira seguinte à primeira segunda-feira de novembro."""
    d = date(ano, 11, 1)
    while d.weekday() != 0:
        d += timedelta(days=1)
    return d + timedelta(days=1)


def calendario(hoje: date, congresso: dict | None) -> dict:
    ano = hoje.year if hoje.year % 2 == 0 and hoje <= dia_da_eleicao(hoje.year) else hoje.year + (1 if hoje.year % 2 else 2)
    eleicao = dia_da_eleicao(ano)
    presidencial = ano % 4 == 0
    senado = [m for m in (congresso or {}).get("senado", {}).get("membros", []) if m.get("proxima_eleicao") == ano]
    return {
        "proxima": eleicao.isoformat(),
        "ano": ano,
        "tipo": "presidencial" if presidencial else "meio de mandato (midterm)",
        "em_disputa": {
            "presidente": presidencial,
            "camara": 435,
            "delegados": 6,
            "senado": len(senado),
            "senado_estados": sorted({(m["uf"], m["classe"]) for m in senado}),
            "senado_especiais": sorted(m["uf"] for m in senado if (m.get("mandato_fim") or "")[5:7] != "01"),
        },
        "datas": [
            {"data": eleicao.isoformat(), "o_que": "Eleição geral (votação presencial; muitos estados recebem votos antecipados e pelo correio antes)", "base": "2 U.S.C. § 7"},
            {"data": f"{ano + 1}-01-03", "o_que": "Posse do novo Congresso (ao meio-dia)", "base": "20ª Emenda à Constituição, seção 1"},
            *([{"data": f"{ano + 1}-01-20", "o_que": "Posse do Presidente e do Vice-Presidente (ao meio-dia)", "base": "20ª Emenda à Constituição, seção 1"}] if presidencial else []),
        ],
        "leis": {
            "2 U.S.C. § 7": "https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title2-section7&num=0&edition=prelim",
            "20ª Emenda": "https://constitution.congress.gov/constitution/amendment-20/",
        },
    }


# ── montagem ─────────────────────────────────────────────────────────────────


def montar(api: Path) -> tuple[bool, list[dict]]:
    pasta = api / "eleicoes"
    mudou = False
    fontes = []

    v_pres, arq_pres = _dataset(DOI_PRESIDENTE)
    anterior = ler(pasta / "presidente.json") or {}
    if anterior.get("versao_medsl") != v_pres and arq_pres:
        linhas = _linhas(arq_pres)
        anos = sorted({_int(x["year"]) for x in linhas})
        colegios = {}
        for ano in anos:
            r = baixar(ARQUIVOS_NARA.format(ano=ano))
            if r.status_code == 200:
                c = ler_colegio(r.text)
                if c:
                    colegios[ano] = c
        dados = {**montar_presidente(linhas, colegios), "versao_medsl": v_pres, "coletado_em": agora()}
        mudou |= gravar_se_mudou(pasta / "presidente.json", dados)
    fontes.append(fonte("eua-medsl-presidente", nome="U.S. President 1976–2024 (votos por estado)", orgao="MIT Election Data and Science Lab · Harvard Dataverse",
                        url=DATAVERSE_PAGINA.format(doi=DOI_PRESIDENTE), pagina=DATAVERSE_PAGINA.format(doi=DOI_PRESIDENTE), licenca=CC0,
                        descricao=f"Votos para Presidente em cada estado, compilados dos resultados certificados pelos estados (versão {v_pres})."))
    fontes.append(fonte("eua-nara-colegio", nome="Electoral College (certificados de cada estado)", orgao="National Archives · Office of the Federal Register",
                        url=ARQUIVOS_NARA.format(ano=2024), pagina="https://www.archives.gov/electoral-college", licenca=DOMINIO_PUBLICO,
                        descricao="Votos de cada estado no Colégio Eleitoral para Presidente, como registrados nos certificados oficiais."))

    v_sen, arq_sen = _dataset(DOI_SENADO)
    anterior = ler(pasta / "senado.json") or {}
    if anterior.get("versao_medsl") != v_sen and arq_sen:
        mudou |= gravar_se_mudou(pasta / "senado.json", {**montar_senado(_linhas(arq_sen)), "versao_medsl": v_sen, "coletado_em": agora()})
    fontes.append(fonte("eua-medsl-senado", nome="U.S. Senate statewide 1976–2024", orgao="MIT Election Data and Science Lab · Harvard Dataverse",
                        url=DATAVERSE_PAGINA.format(doi=DOI_SENADO), pagina=DATAVERSE_PAGINA.format(doi=DOI_SENADO), licenca=CC0,
                        descricao=f"Votos para o Senado em cada estado (eleições regulares e especiais), compilados dos resultados certificados (versão {v_sen})."))

    r = baixar(ESCRITORIOS)
    if r.status_code == 200:
        esc = ler_escritorios(r.text)
        if len(esc) >= 50:
            mudou |= gravar_se_mudou(pasta / "escritorios.json", {"escritorios": esc, "url": ESCRITORIOS, "coletado_em": agora()})
    fontes.append(fonte("eua-usagov-escritorios", nome="Find my state or local election office", orgao="USAGov · General Services Administration",
                        url=ESCRITORIOS, pagina=ESCRITORIOS, licenca=DOMINIO_PUBLICO,
                        descricao="Órgão eleitoral oficial de cada estado e território: é lá que sai a apuração e o resultado certificado."))

    from .comum import ET as FUSO
    from datetime import datetime

    cal = calendario(datetime.now(FUSO).date(), ler(api / "congresso.json"))
    mudou |= gravar_se_mudou(pasta / "calendario.json", cal, campo_data="__")
    return mudou, fontes


if __name__ == "__main__":
    import sys

    print(montar(Path(sys.argv[1]) / "api" / "eua")[0])
