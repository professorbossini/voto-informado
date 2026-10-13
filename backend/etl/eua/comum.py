"""Utilidades comuns da coleta dos EUA: HTTP com novas tentativas, gravação só quando muda e o
registro de fontes (cada bloco de dados do site aponta para o arquivo oficial de origem)."""

from __future__ import annotations

import json
import os
import re
import time
import unicodedata
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

BRT = ZoneInfo("America/Sao_Paulo")
ET = ZoneInfo("America/New_York")
UA = {"User-Agent": "Mozilla/5.0 (compatible; tanaurna/1.0; dados abertos; +https://www.tanaurna.com.br/eua/sobre)"}
SITE_URL = os.environ.get("SITE_URL", "https://www.tanaurna.com.br")

# Congresso atual (119º: 03/01/2025 a 03/01/2027). Depois da posse de 2027, o 120º (calculado pela data).
CONGRESSO_INICIO = 1789


def congresso_atual(hoje: datetime | None = None) -> int:
    """Número do Congresso em vigor: cada um começa em 3 de janeiro dos anos ímpares (20ª Emenda)."""
    h = hoje or datetime.now(ET)
    base = h.year if h.year % 2 else h.year - 1
    if h.year % 2 and (h.month, h.day) < (1, 3):
        base -= 2
    return (base - CONGRESSO_INICIO) // 2 + 1


def anos_do_congresso(n: int) -> tuple[int, int]:
    inicio = CONGRESSO_INICIO + 2 * (n - 1)
    return inicio, inicio + 1


_s = requests.Session()
_s.headers.update(UA)


def baixar(url: str, *, tentativas: int = 4, timeout: tuple[int, int] = (15, 180), metodo: str = "GET", **kw) -> requests.Response:
    """GET (ou POST) com novas tentativas para falhas de rede e erros 5xx/429. 4xx volta direto."""
    erro: Exception | None = None
    for i in range(tentativas):
        try:
            r = _s.request(metodo, url, timeout=timeout, **kw)
            if r.status_code < 500 and r.status_code != 429:
                return r
            erro = requests.HTTPError(f"{r.status_code} em {url}")
        except requests.RequestException as e:
            erro = e
        time.sleep(2.5 * (i + 1))
    raise RuntimeError(f"Falha ao baixar {url}: {erro}")


def publicado_em(r: requests.Response) -> str | None:
    """Last-Modified do servidor oficial, em horário de Brasília."""
    lm = r.headers.get("Last-Modified")
    if not lm:
        return None
    try:
        return parsedate_to_datetime(lm).astimezone(BRT).isoformat(timespec="seconds")
    except (TypeError, ValueError):
        return None


def agora() -> str:
    return datetime.now(BRT).isoformat(timespec="seconds")


def ler(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def gravar(p: Path, dados) -> bool:
    """Grava JSON compacto só se o conteúdo mudou (o site só republica o que mudou)."""
    novo = json.dumps(dados, ensure_ascii=False, separators=(",", ":"))
    if p.exists() and p.read_text(encoding="utf-8") == novo:
        return False
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(novo, encoding="utf-8")
    return True


def sem_data(d: dict, *chaves: str) -> str:
    """Conteúdo sem os campos de data de coleta: para decidir se algo mudou de verdade."""
    fora = set(chaves) or {"coletado_em"}
    return json.dumps({k: v for k, v in d.items() if k not in fora}, sort_keys=True, ensure_ascii=False)


def gravar_se_mudou(p: Path, dados: dict, campo_data: str = "coletado_em") -> bool:
    """Como gravar(), mas ignora a data de coleta ao comparar (não republica só porque o relógio andou)."""
    anterior = ler(p)
    if isinstance(anterior, dict) and sem_data(anterior, campo_data) == sem_data(dados, campo_data):
        return False
    return gravar(p, dados)


def normalizar(s: str | None) -> str:
    """Minúsculas, sem acento e sem pontuação (comparação de nomes)."""
    t = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode()
    return " ".join(re.sub(r"[^a-z0-9 ]+", " ", t.lower()).split())


def slug(s: str) -> str:
    return normalizar(s).replace(" ", "-")


def fonte(chave: str, *, nome: str, orgao: str, url: str, descricao: str, pagina: str | None = None, licenca: str | None = None,
          publicado: str | None = None) -> dict:
    return {
        "chave": chave,
        "nome": nome,
        "orgao": orgao,
        "url": url,
        "pagina": pagina,
        "descricao": descricao,
        "licenca": licenca,
        "gerado_em": None,
        "publicado_em": publicado,
        "coletado_em": agora(),
    }


# Licenças citadas nas fontes (explicadas em /eua/sobre).
DOMINIO_PUBLICO = "Domínio público: obra do governo federal dos EUA (17 U.S.C. § 105)"
CC0 = "CC0 1.0 (dedicação ao domínio público)"

ESTADOS = {
    "AL": "Alabama", "AK": "Alasca", "AZ": "Arizona", "AR": "Arkansas", "CA": "Califórnia", "CO": "Colorado",
    "CT": "Connecticut", "DE": "Delaware", "DC": "Distrito de Colúmbia", "FL": "Flórida", "GA": "Geórgia", "HI": "Havaí",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Luisiana",
    "ME": "Maine", "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada", "NH": "Nova Hampshire", "NJ": "Nova Jersey",
    "NM": "Novo México", "NY": "Nova York", "NC": "Carolina do Norte", "ND": "Dakota do Norte", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pensilvânia", "RI": "Rhode Island", "SC": "Carolina do Sul",
    "SD": "Dakota do Sul", "TN": "Tennessee", "TX": "Texas", "UT": "Utah", "VT": "Vermont", "VA": "Virgínia",
    "WA": "Washington", "WV": "Virgínia Ocidental", "WI": "Wisconsin", "WY": "Wyoming",
}
# Territórios com delegado (sem voto no Plenário) na Câmara.
TERRITORIOS = {"AS": "Samoa Americana", "GU": "Guam", "MP": "Ilhas Marianas do Norte", "PR": "Porto Rico", "VI": "Ilhas Virgens Americanas"}
NOMES_EN = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas", "CA": "California", "CO": "Colorado", "CT": "Connecticut",
    "DE": "Delaware", "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho", "IL": "Illinois",
    "IN": "Indiana", "IA": "Iowa", "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi", "MO": "Missouri", "MT": "Montana",
    "NE": "Nebraska", "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania",
    "RI": "Rhode Island", "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
    "AS": "American Samoa", "GU": "Guam", "MP": "Northern Mariana Islands", "PR": "Puerto Rico", "VI": "U.S. Virgin Islands",
}
SIGLA_POR_NOME_EN = {v.upper(): k for k, v in NOMES_EN.items()}

PARTIDOS = {"R": "Republicano", "D": "Democrata", "I": "Independente", "L": "Libertário", "G": "Verde"}
PARTIDO_POR_NOME = {"Republican": "R", "Democrat": "D", "Democratic": "D", "Independent": "I", "Libertarian": "L", "Green": "G"}
