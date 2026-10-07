"""Notícias recentes na imprensa, por parlamentar e por partido (GitHub Actions, todo dia).

Fonte: busca do Google Notícias (RSS público), uma consulta por pessoa/partido, só dos últimos
30 dias; guarda as 5 mais RECENTES (ordem por data, não por "relevância"), cada uma com título,
veículo, data e link. NÃO são dados oficiais: o site exibe com esse aviso e sempre cita o veículo.

Lê do site publicado (gh-pages) api/plenario.json e api/stf.json e grava:
  api/noticias/parlamentar/<id>.json   (id = o mesmo de /parlamentar/<id>)
  api/noticias/partido/<slug>.json      (slug = o mesmo de /partido/<slug>)
  api/noticias/ministro/<id>.json       (id = o mesmo de /stf/<id>)

Uso: python -m etl.noticias <site> [--limite N]
"""

from __future__ import annotations

import argparse
import hashlib
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
SITE = os.environ.get("SITE_URL", "https://www.tanaurna.com.br")
RSS = "https://news.google.com/rss/search?q={q}&hl=pt-BR&gl=BR&ceid=BR:pt-419"
# Reserva: o Google Notícias costuma recusar servidores de nuvem (como os do GitHub Actions).
BING = "https://www.bing.com/news/search?q={q}&format=rss&setlang=pt-BR&cc=BR"
DIAS = 30
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


def itens_bing(xml: bytes, agora: datetime | None = None) -> list[dict]:
    """RSS de notícias do Bing → mesmo formato; link direto para o veículo; só os últimos DIAS dias."""
    from urllib.parse import parse_qs, urlparse

    agora = agora or datetime.now(BRT)
    raiz = ET.fromstring(xml)
    out, vistos = [], set()
    for it in raiz.findall("./channel/item"):
        titulo = (it.findtext("title") or "").strip()
        fonte = next(((c.text or "").strip() for c in it if c.tag.endswith("}Source")), "") or None
        link = (it.findtext("link") or "").strip()
        alvo = parse_qs(urlparse(link).query).get("url", [None])[0]
        try:
            # O Bing marca "GMT", mas os horários batem com o fuso do Pacífico (EUA): converte supondo
            # isso e o site mostra só o DIA dessas notícias, para não exibir uma hora possivelmente errada.
            bruto = parsedate_to_datetime(it.findtext("pubDate") or "").replace(tzinfo=ZoneInfo("America/Los_Angeles"))
            data = bruto.astimezone(BRT)
        except (TypeError, ValueError):
            continue
        chave = re.sub(r"\W+", " ", titulo.lower()).strip()
        if not titulo or chave in vistos or (agora - data).days > DIAS:
            continue
        vistos.add(chave)
        site = f"{urlparse(alvo).scheme}://{urlparse(alvo).netloc}" if alvo else None
        out.append({"titulo": titulo, "fonte": fonte, "fonte_url": site, "link": alvo or link, "data": data.isoformat(timespec="minutes"), "so_dia": True})
    out.sort(key=lambda x: x["data"], reverse=True)
    return out[:MAX]


class Buscador:
    """Google Notícias primeiro; se recusar (3 vezes), passa direto ao Bing pelo resto da passada."""

    def __init__(self) -> None:
        self.session = requests.Session()
        self.google_falhas = 0
        self.erros: dict[str, int] = {}
        self.origens: dict[str, int] = {}

    def _get(self, url: str) -> bytes | None:
        try:
            r = self.session.get(url, headers=UA, timeout=(10, 30))
        except requests.RequestException as exc:
            self.erros[type(exc).__name__] = self.erros.get(type(exc).__name__, 0) + 1
            return None
        if r.status_code != 200:
            self.erros[f"HTTP {r.status_code}"] = self.erros.get(f"HTTP {r.status_code}", 0) + 1
            return None
        return r.content

    def __call__(self, consulta: str) -> tuple[list[dict], str] | None:
        if self.google_falhas < 3:
            corpo = self._get(RSS.format(q=quote_plus(consulta)))
            try:
                if corpo is not None:
                    achados = itens(corpo)
                    self.origens["Google Notícias"] = self.origens.get("Google Notícias", 0) + 1
                    return achados, "Google Notícias (busca pública)"
            except ET.ParseError:
                self.erros["Google: resposta não é RSS"] = self.erros.get("Google: resposta não é RSS", 0) + 1
            self.google_falhas += 1
        corpo = self._get(BING.format(q=quote_plus(consulta.replace(" when:30d", ""))))
        if corpo is None:
            return None
        try:
            achados = itens_bing(corpo)
        except ET.ParseError:
            self.erros["Bing: resposta não é RSS"] = self.erros.get("Bing: resposta não é RSS", 0) + 1
            return None
        self.origens["Bing Notícias"] = self.origens.get("Bing Notícias", 0) + 1
        return achados, "Bing Notícias (busca pública)"


def alvos(api: Path) -> list[tuple[str, str]]:
    """(arquivo relativo em api/noticias, consulta) de cada parlamentar e partido em exercício."""
    return [(rel, consulta) for rel, consulta, _, _ in alvos_com_nome(api)]


def alvos_com_nome(api: Path) -> list[tuple[str, str, str, str]]:
    """(arquivo, consulta, nome para o aviso, página no site) de cada alvo."""
    pl = _ler(api / "plenario.json") or {}
    out: list[tuple[str, str, str, str]] = []
    for casa in ("senado", "camara"):
        for m in (pl.get(casa) or {}).get("membros", []):
            out.append((f"parlamentar/{m['id']}.json", consulta_parlamentar(m["nome"], casa), m["nome"], f"/parlamentar/{m['id']}"))
    # Ministros do STF (api/stf.json, publicado pelo stf.yml).
    for m in (_ler(api / "stf.json") or {}).get("ministros", []):
        out.append((f"ministro/{m['id']}.json", f'"{m["nome"]}" STF when:30d', m["nome"], f"/stf/{m['id']}"))
    for sigla, info in sorted((pl.get("partidos") or {}).items()):
        if sigla != SEM_PARTIDO:
            out.append((f"partido/{slug_partido(sigla)}.json", consulta_partido(sigla, info.get("nome")), sigla, f"/partido/{slug_partido(sigla)}"))
    return out


def run(site: Path, limite: int | None = None) -> int:
    api = site / "api"
    todos = alvos_com_nome(api)
    lista = todos[:limite] if limite else todos
    buscar = Buscador()
    novidades: list[dict] = []
    agora = datetime.now(BRT).isoformat(timespec="minutes")
    mudados = falhas = 0
    for i, (rel, consulta, nome, pagina) in enumerate(lista):
        if i:
            time.sleep(PAUSA)
        r = buscar(consulta)
        if r is None:
            falhas += 1
            if falhas >= 15 and falhas > i // 2:  # serviço recusando: para e mantém o que havia
                print(f"noticias: muitas falhas seguidas ({falhas}); parando nesta passada")
                break
            continue
        achados, origem = r
        destino = api / "noticias" / rel
        anterior = _ler(destino) or {}
        if anterior.get("itens") == achados:
            continue  # nada novo: não regrava (a data da consulta não conta)
        mudados += _gravar(destino, {"consulta": consulta, "atualizado_em": agora, "fonte": origem, "itens": achados})
        # Aviso para quem segue: só a notícia mais recente, e só se ela é nova.
        vistos = {x.get("link") for x in anterior.get("itens", [])}
        if achados and achados[0]["link"] not in vistos:
            n = achados[0]
            alvo = rel.removesuffix(".json").replace("/", ":", 1)
            novidades.append({
                "alvo": alvo,
                "chave": f"noticia:{alvo}:{hashlib.sha1(n['link'].encode()).hexdigest()[:16]}",
                "titulo": f"Notícia: {nome}",
                "corpo": f"{n['titulo']}" + (f" ({n['fonte']})" if n.get("fonte") else ""),
                "url": f"{SITE}{pagina}",
            })
    print(f"noticias: {len(lista)} consultas, {mudados} arquivos atualizados, {falhas} falhas; respostas: {buscar.origens}; erros: {buscar.erros}")
    from .novidades import enviar as enviar_novidades

    enviar_novidades(novidades)
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
