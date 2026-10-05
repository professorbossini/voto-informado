"""Plenário: composição atual da Câmara e do Senado, quem preside cada Casa e o símbolo
oficial de cada partido. Roda sozinho no GitHub Actions (.github/workflows/plenario.yml),
direto sobre o site publicado (branch gh-pages), sem banco.

Fontes (todas oficiais):
  Câmara dos Deputados (dadosabertos.camara.leg.br/api/v2)
    - /legislaturas            legislatura atual
    - /deputados               deputados em exercício (nome, partido, UF)
    - /legislaturas/{id}/mesa  Mesa Diretora (Presidente)
    - /partidos, /partidos/{id} sigla, nome e símbolo (urlLogo) de cada partido
  Senado Federal (legis.senado.leg.br/dadosabertos)
    - /senador/lista/atual     senadores em exercício
    - /composicao/mesaSF       Mesa Diretora (Presidente)
    - /senador/{cod}/cargos    início do mandato na Presidência (Comissão Diretora)

Se uma fonte falhar, mantém o último dado bom já publicado (e, na primeira vez, a lista de
parlamentares em exercício que o site já tem em api/parlamentares.json).

Grava:
  api/plenario.json              composição, presidência e partidos
  api/plenario/logos/<sigla>.*   símbolos dos partidos (cópia do arquivo oficial da Câmara)
  api/meta.json                  fontes camara_plenario / senado_plenario
(lê também api/partidos.json, do TSE, para o nome do partido quando a Câmara não informa)
  plenario/index.html            página da rota (só se ainda não existir)

Uso: python -m etl.plenario <site>   (saída: mudou=1|0)
"""

from __future__ import annotations

import argparse
import copy
import json
import os
import re
import time
import unicodedata
from datetime import date, datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

BRT = ZoneInfo("America/Sao_Paulo")
CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2"
SENADO_API = "https://legis.senado.leg.br/dadosabertos"
SENADO_FOTO = "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador{cod}.jpg"
HEADERS = {"Accept": "application/json", "User-Agent": "Mozilla/5.0 (compatible; tanaurna/1.0; dados abertos)"}
SEM_PARTIDO = "S/Partido"
SITE_URL = os.environ.get("SITE_URL", "https://www.tanaurna.com.br")


def _get(url: str, params: dict | None = None, retries: int = 3, timeout: tuple[int, int] = (10, 60)):
    """GET JSON com novas tentativas (conexão: 10 s por endereço; leitura: 60 s)."""
    last: Exception | None = None
    for i in range(retries):
        try:
            r = requests.get(url, params=params, headers=HEADERS, timeout=timeout)
            if r.status_code == 429 or r.status_code >= 500:
                raise RuntimeError(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r.json()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"{url}: {last}")


def _paginado(url: str, params: dict) -> list[dict]:
    dados, p = [], dict(params)
    while url:
        j = _get(url, p)
        dados.extend(j.get("dados", []))
        url = next((lk["href"] for lk in j.get("links", []) if lk.get("rel") == "next"), None)
        p = None  # o link "next" já traz os parâmetros
    return dados


def _lista(obj) -> list:
    return obj if isinstance(obj, list) else [obj] if obj else []


def slug(sigla: str) -> str:
    s = unicodedata.normalize("NFKD", sigla).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-") or "partido"


def _ler(p: Path):
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def _gravar(p: Path, data) -> bool:
    novo = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    if p.exists() and p.read_text(encoding="utf-8") == novo:
        return False
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(novo, encoding="utf-8")
    return True


def _agora() -> str:
    return datetime.now(BRT).isoformat(timespec="seconds")


# ── Câmara ────────────────────────────────────────────────────────────────────


def camara() -> dict:
    leg = _get(f"{CAMARA_API}/legislaturas", {"ordem": "DESC", "ordenarPor": "id", "itens": 1})["dados"][0]["id"]
    deps = _paginado(f"{CAMARA_API}/deputados", {"itens": 100, "ordem": "ASC", "ordenarPor": "nome"})
    membros = [
        {"id": f"camara-{d['id']}", "nome": d["nome"], "partido": d.get("siglaPartido") or SEM_PARTIDO, "uf": d.get("siglaUf"), "foto": d.get("urlFoto")}
        for d in deps
    ]
    if len(membros) < 400:  # a Câmara tem 513 cadeiras: lista incompleta não substitui a anterior
        raise RuntimeError(f"lista de deputados incompleta ({len(membros)})")
    hoje = date.today().isoformat()
    mesa = _get(f"{CAMARA_API}/legislaturas/{leg}/mesa")["dados"]
    pres = [m for m in mesa if (m.get("titulo") or "").strip().lower() == "presidente" and (not m.get("dataFim") or m["dataFim"][:10] >= hoje)]
    pres.sort(key=lambda m: m.get("dataInicio") or "", reverse=True)
    presidente = None
    if pres:
        p = pres[0]
        presidente = {
            "id": f"camara-{p['id']}", "nome": p["nome"], "partido": p.get("siglaPartido") or SEM_PARTIDO, "uf": p.get("siglaUf"), "foto": p.get("urlFoto"),
            "desde": (p.get("dataInicio") or "")[:10] or None, "ate": (p.get("dataFim") or "")[:10] or None,
        }
    return {"legislatura": leg, "membros": membros, "presidente": presidente, "coletado_em": _agora()}


def camara_partidos() -> dict[str, dict]:
    """sigla -> {nome, url_logo} dos partidos com registro na Câmara."""
    out: dict[str, dict] = {}
    for p in _paginado(f"{CAMARA_API}/partidos", {"itens": 100, "ordem": "ASC", "ordenarPor": "sigla"}):
        try:
            d = _get(f"{CAMARA_API}/partidos/{p['id']}")["dados"]
        except Exception as exc:  # noqa: BLE001
            print(f"  aviso: partido {p.get('sigla')} sem detalhes ({exc})")
            d = {}
        out[p["sigla"]] = {"nome": d.get("nome") or p.get("nome"), "url_logo": d.get("urlLogo") or None}
    return out


# ── Senado ────────────────────────────────────────────────────────────────────


def _vigencia_senado(cod: str) -> dict:
    """Início (e fim, se houver) do mandato atual na Presidência do Senado (Comissão Diretora, CDIR)."""
    try:
        j = _get(f"{SENADO_API}/senador/{cod}/cargos.json")
    except Exception as exc:  # noqa: BLE001
        print(f"  aviso: vigência da presidência do Senado indisponível ({exc})")
        return {"desde": None, "ate": None}

    def cargos(o):
        if isinstance(o, dict):
            if "DescricaoCargo" in o:
                yield o
            for v in o.values():
                yield from cargos(v)
        elif isinstance(o, list):
            for v in o:
                yield from cargos(v)

    hoje = date.today().isoformat()
    pres = [
        c for c in cargos(j)
        if (c.get("IdentificacaoComissao") or {}).get("SiglaComissao") == "CDIR" and (c.get("DescricaoCargo") or "").strip().upper() == "PRESIDENTE"
        and (not c.get("DataFim") or c["DataFim"][:10] >= hoje)
    ]
    pres.sort(key=lambda c: c.get("DataInicio") or "", reverse=True)
    if not pres:
        return {"desde": None, "ate": None}
    return {"desde": (pres[0].get("DataInicio") or "")[:10] or None, "ate": (pres[0].get("DataFim") or "")[:10] or None}


def senado() -> dict:
    j = _get(f"{SENADO_API}/senador/lista/atual.json")
    lista = _lista(j["ListaParlamentarEmExercicio"]["Parlamentares"]["Parlamentar"])
    membros = []
    for s in lista:
        i = s["IdentificacaoParlamentar"]
        cod = i["CodigoParlamentar"]
        membros.append({"id": f"senado-{cod}", "nome": i["NomeParlamentar"], "partido": i.get("SiglaPartidoParlamentar") or SEM_PARTIDO, "uf": i.get("UfParlamentar"), "foto": SENADO_FOTO.format(cod=cod)})
    if len(membros) < 70:
        raise RuntimeError(f"lista de senadores incompleta ({len(membros)})")
    membros.sort(key=lambda m: m["nome"])
    presidente = None
    mesa = _get(f"{SENADO_API}/composicao/mesaSF.json")["MesaSenado"]
    for col in _lista(mesa.get("Colegiados", {}).get("Colegiado")):
        for c in _lista(col.get("Cargos", {}).get("Cargo")):
            cargos = [x.strip().upper() for x in _lista(c.get("Cargo"))]
            if "PRESIDENTE" in cargos:
                cod = str(c.get("Http") or "")
                m = next((x for x in membros if x["id"] == f"senado-{cod}"), None)
                ban = re.match(r"\(\s*([^-()]+?)\s*-\s*([A-Z]{2})\s*\)", c.get("Bancada") or "")
                nome = re.sub(r"^Senadora?\s+", "", c.get("NomeParlamentar") or "").strip()
                presidente = {
                    "id": f"senado-{cod}",
                    "nome": m["nome"] if m else nome,
                    "partido": m["partido"] if m else (ban.group(1) if ban else SEM_PARTIDO),
                    "uf": m["uf"] if m else (ban.group(2) if ban else None),
                    "foto": SENADO_FOTO.format(cod=cod),
                    **_vigencia_senado(cod),
                }
                break
        if presidente:
            break
    return {"legislatura": None, "membros": membros, "presidente": presidente, "coletado_em": _agora()}


# ── Montagem ──────────────────────────────────────────────────────────────────


def _reserva(api: Path, casa: str) -> dict | None:
    """Primeira execução sem a fonte no ar: parlamentares em exercício já publicados pelo site."""
    pub = _ler(api / "parlamentares.json")
    if not pub:
        return None
    membros = [
        {"id": p["id"], "nome": p["nome"], "partido": p.get("partido") or SEM_PARTIDO, "uf": p.get("uf"), "foto": p.get("foto_url")}
        for p in pub.get("parlamentares", [])
        if p.get("casa") == casa and p.get("em_exercicio")
    ]
    return {"legislatura": None, "membros": sorted(membros, key=lambda m: m["nome"]), "presidente": None, "coletado_em": None} if membros else None


LOGOS_CURADOS = Path(__file__).resolve().parent.parent / "curadoria" / "logos_partidos"


def _logos_curados() -> dict[str, dict]:
    """sigla -> {arquivo, fundo, site} dos logos tirados do site oficial de cada partido
    (curadoria/logos_partidos/fontes.json; site oficial conferido no cadastro do TSE)."""
    fontes = _ler(LOGOS_CURADOS / "fontes.json") or []
    return {
        f["sigla"]: {"arquivo": LOGOS_CURADOS / f["arquivo"], "fundo": f.get("fundo"), "site": f.get("site_oficial")}
        for f in fontes
        if f.get("arquivo") and (LOGOS_CURADOS / f["arquivo"]).exists()
    }


def _baixar_logo(url: str, destino_sem_ext: Path) -> Path | None:
    try:
        r = requests.get(url, headers={"User-Agent": HEADERS["User-Agent"]}, timeout=(10, 60))
        r.raise_for_status()
        tipo = r.headers.get("content-type", "").split(";")[0].strip().lower()
        ext = {"image/png": ".png", "image/gif": ".gif", "image/jpeg": ".jpg", "image/svg+xml": ".svg", "image/webp": ".webp"}.get(tipo) or Path(url.split("?")[0]).suffix.lower()
        if ext not in {".png", ".gif", ".jpg", ".jpeg", ".svg", ".webp"} or len(r.content) < 100:
            return None
        p = destino_sem_ext.with_suffix(ext)
        p.parent.mkdir(parents=True, exist_ok=True)
        if not p.exists() or p.read_bytes() != r.content:
            p.write_bytes(r.content)
        return p
    except Exception as exc:  # noqa: BLE001
        print(f"  aviso: símbolo {url} indisponível ({exc})")
        return None


def _espelhar_fotos(api: Path, casas: dict[str, dict]) -> None:
    """Guarda no site uma cópia de cada foto oficial (api/plenario/fotos/<id>.jpg), baixada uma vez,
    para o desenho não depender do servidor da Casa estar no ar. Sem cópia, mantém o endereço original."""
    from concurrent.futures import ThreadPoolExecutor
    from urllib.parse import urlparse

    pasta = api / "plenario" / "fotos"
    falhas: dict[str, int] = {}
    pessoas = [m for c in casas.values() for m in [*c.get("membros", []), *([c["presidente"]] if c.get("presidente") else [])]]

    def local(m: dict) -> str | None:
        foto = m.get("foto") or ""
        destino = pasta / f"{slug(m['id'])}.jpg"
        rel = str(destino.relative_to(api)).replace(os.sep, "/")
        if destino.exists():
            return rel
        if not foto.startswith("http"):
            return None
        host = urlparse(foto).netloc
        if falhas.get(host, 0) >= 3:  # servidor fora do ar: tenta de novo na próxima passada
            return None
        try:
            r = requests.get(foto, headers={"User-Agent": HEADERS["User-Agent"]}, timeout=(8, 20))
            r.raise_for_status()
            if not r.headers.get("content-type", "").startswith("image/") or len(r.content) < 1000:
                raise ValueError("não é uma foto")
            destino.parent.mkdir(parents=True, exist_ok=True)
            destino.write_bytes(r.content)
            return rel
        except Exception:  # noqa: BLE001
            falhas[host] = falhas.get(host, 0) + 1
            return None

    with ThreadPoolExecutor(max_workers=8) as pool:
        rels = list(pool.map(local, pessoas))
    copiadas = 0
    for m, rel in zip(pessoas, rels):
        if rel:
            m["foto"] = rel
            copiadas += 1
    print(f"fotos: {copiadas} de {len(pessoas)} com cópia no site" + (f"; servidores com falha: {', '.join(falhas)}" if falhas else ""))


def montar(site: Path) -> bool:
    api = site / "api"
    anterior = _ler(api / "plenario.json") or {}
    casas: dict[str, dict] = {}
    no_ar: set[str] = set()
    for casa, coletar in (("camara", camara), ("senado", senado)):
        try:
            casas[casa] = coletar()
            no_ar.add(casa)
            print(f"{casa}: {len(casas[casa]['membros'])} em exercício; presidência: {(casas[casa]['presidente'] or {}).get('nome')}")
        except Exception as exc:  # noqa: BLE001
            velho = copy.deepcopy(anterior.get(casa)) or _reserva(api, casa)
            print(f"{casa}: fonte indisponível ({exc}); mantendo {'o último dado publicado' if velho else 'nada'}")
            if velho:
                casas[casa] = velho

    # Partidos e símbolos (cadastro oficial da Câmara); mantém o que já havia se falhar.
    partidos: dict[str, dict] = copy.deepcopy(anterior.get("partidos") or {})
    try:
        if "camara" not in no_ar:
            raise RuntimeError("Câmara fora do ar nesta execução")
        oficiais = camara_partidos()
    except Exception as exc:  # noqa: BLE001
        print(f"partidos: cadastro da Câmara indisponível ({exc}); mantendo os símbolos já publicados")
        oficiais = {}
    siglas = sorted({m["partido"] for c in casas.values() for m in c["membros"]} | {c["presidente"]["partido"] for c in casas.values() if c.get("presidente")})
    # Nome do partido no TSE (já publicado pelo site), se a Câmara não informar.
    tse = {p["partido"].upper(): p.get("partido_nome") for p in (_ler(api / "partidos.json") or [])}
    curados = _logos_curados()
    for sigla in siglas:
        atual = partidos.get(sigla, {"nome": None, "logo": None})
        atual["nome"] = atual.get("nome") or tse.get(sigla.upper())
        info = oficiais.get(sigla)
        if info:
            atual["nome"] = info["nome"] or atual.get("nome")
        # 1º: logo do site oficial do partido (curadoria); 2º: arquivo oficial da Câmara.
        if sigla in curados:
            c = curados[sigla]
            destino = api / "plenario" / "logos" / f"{slug(sigla)}-partido{c['arquivo'].suffix}"
            destino.parent.mkdir(parents=True, exist_ok=True)
            if not destino.exists() or destino.read_bytes() != c["arquivo"].read_bytes():
                destino.write_bytes(c["arquivo"].read_bytes())
            atual["logo"] = str(destino.relative_to(api)).replace(os.sep, "/")
            atual["fundo"] = c["fundo"]
            atual["fonte_logo"] = c["site"]
        elif info:
            if info["url_logo"]:
                p = _baixar_logo(info["url_logo"], api / "plenario" / "logos" / slug(sigla))
                if p:
                    atual["logo"] = str(p.relative_to(api)).replace(os.sep, "/")
        partidos[sigla] = atual
    partidos = {s: partidos[s] for s in siglas}

    _espelhar_fotos(api, casas)

    # Perfil de gastos no site (para o clique na cadeira levar até ele).
    pub = _ler(api / "parlamentares.json") or {}
    com_perfil = {p["id"] for p in pub.get("parlamentares", [])}
    for c in casas.values():
        for m in c["membros"]:
            m["perfil"] = m["id"] in com_perfil
        if c.get("presidente"):
            c["presidente"]["perfil"] = c["presidente"]["id"] in com_perfil

    # Completo = as duas Casas lidas ao vivo nesta execução e com a Presidência identificada. Enquanto
    # não estiver, o plenario.yml tenta de hora em hora (em vez de a cada 6 horas).
    completo = no_ar == {"camara", "senado"} and all((casas.get(c) or {}).get("presidente") for c in ("camara", "senado"))
    print(f"completo={int(completo)}")
    dados = {"camara": casas.get("camara"), "senado": casas.get("senado"), "partidos": partidos, "completo": completo}
    # Só o conteúdo decide se publica (a hora da coleta muda a cada execução).
    sem_hora = lambda d: json.dumps({k: ({**v, "coletado_em": None} if isinstance(v, dict) and "coletado_em" in v else v) for k, v in d.items()}, sort_keys=True, ensure_ascii=False)  # noqa: E731
    mudou = not anterior or sem_hora(dados) != sem_hora({k: anterior.get(k) for k in dados})
    if mudou:
        _gravar(api / "plenario.json", dados)
        _fontes(api, casas)

    # Página da rota /plenario (título e prévia de link), criada uma vez; o site.yml a remonta depois.
    rota = site / "plenario" / "index.html"
    if not rota.exists() and (site / "index.html").exists():
        from app.export import _page

        resumo = "Dados oficiais da Câmara e do Senado. Sem opinião e sem recomendação de voto."
        _page((site / "index.html").read_text(encoding="utf-8"), site, "plenario", "Plenário da Câmara e do Senado · Tá na Urna", resumo, f"{SITE_URL}/plenario")
        mudou = True
    return mudou


def _fontes(api: Path, casas: dict) -> None:
    meta = _ler(api / "meta.json")
    if not meta:
        return
    novas = {
        "camara_plenario": {
            "nome": "Composição da Câmara, Mesa Diretora e partidos",
            "orgao": "Câmara dos Deputados · Dados Abertos",
            "url": f"{CAMARA_API}/deputados",
            "pagina": "https://dadosabertos.camara.leg.br/",
            "descricao": "Deputados em exercício, Presidente da Câmara (Mesa Diretora da legislatura) e símbolos dos partidos (urlLogo).",
            "coletado_em": (casas.get("camara") or {}).get("coletado_em"),
        },
        "senado_plenario": {
            "nome": "Composição do Senado e Mesa Diretora",
            "orgao": "Senado Federal · Dados Abertos",
            "url": f"{SENADO_API}/senador/lista/atual",
            "pagina": "https://www12.senado.leg.br/dados-abertos",
            "descricao": "Senadores em exercício e Presidente do Senado (composição da Mesa).",
            "coletado_em": (casas.get("senado") or {}).get("coletado_em"),
        },
    }
    fontes = [f for f in meta.get("fontes", []) if f.get("chave") not in novas]
    for chave, f in novas.items():
        fontes.append({"chave": chave, "gerado_em": None, "publicado_em": None, **f})
    meta["fontes"] = fontes
    _gravar(api / "meta.json", meta)


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("site", type=Path, help="pasta do site publicado (checkout da gh-pages)")
    a = ap.parse_args()
    mudou = montar(a.site)
    print(f"mudou={int(mudou)}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"mudou={int(mudou)}\n")


if __name__ == "__main__":
    main()
