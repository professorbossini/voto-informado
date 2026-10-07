"""Busca nos planos de governo do 2º turno: o texto de cada página dos planos registrados no TSE
pelos finalistas (Presidente e Governador), para a página /planos buscar um termo e mostrar o
trecho, a página e o link para o PDF oficial naquela página.

Roda sozinho no GitHub Actions (.github/workflows/planos.yml), direto sobre o site publicado
(branch gh-pages), sem banco.

Entrada:
  api/segundo-turno.json   disputas do 2º turno e os cartões dos finalistas, com os caminhos dos
                           PDFs dos planos ("/propostas/<sq>_01.pdf", cópia sem edição do arquivo
                           que o candidato registrou no TSE)
  <site>/propostas/...     o PDF, se estiver no checkout; senão é baixado do site publicado

Texto: extraído página a página do próprio PDF (pypdf), sem OCR e sem resumir nem corrigir nada:
só espaços e quebras de linha viram um espaço, palavras partidas por hífen no fim da linha são
reunidas, pontilhados de sumário viram reticências e ligaduras tipográficas (ﬁ, ﬂ) viram letras
comuns. PDF que é só imagem digitalizada
fica com sem_texto=true (a página avisa e leva ao PDF).

Grava (JSON compacto, só quando o conteúdo muda; gerado_em acompanha a última mudança):
  api/planos/indice.json             disputas (Presidente primeiro, depois os estados pelo nome)
  api/planos/<uf>-<cargo>.json       candidatos em ordem alfabética do nome de urna, cada um com
                                     seus documentos: {pdf, paginas: [texto da página 1, ...], sem_texto}

Uso: python -m etl.planos <site>   (saída: mudou=1|0)
"""

from __future__ import annotations

import argparse
import io
import json
import logging
import os
import re
import sys
import time
import unicodedata
from datetime import datetime
from pathlib import Path
from typing import Callable
from zoneinfo import ZoneInfo

import requests
from pypdf import PdfReader

from .common import TSE_CDN, USER_AGENT

BRT = ZoneInfo("America/Sao_Paulo")
SITE_PUBLICO = "https://www.tanaurna.com.br"
FONTE = {
    "nome": "Propostas de governo 2026",
    "orgao": "Tribunal Superior Eleitoral (TSE) · DivulgaCandContas",
    "url": f"{TSE_CDN}/odsele/proposta_governo/",
    "pagina": "https://divulgacandcontas.tse.jus.br/divulga/#/home",
    "descricao": "Planos de governo registrados pelos candidatos a Presidente e Governador(a) na Justiça Eleitoral (PDF original, sem edição).",
}
# Abaixo disto (letras por página, na média do documento) o PDF é tratado como imagem digitalizada.
LETRAS_POR_PAGINA = 30

# pypdf avisa de cada detalhe fora do padrão nos PDFs; o texto sai igual.
logging.getLogger("pypdf").setLevel(logging.ERROR)


class FonteIndisponivel(RuntimeError):
    """Faltou o arquivo do 2º turno ou um PDF não pôde ser lido nem baixado."""


# ------------------------------------------------------------------ texto

LIGADURAS = str.maketrans({"ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "ft", "ﬆ": "st", "­": "", "\x00": ""})
# "educa-\nção" → "educação": hífen no fim da linha entre duas letras minúsculas.
HIFEN_FIM_DE_LINHA = re.compile(r"(?<=[a-zà-öø-ÿ])-[ \t]*\r?\n[ \t]*(?=[a-zà-öø-ÿ])")
# Linhas pontilhadas de sumário ("Saúde ........ 21") viram reticências.
PONTILHADO = re.compile(r"(?:\.[ \t]*){4,}")


def normalizar(texto: str | None) -> str:
    """Texto de uma página como saiu do PDF → uma linha só, sem hifenização de fim de linha."""
    t = (texto or "").translate(LIGADURAS)
    t = HIFEN_FIM_DE_LINHA.sub("", t)
    t = PONTILHADO.sub(" … ", t)
    t = "".join(" " if unicodedata.category(ch) in ("Cc", "Zl", "Zp") else ch for ch in t)
    return " ".join(t.split())


def extrair(conteudo: bytes) -> list[str]:
    """Texto de cada página do PDF, na ordem (página 1 = índice 0). Página ilegível → ""."""
    try:
        leitor = PdfReader(io.BytesIO(conteudo))
        paginas = list(leitor.pages)
    except Exception as exc:  # noqa: BLE001 - PDF corrompido ou cifrado
        raise FonteIndisponivel(f"PDF ilegível: {exc}") from exc
    textos = []
    for pagina in paginas:
        try:
            textos.append(normalizar(pagina.extract_text()))
        except Exception:  # noqa: BLE001 - uma página com defeito não derruba o documento
            textos.append("")
    return textos


def sem_texto(paginas: list[str]) -> bool:
    """Documento sem texto extraível (imagem digitalizada): quase nenhuma letra por página."""
    letras = sum(ch.isalpha() for p in paginas for ch in p)
    return letras < LETRAS_POR_PAGINA * max(1, len(paginas))


# ------------------------------------------------------------------ PDFs


def leitor_de_pdfs(site: Path) -> Callable[[str], bytes]:
    """Lê "/propostas/x.pdf" do checkout do site; se não estiver lá, baixa do site publicado."""

    def ler(caminho: str) -> bytes:
        local = site / caminho.lstrip("/")
        if local.is_file():
            return local.read_bytes()
        url = f"{SITE_PUBLICO}{caminho}"
        ultimo: Exception | None = None
        for tentativa in range(3):
            try:
                r = requests.get(url, timeout=(15, 120), headers={"User-Agent": USER_AGENT})
                r.raise_for_status()
                if not r.content.startswith(b"%PDF"):
                    raise FonteIndisponivel(f"{url} não devolveu um PDF")
                return r.content
            except FonteIndisponivel:
                raise
            except Exception as exc:  # noqa: BLE001 - qualquer falha de rede: tenta de novo
                ultimo = exc
                time.sleep(5 * (tentativa + 1))
        raise FonteIndisponivel(f"falha ao baixar {url}: {ultimo}")

    return ler


# ------------------------------------------------------------------ montagem


def _chave_nome(nome: str) -> str:
    """Ordem alfabética sem acento e sem diferença de maiúsculas (Álvaro junto de Alan)."""
    t = unicodedata.normalize("NFKD", nome or "")
    return "".join(ch for ch in t if not unicodedata.combining(ch)).casefold()


def arquivo_disputa(uf: str, cargo: str) -> str:
    return f"{uf.lower()}-{cargo}.json"


def montar(segundo_turno: dict, ler: Callable[[str], bytes]) -> dict[str, dict]:
    """{caminho relativo a api/planos: conteúdo} para o índice e cada disputa (sem gerado_em)."""
    disputas = sorted(
        segundo_turno.get("disputas") or [],
        key=lambda d: (d.get("cargo") != "presidente", _chave_nome(d.get("nome_uf") or d.get("uf") or "")),
    )
    arquivos: dict[str, dict] = {}
    indice = []
    for d in disputas:
        uf, cargo = d["uf"], d["cargo"]
        candidatos = []
        for c in sorted(d.get("candidatos") or [], key=lambda c: _chave_nome(c.get("nome_urna") or "")):
            pdfs = c.get("propostas") or ([c["proposta"]] if c.get("proposta") else [])
            documentos = []
            for pdf in pdfs:
                paginas = extrair(ler(pdf))
                documentos.append({"pdf": pdf, "paginas": paginas, "sem_texto": sem_texto(paginas)})
            candidatos.append({
                "sq": c["sq"],
                "nome_urna": c.get("nome_urna"),
                "partido": c.get("partido"),
                "numero": c.get("numero"),
                "foto": c.get("foto"),
                "divulgacand": c.get("divulgacand"),
                "documentos": documentos,
            })
        nome = arquivo_disputa(uf, cargo)
        arquivos[nome] = {"uf": uf, "nome_uf": d.get("nome_uf"), "cargo": cargo, "candidatos": candidatos, "fonte": FONTE}
        indice.append({"uf": uf, "nome_uf": d.get("nome_uf"), "cargo": cargo, "arquivo": nome})
    arquivos["indice.json"] = {"disputas": indice, "fonte": FONTE}
    return arquivos


# ------------------------------------------------------------------ gravação


def _texto(dados) -> str:
    return json.dumps(dados, ensure_ascii=False, separators=(",", ":"))


def _ler_json(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def gravar(raiz: Path, arquivos: dict[str, dict], agora: str) -> dict:
    """Grava em <raiz> (api/planos) só o que mudou e apaga disputas que deixaram de existir.

    gerado_em fica fora da comparação: a passada diária sem novidade não gera commit.
    """
    gravados = apagados = 0
    for rel, dados in arquivos.items():
        p = raiz / rel
        anterior = _ler_json(p)
        if isinstance(anterior, dict) and {k: v for k, v in anterior.items() if k != "gerado_em"} == json.loads(_texto(dados)):
            continue
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(_texto({**dados, "gerado_em": agora}), encoding="utf-8")
        gravados += 1
    esperados = {raiz / rel for rel in arquivos}
    for p in sorted(raiz.glob("*.json")) if raiz.exists() else []:
        if p not in esperados:
            p.unlink()
            apagados += 1
    return {"gravados": gravados, "apagados": apagados}


def run(site: Path) -> bool:
    entrada = site / "api" / "segundo-turno.json"
    segundo_turno = _ler_json(entrada)
    if not isinstance(segundo_turno, dict):
        raise FonteIndisponivel(f"{entrada} ausente ou inválido")
    arquivos = montar(segundo_turno, leitor_de_pdfs(site))
    agora = datetime.now(BRT).isoformat(timespec="seconds")
    r = gravar(site / "api" / "planos", arquivos, agora)
    docs = [doc for dados in arquivos.values() for c in dados.get("candidatos", []) for doc in c["documentos"]]
    sem = [doc["pdf"] for doc in docs if doc["sem_texto"]]
    print(
        f"planos: {len(arquivos) - 1} disputas, {len(docs)} PDFs, {sum(len(doc['paginas']) for doc in docs)} páginas"
        f" ({r['gravados']} arquivos gravados, {r['apagados']} apagados)"
        + (f"; sem texto extraível: {', '.join(sem)}" if sem else "")
    )
    return bool(r["gravados"] or r["apagados"])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("site", type=Path)
    a = ap.parse_args()
    try:
        mudou = run(a.site)
    except FonteIndisponivel as exc:
        # Mantém o que está publicado; o job falha para o aviso aparecer no GitHub.
        print(f"::error title=Planos de governo::{exc}. Nada foi alterado no site.")
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
                f.write(f"⚠ Planos de governo: {exc}. O site mantém os dados anteriores.\n")
        return 1
    print(f"mudou={int(mudou)}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"mudou={int(mudou)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
