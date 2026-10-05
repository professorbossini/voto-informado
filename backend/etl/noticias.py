"""Notícias recentes na imprensa, por parlamentar e por partido (GitHub Actions, todo dia).

Fonte: busca do Google Notícias (RSS público), uma consulta por pessoa/partido, só dos últimos
30 dias; guarda as 5 mais RECENTES (ordem por data, não por "relevância"), cada uma com título,
veículo, data e link. NÃO são dados oficiais: o site exibe com esse aviso e sempre cita o veículo.

Lê do site publicado (gh-pages) api/plenario.json e grava:
  api/noticias/parlamentar/<id>.json   (id = o mesmo de /parlamentar/<id>)
  api/noticias/partido/<slug>.json      (slug = o mesmo de /partido/<slug>)

Uso: python -m etl.noticias <site> [--limite N]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import quote_plus
from zoneinfo import ZoneInfo

import requests

from .plenario import SEM_PARTIDO, slug_partido

BRT = ZoneInfo("America/Sao_Paulo")
RSS = "https://news.google.com/rss/search?q={q}&hl=pt-BR&gl=BR&ceid=BR:pt-419"
UA = {"User-Agent": "Mozilla/5.0 (compatible; tanaurna/1.0; +https://www.tanaurna.com.br)"}
MAX = 5
PAUSA = 1.2  # segundos entre consultas (gentileza com o servidor)


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


def consulta_parlamentar(nome: str, casa: str) -> str:
    return f'"{nome}" {"senador" if casa == "senado" else "deputado"} when:30d'


def consulta_partido(sigla: str, nome: str | None) -> str:
    n = (nome or sigla).strip()
    # Nome de uma palavra só (Avante, Podemos, Cidadania...) é ambíguo: acrescenta "partido".
    termo = f'"{n.title()}"' if len(n.split()) > 1 else f'"partido {n.title()}"'
    return f"{termo} when:30d"


def itens(xml: bytes) -> list[dict]:
    """Itens do RSS → [{titulo, fonte, fonte_url, link, data}], mais recentes primeiro, sem repetidos."""
    raiz = ET.fromstring(xml)
    out, vistos = [], set()
    for it in raiz.findall("./channel/item"):
        fonte_el = it.find("source")
        fonte = (fonte_el.text or "").strip() if fonte_el is not None else ""
        titulo = (it.findtext("title") or "").strip()
        if fonte and titulo.endswith(f" - {fonte}"):
            titulo = titulo[: -len(fonte) - 3].strip()
        try:
            data = parsedate_to_datetime(it.findtext("pubDate") or "").astimezone(BRT)
        except (TypeError, ValueError):
            continue
        chave = re.sub(r"\W+", " ", titulo.lower()).strip()
        if not titulo or chave in vistos:
            continue
        vistos.add(chave)
        out.append({
            "titulo": titulo,
            "fonte": fonte or None,
            "fonte_url": fonte_el.get("url") if fonte_el is not None else None,
            "link": (it.findtext("link") or "").strip(),
            "data": data.isoformat(timespec="minutes"),
        })
    out.sort(key=lambda x: x["data"], reverse=True)
    return out[:MAX]


def buscar(session: requests.Session, consulta: str) -> list[dict] | None:
    try:
        r = session.get(RSS.format(q=quote_plus(consulta)), headers=UA, timeout=(10, 30))
        if r.status_code != 200:
            return None
        return itens(r.content)
    except (requests.RequestException, ET.ParseError):
        return None


def alvos(api: Path) -> list[tuple[str, str]]:
    """(arquivo relativo em api/noticias, consulta) de cada parlamentar e partido em exercício."""
    pl = _ler(api / "plenario.json") or {}
    out: list[tuple[str, str]] = []
    for casa in ("senado", "camara"):
        for m in (pl.get(casa) or {}).get("membros", []):
            out.append((f"parlamentar/{m['id']}.json", consulta_parlamentar(m["nome"], casa)))
    for sigla, info in sorted((pl.get("partidos") or {}).items()):
        if sigla != SEM_PARTIDO:
            out.append((f"partido/{slug_partido(sigla)}.json", consulta_partido(sigla, info.get("nome"))))
    return out


def run(site: Path, limite: int | None = None) -> int:
    api = site / "api"
    lista = alvos(api)[:limite] if limite else alvos(api)
    session = requests.Session()
    agora = datetime.now(BRT).isoformat(timespec="minutes")
    mudados = falhas = 0
    for i, (rel, consulta) in enumerate(lista):
        if i:
            time.sleep(PAUSA)
        achados = buscar(session, consulta)
        if achados is None:
            falhas += 1
            if falhas >= 15 and falhas > i // 2:  # serviço recusando: para e mantém o que havia
                print(f"noticias: muitas falhas seguidas ({falhas}); parando nesta passada")
                break
            continue
        destino = api / "noticias" / rel
        anterior = _ler(destino) or {}
        if anterior.get("itens") == achados:
            continue  # nada novo: não regrava (a data da consulta não conta)
        mudados += _gravar(destino, {"consulta": consulta, "atualizado_em": agora, "fonte": "Google Notícias (busca pública)", "itens": achados})
    print(f"noticias: {len(lista)} consultas, {mudados} arquivos atualizados, {falhas} falhas")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"mudou={int(mudados > 0)}\n")
    return mudados


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("site", type=Path)
    ap.add_argument("--limite", type=int, default=None, help="só as N primeiras consultas (teste)")
    a = ap.parse_args()
    run(a.site, a.limite)
