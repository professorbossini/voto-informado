"""Eleitos para a próxima legislatura (Câmara, Senado e Assembleias), para o plenário mostrar a
composição que toma posse no ano seguinte à eleição. Roda dentro do plenario.yml (GitHub Actions).

Fontes (oficiais):
  TSE · totalização (resultados.tse.jus.br, arquivo unificado de cada cargo e UF): quem foi
        declarado eleito (Eleito, Eleito por QP, Eleito por média) para deputado federal, deputado
        estadual/distrital e senador, com o partido e o número de urna.
  Senado Federal · /senador/lista/atual: senadores em exercício cujo mandato vai até o fim da
        próxima legislatura (eleitos 4 anos antes), que continuam na Casa.

Só grava quando a totalização da UF está concluída (tf = "s"); enquanto faltar alguma UF, o
arquivo diz "completo": false e o site avisa.

Grava: api/eleitos.json
"""

from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

ANO = 2026
ELEICAO = "6259"  # 1º turno, eleição geral estadual (inclui deputados e senadores)
POSSE = "2027-02-01"  # nova legislatura (Câmara, Senado e Assembleias)
LEGISLATURA_SEGUINTE = "58"
MANDATO = "2027–2031"
BASE = "https://resultados.tse.jus.br/oficial/ele2026"
SENADO_API = "https://legis.senado.leg.br/dadosabertos/senador/lista/atual"
SENADO_FOTO = "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador{cod}.jpg"
UA = {"User-Agent": "Mozilla/5.0 (compatible; tanaurna/1.0; dados abertos)", "Accept": "application/json"}
UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"]
NOMES_UF = {
    "AC": "Acre", "AL": "Alagoas", "AM": "Amazonas", "AP": "Amapá", "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal",
    "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MG": "Minas Gerais", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso",
    "PA": "Pará", "PB": "Paraíba", "PE": "Pernambuco", "PI": "Piauí", "PR": "Paraná", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RO": "Rondônia", "RR": "Roraima", "RS": "Rio Grande do Sul", "SC": "Santa Catarina", "SE": "Sergipe", "SP": "São Paulo", "TO": "Tocantins",
}


def _chave(sigla: str | None) -> str:
    import unicodedata

    return unicodedata.normalize("NFD", sigla or "").encode("ascii", "ignore").decode().upper().replace(" ", "")


def url(uf: str, cargo: int) -> str:
    return f"{BASE}/{ELEICAO}/dados/{uf.lower()}/{uf.lower()}-c{cargo:04d}-e{int(ELEICAO):06d}-u.json"


def nome_proprio(nome: str) -> str:
    minusculas = {"de", "da", "do", "das", "dos", "e"}
    return " ".join(p if p in minusculas and i else p.capitalize() for i, p in enumerate(nome.lower().split()))


def eleitos_do_arquivo(dados: dict, uf: str) -> tuple[list[dict], dict[str, str]]:
    """Quem o TSE declarou eleito no arquivo unificado, e o nome de cada partido."""
    membros, partidos = [], {}
    for carg in dados.get("carg", []):
        for agr in carg.get("agr", []):
            for par in agr.get("par", []):
                partidos[par.get("sg")] = par.get("nm")
                for c in par.get("cand", []):
                    st = (c.get("st") or "").strip()
                    if str(c.get("e", "")).lower() != "s" or "turno" in st.lower():
                        continue
                    membros.append({
                        "id": f"eleito-{c['sqcand']}",
                        "sq": c["sqcand"],
                        "nome": nome_proprio(c.get("nmu") or c.get("nm") or ""),
                        "partido": par.get("sg"),
                        "uf": uf,
                        "numero": c.get("n"),
                        "situacao": st,
                        "votos": int(c["vap"]) if str(c.get("vap", "")).isdigit() else None,
                        "foto": f"/fotos/{c['sqcand']}.jpg",
                    })
    return membros, partidos


def _baixar(alvo: tuple[str, int]):
    uf, cargo = alvo
    try:
        r = requests.get(url(uf, cargo), headers=UA, timeout=(10, 60))
        if r.status_code != 200:
            return alvo, None
        return alvo, r.json()
    except (requests.RequestException, ValueError):
        return alvo, None


def senadores_que_continuam() -> list[dict]:
    r = requests.get(SENADO_API, headers=UA, timeout=(10, 60))
    r.raise_for_status()
    out = []
    from .plenario import em_exercicio

    for p in r.json()["ListaParlamentarEmExercicio"]["Parlamentares"]["Parlamentar"]:
        if not em_exercicio(p):
            continue
        i = p["IdentificacaoParlamentar"]
        m = p.get("Mandato") or {}
        if (m.get("SegundaLegislaturaDoMandato") or {}).get("NumeroLegislatura") != LEGISLATURA_SEGUINTE:
            continue
        cod = i["CodigoParlamentar"]
        out.append({
            "id": f"senado-{cod}",
            "nome": i["NomeParlamentar"],
            "partido": i.get("SiglaPartidoParlamentar") or "S/Partido",
            "uf": i.get("UfParlamentar") or m.get("UfParlamentar"),
            "situacao": "Mandato até 2031",
            "continua": True,
            "foto": SENADO_FOTO.format(cod=cod),
        })
    return out


def montar(site: Path) -> bool:
    api = site / "api"
    destino = api / "eleitos.json"
    anterior = json.loads(destino.read_text(encoding="utf-8")) if destino.exists() else None
    alvos = [(uf, 6) for uf in UFS] + [(uf, 8 if uf == "DF" else 7) for uf in UFS] + [(uf, 5) for uf in UFS]
    with ThreadPoolExecutor(max_workers=8) as pool:
        arquivos = dict(pool.map(_baixar, alvos))
    if not any(arquivos.values()):
        print("eleitos: totalização do TSE indisponível; mantendo o publicado")
        return False

    partidos: dict[str, str] = {}
    casas: dict[str, dict] = {}
    for cargo, chave in ((6, "camara"), (5, "senado")):
        membros, completo = [], True
        for uf in UFS:
            d = arquivos.get((uf, cargo))
            completo &= bool(d) and d.get("tf") == "s"
            if d:
                ms, ps = eleitos_do_arquivo(d, uf)
                membros += ms
                partidos.update(ps)
        casas[chave] = {"membros": membros, "completo": completo}
    assembleias = {}
    for uf in UFS:
        d = arquivos.get((uf, 8 if uf == "DF" else 7))
        ms, ps = eleitos_do_arquivo(d, uf) if d else ([], {})
        partidos.update(ps)
        assembleias[uf] = {
            "nome": "Câmara Legislativa do Distrito Federal" if uf == "DF" else f"Assembleia Legislativa · {NOMES_UF[uf]}",
            "membros": sorted(ms, key=lambda m: m["nome"]),
            "completo": bool(d) and d.get("tf") == "s",
        }

    # Siglas como no cadastro de partidos da Câmara (símbolos do plenário): o TSE escreve "PCDOB".
    oficiais = list(((json.loads((api / "plenario.json").read_text(encoding="utf-8")) if (api / "plenario.json").exists() else {}).get("partidos") or {}).keys())
    por_chave = {_chave(s): s for s in oficiais}
    for m in [*casas["camara"]["membros"], *casas["senado"]["membros"], *(x for a in assembleias.values() for x in a["membros"])]:
        m["partido"] = por_chave.get(_chave(m["partido"]), m["partido"])
    partidos = {por_chave.get(_chave(s), s): n for s, n in partidos.items()}

    # Senado da próxima legislatura: os eleitos agora + quem tem mandato até o fim dela.
    try:
        continuam = senadores_que_continuam()
    except Exception as exc:  # noqa: BLE001
        print(f"eleitos: Senado indisponível ({exc}); mantendo os que continuam já publicados")
        continuam = [m for m in ((anterior or {}).get("senado") or {}).get("membros", []) if m.get("continua")]
    casas["senado"]["membros"] = continuam + casas["senado"]["membros"]
    casas["senado"]["continuam"] = len(continuam)

    dados = {
        "eleicao": ANO,
        "posse": POSSE,
        "mandato": MANDATO,
        "camara": casas["camara"],
        "senado": casas["senado"],
        "assembleias": assembleias,
        "partidos": {s: n for s, n in sorted(partidos.items()) if s},
        "fontes": {
            "tse": f"{BASE}/{ELEICAO}/dados/",
            "senado": SENADO_API,
        },
    }
    if anterior and {k: v for k, v in anterior.items() if k != "gerado_em"} == dados:
        return False
    dados["gerado_em"] = datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(
        f"eleitos: câmara {len(casas['camara']['membros'])} (completo={casas['camara']['completo']}), "
        f"senado {len(casas['senado']['membros'])} ({len(continuam)} continuam), "
        f"assembleias {sum(len(a['membros']) for a in assembleias.values())}"
    )
    return True
