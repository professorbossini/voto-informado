"""Votações nominais (roll call votes) do Plenário da Câmara e do Senado dos EUA no Congresso atual.

Fontes oficiais (XML, uma votação por arquivo):
  Câmara: Office of the Clerk   https://clerk.house.gov/evs/<ano>/roll<NNN>.xml
          traz a pergunta votada, a proposição, o resultado, o placar e o voto de cada membro em
          exercício naquele momento (identificado pelo bioguide).
  Senado: Senate LIS            https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_<congresso>_<sessão>.xml
                                https://www.senate.gov/legislative/LIS/roll_call_votes/vote<congresso><sessão>/vote_<congresso>_<sessão>_<NNNNN>.xml
          o voto de cada senador(a) vem com o código LIS, ligado ao bioguide pela compilação
          congress-legislators (CC0). O senate.gov só aceita acesso a partir dos EUA (o GitHub
          Actions roda lá); se recusar, a parte do Senado fica como estava e o site avisa.

Critério (explicado na página):
  - Todas as votações nominais do Plenário desde o início do Congresso atual (3 de janeiro do ano ímpar).
  - "Participou" = registrou resposta (Sim, Não, "Presente" ou, na eleição do Presidente da Câmara, um nome).
  - "Não votou" = consta como Not Voting. Quem não estava em exercício não aparece na votação.
  - Votos exatamente como publicados (Yea/Aye = Sim; Nay/No = Não; Present = Presente).

Incremental: a base de cada ano (api/eua/votacoes/base/<casa>-<ano>.json) guarda o que já foi lido;
só votações novas são baixadas.

Grava:
  api/eua/votacoes/<casa>.json             catálogo (data, pergunta, proposição, resultado, placar, links)
  api/eua/votacoes/votacao/<id>.json       voto de cada parlamentar numa votação
  api/eua/votacoes/membro/<bioguide>.json  resumo e votações mais recentes de cada parlamentar
"""

from __future__ import annotations

import os
import re
import time
import xml.etree.ElementTree as ET
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

from .comum import (
    DOMINIO_PUBLICO,
    ET as FUSO_ET,
    anos_do_congresso,
    baixar,
    congresso_atual,
    fonte,
    gravar,
    gravar_se_mudou,
    agora,
    ler,
)

CLERK_VOTO = "https://clerk.house.gov/evs/{ano}/roll{n:03d}.xml"
CLERK_PAGINA = "https://clerk.house.gov/Votes"
CLERK_VOTO_PAGINA = "https://clerk.house.gov/Votes/{ano}{n}"
SENADO_MENU = "https://www.senate.gov/legislative/LIS/roll_call_lists/vote_menu_{c}_{s}.xml"
SENADO_VOTO = "https://www.senate.gov/legislative/LIS/roll_call_votes/vote{c}{s}/vote_{c}_{s}_{n:05d}.xml"
SENADO_VOTO_PAGINA = "https://www.senate.gov/legislative/LIS/roll_call_votes/vote{c}{s}/vote_{c}_{s}_{n:05d}.htm"
SENADO_PAGINA = "https://www.senate.gov/legislative/votes_new.htm"
SENADO_PROXY = os.environ.get("EUA_PROXY", "").rstrip("/")  # intermediário opcional (infra/cloudflare/eua-proxy)
MAX_SENADO_POR_PASSADA = 400  # votações do Senado baixadas por passada (o resto vem nas seguintes)
MAX_ITENS = 200  # votações listadas por parlamentar (as mais recentes); o resumo conta todas

# Código curto → texto publicado. S/N/P/A/O: Sim, Não, Presente, Não votou, Outro (nome na eleição do Speaker).
CODIGOS = {"Yea": "S", "Aye": "S", "Nay": "N", "No": "N", "Present": "P", "Not Voting": "A", "Guilty": "S", "Not Guilty": "N"}

TIPOS_PROPOSICAO = {
    "H R": "house-bill", "HR": "house-bill", "H RES": "house-resolution", "H J RES": "house-joint-resolution",
    "H CON RES": "house-concurrent-resolution", "S": "senate-bill", "S RES": "senate-resolution",
    "S J RES": "senate-joint-resolution", "S CON RES": "senate-concurrent-resolution",
}


def _ordinal(n: int) -> str:
    return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def url_proposicao(congresso: int, ref: str | None) -> str | None:
    """'H R 498' → página da proposição no Congress.gov (oficial, da Biblioteca do Congresso)."""
    if not ref:
        return None
    m = re.match(r"^\s*([A-Z][A-Z .]*?)\s*\.?\s*(\d+)\s*$", ref.replace(".", " ").upper())
    if not m:
        return None
    tipo = TIPOS_PROPOSICAO.get(" ".join(m.group(1).split()))
    if not tipo:
        return None
    return f"https://www.congress.gov/bill/{_ordinal(congresso)}-congress/{tipo}/{int(m.group(2))}"


def _cod(voto: str) -> str:
    v = (voto or "").strip()
    return CODIGOS.get(v, "O:" + v if v else "A")


def _placar(votos: dict[str, str]) -> dict[str, int]:
    c = Counter(v if len(v) == 1 else "O" for v in votos.values())
    return {k: c.get(k, 0) for k in ("S", "N", "P", "A", "O") if c.get(k)}


# ── Câmara ───────────────────────────────────────────────────────────────────


def ler_voto_camara(xml: bytes, ano: int) -> dict | None:
    """XML do Clerk → votação; None se o arquivo não for uma votação (número ainda não usado)."""
    if b"<rollcall-vote" not in xml[:400]:
        return None
    raiz = ET.fromstring(xml)
    md = raiz.find("vote-metadata")
    n = int(md.findtext("rollcall-num"))
    congresso = int(md.findtext("congress"))
    data_txt = (md.findtext("action-date") or "").strip()
    hora = md.find("action-time")
    hora_txt = (hora.get("time-etz") if hora is not None else None) or "00:00"
    try:
        quando = datetime.strptime(f"{data_txt} {hora_txt}", "%d-%b-%Y %H:%M").replace(tzinfo=FUSO_ET).isoformat()
    except ValueError:
        quando = None
    votos, nomes = {}, {}
    for rv in raiz.iter("recorded-vote"):
        leg = rv.find("legislator")
        bio = leg.get("name-id") if leg is not None else None
        if bio:
            votos[bio] = _cod(rv.findtext("vote") or "")
            nome = re.sub(r"\s*\([A-Z]{2}\)$", "", (leg.text or leg.get("unaccented-name") or bio).strip())  # "Amodei (NV)" → "Amodei"
            nomes[bio] = f"{nome} ({leg.get('party')}-{leg.get('state')})"
    ref = (md.findtext("legis-num") or "").strip()
    ref = None if ref in ("", "0", "QUORUM", "ADJOURN") else ref
    return {
        "id": f"h{ano}-{n}",
        "casa": "camara",
        "n": n,
        "data": quando,
        "pergunta": (md.findtext("vote-question") or "").strip() or None,
        "tipo": (md.findtext("vote-type") or "").strip() or None,
        "resultado": (md.findtext("vote-result") or "").strip() or None,
        "proposicao": ref,
        "descricao": (md.findtext("vote-desc") or "").strip() or None,
        "exige": "2/3" if "2/3" in (md.findtext("vote-type") or "") else None,
        "url": CLERK_VOTO_PAGINA.format(ano=ano, n=n),
        "url_xml": CLERK_VOTO.format(ano=ano, n=n),
        "url_proposicao": url_proposicao(congresso, ref),
        "votos": votos,
        "_nomes": nomes,
    }


def _separar_nomes(votacoes: list[dict], nomes: dict[str, str]) -> list[dict]:
    """Tira o nome de quem votou de cada votação e junta no dicionário da base (um por parlamentar)."""
    for v in votacoes:
        nomes.update(v.pop("_nomes", {}) or {})
    return votacoes


def _camara_ano(ano: int, base: list[dict]) -> tuple[list[dict], bool]:
    """Completa a base do ano com as votações novas (em lotes paralelos, até achar o fim)."""
    proximo = max((v["n"] for v in base), default=0) + 1
    novas: list[dict] = []
    lote = 16

    def um(n: int):
        r = baixar(CLERK_VOTO.format(ano=ano, n=n), tentativas=3)
        return ler_voto_camara(r.content, ano) if r.status_code == 200 else None

    with ThreadPoolExecutor(max_workers=8) as pool:
        while True:
            res = list(pool.map(um, range(proximo, proximo + lote)))
            ok = [v for v in res if v]
            novas += ok
            # Fim da sequência: o primeiro número do lote já não existe (as votações são numeradas sem buracos).
            if not res[0] or len(ok) < lote:
                break
            proximo += lote
    return sorted(base + novas, key=lambda v: v["n"]), bool(novas)


# ── Senado ───────────────────────────────────────────────────────────────────


def _senado_get(url: str):
    r = baixar(url, tentativas=2)
    if r.status_code == 403 and SENADO_PROXY:
        # Intermediário autenticado pelo token OIDC do próprio GitHub Actions (nenhuma senha guardada).
        r = baixar(f"{SENADO_PROXY}/?url={url}", headers={"Authorization": f"Bearer {_token_proxy()}"}, tentativas=2)
    return r


def _token_proxy() -> str:
    import requests

    r = requests.get(
        os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"],
        params={"audience": "tanaurna-eua"},
        headers={"Authorization": f"bearer {os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']}"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["value"]


def ler_voto_senado(xml: bytes, lis_bio: dict[str, str]) -> dict | None:
    if b"<roll_call_vote" not in xml[:600]:
        return None
    raiz = ET.fromstring(xml)
    t = lambda c: (raiz.findtext(c) or "").strip() or None  # noqa: E731
    c, s, n = int(t("congress")), int(t("session")), int(t("vote_number"))
    try:
        quando = datetime.strptime(re.sub(r"\s+", " ", t("vote_date") or ""), "%B %d, %Y, %I:%M %p").replace(tzinfo=FUSO_ET).isoformat()
    except ValueError:
        quando = None
    votos, nomes = {}, {}
    for m in raiz.iter("member"):
        lis = (m.findtext("lis_member_id") or "").strip()
        bio = lis_bio.get(lis)
        if bio:
            votos[bio] = _cod(m.findtext("vote_cast") or "")
            nomes[bio] = (m.findtext("member_full") or bio).strip()
    doc = raiz.find("document")
    tipo_doc = (doc.findtext("document_type") or "").strip() if doc is not None else ""
    num_doc = (doc.findtext("document_number") or "").strip() if doc is not None else ""
    ref = f"{tipo_doc} {num_doc}".strip() or None
    ano = int(t("congress_year") or anos_do_congresso(c)[s - 1])
    return {
        "id": f"s{c}-{s}-{n}",
        "casa": "senado",
        "n": n,
        "data": quando,
        "pergunta": t("vote_question_text") or t("question"),
        "tipo": t("majority_requirement"),
        "resultado": t("vote_result"),
        "proposicao": ref,
        "descricao": t("vote_title") or (doc.findtext("document_title") if doc is not None else None),
        "exige": t("majority_requirement"),
        "url": SENADO_VOTO_PAGINA.format(c=c, s=s, n=n),
        "url_xml": SENADO_VOTO.format(c=c, s=s, n=n),
        "url_proposicao": url_proposicao(c, ref.replace(".", "") if ref else None),
        "ano": ano,
        "votos": votos,
        "_nomes": nomes,
    }


def _senado_sessao(c: int, s: int, base: list[dict], lis_bio: dict[str, str], a_reler: set[int] | None = None) -> tuple[list[dict], set[int], bool]:
    """(base completa, números lidos nesta passada, senado acessível).

    a_reler: votações já na base que precisam ser lidas de novo (base antiga, sem o nome de quem votou);
    são relidas aos poucos, sem descartar nada do que já existe."""
    r = _senado_get(SENADO_MENU.format(c=c, s=s))
    if r.status_code != 200 or b"<vote_summary" not in r.content[:600]:
        return base, set(), r.status_code == 404  # 404: sessão ainda não começou (acessível, só vazia)
    menu = ET.fromstring(r.content)
    numeros = sorted({int(v.findtext("vote_number")) for v in menu.iter("vote") if v.findtext("vote_number")})
    ja = {v["n"] for v in base}
    faltam = [n for n in numeros if n not in ja] + sorted(a_reler or set())

    def um(n: int):
        time.sleep(0.4)
        rr = _senado_get(SENADO_VOTO.format(c=c, s=s, n=n))
        return ler_voto_senado(rr.content, lis_bio) if rr.status_code == 200 else None

    # O senate.gov limita acessos seguidos: poucos de cada vez; o que faltar fica para a próxima passada.
    with ThreadPoolExecutor(max_workers=2) as pool:
        lidas = [v for v in pool.map(um, faltam[:MAX_SENADO_POR_PASSADA]) if v]
    por_n = {v["n"]: v for v in base} | {v["n"]: v for v in lidas}
    return sorted(por_n.values(), key=lambda v: v["n"]), {v["n"] for v in lidas}, True


# ── montagem ─────────────────────────────────────────────────────────────────


def _catalogo(v: dict) -> dict:
    return {k: v.get(k) for k in ("id", "n", "data", "pergunta", "tipo", "resultado", "proposicao", "descricao", "url", "url_proposicao")} | {"placar": _placar(v["votos"])}


def resumo_membro(bio: str, votacoes: list[dict]) -> dict:
    """Participação de um parlamentar nas votações em que estava em exercício (mais recentes primeiro)."""
    presentes = [v for v in votacoes if bio in v["votos"]]
    c = Counter(v["votos"][bio] if len(v["votos"][bio]) == 1 else "O" for v in presentes)
    total = len(presentes)
    participou = total - c.get("A", 0)
    itens = sorted(presentes, key=lambda v: v["data"] or "", reverse=True)[:MAX_ITENS]
    return {
        "id": bio,
        "total": total,
        "participou": participou,
        "pct_participou": round(100 * participou / total, 1) if total else None,
        "contagem": {k: c.get(k, 0) for k in ("S", "N", "P", "A", "O")},
        "itens": [{"id": v["id"], "voto": v["votos"][bio]} for v in itens],
    }


def montar(api: Path, congresso_json: dict | None = None) -> tuple[bool, list[dict], dict]:
    """Atualiza as duas casas. Devolve (mudou, fontes, situação por casa)."""
    pasta = api / "votacoes"
    c = congresso_atual()
    anos = anos_do_congresso(c)
    hoje = datetime.now(FUSO_ET).year
    mudou = False
    situacao = {"camara": "ok", "senado": "ok"}

    todos_nomes: dict[str, str] = {}
    # Câmara: um arquivo-base por ano do Congresso atual.
    camara: list[dict] = []
    for ano in anos:
        if ano > hoje:
            continue
        caminho = pasta / "base" / f"camara-{ano}.json"
        dados_base = ler(caminho) or {}
        nomes = dados_base.get("nomes")
        base = dados_base.get("votacoes", []) if nomes is not None else []  # base antiga sem nomes: relê o ano uma vez
        nomes = nomes or {}
        try:
            completa, novas = _camara_ano(ano, base)
        except RuntimeError as e:
            print(f"aviso: Câmara {ano}: {e}")
            completa, novas, situacao["camara"] = dados_base.get("votacoes", []), False, "indisponivel"
        completa = _separar_nomes(completa, nomes)
        if novas:
            mudou |= gravar(caminho, {"congresso": c, "ano": ano, "votacoes": completa, "nomes": nomes})
        todos_nomes.update(nomes)
        camara += completa

    # Senado: uma sessão por ano; o vínculo LIS → bioguide vem do congresso.json montado antes.
    lis_bio = {}
    for p in (api / "membro").glob("*.json"):
        d = ler(p) or {}
        if d.get("lis"):
            lis_bio[d["lis"]] = d["id"]
    senado: list[dict] = []
    for s, ano in enumerate(anos, start=1):
        if ano > hoje:
            continue
        caminho = pasta / "base" / f"senado-{ano}.json"
        dados_base = ler(caminho) or {}
        base = dados_base.get("votacoes", [])
        nomes = dados_base.get("nomes") or {}
        # Base antiga (sem nomes): relê as votações que ainda não foram relidas.
        a_reler = set() if "nomes" in dados_base and "a_reler" not in dados_base else set(dados_base.get("a_reler", [v["n"] for v in base]))
        try:
            completa, lidas, acessivel = _senado_sessao(c, s, base, lis_bio, a_reler)
        except RuntimeError as e:
            print(f"aviso: Senado {ano}: {e}")
            completa, lidas, acessivel = base, set(), False
        if not acessivel:
            situacao["senado"] = "indisponivel"
        completa = _separar_nomes(completa, nomes)
        if lidas:
            resto = sorted(a_reler - lidas)
            mudou |= gravar(caminho, {"congresso": c, "ano": ano, "votacoes": completa, "nomes": nomes, **({"a_reler": resto} if resto else {})})
        todos_nomes.update(nomes)
        senado += completa

    for casa, lista in (("camara", camara), ("senado", senado)):
        cat = sorted((_catalogo(v) for v in lista), key=lambda v: v["data"] or "", reverse=True)
        mudou |= gravar_se_mudou(
            pasta / f"{casa}.json",
            {"congresso": c, "casa": casa, "situacao": situacao[casa], "total": len(cat), "votacoes": cat, "coletado_em": agora()},
        )
        for v in lista:
            destino = pasta / "votacao" / f"{v['id']}.json"
            if not destino.exists():
                mudou |= gravar(destino, {**_catalogo(v), "votos": v["votos"], "url_xml": v["url_xml"]})

    # Nome (como publicado na votação) de todos que votaram, para quem já saiu do cargo.
    mudou |= gravar(pasta / "nomes.json", dict(sorted(todos_nomes.items())))

    # Resumo por parlamentar em exercício (cada um só nas votações da própria casa).
    membros = (congresso_json or ler(api / "congresso.json") or {})
    for casa, lista in (("camara", camara), ("senado", senado)):
        for m in membros.get(casa, {}).get("membros", []):
            mudou |= gravar(pasta / "membro" / f"{m['id']}.json", {"casa": casa, **resumo_membro(m["id"], lista)})

    fontes = [
        fonte("eua-votos-camara", nome="Roll Call Votes (votações nominais da Câmara)", orgao="U.S. House of Representatives · Office of the Clerk",
              url=CLERK_VOTO.format(ano=hoje, n=1), pagina=CLERK_PAGINA, licenca=DOMINIO_PUBLICO,
              descricao="Cada votação nominal do Plenário em XML: pergunta, proposição, resultado e o voto de cada membro em exercício."),
        fonte("eua-votos-senado", nome="Roll Call Votes (votações nominais do Senado)", orgao="U.S. Senate · Legislative Information System",
              url=SENADO_MENU.format(c=c, s=1), pagina=SENADO_PAGINA, licenca=DOMINIO_PUBLICO,
              descricao="Lista de votações de cada sessão e o voto de cada senador(a) (código LIS, ligado ao bioguide pela compilação congress-legislators)."),
    ]
    return mudou, fontes, situacao


if __name__ == "__main__":  # teste manual: python -m etl.eua.votacoes <site>
    import sys

    print(montar(Path(sys.argv[1]) / "api" / "eua")[0::2])
