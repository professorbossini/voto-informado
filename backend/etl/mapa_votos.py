"""Mapa do voto por município: votação para Presidente em cada município (e no exterior), por turno.
Roda sozinho no GitHub Actions (.github/workflows/mapa.yml), direto sobre o site publicado.

Fonte oficial: TSE, Divulgação de Resultados, o mesmo arquivo "unificado" da apuração
(etl.resultados, frontend/src/data/apuracao.ts), só que por município:
  https://resultados.tse.jus.br/oficial/<ciclo>/<eleicao>/dados/<uf>/<uf><mun>-c0001-e<eleicao:6>-u.json
e a lista de municípios (código TSE, código IBGE e nome) da configuração oficial da eleição:
  https://resultados.tse.jus.br/oficial/<ciclo>/<eleicao>/config/mun-e<eleicao:6>-cm.json
O exterior aparece como a "UF" ZZ, com uma "cidade" por local de votação no exterior.

Só entra no mapa o município cuja totalização é FINAL (tf = "s" no arquivo): parcial não fica
congelado no site. O resto aparece como "aguardando a totalização final".

Grava (JSON compacto) api/mapa/presidente-<turno>t.json:
  {cargo, turno, eleicao, ciclo, fonte, gerado_em, atualizado_tse, municipios_finais, municipios_total,
   candidatos: [{sq, numero, nome_urna, partido}]           (ordem alfabética do nome na urna)
   nomes: {"<UF>": {"<mun TSE>": "NOME COMO NO TSE"}}       (todos os municípios da configuração)
   municipios: {"<UF>": {"<mun TSE>": [votos válidos, votos do 1º candidato da lista, do 2º, ...]}}}
Os votos de cada candidato são os "votos apurados" (vap) publicados pelo TSE; a porcentagem é sobre os
votos válidos do município (vv), como o TSE calcula.

Só grava quando algo mudou. Quando o arquivo de um turno já tem todos os municípios com totalização
final, o turno não é consultado de novo (use --forcar para consultar mesmo assim).

Uso: python -m etl.mapa_votos <site> [--turno 1] [--turno 2] [--forcar]   (saída: mudou=1|0)
"""

from __future__ import annotations

import argparse
import json
import os
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from .common import ELEICAO_FEDERAL_T1, ELEICAO_FEDERAL_T2, USER_AGENT

BRT = ZoneInfo("America/Sao_Paulo")
CICLO = os.environ.get("TSE_CICLO", "ele2026")
BASE = f"https://resultados.tse.jus.br/oficial/{CICLO}"
PAGINA = "https://resultados.tse.jus.br/"
CARGO = 1  # Presidente
TRABALHADORES = 8  # downloads em paralelo: educado com o servidor do TSE
PAUSA = 15  # segundos antes da 2ª chance aos arquivos que falharam


def eleicao_do_turno(turno: int) -> str:
    return ELEICAO_FEDERAL_T1 if turno == 1 else ELEICAO_FEDERAL_T2


def url_config(eleicao: str) -> str:
    return f"{BASE}/{eleicao}/config/mun-e{int(eleicao):06d}-cm.json"


def url_municipio(eleicao: str, uf: str, mun: str) -> str:
    u = uf.lower()
    return f"{BASE}/{eleicao}/dados/{u}/{u}{mun}-c{CARGO:04d}-e{int(eleicao):06d}-u.json"


def municipios(config: dict) -> list[tuple[str, str, str]]:
    """(UF, código TSE, nome) de cada município da configuração oficial, inclusive o exterior (ZZ)."""
    out = []
    for abr in config.get("abr", []):
        uf = str(abr.get("cd") or "").upper()
        for m in abr.get("mu", []):
            if uf and m.get("cd"):
                out.append((uf, str(m["cd"]), m.get("nm") or ""))
    return sorted(out)


def _int(v) -> int:
    try:
        return int(str(v or "0").replace(".", ""))
    except ValueError:
        return 0


def ler_municipio(data: dict) -> dict:
    """Votos válidos, votos de cada candidatura (por sqcand) e situação da totalização de um arquivo."""
    cands = {}
    for carg in data.get("carg", [])[:1]:
        for agr in carg.get("agr", []):
            for par in agr.get("par", []):
                for c in par.get("cand", []):
                    sq = str(c.get("sqcand") or "")
                    if sq:
                        cands[sq] = {
                            "sq": sq,
                            "numero": str(c.get("n") or ""),
                            "nome_urna": c.get("nmu") or c.get("nm") or "",
                            "partido": par.get("sg") or "",
                            "votos": _int(c.get("vap")),
                        }
    return {
        "final": str(data.get("tf", "")).lower() == "s",
        "validos": _int((data.get("v") or {}).get("vv")),
        "candidatos": cands,
        # dg/hg: horário de Brasília (dt/ht vêm no fuso local de cada UF)
        "atualizado": f"{data.get('dg', '')} {data.get('hg', '')}".strip(),
    }


def _quando(txt: str) -> datetime:
    try:
        return datetime.strptime(txt, "%d/%m/%Y %H:%M:%S")
    except ValueError:
        return datetime.min


def montar(turno: int, eleicao: str, lista: list[tuple[str, str, str]], lidos: dict[str, dict]) -> dict | None:
    """Documento do mapa a partir da lista de municípios e dos arquivos lidos (código TSE → ler_municipio).
    None se nenhum município tem totalização final."""
    finais = {cd: m for cd, m in lidos.items() if m and m["final"]}
    if not finais:
        return None
    meta: dict[str, dict] = {}
    for m in finais.values():
        for sq, c in m["candidatos"].items():
            meta.setdefault(sq, {k: c[k] for k in ("sq", "numero", "nome_urna", "partido")})
    # Ordem alfabética do nome na urna: nenhuma candidatura vem "primeiro" por outro critério.
    candidatos = sorted(meta.values(), key=lambda c: (c["nome_urna"], c["numero"]))
    ordem = [c["sq"] for c in candidatos]
    por_uf: dict[str, dict[str, list[int]]] = {}
    for uf, cd, _nome in lista:
        m = finais.get(cd)
        if m:
            por_uf.setdefault(uf, {})[cd] = [m["validos"], *(m["candidatos"].get(sq, {}).get("votos", 0) for sq in ordem)]
    nomes: dict[str, dict[str, str]] = {}
    for uf, cd, nome in lista:
        nomes.setdefault(uf, {})[cd] = nome
    atualizado = max((m["atualizado"] for m in finais.values()), key=_quando, default="")
    return {
        "cargo": "presidente",
        "turno": turno,
        "eleicao": eleicao,
        "ciclo": CICLO,
        "fonte": {
            "nome": "TSE · Divulgação de Resultados (arquivo de cada município)",
            "url": url_municipio(eleicao, "<uf>", "<municipio>"),
            "config": url_config(eleicao),
            "pagina": PAGINA,
        },
        "gerado_em": datetime.now(BRT).isoformat(timespec="seconds"),
        "atualizado_tse": atualizado,
        "municipios_finais": len(finais),
        "municipios_total": len(lista),
        "candidatos": candidatos,
        "nomes": nomes,
        "municipios": {uf: por_uf[uf] for uf in sorted(por_uf)},
    }


def _sem_data(doc: dict) -> dict:
    return {k: v for k, v in doc.items() if k != "gerado_em"}


def gravar(destino: Path, doc: dict) -> bool:
    """Grava o JSON compacto só se o conteúdo (fora a data de geração) mudou."""
    if destino.exists():
        try:
            if _sem_data(json.loads(destino.read_text(encoding="utf-8"))) == _sem_data(doc):
                return False
        except (OSError, json.JSONDecodeError):
            pass
    destino.parent.mkdir(parents=True, exist_ok=True)
    tmp = destino.with_suffix(".json.part")
    tmp.write_text(json.dumps(doc, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    tmp.replace(destino)
    return True


def sessao() -> requests.Session:
    s = requests.Session()
    s.headers["User-Agent"] = USER_AGENT
    s.headers["Accept"] = "application/json"
    tentativas = Retry(total=4, connect=4, read=4, backoff_factor=1.5, status_forcelist=(429, 500, 502, 503, 504), allowed_methods=("GET",))
    s.mount("https://", HTTPAdapter(max_retries=tentativas, pool_connections=TRABALHADORES, pool_maxsize=TRABALHADORES))
    return s


def baixar(s: requests.Session, url: str, motivos: Counter | None = None) -> dict | None:
    """JSON do TSE; None se ainda não publicado (404/403), fora do ar ou ilegível."""
    try:
        r = s.get(url, timeout=(10, 30))
    except requests.RequestException as exc:
        if motivos is not None:
            motivos[type(exc).__name__] += 1
        return None
    if r.status_code != 200:
        if motivos is not None:
            motivos[f"HTTP {r.status_code}"] += 1
        return None
    try:
        return r.json()
    except ValueError:
        if motivos is not None:
            motivos["JSON inválido"] += 1
        return None


def coletar(s: requests.Session, eleicao: str, lista: list[tuple[str, str, str]]) -> dict[str, dict | None]:
    """Lê o arquivo de cada município. Os que falharem têm uma segunda chance, depois de uma pausa
    e com menos conexões (o servidor do TSE às vezes recusa rajadas)."""
    motivos: Counter = Counter()

    def um(item):
        uf, cd, _nome = item
        data = baixar(s, url_municipio(eleicao, uf, cd), motivos)
        return cd, (ler_municipio(data) if data else None)

    with ThreadPoolExecutor(max_workers=TRABALHADORES) as pool:
        lidos = dict(pool.map(um, lista))
    faltam = [item for item in lista if lidos[item[1]] is None]
    if faltam and len(faltam) < len(lista):
        print(f"mapa: {len(faltam)} arquivos sem resposta na 1ª passada ({dict(motivos)}); tentando de novo")
        time.sleep(PAUSA)
        motivos.clear()
        with ThreadPoolExecutor(max_workers=2) as pool:
            lidos.update(pool.map(um, faltam))
        if motivos:
            print(f"mapa: na 2ª passada: {dict(motivos)}")
    return lidos


def anteriores(destino: Path) -> dict[str, dict]:
    """Municípios já publicados (no formato de ler_municipio), para não perder um município cujo
    arquivo falhou nesta consulta (rede): a totalização final não volta atrás."""
    try:
        d = json.loads(destino.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    cands = d.get("candidatos") or []
    out = {}
    for muns in (d.get("municipios") or {}).values():
        for cd, linha in muns.items():
            out[cd] = {
                "final": True,
                "validos": linha[0],
                "candidatos": {c["sq"]: {**c, "votos": v} for c, v in zip(cands, linha[1:])},
                "atualizado": d.get("atualizado_tse") or "",
            }
    return out


def arquivo(site: Path, turno: int) -> Path:
    return site / "api" / "mapa" / f"presidente-{turno}t.json"


def completo(destino: Path) -> bool:
    try:
        d = json.loads(destino.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return False
    return d.get("municipios_total", 0) > 0 and d.get("municipios_finais") == d.get("municipios_total")


def run(site: Path, turnos: list[int], forcar: bool = False) -> bool:
    s = sessao()
    mudou = False
    for turno in turnos:
        eleicao = eleicao_do_turno(turno)
        destino = arquivo(site, turno)
        if not forcar and completo(destino):
            print(f"mapa: {turno}º turno já com todos os municípios em totalização final; nada a consultar")
            continue
        config = baixar(s, url_config(eleicao))
        if not config:
            print(f"mapa: {turno}º turno ({eleicao}): configuração de municípios ainda não publicada pelo TSE")
            continue
        lista = municipios(config)
        inicio = time.monotonic()
        lidos = coletar(s, eleicao, lista)
        publicados = sum(1 for m in lidos.values() if m)
        falhas = 0
        for cd, m in anteriores(destino).items():
            if lidos.get(cd) is None and cd in lidos:
                lidos[cd] = m
                falhas += 1
        if falhas:
            print(f"mapa: {falhas} municípios sem resposta agora mantidos como já publicados")
        doc = montar(turno, eleicao, lista, lidos)
        print(
            f"mapa: {turno}º turno ({eleicao}): {publicados}/{len(lista)} arquivos publicados, "
            f"{doc['municipios_finais'] if doc else 0} com totalização final ({time.monotonic() - inicio:.0f}s)"
        )
        if doc and gravar(destino, doc):
            print(f"mapa: gravado {destino}")
            mudou = True
    return mudou


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("site", type=Path, help="pasta do site publicado (com api/)")
    ap.add_argument("--turno", type=int, action="append", choices=(1, 2), help="turno(s) a consultar (padrão: 1 e 2)")
    ap.add_argument("--forcar", action="store_true", help="consulta mesmo o turno já completo")
    a = ap.parse_args()
    mudou = run(a.site, a.turno or [1, 2], a.forcar)
    print(f"mudou={int(mudou)}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"mudou={int(mudou)}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
