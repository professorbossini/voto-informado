"""Congresso dos EUA: quem está em exercício na Câmara (House) e no Senado, com foto oficial.

Fontes:
  Clerk of the House (oficial)                  https://clerk.house.gov/xml/lists/MemberData.xml
      deputados(as) e delegados(as) em exercício, vagas, partido, distrito, posse, gabinete e comissões
  Biographical Directory of the U.S. Congress   https://bioguide.congress.gov/bioguide/photo/<L>/<id>.jpg
      retrato oficial de cada parlamentar (identificador "bioguide", o mesmo do Clerk)
  @unitedstates/congress-legislators (CC0)     https://unitedstates.github.io/congress-legislators/
      senadores(as) em exercício, mandatos anteriores, data de nascimento e os códigos que ligam cada
      parlamentar às outras bases oficiais (FEC, Senado). Compilação pública mantida desde 2012 a partir
      das fontes oficiais; usada aqui para o Senado, cujo site (senate.gov) não aceita acesso automatizado
      fora dos EUA, e para cruzar códigos.

Grava:
  api/eua/congresso.json            composição atual (resumo de cada parlamentar) e vagas
  api/eua/membro/<bioguide>.json    perfil: mandatos, contato oficial, comissões, códigos FEC
  api/eua/fotos/<bioguide>.webp     retrato oficial (240 px de largura)
"""

from __future__ import annotations

import io
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

from .comum import (
    CC0,
    DOMINIO_PUBLICO,
    ESTADOS,
    PARTIDO_POR_NOME,
    TERRITORIOS,
    baixar,
    congresso_atual,
    fonte,
    gravar,
    gravar_se_mudou,
    agora,
    publicado_em,
)

CLERK_MEMBROS = "https://clerk.house.gov/xml/lists/MemberData.xml"
CLERK_PAGINA = "https://clerk.house.gov/Members"
LEGISLADORES = "https://unitedstates.github.io/congress-legislators/legislators-current.json"
LEGISLADORES_REDES = "https://unitedstates.github.io/congress-legislators/legislators-social-media.json"
COMISSOES_SENADO = "https://unitedstates.github.io/congress-legislators/committees-current.json"
MEMBROS_COMISSOES = "https://unitedstates.github.io/congress-legislators/committee-membership-current.json"
LEGISLADORES_PAGINA = "https://github.com/unitedstates/congress-legislators"
FOTO_BIOGUIDE = "https://bioguide.congress.gov/bioguide/photo/{l}/{id}.jpg"
# Reservas, também oficiais, para quem ainda não tem retrato no Biographical Directory.
FOTOS_RESERVA = ("https://clerk.house.gov/content/assets/img/members/{id}.jpg", "https://www.congress.gov/img/member/{low}_200.jpg")
BIOGUIDE_PAGINA = "https://bioguide.congress.gov/search/bio/{id}"
CONGRESS_GOV_MEMBRO = "https://www.congress.gov/member/{slug}/{id}"
LARGURA_FOTO = 240


def _texto(no, caminho: str) -> str:
    return (no.findtext(caminho) or "").strip()


def _distrito(txt: str) -> int:
    """'At Large' → 0; '12th' → 12."""
    d = "".join(ch for ch in txt if ch.isdigit())
    return int(d) if d else 0


def ler_clerk(xml: bytes) -> dict:
    """MemberData.xml → {publicado, congresso, membros{bioguide: {...}}, vagas[], comissoes{code: nome}}."""
    raiz = ET.fromstring(xml)
    comissoes: dict[str, str] = {}
    for c in raiz.iter("committee"):
        comissoes[c.get("comcode") or ""] = _texto(c, "committee-fullname")
        for s in c.iter("subcommittee"):
            comissoes[s.get("subcomcode") or ""] = _texto(s, "subcommittee-fullname")
    membros, vagas = {}, []
    for m in raiz.find("members").findall("member"):
        info = m.find("member-info")
        uf = info.find("state").get("postal-code") if info.find("state") is not None else ""
        distrito = _distrito(_texto(info, "district"))
        bio = _texto(info, "bioguideID")
        if not bio:
            vagas.append({"uf": uf, "distrito": distrito, "nota": _texto(m, "footnote") or None})
            continue
        com = []
        for c in m.iter("committee"):
            com.append({"codigo": c.get("comcode"), "nome": comissoes.get(c.get("comcode") or ""), "cargo": c.get("leadership") or None, "sub": False})
        for s in m.iter("subcommittee"):
            com.append({"codigo": s.get("subcomcode"), "nome": comissoes.get(s.get("subcomcode") or ""), "cargo": s.get("leadership") or None, "sub": True})
        sworn = (info.find("sworn-date").get("date") if info.find("sworn-date") is not None else "") or ""
        membros[bio] = {
            "nome": _texto(info, "official-name"),
            "sobrenome": _texto(info, "lastname"),
            "prenome": _texto(info, "firstname"),
            "partido": _texto(info, "party") or None,
            "bancada": _texto(info, "caucus") or None,
            "uf": uf,
            "distrito": distrito,
            "posse": f"{sworn[:4]}-{sworn[4:6]}-{sworn[6:8]}" if len(sworn) == 8 else None,
            "telefone": _texto(info, "phone") or None,
            "gabinete": " ".join(x for x in (_texto(info, "office-room"), _texto(info, "office-building")) if x) or None,
            "comissoes": [c for c in com if c["nome"]],
        }
    titulo = raiz.find("title-info")
    return {
        "publicado": raiz.get("publish-date"),
        "congresso": int(_texto(titulo, "congress-num") or 0) if titulo is not None else None,
        "membros": membros,
        "vagas": vagas,
    }


def _dias_entre(a: str | None, b: str | None) -> int:
    try:
        return (date.fromisoformat(b) - date.fromisoformat(a)).days  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return 10**6


def _proxima_eleicao(fim: str | None, casa: str) -> int | None:
    """Ano da eleição que decide a cadeira: mandatos terminam em 3 de janeiro, logo a eleição é em novembro do ano anterior."""
    if not fim:
        return None
    a, m = int(fim[:4]), int(fim[5:7])
    return a - 1 if m == 1 else a


def _slug_congress_gov(nome: str) -> str:
    from .comum import slug

    return slug(nome) or "membro"


def montar_membros(clerk: dict, legisladores: list[dict], redes: list[dict], com_senado: dict, membros_com: dict) -> tuple[list[dict], dict[str, dict]]:
    """Resumo (lista) e perfil (por bioguide) de cada parlamentar em exercício."""
    por_id = {p["id"]["bioguide"]: p for p in legisladores}
    redes_por_id = {r["id"]["bioguide"]: r.get("social", {}) for r in redes if r.get("id", {}).get("bioguide")}
    resumo, perfis = [], {}

    def base(bio: str, p: dict | None, casa: str) -> dict:
        termos = (p or {}).get("terms", [])
        tipo = "rep" if casa == "camara" else "sen"
        ultimo = termos[-1] if termos else {}
        # Início contínuo na casa atual: volta enquanto os mandatos anteriores forem da mesma casa e contíguos.
        desde = None
        for t in reversed(termos):
            if t.get("type") != tipo:
                break
            if desde and _dias_entre(t.get("end"), desde) > 60:
                break  # houve intervalo: conta só o período contínuo atual (folga para os dias entre sessões)
            desde = t.get("start")
        nome = (p or {}).get("name", {})
        return {
            "id": bio,
            "casa": casa,
            "nome": nome.get("official_full") or f"{nome.get('first', '')} {nome.get('last', '')}".strip(),
            "sobrenome": nome.get("last"),
            "genero": (p or {}).get("bio", {}).get("gender"),
            "nascimento": (p or {}).get("bio", {}).get("birthday"),
            "desde": desde,
            "mandato_fim": ultimo.get("end"),
            "site": ultimo.get("url"),
            "termos": termos,
        }

    # Câmara: lista oficial do Clerk; o resto (nascimento, mandatos) vem da compilação CC0.
    for bio, c in clerk["membros"].items():
        p = por_id.get(bio)
        b = base(bio, p, "camara")
        uf = c["uf"]
        delegado = uf in TERRITORIOS or uf == "DC"
        r = {
            "id": bio,
            "casa": "camara",
            "nome": c["nome"] or b["nome"],
            "sobrenome": c["sobrenome"] or b["sobrenome"],
            "partido": c["partido"],
            "uf": uf,
            "distrito": c["distrito"],
            "delegado": delegado,
            "genero": b["genero"],
            "nascimento": b["nascimento"],
            "desde": b["desde"],
            "posse": c["posse"],
            "mandato_fim": b["mandato_fim"],
            "proxima_eleicao": _proxima_eleicao(b["mandato_fim"], "camara"),
            "foto": None,
        }
        resumo.append(r)
        perfis[bio] = {**r, "telefone": c["telefone"], "gabinete": c["gabinete"], "site": b["site"], "comissoes": c["comissoes"], "termos": b["termos"], "p": p}

    # Senado: compilação CC0 (senate.gov bloqueia acesso automatizado de fora dos EUA).
    nomes_com = {c["thomas_id"]: c["name"] for c in com_senado if c.get("type") == "senate"}
    for c in com_senado:
        for s in c.get("subcommittees", []):
            nomes_com[c["thomas_id"] + s["thomas_id"]] = s["name"]
    com_por_bio: dict[str, list] = {}
    for codigo, lista in membros_com.items():
        if codigo not in nomes_com:
            continue
        for m in lista:
            if m.get("bioguide"):
                com_por_bio.setdefault(m["bioguide"], []).append({"codigo": codigo, "nome": nomes_com[codigo], "cargo": m.get("title"), "sub": len(codigo) > 4})
    for p in legisladores:
        t = p["terms"][-1]
        if t.get("type") != "sen":
            continue
        bio = p["id"]["bioguide"]
        b = base(bio, p, "senado")
        r = {
            "id": bio,
            "casa": "senado",
            "nome": b["nome"],
            "sobrenome": b["sobrenome"],
            "partido": PARTIDO_POR_NOME.get(t.get("party", ""), "I"),
            "bancada": PARTIDO_POR_NOME.get(t.get("caucus", ""), None) if t.get("caucus") else None,
            "uf": t.get("state"),
            "distrito": None,
            "classe": t.get("class"),
            "delegado": False,
            "genero": b["genero"],
            "nascimento": b["nascimento"],
            "desde": b["desde"],
            "posse": None,
            "mandato_fim": t.get("end"),
            "proxima_eleicao": _proxima_eleicao(t.get("end"), "senado"),
            "foto": None,
        }
        resumo.append(r)
        perfis[bio] = {**r, "telefone": t.get("phone"), "gabinete": t.get("office"), "site": t.get("url"), "comissoes": com_por_bio.get(bio, []), "termos": b["termos"], "p": p}

    for bio, perfil in perfis.items():
        p = perfil.pop("p") or {}
        ids = p.get("id", {})
        perfil["redes"] = {k: v for k, v in redes_por_id.get(bio, {}).items() if k in ("twitter", "facebook", "youtube", "instagram", "mastodon") and v}
        perfil["fec"] = ids.get("fec", [])
        perfil["lis"] = ids.get("lis")
        perfil["mandatos"] = [
            {"casa": "camara" if t.get("type") == "rep" else "senado", "inicio": t.get("start"), "fim": t.get("end"), "uf": t.get("state"),
             "distrito": t.get("district"), "partido": PARTIDO_POR_NOME.get(t.get("party", ""), t.get("party"))}
            for t in perfil.pop("termos")
        ]
        perfil["links"] = {
            "bioguide": BIOGUIDE_PAGINA.format(id=bio),
            "congress_gov": CONGRESS_GOV_MEMBRO.format(slug=_slug_congress_gov(perfil["nome"]), id=bio),
        }
    resumo.sort(key=lambda r: (r["casa"], r["uf"] or "", r["distrito"] or 0, r["sobrenome"] or ""))
    return resumo, perfis


def _foto(bio: str, destino: Path) -> bool:
    """Baixa e reduz o retrato oficial (uma vez; o retrato muda raramente)."""
    if destino.exists():
        return True
    try:
        from PIL import Image
    except ImportError:
        return False
    for modelo in (FOTO_BIOGUIDE, *FOTOS_RESERVA):
        r = baixar(modelo.format(l=bio[0], id=bio, low=bio.lower()), tentativas=2)
        if r.status_code == 200 and r.headers.get("content-type", "").startswith("image") and len(r.content) > 2000:
            break
    else:
        return False
    try:
        img = Image.open(io.BytesIO(r.content)).convert("RGB")
    except Exception:  # noqa: BLE001 - arquivo corrompido: fica sem foto
        return False
    if img.width > LARGURA_FOTO:
        img = img.resize((LARGURA_FOTO, round(img.height * LARGURA_FOTO / img.width)), Image.LANCZOS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino, "WEBP", quality=80, method=6)
    return True


def montar(api: Path) -> tuple[bool, list[dict]]:
    """Composição atual. Devolve (mudou, fontes)."""
    r = baixar(CLERK_MEMBROS)
    r.raise_for_status()
    clerk = ler_clerk(r.content)
    pub_clerk = publicado_em(r)
    leg = baixar(LEGISLADORES)
    leg.raise_for_status()
    redes = baixar(LEGISLADORES_REDES)
    com = baixar(COMISSOES_SENADO)
    mcom = baixar(MEMBROS_COMISSOES)
    resumo, perfis = montar_membros(
        clerk,
        leg.json(),
        redes.json() if redes.ok else [],
        com.json() if com.ok else [],
        mcom.json() if mcom.ok else {},
    )
    mudou = False
    with ThreadPoolExecutor(max_workers=8) as pool:
        tem_foto = dict(zip([m["id"] for m in resumo], pool.map(lambda m: _foto(m["id"], api / "fotos" / f"{m['id']}.webp"), resumo)))
    for m in resumo:
        if tem_foto[m["id"]]:
            m["foto"] = f"eua/fotos/{m['id']}.webp"
            perfis[m["id"]]["foto"] = m["foto"]
    for bio, perfil in perfis.items():
        mudou |= gravar(api / "membro" / f"{bio}.json", perfil)

    n = clerk["congresso"] or congresso_atual()
    camara = [m for m in resumo if m["casa"] == "camara"]
    senado = [m for m in resumo if m["casa"] == "senado"]
    dados = {
        "congresso": n,
        "publicado_clerk": clerk["publicado"],
        "camara": {
            "cadeiras": 435,
            "delegados": 6,
            "membros": camara,
            "vagas": clerk["vagas"],
        },
        "senado": {"cadeiras": 100, "membros": senado},
        "coletado_em": agora(),
    }
    mudou |= gravar_se_mudou(api / "congresso.json", dados)
    fontes = [
        fonte("eua-clerk-membros", nome="Member Data (lista oficial da Câmara)", orgao="U.S. House of Representatives · Office of the Clerk",
              url=CLERK_MEMBROS, pagina=CLERK_PAGINA, licenca=DOMINIO_PUBLICO, publicado=pub_clerk,
              descricao="Deputados(as) e delegados(as) em exercício, vagas, partido, distrito, data da posse, gabinete, telefone e comissões."),
        fonte("eua-bioguide", nome="Retratos oficiais (Biographical Directory)", orgao="U.S. Congress · Biographical Directory",
              url="https://bioguide.congress.gov/", pagina="https://bioguide.congress.gov/", licenca=DOMINIO_PUBLICO,
              descricao="Retrato oficial de cada parlamentar, pelo identificador bioguide (o mesmo usado pelo Clerk e pelo Senado)."),
        fonte("eua-legisladores", nome="congress-legislators (compilação pública)", orgao="Projeto @unitedstates (GovTrack e colaboradores)",
              url=LEGISLADORES, pagina=LEGISLADORES_PAGINA, licenca=CC0, publicado=publicado_em(leg),
              descricao="Senadores(as) em exercício, mandatos anteriores, nascimento, comissões do Senado e os códigos que ligam cada parlamentar à FEC e ao Senado. Compilada das fontes oficiais."),
    ]
    return mudou, fontes


def ufs_validas() -> set[str]:
    return set(ESTADOS) | set(TERRITORIOS)


if __name__ == "__main__":  # teste manual: python -m etl.eua.congresso <site>
    import sys

    print(montar(Path(sys.argv[1]) / "api" / "eua"))
