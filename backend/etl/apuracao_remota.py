"""Apuração remota (GitHub Actions): leva a totalização FINAL do TSE para o site publicado.

Não precisa do banco nem dos dados brutos: trabalha direto sobre a pasta api/ do site já
publicado (branch gh-pages) e reescreve só o que depende do resultado, no mesmo formato
que app.export grava a partir do banco:

  api/candidato/<sq>.json   campo "resultados" de cada candidatura com resultado final
  api/resultados.json       disputas majoritárias (como app.queries.resultados)
  api/segundo-turno.json    finalistas de Presidente/Governador (como app.queries.segundo_turno)
  api/meta.json             fase da eleição, hora da consulta e a fonte tse_resultados
  api/apuracao-final.json   assinatura do que foi aplicado (para não reenviar o mesmo)

Uso (ver .github/workflows/apuracao.yml):
  python -m etl.apuracao_remota verificar <site> --salvar finais.json   # mudou=1|0
  python -m etl.apuracao_remota aplicar   <site> --de finais.json
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from app.queries import MAJORITARIOS, UF_NOMES, fase_de

from .resultados import BASE, coletar

BRT = ZoneInfo("America/Sao_Paulo")
MARCA = "apuracao-final.json"


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


def assinatura(finais: list[dict]) -> str:
    linhas = sorted(tuple(l) for d in finais for l in d["linhas"])
    return hashlib.sha256(repr(linhas).encode()).hexdigest()[:16]


def _saida(**kv) -> None:
    """Escreve em $GITHUB_OUTPUT (no Actions) e no terminal."""
    for k, v in kv.items():
        print(f"{k}={v}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            for k, v in kv.items():
                f.write(f"{k}={v}\n")


def _vai_ao_2turno(situacao: str | None) -> bool:
    s = (situacao or "").lower()
    return s.startswith("2") and s.endswith("turno")  # LIKE '2%turno', como em app.queries


def verificar(site: Path, salvar: Path | None) -> bool:
    finais, parciais = coletar()
    ass = assinatura(finais)
    marca = site / "api" / MARCA
    anterior = _ler(marca).get("assinatura") if marca.exists() else None
    mudou = bool(finais) and ass != anterior
    if salvar:
        salvar.write_text(json.dumps({"finais": finais, "parciais": parciais}, ensure_ascii=False), encoding="utf-8")
    print(f"TSE: {len(finais)} disputas com totalização final, {parciais} parciais; assinatura {ass} (publicada: {anterior})")
    _saida(mudou=int(mudou), disputas=len(finais))
    return mudou


def aplicar(site: Path, finais: list[dict], parciais: int, agora: datetime | None = None) -> int:
    """Aplica os resultados finais nos JSON do site. Devolve quantos arquivos mudaram."""
    api = site / "api"
    agora = agora or datetime.now(BRT)
    mudados = 0

    def card(sq: str) -> dict | None:
        p = api / "candidato" / f"{sq}.json"
        return _ler(p) if p.exists() else None

    # 1. Perfis: campo "resultados" (turno, votos, pct, situacao, eleito), por turno.
    por_sq: dict[str, list[dict]] = {}
    for d in finais:
        for (turno, _uf, _cargo, sq, _n, _nome, votos, pct, situacao, eleito, _pos) in d["linhas"]:
            por_sq.setdefault(sq, []).append({"turno": turno, "votos": votos, "pct": pct, "situacao": situacao, "eleito": eleito})
    for sq, res in por_sq.items():
        c = card(sq)
        if c is None:
            continue
        c["resultados"] = sorted(res, key=lambda r: r["turno"])
        mudados += _gravar(api / "candidato" / f"{sq}.json", c)

    # 2. Fase da eleição (mesma regra de app.queries.fase).
    st_path = api / "segundo-turno.json"
    st = _ler(st_path) if st_path.exists() else {"disputas": [], "fontes": []}
    finalistas: dict[tuple[str, str], list[str]] = {
        (d["uf"], d["cargo"]): [c["sq"] for c in d.get("candidatos", [])] for d in st.get("disputas", [])
    }
    for d in finais:
        if d["turno"] == 1 and d["cargo"] in ("presidente", "governador"):
            for l in d["linhas"]:
                if _vai_ao_2turno(l[8]) and l[3] not in finalistas.setdefault((d["uf"], d["cargo"]), []):
                    finalistas[(d["uf"], d["cargo"])].append(l[3])
    tem_2turno = any(finalistas.values())
    tem_t2 = any(d["turno"] == 2 for d in finais)
    fase = fase_de(agora.date(), tem_2turno, tem_t2)

    # 3. resultados.json (só majoritários), na ordem de app.queries.resultados.
    disputas = []
    for d in sorted(finais, key=lambda d: (d["turno"], d["uf"], d["cargo"])):
        if d["cargo"] not in MAJORITARIOS:
            continue
        cands = []
        for (_t, _uf, _cargo, sq, numero, nome, votos, pct, situacao, eleito, _pos) in sorted(d["linhas"], key=lambda l: (-(l[6] or 0), l[3])):
            c = card(sq) or {}
            cands.append({
                "sq": sq, "numero": numero, "nome": nome, "votos": votos, "pct": pct, "situacao": situacao, "eleito": eleito,
                "nome_urna": c.get("nome_urna") or d["nomes_urna"].get(sq), "partido": c.get("partido") or d["partidos"].get(sq),
                "foto": c.get("foto"),
            })
        disputas.append({"turno": d["turno"], "uf": d["uf"], "cargo": d["cargo"], "pct_secoes": d["pct_secoes"], "atualizado": d["atualizado"], "url": d["url"], "candidatos": cands})
    mudados += _gravar(api / "resultados.json", {"fase": fase, "disputas": disputas, "fontes": ["tse_resultados"]})

    # 4. segundo-turno.json: cartões completos dos finalistas (Presidente primeiro, depois por UF).
    st_disputas = []
    for (uf, cargo), sqs in sorted(finalistas.items(), key=lambda kv: (kv[0][1] != "presidente", kv[0][0])):
        cards = [c for c in (card(sq) for sq in sqs) if c]
        if cards:
            st_disputas.append({"uf": uf, "nome_uf": UF_NOMES.get(uf, uf), "cargo": cargo, "candidatos": cards})
    st["fase"], st["disputas"] = fase, st_disputas
    mudados += _gravar(st_path, st)

    # 5. meta.json: fase, hora da consulta e a fonte dos resultados.
    meta_path = api / "meta.json"
    if meta_path.exists():
        meta = _ler(meta_path)
        meta["eleicao"]["fase"] = fase
        meta.setdefault("atualizacao", {})["resultados_consultado_em"] = agora.isoformat(timespec="seconds")
        gerado = max((d["atualizado"] for d in finais), default=None, key=lambda s: datetime.strptime(s, "%d/%m/%Y %H:%M:%S") if s else datetime.min)
        fonte = {
            "chave": "tse_resultados",
            "nome": "Resultados oficiais da apuração 2026",
            "orgao": "Tribunal Superior Eleitoral (TSE) · Divulgação de Resultados",
            "url": f"{BASE}/",
            "pagina": "https://resultados.tse.jus.br/",
            "descricao": "Votos por candidato publicados pelo TSE durante e após a apuração (arquivo unificado de divulgação).",
            "gerado_em": gerado,
            "publicado_em": None,
            "coletado_em": agora.isoformat(timespec="seconds"),
        }
        fontes = [f for f in meta.get("fontes", []) if f.get("chave") != "tse_resultados"]
        meta["fontes"] = fontes + [fonte]
        mudados += _gravar(meta_path, meta)

    # 6. Marca do que foi aplicado.
    _gravar(api / MARCA, {"assinatura": assinatura(finais), "disputas": len(finais), "parciais": parciais, "aplicado_em": agora.isoformat(timespec="seconds")})
    print(f"aplicado: {len(finais)} disputas finais, {len(por_sq)} candidaturas, {mudados} arquivos alterados, fase {fase}")
    return mudados


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("acao", choices=["verificar", "aplicar"])
    ap.add_argument("site", type=Path, help="pasta do site publicado (checkout da gh-pages)")
    ap.add_argument("--salvar", type=Path, help="verificar: guarda o que veio do TSE neste arquivo")
    ap.add_argument("--de", type=Path, help="aplicar: usa o arquivo salvo pelo verificar (senão consulta o TSE)")
    a = ap.parse_args()
    if a.acao == "verificar":
        verificar(a.site, a.salvar)
        return
    if a.de:
        dados = json.loads(a.de.read_text(encoding="utf-8"))
        finais, parciais = dados["finais"], dados["parciais"]
    else:
        finais, parciais = coletar()
    # JSON transforma tuplas em listas; normaliza para o formato de coletar().
    for d in finais:
        d["linhas"] = [tuple(l) for l in d["linhas"]]
    aplicar(a.site, finais, parciais)


if __name__ == "__main__":
    main()
