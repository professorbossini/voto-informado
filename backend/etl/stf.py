"""STF: composição atual, quem preside, datas de cada ministro, quem os nomeou, remuneração mês a
mês e diárias e passagens. Roda sozinho no GitHub Actions (.github/workflows/stf.yml), direto
sobre o site publicado (branch gh-pages), sem banco.

Fontes (todas públicas, publicadas pelo próprio STF por força da Lei de Acesso à Informação e da
Resolução CNJ 215/2015):
  Portal do STF (portal.stf.jus.br)
    - /ostf/plenario/composicao.asp           composição plenária atual (ordem de antiguidade,
                                               Presidente ao centro), fotos oficiais e PGR
    - Pasta de cada Ministro (Biblioteca)      nome completo, nascimento, indicação, nomeação,
                                               posse, Presidência e Vice-Presidência
  Gestão de Pessoas do STF (egesp-portal.stf.jus.br/transparencia/rendimento_folha)
    - remuneração mensal de cada ministro, com as parcelas (A) a (S) da Resolução CNJ 215
  Transparência do STF (transparencia.stf.jus.br, painel "Diárias e passagens")
    - cada passagem aérea e cada diária concedida a ministro desde 2016
  Quem nomeou: Presidente da República em exercício na data do decreto de nomeação (CF, art. 101,
  parágrafo único). Retrato oficial de cada Presidente: Wikimedia Commons (crédito no arquivo).

Sem CPF e só ministros (nenhum servidor). Se uma fonte falhar, mantém o último dado publicado.

Grava:
  api/stf.json                    composição, presidência, resumo de cada ministro, presidentes
  api/stf/ministro/<id>.json      remuneração mês a mês e viagens de cada ministro
  api/stf/fotos/<id>.jpg          retratos (cópia reduzida da foto oficial)
  stf/<id>/index.html             página da rota (título e prévia de link), criada uma vez

Uso: python -m etl.stf <site>   (saída: mudou=1|0)
"""

from __future__ import annotations

import argparse
import html
import io
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
PORTAL = "https://portal.stf.jus.br"
EGESP = "https://egesp-portal.stf.jus.br"
QLIK = "transparencia.stf.jus.br"
QLIK_VIAGENS = "36ff6da1-92c2-41ab-8995-fd7153419ab2"
PAINEL_VIAGENS = f"https://{QLIK}/single/?appid={QLIK_VIAGENS}&sheet=3385332f-145b-49bb-ad91-0908ca9d8909&opt=currsel"
PAGINA_REMUNERACAO = f"{EGESP}/transparencia/rendimento_folha"
PAGINA_COMPOSICAO = f"{PORTAL}/ostf/plenario/composicao.asp"
SITE_URL = os.environ.get("SITE_URL", "https://www.tanaurna.com.br")
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
MESES_REMUNERACAO = 24  # meses de folha guardados por ministro
PAUSA = 0.4  # segundos entre consultas ao portal (gentileza com o servidor)
CADEIRAS = 11  # CF, art. 101

# Presidentes da República desde 1985 (posse e fim do exercício), para saber quem assinou cada
# nomeação. Temer exerceu a Presidência como interino de 12/05/2016 a 30/08/2016.
PRESIDENTES = [
    {"id": "jose-sarney", "nome": "José Sarney", "inicio": "1985-03-15", "fim": "1990-03-14", "commons": "Foto Oficial Sarney EBC.jpg"},
    {"id": "fernando-collor", "nome": "Fernando Collor de Mello", "inicio": "1990-03-15", "fim": "1992-10-01", "commons": "Foto oficial do presidente Fernando Collor de Melo. (38405801411).jpg"},
    {"id": "itamar-franco", "nome": "Itamar Franco", "inicio": "1992-10-02", "fim": "1994-12-31", "commons": "Itamar Franco - Agência Brasil (cropped).jpg"},
    {"id": "fernando-henrique-cardoso", "nome": "Fernando Henrique Cardoso", "inicio": "1995-01-01", "fim": "2002-12-31", "commons": "Fernando Henrique Cardoso (1999).jpg"},
    {"id": "lula", "nome": "Luiz Inácio Lula da Silva", "inicio": "2003-01-01", "fim": "2010-12-31", "commons": "Foto oficial de Luiz Inácio Lula da Silva (estreita).jpg"},
    {"id": "dilma-rousseff", "nome": "Dilma Rousseff", "inicio": "2011-01-01", "fim": "2016-05-11", "commons": "Dilma Rousseff - foto oficial 2011-01-09.jpg"},
    {"id": "michel-temer", "nome": "Michel Temer", "inicio": "2016-05-12", "fim": "2018-12-31", "commons": "Presidente Michel Temer (foto oficial) - cortada.jpg"},
    {"id": "jair-bolsonaro", "nome": "Jair Bolsonaro", "inicio": "2019-01-01", "fim": "2022-12-31", "commons": "Presidente Jair Messias Bolsonaro.jpg"},
    {"id": "lula", "nome": "Luiz Inácio Lula da Silva", "inicio": "2023-01-01", "fim": "2026-12-31", "commons": "Foto oficial de Luiz Inácio Lula da Silva (estreita).jpg"},
]

# Parcelas da folha (Resolução CNJ 215/2015, Anexo VIII), na ordem em que o STF publica.
PARCELAS = [
    ("A", "Vencimentos / subsídios"),
    ("B", "Vantagens pessoais"),
    ("C", "Vantagens de natureza periódica/eventual"),
    ("D", "Exercício de cargo em comissão/função comissionada"),
    ("E", "Rendimento bruto antes do teto constitucional"),
    ("F", "Total bruto após o teto constitucional"),
    ("G", "Abono de permanência"),
    ("H", "Contribuição previdenciária"),
    ("I", "Imposto de renda"),
    ("J", "Total de descontos compulsórios"),
    ("K", "Abate-teto"),
    ("L", "Descontos diversos"),
    ("M", "Total de descontos"),
    ("N", "Férias"),
    ("O", "Gratificação natalina e antecipação"),
    ("P", "Auxílios e benefícios"),
    ("Q", "Indenizações"),
    ("R", "Exercícios anteriores e licença-prêmio convertida em pecúnia"),
    ("S", "Auxílio-moradia"),
]

s = requests.Session()
s.headers["User-Agent"] = UA


def _get(url: str, **kw) -> requests.Response:
    for tentativa in range(3):
        try:
            r = s.get(url, timeout=(10, 60), **kw)
            r.raise_for_status()
            if "charset" not in r.headers.get("content-type", "").lower():
                r.encoding = "utf-8"  # o portal do STF manda UTF-8 sem declarar
            return r
        except requests.RequestException:
            if tentativa == 2:
                raise
            time.sleep(2 * (tentativa + 1))
    raise RuntimeError("inalcançável")


def _ler(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _gravar(p: Path, dados) -> bool:
    novo = json.dumps(dados, ensure_ascii=False, separators=(",", ":"))
    if p.exists() and p.read_text(encoding="utf-8") == novo:
        return False
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(novo, encoding="utf-8")
    return True


def _texto(trecho: str) -> str:
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", trecho, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", t)).replace("\xa0", " ")
    return re.sub(r"\n\s*\n+", "\n", re.sub(r"[ \t]+", " ", t))


def chave_nome(nome: str) -> str:
    sem = unicodedata.normalize("NFD", nome).encode("ascii", "ignore").decode().lower()
    return " ".join(re.sub(r"[^a-z ]+", " ", sem).split())


def slug(nome: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", chave_nome(nome)).strip("-")


def _data(txt: str) -> str | None:
    """'1º/10/2020' ou '16/6/2015' → '2020-10-01'."""
    m = re.search(r"(\d{1,2})º?/(\d{1,2})/(\d{4})", txt)
    return f"{m.group(3)}-{int(m.group(2)):02d}-{int(m.group(1)):02d}" if m else None


def _valor(txt: str) -> float:
    return float(re.sub(r"[^\d,-]", "", txt).replace(",", "."))


def quem_nomeou(nomeacao: str | None) -> str | None:
    if not nomeacao:
        return None
    for p in PRESIDENTES:
        if p["inicio"] <= nomeacao <= p["fim"]:
            return p["id"]
    return None


# ----------------------------------------------------------------------------- composição


def composicao() -> dict:
    """Composição plenária atual, na ordem do STF: Presidente e depois os demais por antiguidade."""
    pag = _get(PAGINA_COMPOSICAO).text
    ids = re.findall(r'<option\s+value="(\d+)">', re.search(r'id="pa-select-presidente".*?</select>', pag, re.S).group(0))
    presidencia = ids[-1]  # a lista é cronológica: a última presidência é a atual
    pag = _get(f"{PAGINA_COMPOSICAO}?id={presidencia}").text
    atual = re.search(r"Composição Atual</h4>\s*<a href=\"(visualizar\.asp\?id=\d+)\">\s*<strong>Período: </strong>([^<]+)</a>", pag)
    url = f"{PORTAL}/ostf/plenario/{atual.group(1)}"
    pag = _get(url).text
    arvore = pag[pag.find("pa-plenario-arvore") : pag.find("pa-rodape")]
    membros = [
        {"pasta": html.unescape(href).replace("http://", "https://"), "foto_id": foto, "nome_stf": " ".join(nome.split())}
        for href, foto, nome in re.findall(r'<a href="([^"]+)">\s*<img[^>]+src="/util/imagem\.asp\?tamanho=\w+&id=(\d+)">\s*</a>\s*<p>\s*Min\.\s*([^<]+?)\s*</p>', arvore)
    ]
    rodape = _texto(pag[pag.find(">", pag.find("pa-rodape")) + 1 : pag.find("<footer")])
    linhas = [l.strip() for l in rodape.split("\n") if l.strip()]
    pgr = next((l.split(":", 1)[1].strip() for l in linhas if l.startswith("Procurador Geral da República")), None)
    pgr_desde = next((_data(l) for l in linhas if l.startswith("Período") and "a partir" in l), None)
    nota = next((l for l in linhas if not l.startswith(("Procurador", "Período"))), None)
    return {"url": url, "desde": _data(atual.group(2)), "membros": membros, "nota": nota, "pgr": {"nome": pgr, "desde": pgr_desde} if pgr else None}


def pasta(url: str) -> dict:
    """Dados e datas da pasta do Ministro (Biblioteca do STF)."""
    txt = _texto(_get(url).text)
    i = txt.find("Ministr", txt.find("pessoas já viram"))
    bloco = txt[i : txt.find("Dados e Datas", i)]
    titulo = bloco.split("\n", 1)[0].strip()
    cargo = re.search(r"\((Presidente|Vice-Presidente)\)", " ".join(bloco.split("\n")[:2]))
    nome = re.sub(r"^Ministr[oa]\s+|\s*\(.*\)$", "", titulo).strip()
    completo = re.search(r"Nome Completo:\s*(.+)", bloco)
    nasc = re.search(r"Data de Nascimento:\s*([^,\n]+),?\s*([^\n]*)", bloco)
    datas: dict[str, str] = {}
    for rotulo, valor in re.findall(r"\n([^\n:]+?)\n:\s*([^\n]+)", bloco):
        rot = rotulo.strip()
        d = _data(valor)
        if not d:
            continue
        if rot.startswith("Indicação"):
            datas["indicacao"] = d
        elif rot.startswith("Nomeação"):
            datas["nomeacao"] = d
        elif rot == "Posse no Supremo Tribunal Federal":
            datas["posse"] = d
        elif rot.startswith("Posse na Vice-Presidência do Supremo"):
            datas["posse_vice"] = d
        elif rot.startswith("Posse na Presidência do Supremo"):
            datas["posse_presidencia"] = d
    return {
        "nome": nome,
        "nome_completo": completo.group(1).strip() if completo else nome,
        "cargo": cargo.group(1) if cargo else None,
        "nascimento": _data(nasc.group(1)) if nasc else None,
        "naturalidade": (nasc.group(2).strip() or None) if nasc else None,
        "datas": datas,
    }


def _retrato(conteudo: bytes, destino: Path, largura: int = 360) -> None:
    from PIL import Image

    im = Image.open(io.BytesIO(conteudo)).convert("RGB")
    if im.width > largura:
        im = im.resize((largura, round(im.height * largura / im.width)), Image.LANCZOS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    im.save(destino, "JPEG", quality=84, optimize=True, progressive=True)


def foto_ministro(api: Path, mid: str, foto_id: str, anterior: dict | None) -> str | None:
    destino = api / "stf" / "fotos" / f"{mid}.jpg"
    rel = str(destino.relative_to(api)).replace(os.sep, "/")
    if destino.exists() and (anterior or {}).get("foto_id") == foto_id:
        return rel
    try:
        _retrato(_get(f"{PORTAL}/util/imagem.asp?tamanho=normal&id={foto_id}").content, destino)
        return rel
    except Exception as exc:  # noqa: BLE001
        print(f"  aviso: foto de {mid} indisponível ({exc})")
        return rel if destino.exists() else None


def presidentes_usados(api: Path, ids: set[str], anteriores: dict) -> dict:
    """Retrato oficial (Wikimedia Commons) e mandatos de cada Presidente que nomeou alguém."""
    out = {}
    for pid in sorted(ids):
        mandatos = [p for p in PRESIDENTES if p["id"] == pid]
        p = mandatos[0]
        info = {"nome": p["nome"], "mandatos": [{"inicio": m["inicio"], "fim": m["fim"]} for m in mandatos]}
        velho = anteriores.get(pid) or {}
        destino = api / "stf" / "presidentes" / f"{pid}.jpg"
        if destino.exists() and velho.get("foto_arquivo") == p["commons"]:
            info.update({k: velho.get(k) for k in ("foto", "foto_arquivo", "foto_credito", "foto_licenca", "foto_pagina")})
        else:
            try:
                meta = _get(
                    "https://commons.wikimedia.org/w/api.php",
                    params={"action": "query", "titles": f"File:{p['commons']}", "prop": "imageinfo", "iiprop": "url|extmetadata", "iiurlwidth": 360, "format": "json"},
                ).json()
                ii = next(iter(meta["query"]["pages"].values()))["imageinfo"][0]
                em = ii.get("extmetadata", {})
                limpo = lambda k: re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", (em.get(k) or {}).get("value", "")))).strip() or None  # noqa: E731
                _retrato(_get(ii["thumburl"]).content, destino)
                info.update({
                    "foto": str(destino.relative_to(api)).replace(os.sep, "/"),
                    "foto_arquivo": p["commons"],
                    "foto_credito": limpo("Artist"),
                    "foto_licenca": limpo("LicenseShortName"),
                    "foto_pagina": ii.get("descriptionurl"),
                })
            except Exception as exc:  # noqa: BLE001
                print(f"  aviso: retrato de {p['nome']} indisponível ({exc})")
                info.update({k: velho.get(k) for k in ("foto", "foto_arquivo", "foto_credito", "foto_licenca", "foto_pagina")})
        out[pid] = info
    return out


# ----------------------------------------------------------------------------- remuneração


def _meses(ate: date, n: int):
    a, m = ate.year, ate.month
    for _ in range(n):
        yield a, m
        a, m = (a, m - 1) if m > 1 else (a - 1, 12)


def remuneracao(ministros: list[dict], anteriores: dict[str, dict]) -> dict[str, list[dict]]:
    """Folha de cada ministro nos últimos MESES_REMUNERACAO meses publicados. Meses já guardados
    (exceto os 2 mais recentes, que o STF ainda pode corrigir) não são consultados de novo."""
    pag = _get(PAGINA_REMUNERACAO).text
    matriculas = {chave_nome(nome): mat for mat, nome in re.findall(r'<option value="(\d+)">\d+ - ([^<]+)</option>', pag)}
    mat_de = {}
    for m in ministros:
        mat = matriculas.get(chave_nome(m["nome_completo"]))
        if mat:
            mat_de[mat] = m["id"]
        else:
            print(f"  aviso: matrícula de {m['nome_completo']} não encontrada na folha")
    if not mat_de:
        raise RuntimeError("nenhum ministro encontrado na folha")
    out: dict[str, dict[str, dict]] = {mid: {r["ref"] + "|" + r["folha"]: r for r in anteriores.get(mid, [])} for mid in mat_de.values()}
    hoje = datetime.now(BRT).date()
    recentes = 0
    for i, (ano, mes) in enumerate(_meses(hoje, MESES_REMUNERACAO + 3)):
        ref = f"{ano}-{mes:02d}"
        ja_tem = all(any(k.startswith(ref + "|") for k in out[mid]) for mid in mat_de.values())
        if ja_tem and recentes >= 2:
            continue
        time.sleep(PAUSA)
        folhas = _get(f"{EGESP}/transparencia/tipos_folhas_referencia", params={"ano": ano, "mes": mes}, headers={"X-Requested-With": "XMLHttpRequest"}).json()
        if not folhas:
            continue  # mês ainda não publicado
        recentes += 1
        for f in folhas:
            f = f[0]
            params = [("utf8", "✓"), ("q[ano_eq]", ano), ("q[mes_eq]", mes), ("q[id_aux_eq]", f["id_aux"])] + [("q[cdg_ordem_in][]", mat) for mat in mat_de]
            time.sleep(PAUSA)
            lista = _get(PAGINA_REMUNERACAO, params=params).text
            token = re.search(r'name="csrf-token" content="([^"]+)"', lista).group(1)
            corpo = lista[lista.find("<tbody") : lista.find("</tbody>")]
            for linha in re.findall(r"<tr.*?</tr>", corpo, re.S):
                cel = [c.strip() for c in _texto(linha).split("\n") if c.strip()]
                det = re.search(r"show_detalhes\?id=(\d+)", linha)
                if not cel or cel[0] not in mat_de or not det:
                    continue
                valores = [c for c in cel if c.startswith("R$")]
                time.sleep(PAUSA)
                js = _get(
                    f"{EGESP}/transparencia/show_detalhes",
                    params={"id": det.group(1)},
                    headers={"X-Requested-With": "XMLHttpRequest", "X-CSRF-Token": token, "Accept": "text/javascript, */*", "Referer": PAGINA_REMUNERACAO},
                ).text
                js = js.replace('\\"', '"').replace("\\/", "/").replace("\\n", "\n")
                inicio = js.find("Parcelas de natureza")
                nums = [_valor(v) for v in re.findall(r"R\\?\$\s*-?[\d.]+,\d{2}", js[inicio:])]
                if len(nums) < len(PARCELAS):
                    print(f"  aviso: detalhe da folha {ref} de {mat_de[cel[0]]} incompleto ({len(nums)} valores)")
                    continue
                reg = {
                    "ref": ref,
                    "folha": re.sub(r"\s*\(\d+\)$", "", f["nme_folha"]).capitalize(),
                    "funcao": cel[3] if len(cel) > 3 and not cel[3].startswith("R$") and cel[3] != "MINISTRO" else None,
                    "bruto": _valor(valores[0]) if valores else None,
                    "liquido": _valor(valores[1]) if len(valores) > 1 else None,
                    "parcelas": {k: nums[i] for i, (k, _) in enumerate(PARCELAS)},
                }
                out[mat_de[cel[0]]][ref + "|" + reg["folha"]] = reg
        if recentes >= MESES_REMUNERACAO:
            break
    corte = sorted({k.split("|")[0] for d in out.values() for k in d}, reverse=True)[:MESES_REMUNERACAO]
    return {mid: sorted((r for k, r in d.items() if k.split("|")[0] in corte), key=lambda r: (r["ref"], r["folha"]), reverse=True) for mid, d in out.items()}


# ----------------------------------------------------------------------------- diárias e passagens


def _qlik_tabela(chamar, campos: list[str], filtro: str, valor: str) -> list[list[str]]:
    lb = chamar("CreateSessionObject", 1, [{"qInfo": {"qType": "lb"}, "qListObjectDef": {"qDef": {"qFieldDefs": [filtro]}, "qInitialDataFetch": [{"qTop": 0, "qLeft": 0, "qWidth": 1, "qHeight": 100}]}}])["qReturn"]["qHandle"]
    lay = chamar("GetLayout", lb)["qLayout"]
    el = [c[0]["qElemNumber"] for c in lay["qListObject"]["qDataPages"][0]["qMatrix"] if c[0]["qText"] == valor]
    if not el:
        raise RuntimeError(f"valor {valor!r} não encontrado em {filtro}")
    chamar("SelectListObjectValues", lb, ["/qListObjectDef", el, False])
    hc = chamar("CreateSessionObject", 1, [{"qInfo": {"qType": "hc"}, "qHyperCubeDef": {"qDimensions": [{"qDef": {"qFieldDefs": [c]}, "qNullSuppression": False} for c in campos], "qSuppressMissing": True}}])["qReturn"]["qHandle"]
    total = chamar("GetLayout", hc)["qLayout"]["qHyperCube"]["qSize"]["qcy"]
    passo = 10000 // len(campos)
    linhas: list[list[str]] = []
    for topo in range(0, total, passo):
        pg = chamar("GetHyperCubeData", hc, ["/qHyperCubeDef", [{"qTop": topo, "qLeft": 0, "qWidth": len(campos), "qHeight": passo}]])["qDataPages"][0]["qMatrix"]
        linhas += [[c.get("qText", "") for c in row] for row in pg]
    chamar("ClearAll", 1, [])
    return linhas


def viagens_brutas() -> tuple[list[list[str]], list[list[str]]]:
    """Passagens e diárias de ministros no painel de transparência do STF (Qlik Sense, acesso anônimo)."""
    import websocket

    _get(PAINEL_VIAGENS)  # abre a sessão anônima (cookie)
    cookie = "; ".join(f"{c.name}={c.value}" for c in s.cookies if QLIK in c.domain)
    ws = websocket.create_connection(f"wss://{QLIK}/app/{QLIK_VIAGENS}", header=[f"User-Agent: {UA}", f"Cookie: {cookie}"], origin=f"https://{QLIK}", timeout=90)
    n = [0]

    def chamar(metodo, handle=-1, params=None):
        n[0] += 1
        ws.send(json.dumps({"jsonrpc": "2.0", "id": n[0], "method": metodo, "handle": handle, "params": params if params is not None else []}))
        while True:
            r = json.loads(ws.recv())
            if r.get("id") == n[0]:
                if "error" in r:
                    raise RuntimeError(f"Qlik {metodo}: {r['error']}")
                return r["result"]

    try:
        chamar("OpenDoc", -1, [QLIK_VIAGENS])
        passagens = _qlik_tabela(
            chamar,
            ["idPassagem", "Passageiro", "Motivo da viagem", "Data ida", "Data volta", "Tipo passagem", "Trecho", "Valor bilhete", "Valor reembolso", "Custo efetivo", "Anos", "Mês Passagem", "DATA_ATUALIZACAO_ARQUIVO_passagem"],
            "Cargo",
            "Ministro(a)",
        )
        diarias = _qlik_tabela(
            chamar,
            ["idDiaria", "Beneficiário", "Motivo", "Tipo diária", "Moeda", "Data Ida Diaria", "Data Volta Diaria", "Destino Diaria", "Valor Total", "Quantidade diárias", "Anos", "Mês diária", "DATA_ATUALIZACAO_ARQUIVO_diaria"],
            "Cargo diária",
            "Ministro(a)",
        )
    finally:
        ws.close()
    return passagens, diarias


def _num(t: str) -> float | None:
    t = (t or "").strip()
    if t in ("", "-"):
        return None
    try:
        return float(t.replace(".", "").replace(",", ".")) if "," in t else float(t)
    except ValueError:
        return None


def _iso(t: str) -> str | None:
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", (t or "").strip())
    return f"{m.group(3)}-{m.group(2)}-{m.group(1)}" if m else None


MESES_PT = {m: i + 1 for i, m in enumerate(["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"])}


def _mes(ano: str, mes: str) -> str | None:
    """'2026' + 'jan' (ou '1', 'Janeiro') → '2026-01'."""
    mes = (mes or "").strip().lower()
    n = int(mes) if mes.isdigit() else MESES_PT.get(mes[:3])
    return f"{ano}-{n:02d}" if ano.isdigit() and n else (ano if ano.isdigit() else None)


def viagens(ministros: list[dict]) -> tuple[dict[str, dict], str | None]:
    passagens, diarias = viagens_brutas()
    por_nome = {chave_nome(m["nome_completo"]): m["id"] for m in ministros}
    out = {m["id"]: {"passagens": [], "diarias": []} for m in ministros}
    atualizado = None
    for idp, nome, motivo, ida, volta, tipo, trecho, bilhete, reembolso, custo, ano, mes, atu in passagens:
        mid = por_nome.get(chave_nome(nome))
        atualizado = atualizado or atu
        if not mid:
            continue
        out[mid]["passagens"].append({
            "id": idp, "motivo": motivo if motivo != "-" else None, "ida": _iso(ida), "volta": _iso(volta), "tipo": tipo,
            "trecho": trecho if trecho != "-" else None, "bilhete": _num(bilhete), "reembolso": _num(reembolso), "custo": _num(custo), "mes": _mes(ano, mes),
        })
    for idd, nome, motivo, tipo, moeda, ida, volta, destino, valor, qtd, ano, mes, atu in diarias:
        mid = por_nome.get(chave_nome(nome))
        if not mid:
            continue
        out[mid]["diarias"].append({
            "id": idd, "motivo": motivo if motivo != "-" else None, "tipo": tipo, "moeda": "USD" if moeda.lower().startswith("d") else "BRL",
            "ida": _iso(ida), "volta": _iso(volta), "destino": destino if destino != "-" else None, "valor": _num(valor), "quantidade": _num(qtd), "mes": _mes(ano, mes),
        })
    for v in out.values():
        chave = lambda r: (r.get("ida") or r.get("mes") or "", r["id"])  # noqa: E731
        v["passagens"].sort(key=chave, reverse=True)
        v["diarias"].sort(key=chave, reverse=True)
    return out, atualizado


def resumo_viagens(v: dict) -> dict:
    anos: dict[str, dict] = {}
    for p in v["passagens"]:
        a = (p.get("mes") or p.get("ida") or "")[:4] or "?"
        x = anos.setdefault(a, {"passagens": 0, "passagens_valor": 0.0, "diarias": 0.0, "diarias_brl": 0.0, "diarias_usd": 0.0})
        x["passagens"] += 1
        x["passagens_valor"] += p.get("custo") or 0
    for d in v["diarias"]:
        a = (d.get("mes") or d.get("ida") or "")[:4] or "?"
        x = anos.setdefault(a, {"passagens": 0, "passagens_valor": 0.0, "diarias": 0.0, "diarias_brl": 0.0, "diarias_usd": 0.0})
        x["diarias"] += d.get("quantidade") or 0
        x["diarias_usd" if d["moeda"] == "USD" else "diarias_brl"] += d.get("valor") or 0
    return {a: {k: round(val, 2) for k, val in x.items()} for a, x in sorted(anos.items(), reverse=True)}


# ----------------------------------------------------------------------------- montagem


def montar(site: Path) -> bool:
    api = site / "api"
    anterior = _ler(api / "stf.json") or {}
    agora = datetime.now(BRT).isoformat(timespec="seconds")
    velhos = {m["id"]: m for m in anterior.get("ministros", [])}

    try:
        comp = composicao()
        ministros = []
        for ordem, mb in enumerate(comp["membros"]):
            time.sleep(PAUSA)
            p = pasta(mb["pasta"])
            mid = slug(p["nome"])
            ministros.append({
                "id": mid,
                "nome": p["nome"],
                "nome_completo": p["nome_completo"],
                "cargo": p["cargo"],
                "antiguidade": ordem,  # 0 = quem preside; depois, do mais antigo ao mais novo
                "nascimento": p["nascimento"],
                "naturalidade": p["naturalidade"],
                "datas": p["datas"],
                "nomeado_por": quem_nomeou(p["datas"].get("nomeacao")),
                "pasta": mb["pasta"],
                "foto_id": mb["foto_id"],
            })
        if len(ministros) < 5:
            raise RuntimeError(f"composição com só {len(ministros)} ministros")
        print(f"composição: {len(ministros)} ministros desde {comp['desde']}; presidência: {ministros[0]['nome']}")
        ao_vivo = True
    except Exception as exc:  # noqa: BLE001
        print(f"composição: fonte indisponível ({exc}); mantendo o último dado publicado")
        if not anterior:
            return False
        comp = {k: anterior.get(k) for k in ("url", "desde", "nota", "pgr")}
        comp["url"] = anterior.get("fonte_composicao")
        ministros = [{k: v for k, v in m.items() if k not in ("foto", "remuneracao", "viagens")} for m in anterior["ministros"]]
        ao_vivo = False

    for m in ministros:
        m["foto"] = foto_ministro(api, m["id"], m["foto_id"], velhos.get(m["id"])) if ao_vivo else velhos.get(m["id"], {}).get("foto")
    presidentes = presidentes_usados(api, {m["nomeado_por"] for m in ministros if m["nomeado_por"]}, anterior.get("presidentes") or {})

    detalhes_velhos = {m["id"]: _ler(api / "stf" / "ministro" / f"{m['id']}.json") or {} for m in ministros}
    try:
        rem = remuneracao(ministros, {mid: d.get("remuneracao", []) for mid, d in detalhes_velhos.items()})
        rem_ok = True
        print(f"remuneração: {sum(len(v) for v in rem.values())} folhas de {len(rem)} ministros")
    except Exception as exc:  # noqa: BLE001
        print(f"remuneração: fonte indisponível ({exc}); mantendo a publicada")
        rem, rem_ok = {mid: d.get("remuneracao", []) for mid, d in detalhes_velhos.items()}, False
    try:
        via, via_atualizado = viagens(ministros)
        print(f"viagens: {sum(len(v['passagens']) for v in via.values())} passagens e {sum(len(v['diarias']) for v in via.values())} registros de diárias")
    except Exception as exc:  # noqa: BLE001
        print(f"viagens: painel indisponível ({exc}); mantendo o publicado")
        via = {mid: d.get("viagens") or {"passagens": [], "diarias": []} for mid, d in detalhes_velhos.items()}
        via_atualizado = anterior.get("viagens_atualizado_em")

    mudou = False
    for m in ministros:
        r = rem.get(m["id"], [])
        v = via.get(m["id"], {"passagens": [], "diarias": []})
        ultima = next((x for x in r if x["folha"].lower().startswith("folha normal")), r[0] if r else None)
        m["remuneracao"] = (
            {"ref": ultima["ref"], "bruto": ultima["bruto"], "liquido": ultima["liquido"], "subsidio": ultima["parcelas"].get("A"), "funcao": ultima.get("funcao")} if ultima else None
        )
        anos = resumo_viagens(v)
        m["viagens"] = {"anos": anos, "passagens": len(v["passagens"]), "diarias": round(sum(d.get("quantidade") or 0 for d in v["diarias"]), 1)}
        mudou |= _gravar(api / "stf" / "ministro" / f"{m['id']}.json", {"id": m["id"], "remuneracao": r, "viagens": v, "resumo_viagens": anos})

    fontes = {
        "composicao": {"nome": "Composição plenária atual", "orgao": "Supremo Tribunal Federal", "url": comp.get("url") or PAGINA_COMPOSICAO},
        "pastas": {"nome": "Pastas dos Ministros (dados e datas)", "orgao": "Biblioteca do STF", "url": f"{PORTAL}/textos/verTexto.asp?servico=bibliotecaConsultaProdutoBibliotecaPastaMinistro&pagina=ComposicaoAtual"},
        "remuneracao": {"nome": "Remuneração de ministros e servidores", "orgao": "STF · Secretaria de Gestão de Pessoas", "url": PAGINA_REMUNERACAO},
        "viagens": {"nome": "Diárias e passagens aéreas", "orgao": "STF · Portal da Transparência", "url": PAINEL_VIAGENS},
        "nomeacao": {"nome": "Quem nomeia os Ministros", "orgao": "Constituição Federal, art. 101, parágrafo único", "url": "https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm#art101"},
    }
    dados = {
        "cadeiras": CADEIRAS,
        "desde": comp.get("desde"),
        "nota": comp.get("nota"),
        "pgr": comp.get("pgr"),
        "fonte_composicao": comp.get("url"),
        "ministros": ministros,
        "presidentes": presidentes,
        "remuneracao_ok": rem_ok,
        "viagens_atualizado_em": via_atualizado,
        "fontes": fontes,
        "coletado_em": anterior.get("coletado_em"),
    }
    sem_hora = lambda d: json.dumps({k: v for k, v in d.items() if k != "coletado_em"}, sort_keys=True, ensure_ascii=False)  # noqa: E731
    if mudou or not anterior or sem_hora(dados) != sem_hora(anterior):
        dados["coletado_em"] = agora
        _gravar(api / "stf.json", dados)
        mudou = True

    # Páginas das rotas /stf/<id> (título e prévia de link), criadas uma vez; o site.yml as remonta.
    if (site / "index.html").exists():
        from app.export import _page

        modelo = (site / "index.html").read_text(encoding="utf-8")
        for m in ministros:
            rel = f"stf/{m['id']}"
            if not (site / rel / "index.html").exists():
                cargo = f"{m['cargo']} do STF" if m.get("cargo") else "Ministro(a) do STF"
                desc = f"{cargo}: datas, quem nomeou, remuneração mês a mês, diárias e passagens. Dados públicos oficiais do STF."
                img = f"{SITE_URL}/api/{m['foto']}" if m.get("foto") else None
                _page(modelo, site, rel, f"{m['nome']} · {cargo} · Tá na Urna", desc, f"{SITE_URL}/{rel}", img)
                mudou = True
    return mudou


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
