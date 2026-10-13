"""Suprema Corte dos EUA: composição, histórico de juízes, remuneração e decisões do ano judiciário.

Fontes oficiais:
  Supreme Court of the United States (supremecourt.gov)
    /about/biographies.aspx           juízes(as) em exercício: biografia oficial e retrato
                                      (fotos da Collection of the Supreme Court of the United States)
    /about/members_text.aspx          todos os juízes desde 1789: estado, Presidente que nomeou,
                                      data do juramento e do fim do serviço
    /opinions/slipopinion/<ano>       decisões de mérito do ano judiciário (outubro a outubro):
                                      data, número do processo, nome, autor(a) e PDF oficial
  Administrative Office of the U.S. Courts (uscourts.gov)
    /judges-judgeships/judicial-compensation   salário anual fixado em lei, ano a ano

Decisões judiciais federais não têm direitos autorais (doutrina dos "government edicts":
Banks v. Manchester, 1888; Georgia v. Public.Resource.Org, 2020) e são obras do governo (17 U.S.C. § 105).
O resumo de cada decisão é o publicado pela própria Corte (em inglês).

Grava:
  api/eua/suprema-corte.json             composição, histórico, remuneração e decisões recentes
  api/eua/fotos/scotus/<slug>.webp       retratos oficiais
"""

from __future__ import annotations

import html
import io
import re
from datetime import datetime
from pathlib import Path

from .comum import DOMINIO_PUBLICO, ET, agora, baixar, fonte, gravar_se_mudou, normalizar, publicado_em, slug

BASE = "https://www.supremecourt.gov"
BIOGRAFIAS = BASE + "/about/biographies.aspx"
HISTORICO = BASE + "/about/members_text.aspx"
DECISOES = BASE + "/opinions/slipopinion/{t}"
SALARIOS = "https://www.uscourts.gov/judges-judgeships/judicial-compensation"
CONSTITUICAO = "https://constitution.congress.gov/browse/essay/artII-S2-C2-3-1/ALDE_00013092/"

# Códigos de autoria usados pela Corte na tabela de decisões.
AUTORES = {
    "R": "Roberts", "T": "Thomas", "A": "Alito", "SS": "Sotomayor", "EK": "Kagan", "NG": "Gorsuch", "BK": "Kavanaugh",
    "AB": "Barrett", "KJ": "Jackson", "SB": "Breyer", "G": "Ginsburg", "AK": "Kennedy", "S": "Scalia",
    "PC": "Per curiam (sem autor nomeado)", "D": "Decreto",
}
MESES_EN = {m: i for i, m in enumerate(["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"], 1)}


def _texto(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def _data_en(s: str) -> str | None:
    m = re.search(r"([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})", s or "")
    if not m or m.group(1) not in MESES_EN:
        return None
    return f"{m.group(3)}-{MESES_EN[m.group(1)]:02d}-{int(m.group(2)):02d}"


def nome_legivel(s: str) -> str:
    """'Roberts, John G., Jr.' → 'John G. Roberts Jr.'"""
    partes = [p.strip() for p in s.split(",")]
    if len(partes) >= 2:
        suf = [p for p in partes[2:] if p]
        return " ".join([partes[1], partes[0], *suf]).strip()
    return s.strip()


def ler_historico(pagina: str) -> list[dict]:
    out = []
    tabelas = [t for t in re.findall(r"<table.*?</table>", pagina, flags=re.S) if "Judicial Oath Taken" in t]
    for i, tabela in enumerate(tabelas[:2]):
        cargo = "presidente" if i == 0 else "associado"
        for linha in re.findall(r"<tr.*?</tr>", tabela, flags=re.S):
            c = [_texto(x) for x in re.findall(r"<td[^>]*>(.*?)</td>", linha, flags=re.S)]  # a 1ª célula é <th>
            if len(c) < 5 or not c[0]:
                continue
            out.append({
                "nome": nome_legivel(c[0]),
                "nome_oficial": c[0],
                "cargo": cargo,
                "estado": c[1],
                "nomeado_por": c[2],
                "juramento": _data_en(c[3]),
                "saida": _data_en(c[4]),
            })
    return out


def ler_biografias(pagina: str) -> list[dict]:
    out = []
    for bloco in re.findall(r'<div class="media">(.*?)</div>\s*</div>', pagina, flags=re.S):
        img = re.search(r'<img[^>]+title="([^"]+)"[^>]+src="([^"]+)"', bloco) or re.search(r'<img[^>]+src="([^"]+)"[^>]+title="([^"]+)"', bloco)
        if not img:
            continue
        titulo, src = (img.group(1), img.group(2)) if 'title="' in img.group(0)[: img.group(0).find("src=")] else (img.group(2), img.group(1))
        texto = _texto(re.sub(r"<img[^>]*>", "", bloco))
        nome = titulo.split(",")[0].strip()
        cargo = "presidente" if "Chief Justice" in titulo else "associado"
        nasc = re.search(r"was born (?:in |on )?(.*?)(?:,| on)\s*([A-Z][a-z]+ \d{1,2}, \d{4})", texto)
        out.append({
            "nome": nome,
            "cargo": cargo,
            "foto_url": BASE + "/about/" + src.lstrip("./") if not src.startswith("http") else src,
            "nascimento": _data_en(nasc.group(2)) if nasc else None,
            "naturalidade": nasc.group(1).strip(" ,") if nasc else None,
            "biografia_en": texto,
        })
    # Os aposentados (Retired Justices) vêm depois dos 9 em exercício: fica só a composição atual.
    return out[:9]


def ler_salarios(pagina: str) -> list[dict]:
    texto = _texto(re.sub(r"<script.*?</script>", "", pagina, flags=re.S))
    out = []
    for m in re.finditer(r"\b(19[6-9]\d|20\d\d)\s*\d?\s+\$([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)\s+\$([\d,]+)", texto):
        out.append({"ano": int(m.group(1)), "associado": int(m.group(4).replace(",", "")), "presidente": int(m.group(5).replace(",", ""))})
    vistos, unicos = set(), []
    for s in out:
        if s["ano"] not in vistos:
            vistos.add(s["ano"])
            unicos.append(s)
    return sorted(unicos, key=lambda s: s["ano"])


def ler_decisoes(pagina: str, termo: int) -> list[dict]:
    out = []
    for linha in re.findall(r"<tr[^>]*>(.*?)</tr>", pagina, flags=re.S):
        if ".pdf" not in linha:
            continue
        c = re.findall(r"<td[^>]*>(.*?)</td>", linha, flags=re.S)
        if len(c) < 5:
            continue
        a = re.search(r"<a ([^>]*href='([^']+\.pdf)'[^>]*)>(.*?)</a>", c[3], flags=re.S)
        if not a:
            continue
        titulo = re.search(r'title="([^"]*)"', a.group(1))
        mes, dia, ano = (_texto(c[1]).split("/") + ["", "", ""])[:3]
        try:
            data = datetime(2000 + int(ano) if len(ano) == 2 else int(ano), int(mes), int(dia)).date().isoformat()
        except ValueError:
            data = None
        autor = _texto(c[4])
        out.append({
            "r": _texto(c[0]) or None,
            "data": data,
            "processo": _texto(c[2]),
            "nome": _texto(a.group(3)),
            "resumo_en": html.unescape(titulo.group(1)).strip() if titulo else None,
            "autor": autor or None,
            "autor_nome": AUTORES.get(autor),
            "citacao": _texto(c[5]) if len(c) > 5 else None,
            "pdf": BASE + a.group(2),
            "termo": termo,
        })
    return out


def termo_atual(hoje: datetime | None = None) -> int:
    """Ano judiciário (October Term): começa na primeira segunda-feira de outubro."""
    h = hoje or datetime.now(ET)
    return h.year if h.month >= 10 else h.year - 1


def _foto(url: str, destino: Path) -> bool:
    if destino.exists():
        return True
    try:
        from PIL import Image
    except ImportError:
        return False
    r = baixar(url.replace(" ", "%20"), tentativas=2)
    if r.status_code != 200 or len(r.content) < 2000:
        return False
    img = Image.open(io.BytesIO(r.content)).convert("RGB")
    if img.width > 240:
        img = img.resize((240, round(img.height * 240 / img.width)), Image.LANCZOS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    img.save(destino, "WEBP", quality=82, method=6)
    return True


def montar(api: Path) -> tuple[bool, list[dict]]:
    rb = baixar(BIOGRAFIAS)
    rb.raise_for_status()
    rh = baixar(HISTORICO)
    rh.raise_for_status()
    atuais = ler_biografias(rb.text)
    historico = ler_historico(rh.text)
    rs = baixar(SALARIOS)
    salarios = ler_salarios(rs.text) if rs.ok else []

    # Liga cada juiz(a) em exercício à linha do histórico (sobrenome + sem data de saída).
    sem_saida = [h for h in historico if not h["saida"]]
    juizes = []
    for j in atuais:
        sob = normalizar(j["nome"].replace(", Jr.", "").replace(" Jr.", "")).split()[-1]
        h = next((x for x in sem_saida if normalizar(x["nome_oficial"].split(",")[0]) == sob), None)
        sl = slug(j["nome"])
        foto = f"eua/fotos/scotus/{sl}.webp" if _foto(j["foto_url"], api / "fotos" / "scotus" / f"{sl}.webp") else None
        juizes.append({
            "id": sl,
            "nome": j["nome"],
            "cargo": j["cargo"],
            "nascimento": j["nascimento"],
            "naturalidade": j["naturalidade"],
            "nomeado_por": h["nomeado_por"] if h else None,
            "estado": h["estado"] if h else None,
            "juramento": h["juramento"] if h else None,
            "foto": foto,
            "biografia_en": j["biografia_en"],
        })
    # Ordem oficial: presidente da Corte e depois por antiguidade (data do juramento).
    juizes.sort(key=lambda j: (j["cargo"] != "presidente", j["juramento"] or "9999"))

    t = termo_atual()
    decisoes = []
    for termo in (t, t - 1):
        r = baixar(DECISOES.format(t=str(termo)[2:]))
        if r.status_code == 200:
            decisoes += ler_decisoes(r.text, termo)
    decisoes.sort(key=lambda d: (d["data"] or "", d["r"] or ""), reverse=True)

    dados = {
        "cadeiras": 9,
        "juizes": juizes,
        "historico": historico,
        "salarios": salarios,
        "termo_atual": t,
        "decisoes": decisoes,
        "autores": AUTORES,
        "coletado_em": agora(),
    }
    mudou = gravar_se_mudou(api / "suprema-corte.json", dados)
    fontes = [
        fonte("eua-scotus-membros", nome="Current Members e Justices 1789 to Present", orgao="Supreme Court of the United States",
              url=BIOGRAFIAS, pagina=HISTORICO, licenca=DOMINIO_PUBLICO, publicado=publicado_em(rb),
              descricao="Juízes(as) em exercício (biografia e retrato oficiais) e a lista de todos os juízes desde 1789, com o Presidente que nomeou e as datas de juramento e saída."),
        fonte("eua-scotus-decisoes", nome=f"Slip opinions (October Term {t} e {t - 1})", orgao="Supreme Court of the United States",
              url=DECISOES.format(t=str(t)[2:]), pagina=BASE + "/opinions/opinions.aspx", licenca=DOMINIO_PUBLICO,
              descricao="Decisões de mérito publicadas no ano judiciário: data, número do processo, nome do caso, autor(a) da opinião da Corte, resumo oficial e PDF."),
        fonte("eua-uscourts-salarios", nome="Judicial Compensation", orgao="Administrative Office of the U.S. Courts",
              url=SALARIOS, pagina=SALARIOS, licenca=DOMINIO_PUBLICO,
              descricao="Salário anual de juízes federais e da Suprema Corte, fixado em lei, ano a ano."),
    ]
    return mudou, fontes


if __name__ == "__main__":
    import sys

    print(montar(Path(sys.argv[1]) / "api" / "eua")[0])
