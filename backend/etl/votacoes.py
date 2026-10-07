"""Votações nominais do Plenário: como cada deputado federal e senador em exercício votou.

Roda sozinho no GitHub Actions (.github/workflows/votacoes.yml), direto sobre o site publicado
(branch gh-pages), sem banco. Só dados oficiais, como publicados; sem CPF.

Fontes:
  Câmara dos Deputados (dadosabertos.camara.leg.br, arquivos anuais em CSV)
    - votacoes-<ano>.csv            cada votação (órgão, data e hora, resultado, placar)
    - votacoesProposicoes-<ano>.csv proposição votada (sigla/número/ano e ementa)
    - votacoesVotos-<ano>.csv       voto de cada deputado nas votações nominais
    - /api/v2/deputados/{id}/historico  períodos de exercício (posse, licenças, afastamentos)
  Senado Federal (legis.senado.leg.br/dadosabertos)
    - /votacao?dataInicio&dataFim   votações nominais do Plenário com a situação de cada senador
                                    em exercício (voto, presença sem voto, licença, missão...)

Critério (explicado também na página):
  - Só votações NOMINAIS do PLENÁRIO da própria Casa, desde o início da legislatura atual.
  - Câmara: conta a votação se o deputado estava em exercício na hora do registro, segundo o
    histórico oficial; quem não consta da lista de votos fica como "sem registro" (a Câmara não
    informa nesta base o motivo). Sem histórico, não há total: só os votos registrados.
  - Senado: a própria lista de cada votação traz todos os senadores em exercício, com o código
    publicado (Sim, Não, AP, LS, MIS, P-NRV...).
  - "Participou" = registrou voto (Sim, Não, Abstenção, Obstrução ou, em votação secreta, "Votou")
    ou presidia a sessão (Art. 17 do Regimento da Câmara / art. 51 do Regimento do Senado).

Grava (só quando o conteúdo muda):
  api/votacoes/parlamentar/<id>.json   resumo e as votações mais recentes de cada parlamentar (id e voto)
  api/votacoes/<casa>.json             catálogo: data, proposição, ementa, resultado e links de cada
                                       votação listada nos arquivos de parlamentar; critério e fonte
  api/votacoes/resumo.json             metadados, critérios, fontes e data da coleta
  api/votacoes/base/<casa>-<ano>.json  base compacta por ano (anos passados não são baixados de novo)

Uso: python -m etl.votacoes <site>   (saída: mudou=1|0)
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import tempfile
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime
from pathlib import Path
from typing import IO, Iterable
from zoneinfo import ZoneInfo

import requests

BRT = ZoneInfo("America/Sao_Paulo")
UA = {"User-Agent": "Mozilla/5.0 (compatible; tanaurna/1.0; dados abertos)"}
CAMARA_ARQ = "https://dadosabertos.camara.leg.br/arquivos/{t}/csv/{t}-{ano}.csv"
CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2"
CAMARA_PROPOSICAO = "https://www.camara.leg.br/propostas-legislativas/{id}"
CAMARA_SESSAO = "https://www.camara.leg.br/presenca-comissoes/votacao-portal?reuniao={id}"
SENADO_VOTACAO = "https://legis.senado.leg.br/dadosabertos/votacao"
SENADO_MATERIA = "https://www25.senado.leg.br/web/atividade/materias/-/materia/{id}"
SENADO_SESSAO = "https://www25.senado.leg.br/web/atividade/sessao-plenaria/-/pauta/{id}"

MAX_ITENS = 200  # votações listadas por parlamentar (as mais recentes); o resumo conta todas
EMENTA_MAX = 220
DESCRICAO_MAX = 260
# Opções que contam como "registrou voto" e como "presidia a sessão" (textos como publicados).
VOTOU = {"Sim", "Não", "Abstenção", "Obstrução", "Votou"}
PRESIDIU = {"Artigo 17", "Presidente (art. 51 RISF)"}
SEM_REGISTRO = "Sem registro"  # Câmara: em exercício, mas fora da lista de votos publicada

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))


# ── utilidades ────────────────────────────────────────────────────────────────


def _ler(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _gravar(p: Path, dados) -> bool:
    novo = json.dumps(dados, ensure_ascii=False, separators=(",", ":"))
    if p.exists() and p.read_text(encoding="utf-8") == novo:
        return False
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(novo, encoding="utf-8")
    return True


def _agora() -> str:
    return datetime.now(BRT).isoformat(timespec="seconds")


def _curto(texto: str | None, n: int) -> str | None:
    t = re.sub(r"\s+", " ", texto or "").strip()
    if not t:
        return None
    return t if len(t) <= n else t[: n - 1].rstrip(" ,;.") + "…"


def _int(v) -> int | None:
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def _placar(sim, nao, outros=None, abst=None) -> str | None:
    partes = [(r, v) for r, v in (("Sim", sim), ("Não", nao), ("Abstenção", abst), ("Outros", outros)) if v is not None]
    if not partes or not any(v for _, v in partes):
        return None
    return " · ".join(f"{r}: {v}" for r, v in partes)


def inicio_legislatura(legislatura: int | None) -> str:
    """57ª legislatura: 01/02/2023; cada uma dura 4 anos."""
    leg = legislatura or 57
    return f"{2023 + 4 * (leg - 57)}-02-01"


def _baixar(url: str, destino: Path, tentativas: int = 3) -> Path:
    erro: Exception | None = None
    for i in range(tentativas):
        try:
            with requests.get(url, stream=True, headers=UA, timeout=(15, 180)) as r:
                r.raise_for_status()
                with destino.open("wb") as f:
                    for bloco in r.iter_content(1 << 20):
                        f.write(bloco)
            return destino
        except Exception as exc:  # noqa: BLE001
            erro = exc
            time.sleep(3 * (i + 1))
    raise RuntimeError(f"{url}: {erro}")


def _get_json(url: str, params: dict | None = None, tentativas: int = 3, timeout=(10, 120)):
    erro: Exception | None = None
    for i in range(tentativas):
        try:
            r = requests.get(url, params=params, headers={**UA, "Accept": "application/json"}, timeout=timeout)
            if r.status_code == 429 or r.status_code >= 500:
                raise RuntimeError(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r.json()
        except Exception as exc:  # noqa: BLE001
            erro = exc
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"{url}: {erro}")


# ── Câmara ────────────────────────────────────────────────────────────────────


def _linhas(f: IO[str]) -> Iterable[dict]:
    return csv.DictReader(f, delimiter=";")


def camara_votacoes(f_votacoes: IO[str], f_proposicoes: IO[str], f_votos: IO[str], inicio: str) -> list[dict]:
    """Votações nominais do Plenário (siglaOrgao PLEN) a partir de `inicio`, com o voto de cada
    deputado ({id do deputado: voto como publicado}). Votação nominal = tem votos individuais."""
    plen: dict[str, dict] = {}
    for r in _linhas(f_votacoes):
        if (r.get("siglaOrgao") or "").strip() != "PLEN" or (r.get("data") or "") < inicio:
            continue
        aprov = (r.get("aprovacao") or "").strip()
        plen[r["id"]] = {
            "id": r["id"],
            "data": r["data"][:10],
            "hora": (r.get("dataHoraRegistro") or "")[:19] or None,
            "proposicao": None,
            "proposicao_id": None,
            "ementa": None,
            "descricao": _curto(r.get("descricao"), DESCRICAO_MAX),
            "resultado": {"1": "Aprovado", "0": "Rejeitado"}.get(aprov),
            "placar": _placar(_int(r.get("votosSim")), _int(r.get("votosNao")), _int(r.get("votosOutros"))),
            "sessao": (r.get("idEvento") or "").strip() or None,
            "votos": {},
        }
    props: dict[str, list[dict]] = {}
    for r in _linhas(f_proposicoes):
        if r.get("idVotacao") in plen:
            props.setdefault(r["idVotacao"], []).append(r)
    for vid, lista in props.items():
        prefixo = vid.split("-")[0]
        p = next((x for x in lista if x.get("proposicao_id") == prefixo), lista[0])
        v = plen[vid]
        titulo = (p.get("proposicao_titulo") or "").strip()
        if not titulo and p.get("proposicao_siglaTipo"):
            titulo = f"{p['proposicao_siglaTipo']} {p.get('proposicao_numero')}/{p.get('proposicao_ano')}"
        v["proposicao"] = titulo or None
        v["proposicao_id"] = (p.get("proposicao_id") or "").strip() or None
        v["ementa"] = _curto(p.get("proposicao_ementa"), EMENTA_MAX)
    for r in _linhas(f_votos):
        v = plen.get(r.get("idVotacao"))
        if v is not None and r.get("deputado_id"):
            # Voto em branco no arquivo = presença registrada sem a opção divulgada (votação secreta).
            v["votos"][r["deputado_id"].strip()] = (r.get("voto") or "").strip() or "Votou"
    out = [v for v in plen.values() if v["votos"]]
    for v in out:
        v["url"] = CAMARA_PROPOSICAO.format(id=v["proposicao_id"]) if v["proposicao_id"] else (CAMARA_SESSAO.format(id=v["sessao"]) if v["sessao"] else None)
        v["url_sessao"] = CAMARA_SESSAO.format(id=v["sessao"]) if v["sessao"] else None
    out.sort(key=lambda v: (v["data"], v["hora"] or "", v["id"]))
    return out


def camara_ano(ano: int, inicio: str, pasta: Path) -> dict:
    arquivos = {}
    for t in ("votacoes", "votacoesProposicoes", "votacoesVotos"):
        arquivos[t] = _baixar(CAMARA_ARQ.format(t=t, ano=ano), pasta / f"{t}-{ano}.csv")
    with (
        arquivos["votacoes"].open(encoding="utf-8-sig", newline="") as fv,
        arquivos["votacoesProposicoes"].open(encoding="utf-8-sig", newline="") as fp,
        arquivos["votacoesVotos"].open(encoding="utf-8-sig", newline="") as fo,
    ):
        votacoes = camara_votacoes(fv, fp, fo, inicio)
    for p in arquivos.values():
        p.unlink(missing_ok=True)
    return {"casa": "camara", "ano": ano, "votacoes": votacoes, "legenda": {}}


def periodos_exercicio(historico: list[dict], legislatura: int) -> list[list[str | None]]:
    """Períodos [início, fim] em exercício na legislatura, pelo histórico oficial da Câmara.
    "Exercício" abre um período; Licença, Suplência, Afastamento, Fim de mandato etc. fecham;
    registros sem situação, convocações e trocas de partido não mudam nada (a Câmara registra a troca
    de partido de suplente fora do cargo com a situação "Exercício")."""
    eventos = sorted(
        (e for e in historico if e.get("idLegislatura") == legislatura and (e.get("situacao") or "").strip() and e.get("dataHora")),
        key=lambda e: e["dataHora"],
    )
    out: list[list[str | None]] = []
    aberto: str | None = None
    for e in eventos:
        sit = e["situacao"].strip().lower()
        desc = e.get("descricaoStatus") or ""
        if sit == "convocado" or ("Alteração de partido" in desc and "Entrada" not in desc):
            continue
        if sit == "exercício":
            if aberto is None:
                aberto = e["dataHora"][:16]
        elif aberto is not None:
            out.append([aberto, e["dataHora"][:16]])
            aberto = None
    if aberto is not None:
        out.append([aberto, None])
    return out


def em_exercicio_na(periodos: list[list[str | None]], quando: str) -> bool:
    return any(ini <= quando and (fim is None or quando < fim) for ini, fim in periodos)


def camara_periodos(ids: list[str], legislatura: int) -> dict[str, list]:
    """id (sem o prefixo camara-) → períodos de exercício; falhas ficam de fora."""

    def um(i: str):
        try:
            return i, periodos_exercicio(_get_json(f"{CAMARA_API}/deputados/{i}/historico", timeout=(10, 60))["dados"], legislatura)
        except Exception as exc:  # noqa: BLE001
            print(f"  aviso: histórico do deputado {i} indisponível ({exc})")
            return i, None

    with ThreadPoolExecutor(max_workers=6) as pool:
        return {i: p for i, p in pool.map(um, ids) if p is not None}


# ── Senado ────────────────────────────────────────────────────────────────────


def senado_votacoes(lista: list[dict], inicio: str) -> tuple[list[dict], dict[str, str]]:
    """Votações do Plenário do Senado (serviço /votacao) → mesmo formato da Câmara, mais a
    legenda dos códigos publicados (ex.: AP → Atividade parlamentar)."""
    out, legenda = [], {}
    for v in lista:
        if (v.get("casaSessao") or "SF") != "SF" or (v.get("dataSessao") or "") < inicio or not v.get("votos"):
            continue
        votos: dict[str, str] = {}
        for x in v["votos"]:
            cod, sigla = x.get("codigoParlamentar"), (x.get("siglaVotoParlamentar") or "").strip()
            if cod is None or not sigla:
                continue
            votos[str(cod)] = sigla
            if x.get("descricaoVotoParlamentar"):
                legenda.setdefault(sigla, x["descricaoVotoParlamentar"].strip())
        if not votos:
            continue
        secreta = (v.get("votacaoSecreta") or "").upper() == "S"
        conta = Counter(votos.values())
        sim = v.get("totalVotosSim") if v.get("totalVotosSim") is not None else (None if secreta else conta.get("Sim", 0))
        nao = v.get("totalVotosNao") if v.get("totalVotosNao") is not None else (None if secreta else conta.get("Não", 0))
        abst = v.get("totalVotosAbstencao") if v.get("totalVotosAbstencao") is not None else (None if secreta else conta.get("Abstenção", 0))
        sessao = str(v["codigoSessao"]) if v.get("codigoSessao") else None
        materia = str(v["codigoMateria"]) if v.get("codigoMateria") else None
        out.append({
            "id": str(v.get("codigoSessaoVotacao") or f"{sessao}-{v.get('sequencialSessao')}"),
            "data": v["dataSessao"][:10],
            "hora": None,
            "ordem": v.get("sequencialVotacao") or 0,
            "proposicao": (v.get("identificacao") or "").strip() or None,
            "proposicao_id": materia,
            "ementa": _curto(v.get("ementa"), EMENTA_MAX),
            "descricao": _curto(v.get("descricaoVotacao"), DESCRICAO_MAX),
            "resultado": {"A": "Aprovado", "R": "Rejeitado"}.get((v.get("resultadoVotacao") or "").upper()),
            "placar": _placar(sim, nao, abst=abst),
            "secreta": secreta,
            "sessao": sessao,
            "url": SENADO_MATERIA.format(id=materia) if materia else (SENADO_SESSAO.format(id=sessao) if sessao else None),
            "url_sessao": SENADO_SESSAO.format(id=sessao) if sessao else None,
            "votos": votos,
        })
    out.sort(key=lambda v: (v["data"], v["ordem"], v["id"]))
    return out, legenda


def senado_ano(ano: int, inicio: str) -> dict:
    dados = _get_json(SENADO_VOTACAO, {"dataInicio": f"{ano}-01-01", "dataFim": f"{ano}-12-31"}, timeout=(15, 240))
    if not isinstance(dados, list):
        raise RuntimeError("resposta inesperada do Senado")
    votacoes, legenda = senado_votacoes(dados, inicio)
    return {"casa": "senado", "ano": ano, "votacoes": votacoes, "legenda": legenda}


# ── Base anual (incremental) ──────────────────────────────────────────────────


def base_anual(api: Path, casa: str, ano: int, hoje: date, coletar) -> tuple[dict | None, bool]:
    """Base de um ano: anos encerrados (com folga até 31/01 do ano seguinte, para correções)
    vêm da cópia já publicada; o ano corrente é sempre baixado de novo. Falha → cópia anterior."""
    destino = api / "votacoes" / "base" / f"{casa}-{ano}.json"
    anterior = _ler(destino)
    if anterior and anterior.get("final"):
        return anterior, False
    try:
        novo = coletar()
    except Exception as exc:  # noqa: BLE001
        print(f"{casa} {ano}: fonte indisponível ({exc}); {'mantendo a cópia publicada' if anterior else 'sem dados'}")
        return anterior, False
    novo["final"] = hoje.isoformat() >= f"{ano + 1}-01-31"
    print(f"{casa} {ano}: {len(novo['votacoes'])} votações nominais no Plenário")
    if anterior and {k: v for k, v in anterior.items() if k != "gerado_em"} == novo:
        return anterior, False
    novo["gerado_em"] = _agora()
    return novo, _gravar(destino, novo)


# ── Montagem por parlamentar ──────────────────────────────────────────────────


def montar_parlamentar(votacoes: list[dict], cod: str, periodos: list | None, legenda: dict[str, str], casa: str) -> dict:
    """Resumo e lista das votações de um parlamentar.

    Câmara: entram as votações em que estava em exercício (pelo histórico) ou em que votou;
    sem histórico (periodos=None), só as votações com registro dele e total desconhecido.
    Senado: entram as votações em cuja lista ele aparece (a lista traz todos em exercício)."""
    itens = []
    for v in votacoes:
        voto = v["votos"].get(cod)
        if voto is None:
            if casa != "camara" or not periodos or not em_exercicio_na(periodos, v["hora"] or f"{v['data']}T12:00"):
                continue
            voto = SEM_REGISTRO
        itens.append((v, voto))
    conta = Counter(voto for _, voto in itens)
    participou = sum(n for voto, n in conta.items() if voto in VOTOU or voto in PRESIDIU)
    votou = sum(n for voto, n in conta.items() if voto in VOTOU)
    sem_total = casa == "camara" and periodos is None
    total = None if sem_total else len(itens)
    por_ano: dict[int, dict] = {}
    for v, voto in itens:
        a = por_ano.setdefault(int(v["data"][:4]), {"ano": int(v["data"][:4]), "total": 0, "participou": 0})
        a["total"] += 1
        a["participou"] += voto in VOTOU or voto in PRESIDIU
    if sem_total:
        for a in por_ano.values():
            a["total"] = None
    # Só o id e o voto: os dados de cada votação ficam no catálogo da Casa (api/votacoes/<casa>.json),
    # uma vez só, em vez de repetidos nos ~600 arquivos de parlamentar.
    recentes = [{"id": v["id"], "voto": voto} for v, voto in reversed(itens[-MAX_ITENS:])]
    return {
        "resumo": {
            "total": total,
            "participou": participou,
            "votou": votou,
            "presidiu": sum(n for voto, n in conta.items() if voto in PRESIDIU),
            "percentual": round(participou / total, 4) if total else None,
            "votos": dict(sorted(conta.items(), key=lambda kv: (-kv[1], kv[0]))),
        },
        "por_ano": [por_ano[a] for a in sorted(por_ano)],
        "legenda": {k: legenda[k] for k in sorted(conta) if k in legenda},
        "exercicio": periodos if casa == "camara" else None,
        "sem_periodo": sem_total,
        "itens": recentes,
    }


CAMPOS_CATALOGO = ("data", "proposicao", "ementa", "descricao", "resultado", "placar", "url", "url_sessao")


def catalogo(votacoes: list[dict], ids: set[str]) -> dict[str, dict]:
    """id → dados de cada votação listada em algum arquivo de parlamentar (mais recentes primeiro)."""
    out = {}
    for v in reversed(votacoes):
        if v["id"] in ids:
            out[v["id"]] = {k: v[k] for k in CAMPOS_CATALOGO}
            if v.get("secreta"):
                out[v["id"]]["secreta"] = True
    return out


FONTES = {
    "camara": {
        "nome": "Câmara dos Deputados · Dados Abertos: votações, proposições votadas e votos do Plenário; histórico de exercício dos deputados",
        "url": "https://dadosabertos.camara.leg.br/swagger/api.html#staticfile",
        "pagina": "https://dadosabertos.camara.leg.br/",
    },
    "senado": {
        "nome": "Senado Federal · Dados Abertos: votações nominais do Plenário (serviço /votacao)",
        "url": SENADO_VOTACAO,
        "pagina": "https://legis.senado.leg.br/dadosabertos/docs/",
    },
}

CRITERIOS = {
    "camara": (
        "Votações nominais do Plenário da Câmara desde o início da legislatura. Contam as realizadas enquanto o(a) deputado(a) estava em "
        "exercício, segundo o histórico oficial da Câmara (posse, licenças e afastamentos). \"Sem registro\": em exercício na hora da votação, "
        "mas fora da lista de votos publicada; a Câmara não informa nesta base o motivo (por exemplo, missão oficial ou falta justificada). "
        "\"Artigo 17\": presidia a sessão, e por isso não vota. \"Votou\": votação secreta; a fonte informa só que votou."
    ),
    "senado": (
        "Votações nominais do Plenário do Senado desde o início da legislatura. Em cada uma, o Senado publica a situação de cada senador em "
        "exercício (voto, presença sem voto, licença, atividade parlamentar, missão etc.), mostrada aqui como publicada. \"Votou\": votação "
        "secreta; a fonte informa só que votou. Sessões do Congresso Nacional (deputados e senadores juntos) não entram."
    ),
}


def run(site: Path, hoje: date | None = None) -> bool:
    hoje = hoje or datetime.now(BRT).date()
    api = site / "api"
    pl = _ler(api / "plenario.json") or {}
    legislatura = (pl.get("camara") or {}).get("legislatura") or 57
    inicio = inicio_legislatura(legislatura)
    anos = list(range(int(inicio[:4]), hoje.year + 1))
    mudou = False

    bases: dict[str, list[dict] | None] = {}
    legendas: dict[str, dict] = {}
    with tempfile.TemporaryDirectory(prefix="votacoes-") as tmp:
        for casa, coletar in (
            ("camara", lambda a: camara_ano(a, inicio, Path(tmp))),
            ("senado", lambda a: senado_ano(a, inicio)),
        ):
            lidos = [base_anual(api, casa, a, hoje, lambda a=a, coletar=coletar: coletar(a)) for a in anos]
            mudou |= any(gravou for _, gravou in lidos)
            por_ano = [b for b, _ in lidos]
            if any(b is None for b in por_ano):
                print(f"{casa}: falta algum ano da legislatura; páginas desta Casa ficam como estavam")
                bases[casa] = None
                continue
            bases[casa] = [v for b in por_ano for v in b["votacoes"]]
            legendas[casa] = {k: v for b in por_ano for k, v in (b.get("legenda") or {}).items()}
            tipos = Counter(voto for v in bases[casa] for voto in v["votos"].values())
            print(f"{casa}: {len(bases[casa])} votações nominais desde {inicio}; tipos publicados: {dict(tipos)}")

    agora = _agora()
    resumo_casas = {}
    for casa in ("camara", "senado"):
        membros = (pl.get(casa) or {}).get("membros") or []
        votacoes = bases.get(casa)
        if votacoes is None or not membros:
            continue
        periodos: dict[str, list] = {}
        if casa == "camara":
            ids = [m["id"].split("-", 1)[1] for m in membros]
            periodos = camara_periodos(ids, legislatura)
            print(f"camara: histórico de exercício de {len(periodos)} de {len(ids)} deputados")
        gravados = 0
        usados: set[str] = set()
        for m in membros:
            cod = m["id"].split("-", 1)[1]
            destino = api / "votacoes" / "parlamentar" / f"{m['id']}.json"
            anterior = _ler(destino) or {}
            per = periodos.get(cod) if casa == "camara" else None
            if casa == "camara" and per is None and anterior.get("exercicio") is not None:
                per = anterior["exercicio"]  # histórico fora do ar: usa os períodos já publicados
            corpo = montar_parlamentar(votacoes, cod, per, legendas.get(casa, {}), casa)
            usados.update(i["id"] for i in corpo["itens"])
            dados = {"id": m["id"], "casa": casa, "nome": m.get("nome"), "inicio": inicio, **corpo}
            if {k: v for k, v in anterior.items() if k != "atualizado_em"} == dados:
                continue
            dados["atualizado_em"] = agora
            gravados += _gravar(destino, dados)
        print(f"{casa}: {gravados} de {len(membros)} arquivos de parlamentar atualizados")
        mudou |= gravados > 0
        cat_caminho = api / "votacoes" / f"{casa}.json"
        cat_anterior = _ler(cat_caminho) or {}
        cat = {"casa": casa, "inicio": inicio, "criterio": CRITERIOS[casa], "fonte": FONTES[casa], "votacoes": catalogo(votacoes, usados)}
        if {k: v for k, v in cat_anterior.items() if k != "atualizado_em"} != cat:
            cat["atualizado_em"] = agora
            mudou |= _gravar(cat_caminho, cat)
        resumo_casas[casa] = {"votacoes": len(votacoes), "ultima": votacoes[-1]["data"] if votacoes else None, "parlamentares": len(membros), "fonte": FONTES[casa], "criterio": CRITERIOS[casa]}

    if resumo_casas:
        caminho = api / "votacoes" / "resumo.json"
        anterior = _ler(caminho) or {}
        resumo = {"legislatura": legislatura, "inicio": inicio, "max_itens": MAX_ITENS, "casas": {**(anterior.get("casas") or {}), **resumo_casas}}
        if mudou or {k: v for k, v in anterior.items() if k != "coletado_em"} != resumo:
            resumo["coletado_em"] = agora
            mudou |= _gravar(caminho, resumo)
    return mudou


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("site", type=Path, help="pasta do site publicado (checkout da gh-pages)")
    a = ap.parse_args()
    mudou = run(a.site)
    print(f"mudou={int(mudou)}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"mudou={int(mudou)}\n")


if __name__ == "__main__":
    main()
