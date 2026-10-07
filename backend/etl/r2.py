"""Site publicado no Cloudflare R2: baixar e enviar arquivos a partir do GitHub Actions.

O site inteiro (interface, dados, fotos, PDFs e páginas por rota) fica no bucket tanaurna-site,
servido pelo Worker tanaurna-site. A gravação passa pelo Worker tanaurna-sync, que só aceita um
token OIDC do próprio GitHub Actions deste repositório (nenhuma senha guardada). Código dos
Workers: infra/cloudflare/.

Uso (no GitHub Actions, com `permissions: id-token: write`):
  python -m etl.r2 baixar <pasta> <caminho ou prefixo/> ...   copia do R2 para a pasta
  python -m etl.r2 enviar <pasta> [--prefixo P ...]           envia o que mudou (MD5 ≠ ETag)
"""

from __future__ import annotations

import argparse
import hashlib
import mimetypes
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import quote

import requests

SYNC = os.environ.get("R2_SYNC_URL", "https://tanaurna-sync.insta-publisher.workers.dev").rstrip("/")
IGNORAR = {".git", ".nojekyll", "CNAME"}
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("font/woff2", ".woff2")

_oidc: dict = {"token": None, "em": 0.0}
_s = requests.Session()
_s.mount("https://", requests.adapters.HTTPAdapter(pool_connections=64, pool_maxsize=64))


def _token() -> str:
    if not _oidc["token"] or time.time() - _oidc["em"] > 240:  # o token do GitHub vale poucos minutos
        r = requests.get(
            os.environ["ACTIONS_ID_TOKEN_REQUEST_URL"],
            params={"audience": "tanaurna-r2"},
            headers={"Authorization": f"bearer {os.environ['ACTIONS_ID_TOKEN_REQUEST_TOKEN']}"},
            timeout=30,
        )
        r.raise_for_status()
        _oidc.update(token=r.json()["value"], em=time.time())
    return _oidc["token"]


def _pedido(metodo: str, caminho: str, **kw) -> requests.Response:
    for tentativa in range(5):
        try:
            r = _s.request(metodo, SYNC + caminho, headers={**kw.pop("headers", {}), "Authorization": f"Bearer {_token()}"}, timeout=(10, 120), **kw)
            if r.status_code < 500:
                return r
        except requests.RequestException:
            if tentativa == 4:
                raise
        time.sleep(1.5 * (tentativa + 1))
    r.raise_for_status()
    return r


def listar(prefixo: str = "") -> dict[str, str]:
    """chave → ETag (MD5) de tudo sob o prefixo."""
    out, cursor = {}, None
    while True:
        r = _pedido("GET", "/list", params={"prefix": prefixo, **({"cursor": cursor} if cursor else {})})
        r.raise_for_status()
        d = r.json()
        out.update({o["key"]: o["etag"] for o in d["objects"]})
        cursor = d.get("cursor")
        if not d.get("truncated") or not cursor:
            return out


def _url(chave: str) -> str:
    return "/obj/" + quote(chave, safe="/")


def baixar(pasta: Path, alvos: list[str]) -> int:
    """Copia do R2 os caminhos (ou prefixos terminados em "/") para a pasta. Ausentes são ignorados."""
    chaves: list[str] = []
    for a in alvos:
        a = a.lstrip("/")
        chaves += list(listar(a)) if a.endswith("/") else [a]

    def um(chave: str) -> int:
        r = _pedido("GET", _url(chave))
        if r.status_code == 404:
            return 0
        r.raise_for_status()
        destino = pasta / chave
        destino.parent.mkdir(parents=True, exist_ok=True)
        destino.write_bytes(r.content)
        return 1

    with ThreadPoolExecutor(max_workers=24) as pool:
        n = sum(pool.map(um, chaves))
    print(f"r2: {n} arquivos baixados para {pasta}")
    return n


def _md5(p: Path) -> str:
    h = hashlib.md5()
    with p.open("rb") as f:
        for bloco in iter(lambda: f.read(1 << 20), b""):
            h.update(bloco)
    return h.hexdigest()


def enviar(pasta: Path, prefixos: list[str] | None = None) -> int:
    """Envia os arquivos da pasta que não existem no R2 ou têm conteúdo diferente."""
    locais = [p for p in pasta.rglob("*") if p.is_file() and not (set(p.relative_to(pasta).parts) & IGNORAR)]
    chaves = {str(p.relative_to(pasta)).replace(os.sep, "/"): p for p in locais}
    if prefixos:
        chaves = {k: p for k, p in chaves.items() if any(k.startswith(x.lstrip("/")) for x in prefixos)}
    raizes = sorted({k.split("/", 1)[0] + "/" if "/" in k else k for k in chaves})
    remotos: dict[str, str] = {}
    for r in raizes:
        remotos.update(listar(r))
    pendentes = [(k, p) for k, p in chaves.items() if remotos.get(k) != _md5(p)]

    def um(item) -> int:
        chave, p = item
        tipo = mimetypes.guess_type(chave)[0] or "application/octet-stream"
        r = _pedido("PUT", _url(chave), data=p.read_bytes(), headers={"Content-Type": tipo})
        r.raise_for_status()
        return 1

    with ThreadPoolExecutor(max_workers=24) as pool:
        n = sum(pool.map(um, pendentes))
    print(f"r2: {n} de {len(chaves)} arquivos enviados (os demais já estavam iguais)")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"enviados={n}\n")
    return n


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("baixar")
    b.add_argument("pasta", type=Path)
    b.add_argument("alvos", nargs="+")
    e = sub.add_parser("enviar")
    e.add_argument("pasta", type=Path)
    e.add_argument("--prefixo", action="append")
    a = ap.parse_args()
    if a.cmd == "baixar":
        baixar(a.pasta, a.alvos)
    else:
        enviar(a.pasta, a.prefixo)


if __name__ == "__main__":
    sys.exit(main())
