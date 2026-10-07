"""Atualiza só a interface (build do Vite) no site já publicado, sem banco (GitHub Actions).

O site publicado tem ~22 mil páginas por rota, cada uma = index.html com título, descrição e
prévia de link próprios (app.export._page). Aqui cada página é remontada com o index.html NOVO,
reaproveitando título, descrição, URL e imagem que ela já tinha; os arquivos de assets/ novos
entram ao lado dos antigos (quem estiver com a página aberta não quebra).

Uso: python -m app.frontend_remoto <site (checkout da gh-pages)> <frontend/dist recém-buildado>
"""

from __future__ import annotations

import html
import re
import shutil
import sys
from pathlib import Path

from .export import _page

# Pastas do site que não são do build do frontend.
DADOS = {"api", "fotos", "propostas", ".git"}
SITE = "https://www.tanaurna.com.br"
# Rotas fixas novas (o export completo também as cria; aqui, para não depender dele).
NOVAS_ROTAS = {
    "minha-cidade": (
        "Minha cidade · Tá na Urna",
        "Prefeitura, Câmara Municipal, como a cidade votou em 2026 e as emendas parlamentares recebidas. Dados oficiais do TSE e da CGU.",
    ),
    "emendas": (
        "Emendas parlamentares no seu município · Tá na Urna",
        "Quanto dinheiro de emendas chegou a cada município, de qual parlamentar e para quê. Dados do Portal da Transparência (CGU).",
    ),
    "como-votar": (
        "Como votar no 2º turno · Tá na Urna",
        "Data, horário, documentos, celular, local de votação e justificativa, conforme as regras do TSE.",
    ),
    "presidentes": (
        "Presidentes do Brasil · Tá na Urna",
        "De Deodoro da Fonseca a hoje: retratos, datas, como cada um chegou e saiu do cargo e os marcos de cada período.",
    ),
    "congresso-eleito": (
        "Perfil do Congresso eleito · Tá na Urna",
        "Quem foi eleito em 2026 para a Câmara, o Senado e as Assembleias, comparado com 2022: gênero, idade, cor/raça, instrução, ocupação e renovação. Dados oficiais do TSE.",
    ),
    "planos": (
        "Planos de governo do 2º turno · Tá na Urna",
        "Busque um tema nos planos de governo registrados no TSE pelos finalistas do 2º turno e veja os trechos de cada plano, lado a lado, com a página do PDF oficial.",
    ),
}


def _attr(page: str, pattern: str) -> str | None:
    m = re.search(pattern, page, flags=re.S)
    return html.unescape(m.group(1)) if m else None


def remontar(site: Path, dist: Path) -> int:
    template = (dist / "index.html").read_text(encoding="utf-8")

    # 1. Arquivos do build (assets novos somam aos antigos; o resto é substituído).
    for item in dist.iterdir():
        if item.name in DADOS or item.is_dir() and (site / item.name / "index.html").exists() and item.name != "assets":
            continue  # pastas de rota do dist (não existem num build puro do Vite)
        destino = site / item.name
        if item.is_dir():
            shutil.copytree(item, destino, dirs_exist_ok=True)
        else:
            shutil.copy2(item, destino)
    shutil.copy2(dist / "index.html", site / "404.html")

    # Rotas fixas criadas depois do último export completo: página com título e prévia de link.
    for rel, (titulo, resumo) in NOVAS_ROTAS.items():
        if not (site / rel / "index.html").exists():
            _page(template, site, rel, titulo, resumo, f"{SITE}/{rel}")

    # 2. Páginas por rota com o template novo.
    n = 0
    for page_path in site.rglob("index.html"):
        rel = page_path.parent.relative_to(site)
        if rel == Path(".") or rel.parts[0] in DADOS:
            continue
        antiga = page_path.read_text(encoding="utf-8")
        title = _attr(antiga, r"<title>(.*?)</title>")
        desc = _attr(antiga, r'<meta\s+name="description"\s+content="([^"]*)"')
        url = _attr(antiga, r'<meta property="og:url" content="([^"]*)"')
        image = _attr(antiga, r'<meta property="og:image" content="([^"]*)"')
        if not (title and desc and url):
            continue  # não foi gerada por app.export._page
        _page(template, site, str(rel), title, desc, url, image)
        n += 1
    return n


if __name__ == "__main__":
    site, dist = Path(sys.argv[1]), Path(sys.argv[2])
    print(f"interface atualizada: {remontar(site, dist)} páginas por rota remontadas")
