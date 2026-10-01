"""Parlamentares federais da 57ª legislatura e suas despesas de cota parlamentar.

Fontes (todas oficiais):
  Câmara dos Deputados
    - https://dadosabertos.camara.leg.br/api/v2/deputados (lista da legislatura 57,
      lista dos em exercício e detalhes por deputado: nomeCivil, cpf, último status)
    - https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip (CEAP, arquivo completo por ano)
    - https://www.camara.leg.br/transparencia/gastos-parlamentares (valor mensal da cota por UF)
  Senado Federal
    - https://legis.senado.leg.br/dadosabertos/senador/lista/... (senadores)
    - https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/{ano}
      (CEAPS com código do senador; mesmo conteúdo do CSV da LAI)
    - https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv (fallback,
      só traz o nome do senador -> casamento por nome normalizado)

Uso:  cd backend && .venv/bin/python -m etl.parlamentares
"""

from __future__ import annotations

import io
import json
import re
import threading
import time
import unicodedata
import zipfile
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path

import pandas as pd
import requests

from etl import common
from etl.common import RAW, USER_AGENT, connect, download, set_meta

LEGISLATURA = 57
INICIO_LEGISLATURA = (2023, 2)  # 57ª legislatura começa em 01/02/2023
ANOS = [2023, 2024, 2025, 2026]
ANO_CORRENTE = datetime.now().year
TOP_FORNECEDORES = 25

RAW_CAMARA = RAW / "camara"
RAW_SENADO = RAW / "senado"

CAMARA_API = "https://dadosabertos.camara.leg.br/api/v2"
CAMARA_CEAP_URL = "https://www.camara.leg.br/cotas/Ano-{ano}.csv.zip"
CAMARA_GASTOS_URL = "https://www.camara.leg.br/transparencia/gastos-parlamentares"
CAMARA_PERFIL = "https://www.camara.leg.br/deputados/{id}"

SENADO_LEGIS = "https://legis.senado.leg.br/dadosabertos"
SENADO_CEAPS_API = "https://adm.senado.gov.br/adm-dadosabertos/api/v1/senadores/despesas_ceaps/{ano}"
SENADO_CEAPS_CSV = "https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_{ano}.csv"
SENADO_FOTO = "https://www.senado.leg.br/senadores/img/fotos-oficiais/senador{cod}.jpg"
SENADO_PERFIL = "https://www25.senado.leg.br/web/senadores/senador/-/perfil/{cod}"

JSON_HEADERS = {"Accept": "application/json", "User-Agent": USER_AGENT}

# --------------------------------------------------------------------------------------
# Categorias: rótulos legíveis, fiéis ao significado de cada Casa. Equivalentes óbvios
# compartilham o rótulo (divulgação, segurança privada, passagens aéreas da Câmara).
# --------------------------------------------------------------------------------------
CATEGORIAS_CAMARA = {
    "COMBUSTIVEIS E LUBRIFICANTES": "Combustíveis e lubrificantes",
    "PASSAGEM AEREA - SIGEPA": "Passagens aéreas",
    "PASSAGEM AEREA - RPA": "Passagens aéreas",
    "PASSAGEM AEREA - REEMBOLSO": "Passagens aéreas",
    "PASSAGENS AEREAS": "Passagens aéreas",
    "EMISSAO BILHETE AEREO": "Passagens aéreas",
    "SERVICO DE TAXI, PEDAGIO E ESTACIONAMENTO": "Táxi, pedágio e estacionamento",
    "MANUTENCAO DE ESCRITORIO DE APOIO A ATIVIDADE PARLAMENTAR": "Manutenção de escritório de apoio",
    "TELEFONIA": "Telefonia",
    "DIVULGACAO DA ATIVIDADE PARLAMENTAR": "Divulgação da atividade parlamentar",
    "FORNECIMENTO DE ALIMENTACAO DO PARLAMENTAR": "Alimentação do parlamentar",
    "LOCACAO OU FRETAMENTO DE VEICULOS AUTOMOTORES": "Locação ou fretamento de veículos",
    "HOSPEDAGEM ,EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL": "Hospedagem (exceto no Distrito Federal)",
    "HOSPEDAGEM, EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL": "Hospedagem (exceto no Distrito Federal)",
    "PASSAGENS TERRESTRES, MARITIMAS OU FLUVIAIS": "Passagens terrestres, marítimas ou fluviais",
    "COMPLEMENTACAO DO AUXILIO-MORADIA": "Complementação do auxílio-moradia",
    "SERVICOS POSTAIS": "Serviços postais",
    "SERVICO DE SEGURANCA PRESTADO POR EMPRESA ESPECIALIZADA": "Segurança privada",
    "ASSINATURA DE PUBLICACOES": "Assinatura de publicações",
    "CONSULTORIAS, PESQUISAS E TRABALHOS TECNICOS": "Consultorias, pesquisas e trabalhos técnicos",
    "LOCACAO OU FRETAMENTO DE AERONAVES": "Locação ou fretamento de aeronaves",
    "LOCACAO OU FRETAMENTO DE EMBARCACOES": "Locação ou fretamento de embarcações",
    "AQUISICAO DE TOKENS E CERTIFICADOS DIGITAIS": "Tokens e certificados digitais",
    "PARTICIPACAO EM CURSO, PALESTRA OU EVENTO SIMILAR": "Participação em curso, palestra ou evento",
}

# Senado: chave = prefixo normalizado do TIPO_DESPESA (os textos oficiais são longos).
CATEGORIAS_SENADO = [
    ("ALUGUEL DE IMOVEIS PARA ESCRITORIO POLITICO", "Aluguel de imóveis para escritório político"),
    ("AQUISICAO DE MATERIAL DE CONSUMO", "Material de consumo, software, postais e publicações"),
    ("CONTRATACAO DE CONSULTORIAS", "Consultorias, assessorias, pesquisas e trabalhos técnicos"),
    ("DIVULGACAO DA ATIVIDADE PARLAMENTAR", "Divulgação da atividade parlamentar"),
    ("LOCOMOCAO, HOSPEDAGEM, ALIMENTACAO", "Locomoção, hospedagem, alimentação e combustíveis"),
    ("PASSAGENS AEREAS, AQUATICAS E TERRESTRES", "Passagens aéreas, aquáticas e terrestres"),
    ("SERVICOS DE SEGURANCA PRIVADA", "Segurança privada"),
]


def norm(texto: object) -> str:
    """Upper-case, sem acentos, sem pontuação final e com espaços simples."""
    s = unicodedata.normalize("NFKD", str(texto or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    return re.sub(r"\s+", " ", s).strip().upper()


def sentence_case(texto: str) -> str:
    t = re.sub(r"\s+", " ", str(texto)).strip().rstrip(".").strip()
    return t[:1].upper() + t[1:].lower() if t else "Não informado"


def categoria_camara(raw: str) -> str:
    key = norm(raw).rstrip(".").strip()
    return CATEGORIAS_CAMARA.get(key) or sentence_case(raw)


def categoria_senado(raw: object) -> str:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)) or not str(raw).strip():
        return "Tipo não informado na fonte"
    key = norm(raw)
    for prefixo, rotulo in CATEGORIAS_SENADO:
        if key.startswith(prefixo):
            return rotulo
    return sentence_case(raw)


def doc_fornecedor(raw: object) -> str | None:
    """CNPJ formatado; CPF (pessoa física) mascarado; identificador inválido -> None."""
    d = re.sub(r"\D", "", str(raw or ""))
    if len(d) == 14:
        return f"{d[:2]}.{d[2:5]}.{d[5:8]}/{d[8:12]}-{d[12:]}"
    if len(d) == 11:
        return f"***.{d[3:6]}.{d[6:9]}-**"
    return None  # vazio ou malformado: não expõe dígitos soltos (podem ser de pessoa física)


def so_digitos(raw: object) -> str | None:
    d = re.sub(r"\D", "", str(raw or ""))
    return d.zfill(11) if 0 < len(d) <= 11 else None


def max_age(ano: int) -> float:
    return 12 if ano >= ANO_CORRENTE else 24 * 90


def https(url: str | None) -> str | None:
    return url.replace("http://", "https://", 1) if url else url


# --------------------------------------------------------------------------------------
# HTTP JSON com cache em disco (para APIs paginadas/detalhes)
# --------------------------------------------------------------------------------------
_session_local = threading.local()


def _session() -> requests.Session:
    s = getattr(_session_local, "s", None)
    if s is None:
        s = requests.Session()
        s.headers.update(JSON_HEADERS)
        _session_local.s = s
    return s


def get_json(url: str, *, params: dict | None = None, retries: int = 4, timeout: int = 60):
    last: Exception | None = None
    for attempt in range(retries):
        try:
            r = _session().get(url, params=params, timeout=timeout)
            if r.status_code == 429 or r.status_code >= 500:
                raise RuntimeError(f"HTTP {r.status_code}")
            r.raise_for_status()
            return r.json()
        except Exception as exc:  # noqa: BLE001
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"Falha em {url} {params or ''}: {last}")


def cached_json(url: str, dest: Path, max_age_hours: float):
    download_json = dest.exists() and (time.time() - dest.stat().st_mtime) / 3600 < max_age_hours
    if download_json:
        return json.loads(dest.read_text(encoding="utf-8"))
    dest.parent.mkdir(parents=True, exist_ok=True)
    data = get_json(url)
    dest.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    return data


def camara_lista(params: dict, dest: Path) -> list[dict]:
    """Lista de deputados seguindo a paginação via links 'next'."""
    if dest.exists() and (time.time() - dest.stat().st_mtime) / 3600 < 12:
        return json.loads(dest.read_text(encoding="utf-8"))
    url, p, dados = f"{CAMARA_API}/deputados", dict(params), []
    while url:
        j = get_json(url, params=p)
        dados.extend(j.get("dados", []))
        url = next((lk["href"] for lk in j.get("links", []) if lk.get("rel") == "next"), None)
        p = None  # o link 'next' já carrega os parâmetros
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(dados, ensure_ascii=False), encoding="utf-8")
    return dados


# --------------------------------------------------------------------------------------
# Câmara
# --------------------------------------------------------------------------------------
def camara_detalhes(ids: list[int]) -> dict[str, dict]:
    """Detalhes por deputado (nomeCivil, cpf, ultimoStatus), cache de 7 dias por entrada."""
    cache_path = RAW_CAMARA / "deputados_detalhes.json"
    cache: dict[str, dict] = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text(encoding="utf-8"))
    agora = time.time()
    faltam = [i for i in ids if str(i) not in cache or agora - cache[str(i)].get("_ts", 0) > 7 * 86400]
    if faltam:
        print(f"  Câmara: buscando detalhes de {len(faltam)} deputados na API...")

        def fetch(i: int):
            try:
                d = get_json(f"{CAMARA_API}/deputados/{i}")["dados"]
                d["_ts"] = time.time()
                return str(i), d
            except Exception as exc:  # noqa: BLE001
                print(f"    aviso: detalhes do deputado {i} indisponíveis ({exc})")
                return str(i), None

        with ThreadPoolExecutor(max_workers=8) as ex:
            for k, d in ex.map(fetch, faltam):
                if d is not None:
                    cache[k] = d
        cache_path.write_text(json.dumps(cache, ensure_ascii=False), encoding="utf-8")
    return cache


def camara_ceap() -> pd.DataFrame:
    cols = ["cpf", "ideCadastro", "codLegislatura", "txtDescricao", "txtFornecedor",
            "txtCNPJCPF", "vlrLiquido", "numMes", "numAno", "txNomeParlamentar"]
    frames = []
    for ano in ANOS:
        url = CAMARA_CEAP_URL.format(ano=ano)
        try:
            path = download(url, RAW_CAMARA / f"Ano-{ano}.csv.zip", max_age_hours=max_age(ano))
        except RuntimeError as exc:
            print(f"  aviso: {exc}")
            continue
        with zipfile.ZipFile(path) as z:
            nome = next(n for n in z.namelist() if n.lower().endswith(".csv"))
            df = pd.read_csv(z.open(nome), sep=";", dtype=str, encoding="utf-8-sig",
                             usecols=lambda c: c in cols)
        n0 = len(df)
        if "codLegislatura" in df.columns:
            df = df[df["codLegislatura"].astype(str).str.strip() == str(LEGISLATURA)]
        df = df[df["ideCadastro"].fillna("").str.strip() != ""]  # remove lideranças
        df["vlrLiquido"] = pd.to_numeric(df["vlrLiquido"].str.replace(",", "."), errors="coerce").fillna(0.0)
        # A complementação do auxílio-moradia vem com vlrLiquido negativo (vlrDocumento positivo);
        # o painel oficial da Câmara a exibe como gasto positivo -> usamos o valor absoluto.
        moradia = df["txtDescricao"].map(norm).str.startswith("COMPLEMENTACAO DO AUXILIO-MORADIA")
        df.loc[moradia, "vlrLiquido"] = df.loc[moradia, "vlrLiquido"].abs()
        print(f"  Câmara CEAP {ano}: {n0} linhas no arquivo, {len(df)} de deputados da 57ª")
        frames.append(df)
    df = pd.concat(frames, ignore_index=True)
    df["ideCadastro"] = df["ideCadastro"].str.strip().str.replace(r"\.0$", "", regex=True)
    out = pd.DataFrame({
        "id_casa": df["ideCadastro"],
        "ano": df["numAno"].astype(int),
        "mes": df["numMes"].astype(int),
        "categoria": df["txtDescricao"].map(categoria_camara),
        "fornecedor": df["txtFornecedor"].fillna("").str.strip(),
        "doc_raw": df["txtCNPJCPF"].fillna(""),
        "valor": df["vlrLiquido"],
        "cpf_parl": df["cpf"],
        "nome_csv": df["txNomeParlamentar"],
    })
    return out


def camara_parlamentares(ceap: pd.DataFrame) -> list[dict]:
    leg = camara_lista({"idLegislatura": LEGISLATURA, "itens": 1000}, RAW_CAMARA / "deputados_leg57.json")
    atuais = camara_lista({"itens": 1000}, RAW_CAMARA / "deputados_atuais.json")
    em_exercicio = {str(d["id"]) for d in atuais}
    atual_por_id = {str(d["id"]): d for d in atuais}
    base: dict[str, dict] = {}
    for d in leg:  # lista tem uma linha por filiação; a última sobrescreve
        base[str(d["id"])] = d
    for d in atuais:
        base.setdefault(str(d["id"]), d)

    extras = sorted(set(ceap["id_casa"]) - set(base))
    if extras:
        v = ceap.loc[ceap["id_casa"].isin(extras), "valor"].sum()
        print(f"  Câmara: {len(extras)} ideCadastro com codLegislatura=57 no CEAP mas fora da lista da "
              f"57ª na API (ajustes tardios de deputados da 56ª), ignorados: R$ {v:,.2f}")

    detalhes = camara_detalhes(sorted(int(i) for i in base))

    # CPF a partir do CEAP (mais frequente por ideCadastro), fallback na API
    cpf_ceap = (ceap.dropna(subset=["cpf_parl"]).groupby("id_casa")["cpf_parl"]
                .agg(lambda s: s.value_counts().index[0]).map(so_digitos).to_dict())
    divergentes = 0
    out = []
    for i, d in base.items():
        det = detalhes.get(i) or {}
        st = det.get("ultimoStatus") or {}
        atual = atual_por_id.get(i, {})
        cpf_api = so_digitos(det.get("cpf"))
        cpf = cpf_ceap.get(i) or cpf_api
        if cpf_ceap.get(i) and cpf_api and cpf_ceap[i] != cpf_api:
            divergentes += 1
        out.append({
            "id": f"camara:{i}",
            "casa": "camara",
            "id_casa": i,
            "nome": atual.get("nome") or st.get("nome") or d.get("nome"),
            "nome_civil": (det.get("nomeCivil") or "").strip() or None,
            "partido": atual.get("siglaPartido") or st.get("siglaPartido") or d.get("siglaPartido"),
            "uf": atual.get("siglaUf") or st.get("siglaUf") or d.get("siglaUf"),
            "foto_url": atual.get("urlFoto") or st.get("urlFoto") or d.get("urlFoto"),
            "pagina_oficial": CAMARA_PERFIL.format(id=i),
            "em_exercicio": 1 if i in em_exercicio else 0,
            "cpf": cpf,
        })
    if divergentes:
        print(f"  aviso: {divergentes} deputados com CPF divergente entre CEAP e API (mantido o do CEAP)")
    sem_cpf_ceap = sum(1 for p in out if p["id_casa"] not in cpf_ceap)
    print(f"  Câmara: CPF do CEAP para {len(out) - sem_cpf_ceap} deputados; {sem_cpf_ceap} via API ou ausente")
    return out


def camara_limites() -> list[dict]:
    """Valor mensal da cota por UF, extraído do mapa da página oficial de transparência."""
    try:
        path = download(CAMARA_GASTOS_URL, RAW_CAMARA / "gastos-parlamentares.html", max_age_hours=24)
    except RuntimeError as exc:
        print(f"  aviso: página de limites da Câmara indisponível ({exc})")
        return []
    t = path.read_text(encoding="utf-8", errors="replace")
    ini = t.find("Qual o valor mensal atual da cota por UF")
    if ini < 0:
        print("  aviso: seção de valor da cota por UF não encontrada na página da Câmara")
        return []
    trecho = t[ini:ini + 200_000]
    nome_para_uf = {}
    for m in re.finditer(r'<a [^>]*class="mapa-estado"[^>]*>.*?</a>', trecho, re.S):
        bloco = m.group(0)
        valor = re.search(r'data-content="([\d.]+,\d{2})"', bloco)
        uf = re.search(r"<text[^>]*>\s*([A-Z]{2})\s*</text>", bloco)
        if valor and uf:
            nome_para_uf[uf.group(1)] = float(valor.group(1).replace(".", "").replace(",", "."))
    if len(nome_para_uf) != 27:
        print(f"  aviso: limites da Câmara parseados para {len(nome_para_uf)} UFs (esperado 27); tabela não preenchida")
        return []
    vigencia = f"valor atual publicado em {datetime.fromtimestamp(path.stat().st_mtime).date().isoformat()}"
    return [{"casa": "camara", "uf": uf, "valor_mensal": v, "vigencia": vigencia, "fonte_url": CAMARA_GASTOS_URL}
            for uf, v in sorted(nome_para_uf.items())]


# --------------------------------------------------------------------------------------
# Senado
# --------------------------------------------------------------------------------------
def _lista(obj) -> list:
    if obj is None:
        return []
    return obj if isinstance(obj, list) else [obj]


def senado_listas():
    leg = cached_json(f"{SENADO_LEGIS}/senador/lista/legislatura/{LEGISLATURA}.json",
                      RAW_SENADO / "senadores_leg57.json", 12)
    exe = cached_json(f"{SENADO_LEGIS}/senador/lista/legislatura/{LEGISLATURA}.json?exercicio=S",
                      RAW_SENADO / "senadores_leg57_exercicio.json", 12)
    atu = cached_json(f"{SENADO_LEGIS}/senador/lista/atual.json", RAW_SENADO / "senadores_atuais.json", 12)
    todos = _lista(leg["ListaParlamentarLegislatura"]["Parlamentares"]["Parlamentar"])
    exercicio = _lista(exe["ListaParlamentarLegislatura"]["Parlamentares"]["Parlamentar"])
    atuais = _lista(atu["ListaParlamentarEmExercicio"]["Parlamentares"]["Parlamentar"])
    return todos, exercicio, atuais


def senado_ceaps() -> tuple[pd.DataFrame, str]:
    """CEAPS dos anos da legislatura. Usa a API administrativa (traz codSenador); se falhar,
    usa o CSV da LAI (só nome do senador)."""
    frames, fonte = [], SENADO_CEAPS_API.format(ano="{ano}")
    for ano in ANOS:
        df = None
        dest = RAW_SENADO / f"despesas_ceaps_{ano}.json"
        try:
            data = cached_json(SENADO_CEAPS_API.format(ano=ano), dest, max_age(ano))
            df = pd.DataFrame(data)
            df = pd.DataFrame({
                "ano": df["ano"].astype(int), "mes": df["mes"].astype(int),
                "cod": df["codSenador"].map(lambda x: str(int(x)) if pd.notna(x) else None),
                "nome_csv": df["nomeSenador"], "tipo": df["tipoDespesa"],
                "doc_raw": df["cpfCnpj"], "fornecedor": df["fornecedor"],
                "valor": pd.to_numeric(df["valorReembolsado"], errors="coerce").fillna(0.0),
            })
        except Exception as exc:  # noqa: BLE001
            print(f"  aviso: API CEAPS {ano} falhou ({exc}); usando CSV")
            fonte = SENADO_CEAPS_CSV.format(ano="{ano}")
            path = download(SENADO_CEAPS_CSV.format(ano=ano), RAW_SENADO / f"despesa_ceaps_{ano}.csv",
                            max_age_hours=max_age(ano))
            df = ler_csv_senado(path)
        print(f"  Senado CEAPS {ano}: {len(df)} linhas, R$ {df['valor'].sum():,.2f}")
        frames.append(df)
    return pd.concat(frames, ignore_index=True), fonte


def ler_csv_senado(path: Path) -> pd.DataFrame:
    raw = path.read_bytes()
    try:
        texto = raw.decode("utf-8")
    except UnicodeDecodeError:
        texto = raw.decode("latin-1")
    linhas = texto.splitlines()
    skip = 1 if linhas and "ULTIMA ATUALIZACAO" in norm(linhas[0]) else 0
    df = pd.read_csv(io.StringIO(texto), sep=";", dtype=str, skiprows=skip)
    valor = (df["VALOR_REEMBOLSADO"].fillna("0").str.replace(".", "", regex=False)
             .str.replace(",", ".", regex=False))
    return pd.DataFrame({
        "ano": df["ANO"].astype(int), "mes": df["MES"].astype(int), "cod": None,
        "nome_csv": df["SENADOR"], "tipo": df["TIPO_DESPESA"], "doc_raw": df["CNPJ_CPF"],
        "fornecedor": df["FORNECEDOR"], "valor": pd.to_numeric(valor, errors="coerce").fillna(0.0),
    })


def casar_nomes(nomes: list[str], todos: list[dict], preferidos: set[str]) -> dict[str, str]:
    """Nome do CSV -> CodigoParlamentar: exato (NomeParlamentar/NomeCompleto) e, em seguida,
    todos os tokens do nome do CSV contidos no nome parlamentar ou completo (único)."""
    def toks(s: str) -> set[str]:
        return set(re.sub(r"[^A-Z ]", " ", norm(s)).split()) - {"DA", "DE", "DO", "DAS", "DOS", "E", "DR", "DRA"}

    exato: dict[str, set[str]] = defaultdict(set)
    cand = []
    for p in todos:
        ide = p["IdentificacaoParlamentar"]
        cod = ide["CodigoParlamentar"]
        for k in ("NomeParlamentar", "NomeCompletoParlamentar"):
            exato[norm(ide.get(k))].add(cod)
        cand.append((cod, toks(ide.get("NomeParlamentar", "")), toks(ide.get("NomeCompletoParlamentar", ""))))

    def escolhe(cods: set[str]) -> str | None:
        if len(cods) == 1:
            return next(iter(cods))
        pref = cods & preferidos
        return next(iter(pref)) if len(pref) == 1 else None

    out = {}
    for nome in nomes:
        cod = escolhe(exato.get(norm(nome), set()))
        if cod is None:
            t = toks(nome)
            cods = {c for c, a, b in cand if t and (t <= a or t <= b)}
            cod = escolhe(cods)
        if cod:
            out[nome] = cod
    return out


def senado_parlamentares(ceaps: pd.DataFrame) -> tuple[list[dict], pd.DataFrame, dict]:
    todos, exercicio, atuais = senado_listas()
    em_exercicio = {p["IdentificacaoParlamentar"]["CodigoParlamentar"] for p in atuais}
    # 'exercicio=S' traz quem exerceu em qualquer momento de mandatos que tocam a 57ª (inclusive
    # só na 56ª): mantemos quem teve exercício a partir de 01/02/2023.
    inicio_leg = f"{INICIO_LEGISLATURA[0]}-{INICIO_LEGISLATURA[1]:02d}-01"
    exerceu = set()
    for p in exercicio:
        for m in _lista((p.get("Mandatos") or {}).get("Mandato")):
            for e in _lista((m.get("Exercicios") or {}).get("Exercicio")):
                if (e.get("DataFim") or "9999-12-31") >= inicio_leg:
                    exerceu.add(p["IdentificacaoParlamentar"]["CodigoParlamentar"])

    # Linhas sem código (fallback CSV): casar por nome
    sem_cod = ceaps["cod"].isna()
    if sem_cod.any():
        mapa = casar_nomes(sorted(ceaps.loc[sem_cod, "nome_csv"].dropna().unique()), todos, exerceu)
        ceaps.loc[sem_cod, "cod"] = ceaps.loc[sem_cod, "nome_csv"].map(mapa)

    info: dict[str, dict] = {}
    for fonte in (todos, exercicio, atuais):  # do menos para o mais completo/atual
        for p in fonte:
            ide = p["IdentificacaoParlamentar"]
            cod = ide["CodigoParlamentar"]
            d = info.setdefault(cod, {})
            d.update({k: v for k, v in ide.items() if v})
            mand = _lista((p.get("Mandatos") or {}).get("Mandato")) or _lista(p.get("Mandato"))
            if mand and not d.get("UfParlamentar"):
                d["UfParlamentar"] = mand[-1].get("UfParlamentar")

    com_despesa = set(ceaps["cod"].dropna())
    incluir = (exerceu | em_exercicio | (com_despesa & set(info)))
    nao_casados = ceaps[ceaps["cod"].isna() | ~ceaps["cod"].isin(incluir)]
    resumo_nc = (nao_casados.assign(nome=nao_casados["nome_csv"].fillna("?"))
                 .groupby("nome")["valor"].agg(["sum", "count"]).sort_values("sum", ascending=False))

    # Partido de quem não está mais em exercício e não veio na lista com partido: filiações
    out = []
    for cod in sorted(incluir, key=int):
        d = info.get(cod, {})
        partido = d.get("SiglaPartidoParlamentar")
        if not partido:
            partido = senado_ultimo_partido(cod)
        out.append({
            "id": f"senado:{cod}",
            "casa": "senado",
            "id_casa": cod,
            "nome": d.get("NomeParlamentar") or cod,
            "nome_civil": d.get("NomeCompletoParlamentar"),
            "partido": partido,
            "uf": d.get("UfParlamentar"),
            "foto_url": https(d.get("UrlFotoParlamentar")) or SENADO_FOTO.format(cod=cod),
            "pagina_oficial": https(d.get("UrlPaginaParlamentar")) or SENADO_PERFIL.format(cod=cod),
            "em_exercicio": 1 if cod in em_exercicio else 0,
            "cpf": None,  # o Senado não publica CPF dos senadores nos dados abertos
        })
    return out, resumo_nc, {"exerceu": len(exerceu)}


def senado_ultimo_partido(cod: str) -> str | None:
    try:
        j = cached_json(f"{SENADO_LEGIS}/senador/{cod}/filiacoes.json",
                        RAW_SENADO / "filiacoes" / f"{cod}.json", 24 * 7)
        fil = _lista(j["FiliacaoParlamentar"]["Parlamentar"]["Filiacoes"]["Filiacao"])
        fil.sort(key=lambda f: f.get("DataFiliacao") or "")
        return fil[-1]["Partido"]["SiglaPartido"] if fil else None
    except Exception as exc:  # noqa: BLE001
        print(f"    aviso: filiações do senador {cod} indisponíveis ({exc})")
        return None


# --------------------------------------------------------------------------------------
# Agregações e gravação
# --------------------------------------------------------------------------------------
def agrega(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    mensal = (df.groupby(["parlamentar_id", "ano", "mes", "categoria"], as_index=False)
              .agg(valor=("valor", "sum"), n_documentos=("valor", "size")))
    mensal["valor"] = mensal["valor"].round(2)

    f = df.copy()
    f["cnpj_cpf"] = f["doc_raw"].map(doc_fornecedor)
    f["fornecedor"] = f["fornecedor"].fillna("").str.strip().replace("", "Não informado")
    # Agrupa pelo documento quando válido; senão pelo nome normalizado
    f["chave"] = f["cnpj_cpf"].where(f["cnpj_cpf"].notna(), "N:" + f["fornecedor"].map(norm))
    g = (f.groupby(["parlamentar_id", "ano", "chave"], as_index=False)
         .agg(valor=("valor", "sum"), n_documentos=("valor", "size"),
              fornecedor=("fornecedor", lambda s: s.value_counts().index[0]),
              cnpj_cpf=("cnpj_cpf", "first")))
    g = g.sort_values(["parlamentar_id", "ano", "valor"], ascending=[True, True, False])
    top = g.groupby(["parlamentar_id", "ano"]).head(TOP_FORNECEDORES).copy()
    top["valor"] = top["valor"].round(2)
    return mensal, top[["parlamentar_id", "ano", "fornecedor", "cnpj_cpf", "valor", "n_documentos"]]


SCHEMA = """
DROP TABLE IF EXISTS parlamentares;
DROP TABLE IF EXISTS ceap_mensal;
DROP TABLE IF EXISTS ceap_fornecedor;
DROP TABLE IF EXISTS ceap_limite;
CREATE TABLE parlamentares (
  id TEXT PRIMARY KEY,
  casa TEXT NOT NULL,
  id_casa TEXT NOT NULL,
  nome TEXT NOT NULL,
  nome_civil TEXT,
  partido TEXT,
  uf TEXT,
  foto_url TEXT,
  pagina_oficial TEXT,
  em_exercicio INTEGER NOT NULL,
  cpf TEXT
);
CREATE TABLE ceap_mensal (
  parlamentar_id TEXT NOT NULL, ano INTEGER NOT NULL, mes INTEGER NOT NULL,
  categoria TEXT NOT NULL,
  valor REAL NOT NULL, n_documentos INTEGER NOT NULL
);
CREATE TABLE ceap_fornecedor (
  parlamentar_id TEXT NOT NULL, ano INTEGER NOT NULL,
  fornecedor TEXT NOT NULL, cnpj_cpf TEXT, valor REAL NOT NULL, n_documentos INTEGER NOT NULL
);
CREATE TABLE ceap_limite (
  casa TEXT NOT NULL, uf TEXT NOT NULL, valor_mensal REAL NOT NULL, vigencia TEXT, fonte_url TEXT NOT NULL
);
CREATE INDEX idx_ceap_mensal_parl ON ceap_mensal (parlamentar_id);
CREATE INDEX idx_ceap_fornecedor_parl ON ceap_fornecedor (parlamentar_id);
CREATE INDEX idx_parlamentares_casa ON parlamentares (casa);
CREATE INDEX idx_parlamentares_cpf ON parlamentares (cpf);
"""


def na_legislatura(df: pd.DataFrame) -> pd.Series:
    return (df["ano"] * 100 + df["mes"]) >= INICIO_LEGISLATURA[0] * 100 + INICIO_LEGISLATURA[1]


def main() -> None:
    inicio = time.time()
    print("== Câmara dos Deputados")
    ceap_c = camara_ceap()
    parl_c = camara_parlamentares(ceap_c)
    ceap_c["parlamentar_id"] = "camara:" + ceap_c["id_casa"]
    ceap_c = ceap_c[ceap_c["parlamentar_id"].isin({p["id"] for p in parl_c})]
    limites = camara_limites()

    print("== Senado Federal")
    ceap_s, fonte_s = senado_ceaps()
    antes = ceap_s[~na_legislatura(ceap_s)]
    if len(antes):
        print(f"  Senado: {len(antes)} linhas de jan/2023 (56ª legislatura) descartadas, "
              f"R$ {antes['valor'].sum():,.2f}")
    ceap_s = ceap_s[na_legislatura(ceap_s)].copy()
    parl_s, nao_casados, _ = senado_parlamentares(ceap_s)
    ids_s = {p["id_casa"] for p in parl_s}
    ceap_s = ceap_s[ceap_s["cod"].isin(ids_s)].copy()
    ceap_s["parlamentar_id"] = "senado:" + ceap_s["cod"]
    ceap_s["categoria"] = ceap_s["tipo"].map(categoria_senado)

    cols = ["parlamentar_id", "ano", "mes", "categoria", "fornecedor", "doc_raw", "valor"]
    todas = pd.concat([ceap_c[cols], ceap_s[cols]], ignore_index=True)
    mensal, fornecedores = agrega(todas)

    conn = connect()
    with conn:
        conn.executescript(SCHEMA)
        campos = ["id", "casa", "id_casa", "nome", "nome_civil", "partido", "uf", "foto_url",
                  "pagina_oficial", "em_exercicio", "cpf"]
        conn.executemany(f"INSERT INTO parlamentares ({','.join(campos)}) VALUES ({','.join('?' * len(campos))})",
                         [tuple(p[c] for c in campos) for p in parl_c + parl_s])
        conn.executemany("INSERT INTO ceap_mensal VALUES (?,?,?,?,?,?)",
                         mensal[["parlamentar_id", "ano", "mes", "categoria", "valor", "n_documentos"]]
                         .itertuples(index=False, name=None))
        conn.executemany("INSERT INTO ceap_fornecedor VALUES (?,?,?,?,?,?)",
                         [(a, int(b), c, d if isinstance(d, str) else None, float(e), int(f))
                          for a, b, c, d, e, f in fornecedores.itertuples(index=False, name=None)])
        conn.executemany("INSERT INTO ceap_limite VALUES (?,?,?,?,?)",
                         [(l["casa"], l["uf"], l["valor_mensal"], l["vigencia"], l["fonte_url"]) for l in limites])
        set_meta(conn, "parlamentares_atualizado_em", datetime.now().astimezone().isoformat(timespec="seconds"))
        set_meta(conn, "ceap_fonte_camara", CAMARA_CEAP_URL)
        set_meta(conn, "ceap_fonte_senado", fonte_s)
        set_meta(conn, "ceap_observacao_camara",
                 "Arquivos anuais oficiais da CEAP; valores líquidos (vlrLiquido) de deputados da 57ª "
                 "legislatura; despesas de lideranças não incluídas.")
    conn.commit()

    # ---------------- Resumo ----------------
    print("\n== Resumo")
    for casa in ("camara", "senado"):
        n, ex, cpf = conn.execute(
            "SELECT COUNT(*), SUM(em_exercicio), SUM(cpf IS NOT NULL) FROM parlamentares WHERE casa=?",
            (casa,)).fetchone()
        print(f"  {casa}: {n} parlamentares, {ex} em exercício, {cpf} com CPF")
    for t in ("parlamentares", "ceap_mensal", "ceap_fornecedor", "ceap_limite"):
        print(f"  {t}: {conn.execute(f'SELECT COUNT(*) FROM {t}').fetchone()[0]} linhas")
    print("  Total CEAP por casa/ano (R$):")
    for casa, ano, v, n in conn.execute(
            "SELECT substr(parlamentar_id,1,instr(parlamentar_id,':')-1) casa, ano, SUM(valor), SUM(n_documentos) "
            "FROM ceap_mensal GROUP BY casa, ano ORDER BY casa, ano"):
        print(f"    {casa} {ano}: {v:>16,.2f}  ({n} documentos)")
    sem_desp = conn.execute("SELECT COUNT(*) FROM parlamentares p WHERE NOT EXISTS "
                            "(SELECT 1 FROM ceap_mensal m WHERE m.parlamentar_id=p.id)").fetchone()[0]
    print(f"  Parlamentares sem nenhuma despesa CEAP na legislatura: {sem_desp}")
    if len(nao_casados):
        print(f"  Senado: nomes não associados a senador da 57ª: {len(nao_casados)} "
              f"(R$ {nao_casados['sum'].sum():,.2f})")
        for nome, r in nao_casados.iterrows():
            print(f"    {nome}: R$ {r['sum']:,.2f} em {int(r['count'])} documentos")
    else:
        print("  Senado: todas as despesas associadas a um senador da 57ª legislatura")
    print(f"  Limites: {len(limites)} UFs (Câmara) de {CAMARA_GASTOS_URL}" if limites else
          "  Limites: tabela ceap_limite vazia")
    print(f"Concluído em {time.time() - inicio:.0f}s -> {common.DB_PATH}")
    conn.close()


# Entrada padrão usada por etl.run_all
run = main


if __name__ == "__main__":
    main()
