"""Estados Unidos → site: orquestra a coleta, decide o que consultar em cada horário e cria as páginas
por rota (/eua/...). Roda sozinho no GitHub Actions (.github/workflows/eua.yml).

Isolamento: grava só em <site>/api/eua/ e <site>/eua/. Nada do Brasil é lido ou alterado.

Agenda (horários em UTC; o workflow dispara nesses momentos e esta função escolhe as partes):
  - Passada diária completa (10h UTC, 6h da manhã em Washington): tudo. Cada parte só baixa o que
    mudou (votações novas, trimestre novo de gastos, versão nova dos resultados etc.).
  - Dias úteis, 14h–16h UTC (10h–12h em Washington, quando a Suprema Corte anuncia decisões, de
    outubro a julho) e 23h/02h UTC (fim das sessões do Congresso): votações e, no horário da Corte,
    as decisões.
  - De 1º a 10 de janeiro dos anos ímpares (posse do novo Congresso, 3 de janeiro) e de 3 a 30 de
    novembro dos anos pares (eleição geral): composição, candidaturas e resultados em todas as passadas.
  - "Run workflow" manual ou mudança no código: tudo.

Uso:
  python -m etl.eua.montar <site> [--partes congresso,votacoes,...] [--agenda]
  --agenda imprime as partes da hora atual (sem coletar), para o workflow decidir se segue.
"""

from __future__ import annotations

import argparse
import os
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path

from . import congresso, eleicoes, fec, gastos, suprema, votacoes
from .comum import ESTADOS, SITE_URL, TERRITORIOS, agora, gravar_se_mudou, ler

PARTES = ["congresso", "votacoes", "fec", "gastos_camara", "gastos_federal", "eleicoes", "suprema"]


def partes_da_hora(agora_utc: datetime, evento: str = "schedule") -> list[str]:
    if evento != "schedule":
        return list(PARTES)
    h, m, d, dia_semana = agora_utc.hour, agora_utc.month, agora_utc.day, agora_utc.weekday()
    if h == 10:
        return list(PARTES)
    partes = ["votacoes"]
    if 14 <= h <= 16 and dia_semana < 5 and (m >= 10 or m <= 7):
        partes.append("suprema")
    posse = agora_utc.year % 2 == 1 and m == 1 and d <= 10
    eleicao = agora_utc.year % 2 == 0 and m == 11 and d >= 3
    if posse or eleicao:
        partes += ["congresso", "fec", "eleicoes"]
    return [p for p in PARTES if p in partes]


# ── páginas por rota ─────────────────────────────────────────────────────────

ROTAS_FIXAS = {
    "eua": ("Estados Unidos · Tá na Urna", "Congresso, eleições, votações, gastos e Suprema Corte dos EUA, só com dados públicos oficiais. Sem opinião e sem recomendação de voto."),
    "eua/congresso": ("Congresso dos EUA · Tá na Urna", "Quem está na Câmara e no Senado dos EUA, com retrato oficial, partido, estado e distrito. Dados do Clerk da Câmara e do Congresso."),
    "eua/votacoes": ("Votações nominais do Congresso dos EUA · Tá na Urna", "Como cada deputado(a) e senador(a) votou no Plenário. Dados oficiais da Câmara e do Senado dos EUA."),
    "eua/eleicoes": ("Eleições nos EUA · Tá na Urna", "Mapa dos resultados por estado desde 1976, Colégio Eleitoral, eleição de 2026 e onde ver o resultado oficial de cada estado."),
    "eua/candidatos": ("Candidaturas de 2026 nos EUA · Tá na Urna", "Candidaturas registradas na FEC para a Câmara e o Senado em cada estado, com receitas, despesas e caixa declarados."),
    "eua/gastos": ("Gastos públicos nos EUA · Tá na Urna", "Gastos dos gabinetes da Câmara dos EUA por categoria e o gasto federal em cada estado. Dados oficiais."),
    "eua/suprema-corte": ("Suprema Corte dos EUA · Tá na Urna", "Os nove juízes, quem os indicou, salários, a lista histórica desde 1789 e as decisões do ano judiciário."),
    "eua/sobre": ("Fontes e base legal (EUA) · Tá na Urna", "De onde vêm os dados dos EUA, por que podem ser usados livremente e como o site se mantém neutro e dentro da lei."),
}


def paginas(site: Path, api: Path) -> bool:
    if not (site / "index.html").exists():
        return False
    from app.export import _page

    modelo = (site / "index.html").read_text(encoding="utf-8")
    mudou = False

    def criar(rel: str, titulo: str, desc: str, img: str | None = None) -> None:
        nonlocal mudou
        if not (site / rel / "index.html").exists():
            _page(modelo, site, rel, titulo, desc, f"{SITE_URL}/{rel}", img)
            mudou = True

    for rel, (t, d) in ROTAS_FIXAS.items():
        criar(rel, t, d)
    cong = ler(api / "congresso.json") or {}
    for casa in ("camara", "senado"):
        for m in cong.get(casa, {}).get("membros", []):
            cargo = "Senador(a)" if casa == "senado" else ("Delegado(a)" if m.get("delegado") else "Deputado(a)")
            onde = ESTADOS.get(m["uf"]) or TERRITORIOS.get(m["uf"]) or m["uf"]
            img = f"{SITE_URL}/api/{m['foto']}" if m.get("foto") else None
            criar(f"eua/membro/{m['id']}", f"{m['nome']} · {cargo} ({onde}) · Tá na Urna",
                  "Perfil, votações nominais, gastos do gabinete e finanças de campanha, com dados oficiais do Congresso dos EUA e da FEC.", img)
    for uf, nome in {**ESTADOS, **TERRITORIOS}.items():
        criar(f"eua/estado/{uf}", f"{nome} · Estados Unidos · Tá na Urna", f"Senado, Câmara, candidaturas de 2026, resultados anteriores e gasto federal em {nome}. Dados oficiais.")
    for j in (ler(api / "suprema-corte.json") or {}).get("juizes", []):
        img = f"{SITE_URL}/api/{j['foto']}" if j.get("foto") else None
        criar(f"eua/suprema-corte/{j['id']}", f"{j['nome']} · Suprema Corte dos EUA · Tá na Urna", "Quem indicou, quando tomou posse, biografia oficial e decisões que escreveu.", img)
    return mudou


# ── orquestração ─────────────────────────────────────────────────────────────


def montar(site: Path, partes: list[str]) -> bool:
    api = site / "api" / "eua"
    api.mkdir(parents=True, exist_ok=True)
    meta = ler(api / "meta.json") or {}
    fontes = {f["chave"]: f for f in (ler(api / "fontes.json") or {}).get("fontes", [])}
    situacao = meta.get("partes", {})
    mudou = False

    def rodar(nome: str, fn):
        nonlocal mudou
        print(f"── {nome}", flush=True)
        try:
            res = fn()
            m, fs = res[0], res[1]
            mudou |= m
            for f in fs:
                fontes[f["chave"]] = f
            extra = res[2] if len(res) > 2 else None
            situacao[nome] = {"ok": True, "em": agora(), **({"detalhe": extra} if extra else {})}
        except Exception as e:  # noqa: BLE001 - uma fonte fora do ar não derruba as outras
            traceback.print_exc()
            situacao[nome] = {**situacao.get(nome, {}), "ok": False, "erro": f"{type(e).__name__}: {e}"[:300], "tentativa": agora()}

    if "congresso" in partes:
        rodar("congresso", lambda: congresso.montar(api))
    if "votacoes" in partes and (api / "congresso.json").exists():
        rodar("votacoes", lambda: votacoes.montar(api))
    if "fec" in partes and (api / "congresso.json").exists():
        rodar("fec", lambda: fec.montar(api))
    if "gastos_camara" in partes and (api / "congresso.json").exists():
        rodar("gastos_camara", lambda: gastos.montar_camara(api, ler(api / "congresso.json")["camara"]["membros"]))
    if "gastos_federal" in partes:
        rodar("gastos_federal", lambda: gastos.montar_federal(api))
    if "eleicoes" in partes:
        rodar("eleicoes", lambda: eleicoes.montar(api))
    if "suprema" in partes:
        rodar("suprema", lambda: suprema.montar(api))

    mudou |= paginas(site, api)
    lista = sorted(fontes.values(), key=lambda f: f["chave"])
    mudou |= gravar_se_mudou(api / "fontes.json", {"fontes": lista, "coletado_em": agora()})
    novo_meta = {"partes": situacao, "atualizado_em": meta.get("atualizado_em")}
    if mudou or novo_meta["partes"] != meta.get("partes"):
        novo_meta["atualizado_em"] = agora()
        mudou |= gravar_se_mudou(api / "meta.json", novo_meta, campo_data="__")
    return mudou


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("site", type=Path, nargs="?", default=Path("."))
    ap.add_argument("--partes", help="lista separada por vírgula (padrão: as da hora)")
    ap.add_argument("--agenda", action="store_true", help="só imprime as partes da hora atual")
    a = ap.parse_args()
    evento = os.environ.get("GITHUB_EVENT_NAME", "workflow_dispatch")
    partes = a.partes.split(",") if a.partes else partes_da_hora(datetime.now(timezone.utc), evento)
    if a.agenda:
        print(",".join(partes))
        return
    mudou = montar(a.site, partes)
    print(f"partes={','.join(partes)} mudou={int(mudou)}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"mudou={int(mudou)}\n")


if __name__ == "__main__":
    sys.exit(main())
