"""Prestação de contas do TSE → site, sozinho na nuvem (GitHub Actions).

Fonte (oficial): prestacao_de_contas_eleitorais_candidatos_<ano>.zip, no Portal de Dados Abertos do
TSE. As campanhas seguem enviando dados até a prestação de contas final; o TSE republica o arquivo.

Não precisa do banco: trabalha direto sobre a pasta api/ do site publicado (branch gh-pages) e
reescreve só o que depende das finanças, com a MESMA conta do build local (etl.tse.calcular_financas,
gravada num SQLite em memória e lida pelas mesmas consultas de app.queries):

  api/candidato/<sq>.json        receitas, despesas, financas, contas_atualizadas_em e, para quem foi
                                 eleito em 2026, custo_por_voto (receitas ÷ votos no turno que elegeu)
  api/presidente.json            receitas e despesas dos cartões
  api/uf/<UF>.json               idem (governador e senador)
  api/uf/<UF>/deputados.json     idem, arredondadas como no export
  api/segundo-turno.json         perfis completos dos finalistas
  api/estatisticas.json          receitas por fonte e cargo (só com todos os perfis na pasta)
  api/meta.json                  data do arquivo e fonte tse_prestacao
  api/contas-meta.json           marca do arquivo aplicado (ETag, Last-Modified): sem mudança no
                                 TSE, nada é baixado nem reescrito

CPF/CNPJ não saem daqui (mesma política do export): só servem para classificar o tipo de doador.

Uso (ver .github/workflows/contas.yml):
  python -m etl.contas verificar <site>                 # mudou=1|0 (só um HEAD no TSE)
  python -m etl.contas atualizar <site> [--zip Z] [--forcar]
"""

from __future__ import annotations

import argparse
import json
import os
import sqlite3
import tempfile
import time
import zipfile
from datetime import datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

from app import queries as q

from .common import ANO, TSE_CDN, USER_AGENT

URL = f"{TSE_CDN}/odsele/prestacao_contas/prestacao_de_contas_eleitorais_candidatos_{ANO}.zip"
BRT = ZoneInfo("America/Sao_Paulo")
MARCA = "contas-meta.json"
# Se o arquivo novo tiver bem menos campanhas que o já aplicado, algo está errado no TSE (arquivo
# truncado ou em reprocessamento): nada é gravado e a execução falha, para alguém olhar.
ENCOLHIMENTO_MAXIMO = 0.8


def _ler(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def _gravar(path: Path, data) -> bool:
    """Grava no formato do app.export; devolve True se o conteúdo mudou."""
    novo = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    if path.exists() and path.read_text(encoding="utf-8") == novo:
        return False
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(novo, encoding="utf-8")
    return True


def _saida(**kv) -> None:
    """Escreve em $GITHUB_OUTPUT (no Actions) e no terminal."""
    for k, v in kv.items():
        print(f"{k}={v}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            for k, v in kv.items():
                f.write(f"{k}={v}\n")


# ── Arquivo do TSE ────────────────────────────────────────────────────────────


def _marca_de(headers) -> dict:
    return {
        "url": URL,
        "etag": headers.get("ETag"),
        "last_modified": headers.get("Last-Modified"),
        "bytes": int(headers["Content-Length"]) if headers.get("Content-Length") else None,
    }


def marca_remota() -> dict:
    r = requests.head(URL, timeout=60, allow_redirects=True, headers={"User-Agent": USER_AGENT})
    r.raise_for_status()
    return _marca_de(r.headers)


def mesma_versao(remota: dict, aplicada: dict | None) -> bool:
    """Mesmo arquivo: ETag igual, ou (sem ETag) Last-Modified e tamanho iguais."""
    if not aplicada:
        return False
    if remota.get("etag") and aplicada.get("etag"):
        return remota["etag"] == aplicada["etag"]
    return bool(remota.get("last_modified")) and (remota.get("last_modified"), remota.get("bytes")) == (
        aplicada.get("last_modified"), aplicada.get("bytes"))


def marca_aplicada(site: Path) -> dict | None:
    p = site / "api" / MARCA
    return _ler(p) if p.exists() else None


def baixar(destino: Path, tentativas: int = 5) -> dict:
    """Baixa o zip (com retomada se a conexão cair) e devolve a marca da versão baixada."""
    erro: Exception | None = None
    for i in range(tentativas):
        try:
            feito = destino.stat().st_size if destino.exists() else 0
            headers = {"User-Agent": USER_AGENT, **({"Range": f"bytes={feito}-"} if feito else {})}
            with requests.get(URL, stream=True, timeout=(30, 120), headers=headers) as r:
                if r.status_code == 416:  # já estava completo
                    return marca_remota()
                r.raise_for_status()
                modo = "ab" if r.status_code == 206 else "wb"
                with open(destino, modo) as fh:
                    for bloco in r.iter_content(1 << 20):
                        fh.write(bloco)
                marca = _marca_de(r.headers)
                marca["bytes"] = destino.stat().st_size
            with zipfile.ZipFile(destino) as zf:
                ruim = zf.testzip()  # zip íntegro (CRC de cada arquivo)
            if ruim:
                raise zipfile.BadZipFile(f"CRC inválido em {ruim}")
            return marca
        except Exception as exc:  # noqa: BLE001 - qualquer falha de rede: tenta de novo
            erro = exc
            if isinstance(exc, zipfile.BadZipFile):
                destino.unlink(missing_ok=True)
            time.sleep(5 * (i + 1))
    raise RuntimeError(f"Falha ao baixar {URL}: {erro}")


# ── Aplicação nos JSON do site ────────────────────────────────────────────────


class Financas:
    """As tabelas fin_* num SQLite em memória, consultadas como no app.queries."""

    def __init__(self, tabelas: dict, gerado_em: str):
        from . import tse  # pandas só aqui: etl.apuracao_remota importa este módulo sem pandas

        self.conn = sqlite3.connect(":memory:")
        self.conn.row_factory = sqlite3.Row
        tse.gravar_financas(self.conn, tabelas)
        self.gerado_em = gerado_em
        self.totais = {
            r[0]: (r[1], r[2], r[3], r[4])
            for r in self.conn.execute("SELECT sq, receitas, despesas, ROUND(receitas, 2), ROUND(despesas, 2) FROM fin_totais")
        }

    def totais_de(self, sq: str, arredondado: bool = False) -> tuple[float | None, float | None]:
        t = self.totais.get(sq)
        if t is None:
            return None, None  # LEFT JOIN sem movimentação, como no export
        return (t[2], t[3]) if arredondado else (t[0], t[1])

    def cartao(self, c: dict, arredondado: bool = False) -> None:
        c["receitas"], c["despesas"] = self.totais_de(c["sq"], arredondado)

    def perfil(self, c: dict) -> None:
        self.cartao(c)
        c["financas"] = q.financas(self.conn, c["sq"])
        c["contas_atualizadas_em"] = self.gerado_em
        c["custo_por_voto"] = q.custo_por_voto(c)

    def receitas_por_fonte(self, cargos: dict[str, str]) -> dict:
        self.conn.execute("DROP TABLE IF EXISTS candidatos")
        self.conn.execute("CREATE TABLE candidatos (sq TEXT PRIMARY KEY, cargo TEXT)")
        self.conn.executemany("INSERT INTO candidatos VALUES (?, ?)", cargos.items())
        return q.receitas_por_fonte_por_cargo(self.conn)


def aplicar(site: Path, fin: Financas, agora: datetime | None = None, publicado_em: str | None = None) -> dict:
    """Reescreve os JSON que dependem das finanças. Devolve contagens do que mudou."""
    api = site / "api"
    agora = agora or datetime.now(BRT)
    n = {"perfis": 0, "perfis_alterados": 0, "agregados_alterados": 0, "eleitos_com_custo": 0}
    cargos: dict[str, str] = {}

    # 1. Perfis de cada candidatura.
    for p in sorted((api / "candidato").glob("*.json")):
        c = _ler(p)
        fin.perfil(c)
        cargos[c["sq"]] = c.get("cargo")
        n["perfis"] += 1
        n["eleitos_com_custo"] += c["custo_por_voto"] is not None
        n["perfis_alterados"] += _gravar(p, c)

    # 2. Listas com cartões (receitas e despesas).
    pres = api / "presidente.json"
    if pres.exists():
        d = _ler(pres)
        for c in d.get("candidatos", []):
            fin.cartao(c)
        n["agregados_alterados"] += _gravar(pres, d)
    for p in sorted((api / "uf").glob("*.json")):
        d = _ler(p)
        for c in [*d.get("governador", []), *d.get("senador", [])]:
            fin.cartao(c)
        n["agregados_alterados"] += _gravar(p, d)
    for p in sorted((api / "uf").glob("*/deputados.json")):
        d = _ler(p)
        for c in d.get("candidatos", []):
            fin.cartao(c, arredondado=True)  # ROUND(f.receitas, 2), como em app.queries.LITE_SQL
        n["agregados_alterados"] += _gravar(p, d)

    # 3. 2º turno: perfis completos dos finalistas.
    st = api / "segundo-turno.json"
    if st.exists():
        d = _ler(st)
        for disputa in d.get("disputas", []):
            for c in disputa.get("candidatos", []):
                fin.perfil(c)
        n["agregados_alterados"] += _gravar(st, d)

    # 4. Estatísticas por cargo: precisam do cargo de TODAS as candidaturas (todos os perfis).
    est = api / "estatisticas.json"
    busca = api / "busca.json"
    completo = busca.exists() and all(linha[0] in cargos for linha in _ler(busca))
    if est.exists() and completo:
        d = _ler(est)
        d["receitas_por_fonte"] = fin.receitas_por_fonte(cargos)
        n["agregados_alterados"] += _gravar(est, d)
    elif est.exists():
        print("  estatisticas.json mantido: a pasta não tem todos os perfis (amostra?)")

    # 5. meta.json: data do arquivo e a fonte tse_prestacao.
    meta_path = api / "meta.json"
    if meta_path.exists():
        meta = _ler(meta_path)
        meta.setdefault("atualizacao", {})["prestacao_gerada_em"] = fin.gerado_em
        for f in meta.get("fontes", []):
            if f.get("chave") == "tse_prestacao":
                if publicado_em:
                    f["publicado_em"] = publicado_em
                f["coletado_em"] = agora.isoformat(timespec="seconds")
        n["agregados_alterados"] += _gravar(meta_path, meta)
    return n


def _publicado_em(last_modified: str | None) -> str | None:
    try:
        return parsedate_to_datetime(last_modified).astimezone(BRT).isoformat(timespec="seconds")
    except (TypeError, ValueError):
        return None


def atualizar(site: Path, zip_path: Path | None = None, forcar: bool = False, agora: datetime | None = None) -> bool:
    """Baixa (se mudou), recalcula e aplica. Devolve True se algum arquivo do site mudou."""
    from . import tse

    agora = agora or datetime.now(BRT)
    aplicada = marca_aplicada(site)
    with tempfile.TemporaryDirectory(dir=os.environ.get("RUNNER_TEMP")) as tmp:
        if zip_path is None:
            remota = marca_remota()
            if mesma_versao(remota, aplicada) and not forcar:
                print(f"TSE: prestação de contas sem mudança ({remota.get('last_modified')}); nada a fazer")
                _saida(mudou=0)
                return False
            zip_path = Path(tmp) / "prestacao.zip"
            marca = baixar(zip_path)
        else:
            marca = {"url": URL, "etag": None, "last_modified": None, "bytes": zip_path.stat().st_size}  # arquivo local: sem marca do servidor
        print(f"TSE: prestação de contas {marca.get('last_modified') or zip_path} ({marca['bytes']} bytes)")
        tabelas, gerado_em = tse.financas_do_zip(zipfile.ZipFile(zip_path))

    campanhas = len(tabelas["fin_totais"])
    antes = (aplicada or {}).get("campanhas")
    if antes and campanhas < ENCOLHIMENTO_MAXIMO * antes and not forcar:
        raise SystemExit(f"Arquivo do TSE com {campanhas} campanhas (antes: {antes}): parece incompleto; nada foi gravado.")
    print(f"  finanças: {campanhas} campanhas com movimentação; arquivo gerado em {gerado_em}")

    fin = Financas(tabelas, gerado_em)
    n = aplicar(site, fin, agora=agora, publicado_em=_publicado_em(marca.get("last_modified")))
    mudou = bool(n["perfis_alterados"] or n["agregados_alterados"])
    _gravar(site / "api" / MARCA, {
        **marca,
        "gerado_em": gerado_em,
        "campanhas": campanhas,
        "perfis": n["perfis"],
        "eleitos_com_custo": n["eleitos_com_custo"],
        "aplicado_em": agora.isoformat(timespec="seconds"),
    })
    print(f"aplicado: {n['perfis_alterados']} de {n['perfis']} perfis e {n['agregados_alterados']} agregados alterados; "
          f"{n['eleitos_com_custo']} eleitos com custo por voto")
    _saida(mudou=int(mudou), perfis=n["perfis_alterados"])
    return mudou


def verificar(site: Path) -> bool:
    remota, aplicada = marca_remota(), marca_aplicada(site)
    mudou = not mesma_versao(remota, aplicada)
    print(f"TSE: {remota.get('last_modified')} (ETag {remota.get('etag')}); aplicado: {(aplicada or {}).get('last_modified')}")
    _saida(mudou=int(mudou))
    return mudou


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("acao", choices=["verificar", "atualizar"])
    ap.add_argument("site", type=Path, help="pasta do site publicado (checkout da gh-pages)")
    ap.add_argument("--zip", type=Path, help="atualizar: usa este zip local em vez de baixar do TSE")
    ap.add_argument("--forcar", action="store_true", help="atualizar: reaplica mesmo sem mudança no TSE")
    a = ap.parse_args()
    if a.acao == "verificar":
        verificar(a.site)
    else:
        atualizar(a.site, zip_path=a.zip, forcar=a.forcar)


if __name__ == "__main__":
    main()
