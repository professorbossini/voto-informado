"""Perfil do Congresso eleito: quem foi eleito em 2026 para a Câmara dos Deputados, o Senado e as
Assembleias Legislativas, comparado com 2022 (gênero, faixa etária, cor/raça, grau de instrução,
ocupações e renovação). Só contagens: nenhum nome é gravado. Roda sozinho no GitHub Actions
(.github/workflows/perfil-eleitos.yml), direto sobre o site publicado.

Fontes (oficiais, dados abertos do TSE, latin-1 separado por ";"):
  consulta_cand_<ano>.zip              candidaturas de cada eleição geral, com gênero, cor/raça,
                                       grau de instrução, ocupação, data de nascimento e a situação
                                       na totalização (DS_SIT_TOT_TURNO: Eleito, Eleito por QP,
                                       Eleito por média). Anos usados: 2026 e 2022 (perfil) e
                                       2018 e 2014 (só para saber quem já tinha sido eleito antes).
  consulta_cand_complementar_<ano>.zip ST_REELEICAO ("concorre à reeleição"), declarado no registro.
                                       Em 2026 o TSE ainda não preencheu (#NE); quando preencher,
                                       a contagem aparece sozinha.

Privacidade: o arquivo é lido só com as colunas da lista COLUNAS (CPF, título de eleitor e e-mail
nunca saem do ZIP). A data de nascimento serve apenas para a idade na posse (1º de fevereiro do ano
seguinte) e não é gravada; os nomes servem apenas para casar quem já tinha sido eleito antes.

Renovação (o mesmo critério nos dois anos, ver CRITERIO_RENOVACAO): é reeleito quem, eleito agora,
tinha sido eleito para a mesma Casa, na mesma UF, na eleição anterior (no Senado, em qualquer das
duas anteriores, porque o mandato é de 8 anos). O casamento é pelo nome completo, pelo nome social
ou pelo nome de urna, sem acentos, dentro da mesma Casa e UF.

Completo: o arquivo do site api/eleitos.json (totalização, etl.eleitos) diz se a totalização de 2026
terminou em todas as UFs; sem ele, vale o número de eleitos igual ao de vagas.

Grava: api/perfil-eleitos.json
Uso: python -m etl.perfil_eleitos <site> [--zips pasta]   (saída: mudou=1|0)
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import statistics
import sys
import time
import unicodedata
import zipfile
from collections import Counter
from datetime import date, datetime
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Iterable
from zoneinfo import ZoneInfo

import requests

TSE_CDN = "https://cdn.tse.jus.br/estatistica/sead/odsele"
URL_CAND = TSE_CDN + "/consulta_cand/consulta_cand_{ano}.zip"
URL_COMPL = TSE_CDN + "/consulta_cand_complementar/consulta_cand_complementar_{ano}.zip"
PAGINA_TSE = "https://dadosabertos.tse.jus.br/dataset/candidatos-{ano}"
UA = {"User-Agent": "Mozilla/5.0 (compatible; tanaurna/1.0; dados abertos)"}

ANO = 2026
ANTERIOR = 2022

# Só estas colunas são lidas (CPF, título e e-mail ficam de fora desde a leitura).
COLUNAS = (
    "ANO_ELEICAO", "CD_TIPO_ELEICAO", "SG_UF", "DS_CARGO", "SQ_CANDIDATO", "NM_CANDIDATO", "NM_URNA_CANDIDATO",
    "NM_SOCIAL_CANDIDATO", "DT_NASCIMENTO", "DS_GENERO", "DS_GRAU_INSTRUCAO", "DS_COR_RACA", "DS_OCUPACAO", "DS_SIT_TOT_TURNO",
)
COLUNAS_COMPL = ("SQ_CANDIDATO", "ST_REELEICAO")

CASAS = {
    "DEPUTADO FEDERAL": "camara",
    "SENADOR": "senado",
    "DEPUTADO ESTADUAL": "assembleias",
    "DEPUTADO DISTRITAL": "assembleias",  # Câmara Legislativa do DF, somada às Assembleias
}
NOMES_CASAS = {"camara": "Câmara dos Deputados", "senado": "Senado Federal", "assembleias": "Assembleias Legislativas e Câmara Legislativa do DF"}
ELEITO = {"ELEITO", "ELEITO POR QP", "ELEITO POR MÉDIA"}
NULOS = {"", "#NULO", "#NULO#", "#NE", "-1", "-3", "-4", "NÃO DIVULGÁVEL", "NÃO INFORMADO"}
NAO_INFORMADO = "Não informado"

FAIXAS = ["18–29", "30–39", "40–49", "50–59", "60–69", "70+"]  # as mesmas de "Em números"
ORDEM_INSTRUCAO = [
    "Analfabeto", "Lê e escreve", "Ensino fundamental incompleto", "Ensino fundamental completo",
    "Ensino médio incompleto", "Ensino médio completo", "Superior incompleto", "Superior completo",
]
TOP_OCUPACOES = 10

CRITERIO_RENOVACAO = (
    "Reeleito: eleito nesta eleição que também tinha sido eleito para a mesma Casa, pela mesma UF, na eleição "
    "anterior (no Senado, em qualquer das duas anteriores, porque o mandato é de 8 anos), segundo os arquivos de "
    "candidaturas do TSE. A pessoa é reconhecida pelo nome completo, nome social ou nome de urna (sem acentos), "
    "dentro da mesma Casa e UF. Novo: todos os demais, inclusive quem já foi parlamentar em outra Casa ou em "
    "mandatos mais antigos e quem exerceu o mandato como suplente sem ter sido eleito titular. É o mesmo critério "
    "em 2022 e em 2026. À parte, quando o TSE publica, mostramos quantos eleitos declararam no registro que "
    "concorriam à reeleição (campo ST_REELEICAO, que inclui suplentes no exercício do mandato); para 2026 o TSE "
    "ainda não preencheu esse campo."
)
CRITERIO_IDADE = "Idade em anos completos na posse, em 1º de fevereiro do ano seguinte à eleição, calculada pela data de nascimento informada ao TSE (que não é publicada aqui)."
CRITERIO_ELEITOS = "Eleitos: situação Eleito, Eleito por QP ou Eleito por média no arquivo de candidaturas do TSE, só na eleição geral ordinária (sem eleições suplementares)."
CRITERIO_SENADO = (
    "O Senado renova 1/3 das cadeiras (27) e 2/3 (54) em eleições alternadas: em 2022 foram eleitos 27 senadores; "
    "em 2026, 54. A composição completa soma os eleitos na eleição com os eleitos 4 anos antes, que continuam no "
    "mandato (titulares eleitos; suplentes em exercício não entram)."
)


class FonteIndisponivel(RuntimeError):
    pass


# ── leitura ──────────────────────────────────────────────────────────────────


def norm(texto: str | None) -> str:
    texto = unicodedata.normalize("NFKD", texto or "").encode("ascii", "ignore").decode()
    return " ".join(texto.upper().split())


def rotulo(valor: str | None) -> str:
    """'SUPERIOR COMPLETO' → 'Superior completo' (como no resto do site); vazios → 'Não informado'."""
    v = (valor or "").strip()
    if v.upper() in NULOS:
        return NAO_INFORMADO
    return v[:1].upper() + v[1:].lower()


def nascimento(texto: str | None) -> date | None:
    try:
        return datetime.strptime((texto or "").strip(), "%d/%m/%Y").date()
    except ValueError:
        return None


def idade(nasc: date | None, ref: date) -> int | None:
    if not nasc:
        return None
    return ref.year - nasc.year - ((ref.month, ref.day) < (nasc.month, nasc.day))


def faixa(i: int | None) -> str:
    if i is None:
        return NAO_INFORMADO
    return "18–29" if i < 30 else "30–39" if i < 40 else "40–49" if i < 50 else "50–59" if i < 60 else "60–69" if i < 70 else "70+"


def posse(ano: int) -> date:
    return date(ano + 1, 2, 1)


def vagas(casa: str, ano: int) -> int:
    if casa == "camara":
        return 513
    if casa == "assembleias":
        return 1059  # 1.035 deputados estaduais + 24 distritais
    return 54 if ano % 8 == 2 else 27  # 2018, 2026: 2/3; 2022: 1/3


def eleitos(linhas: Iterable[dict], ano: int) -> list[dict]:
    """Eleitos para Câmara, Senado e Assembleias na eleição geral ordinária do ano."""
    out = []
    for r in linhas:
        casa = CASAS.get((r.get("DS_CARGO") or "").strip().upper())
        if not casa or (r.get("DS_SIT_TOT_TURNO") or "").strip().upper() not in ELEITO:
            continue
        if str(r.get("ANO_ELEICAO")) != str(ano) or (r.get("CD_TIPO_ELEICAO") or "2") != "2":
            continue
        nomes = {norm(r.get(c)) for c in ("NM_CANDIDATO", "NM_SOCIAL_CANDIDATO", "NM_URNA_CANDIDATO")}
        out.append({
            "sq": r.get("SQ_CANDIDATO"),
            "casa": casa,
            "uf": r.get("SG_UF"),
            "nomes": {n for n in nomes if n and n not in {norm(x) for x in NULOS}},
            "nascimento": nascimento(r.get("DT_NASCIMENTO")),  # só em memória
            "genero": rotulo(r.get("DS_GENERO")),
            "cor_raca": rotulo(r.get("DS_COR_RACA")),
            "instrucao": rotulo(r.get("DS_GRAU_INSTRUCAO")),
            "ocupacao": rotulo(r.get("DS_OCUPACAO")),
        })
    return out


def chaves(e: dict) -> set[tuple[str, str, str]]:
    return {(e["casa"], e["uf"], n) for n in e["nomes"]}


# ── contagens ────────────────────────────────────────────────────────────────


def _lista(cont: Counter, ordem: list[str] | None = None) -> list[dict]:
    """Categorias conhecidas na ordem dada; as outras em ordem alfabética; 'Não informado' por último."""
    ordem = ordem or []
    pos = {k: i for i, k in enumerate(ordem)}

    def chave(k: str):
        return (k == NAO_INFORMADO, k not in pos, pos.get(k, 0), norm(k))

    return [{"nome": k, "n": cont[k]} for k in sorted(cont, key=chave)]


def perfil(grupo: list[dict], ref: date) -> dict:
    idades = [i for i in (idade(e["nascimento"], ref) for e in grupo) if i is not None]
    faixas = Counter(faixa(idade(e["nascimento"], ref)) for e in grupo)
    ocup = Counter(e["ocupacao"] for e in grupo)
    top = sorted(ocup.items(), key=lambda kv: (-kv[1], norm(kv[0])))[:TOP_OCUPACOES]
    return {
        "total": len(grupo),
        "genero": _lista(Counter(e["genero"] for e in grupo)),
        "faixa_etaria": [{"nome": f, "n": faixas[f]} for f in FAIXAS] + ([{"nome": NAO_INFORMADO, "n": faixas[NAO_INFORMADO]}] if faixas[NAO_INFORMADO] else []),
        "idade_mediana": statistics.median(idades) if idades else None,
        "cor_raca": _lista(Counter(e["cor_raca"] for e in grupo)),
        "instrucao": _lista(Counter(e["instrucao"] for e in grupo), ORDEM_INSTRUCAO),
        "ocupacoes": [{"nome": k, "n": n} for k, n in top],
        "ocupacoes_outras": len(grupo) - sum(n for _, n in top),
    }


def renovacao(grupo: list[dict], anteriores: set, declarou: dict[str, str] | None) -> dict:
    reeleitos = sum(1 for e in grupo if chaves(e) & anteriores)
    out = {"reeleitos": reeleitos, "novos": len(grupo) - reeleitos, "declararam_reeleicao": None}
    if declarou:  # só quando o TSE preencheu ST_REELEICAO (S/N) neste ano
        out["declararam_reeleicao"] = sum(1 for e in grupo if declarou.get(e["sq"]) == "S")
    return out


def st_reeleicao(linhas: Iterable[dict]) -> dict[str, str] | None:
    """SQ → S/N; None se o campo ainda não foi preenchido pelo TSE (#NE em todas as linhas)."""
    m = {r["SQ_CANDIDATO"]: (r.get("ST_REELEICAO") or "").strip().upper() for r in linhas}
    return m if any(v in ("S", "N") for v in m.values()) else None


def montar(por_ano: dict[int, list[dict]], declarou: dict[int, dict | None], eleitos_site: dict | None, fontes: list[dict]) -> dict:
    """por_ano: eleitos de ANO, ANTERIOR e das duas eleições antes (para a renovação)."""
    casas = {}
    completo_geral = True
    for casa in ("camara", "senado", "assembleias"):
        anos = {}
        for ano in (ANTERIOR, ANO):
            grupo = [e for e in por_ano.get(ano, []) if e["casa"] == casa]
            previas = [ano - 4, ano - 8] if casa == "senado" else [ano - 4]
            anteriores = {k for a in previas for e in por_ano.get(a, []) if e["casa"] == casa for k in chaves(e)}
            p = perfil(grupo, posse(ano))
            p["vagas"] = vagas(casa, ano)
            p["renovacao"] = renovacao(grupo, anteriores, declarou.get(ano))
            p["posse"] = posse(ano).isoformat()
            anos[str(ano)] = p
        # Totalização de 2026: o eleitos.json diz se terminou; sem ele, conta de eleitos = vagas.
        completo = anos[str(ANO)]["total"] == anos[str(ANO)]["vagas"]
        if eleitos_site:
            if casa == "assembleias":
                completo = completo and all(a.get("completo") for a in (eleitos_site.get("assembleias") or {}).values())
            else:
                completo = completo and bool((eleitos_site.get(casa) or {}).get("completo"))
        completo_geral &= completo
        casas[casa] = {"nome": NOMES_CASAS[casa], "completo": completo, "anos": anos}

    # Senado inteiro em cada legislatura: eleitos no ano + eleitos 4 anos antes (mandato de 8 anos).
    composicao = {}
    for ano in (ANTERIOR, ANO):
        grupo = [e for a in (ano, ano - 4) for e in por_ano.get(a, []) if e["casa"] == "senado"]
        p = perfil(grupo, posse(ano))
        p["vagas"] = 81
        p["eleitos_em"] = [ano - 4, ano]
        p["posse"] = posse(ano).isoformat()
        composicao[str(ano)] = p
    casas["senado"]["composicao"] = composicao

    return {
        "eleicao": ANO,
        "comparacao": ANTERIOR,
        "completo": completo_geral,
        "casas": casas,
        "criterio": {
            "eleitos": CRITERIO_ELEITOS,
            "renovacao": CRITERIO_RENOVACAO,
            "idade": CRITERIO_IDADE,
            "senado": CRITERIO_SENADO,
            "ocupacoes": f"As {TOP_OCUPACOES} ocupações mais declaradas, com o nome usado pelo TSE (“Outros” é uma categoria do próprio TSE).",
        },
        "fontes": fontes,
    }


# ── arquivos do TSE ──────────────────────────────────────────────────────────


def _iso_http(data_http: str | None) -> str | None:
    try:
        return parsedate_to_datetime(data_http).astimezone(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds") if data_http else None
    except (TypeError, ValueError):
        return None


def obter_zip(url: str, pasta: Path | None) -> tuple[zipfile.ZipFile, str | None]:
    """ZIP do TSE (da pasta local, se já baixado; senão da CDN), com a data de publicação."""
    local = pasta / url.rsplit("/", 1)[1] if pasta else None
    if local and local.exists():
        publicado = datetime.fromtimestamp(local.stat().st_mtime, ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds")
        return zipfile.ZipFile(local), publicado
    for tentativa in range(4):
        try:
            r = requests.get(url, headers=UA, timeout=(15, 300))
            if r.status_code == 200 and r.content[:2] == b"PK":
                if local:
                    local.parent.mkdir(parents=True, exist_ok=True)
                    local.write_bytes(r.content)
                return zipfile.ZipFile(io.BytesIO(r.content)), _iso_http(r.headers.get("Last-Modified"))
            erro = f"HTTP {r.status_code}"
        except requests.RequestException as exc:
            erro = str(exc)
        time.sleep(5 * (tentativa + 1))
    raise FonteIndisponivel(f"{url}: {erro}")


def ler_csv(zf: zipfile.ZipFile, colunas: tuple[str, ...]) -> Iterable[dict]:
    """Planilha nacional (_BRASIL.csv) só com as colunas pedidas."""
    nome = next((n for n in zf.namelist() if n.upper().endswith("_BRASIL.CSV")), None)
    if not nome:
        raise FonteIndisponivel("arquivo _BRASIL.csv não está no ZIP do TSE (mudou o formato?)")
    with zf.open(nome) as fh:
        leitor = csv.reader(io.TextIOWrapper(fh, encoding="latin-1", newline=""), delimiter=";")
        cab = next(leitor)
        faltam = [c for c in colunas if c not in cab and c != "NM_SOCIAL_CANDIDATO"]
        if faltam:
            raise FonteIndisponivel(f"colunas {faltam} não estão em {nome} (mudou o formato?)")
        idx = [(c, cab.index(c)) for c in colunas if c in cab]
        for linha in leitor:
            yield {c: linha[i] for c, i in idx if i < len(linha)}


def run(site: Path, pasta: Path | None = None) -> bool:
    api = site / "api"
    destino = api / "perfil-eleitos.json"
    anterior = json.loads(destino.read_text(encoding="utf-8")) if destino.exists() else None
    eleitos_site = json.loads((api / "eleitos.json").read_text(encoding="utf-8")) if (api / "eleitos.json").exists() else None

    por_ano: dict[int, list[dict]] = {}
    declarou: dict[int, dict | None] = {}
    fontes = []
    for ano in (ANO, ANTERIOR, ANO - 8, ANTERIOR - 8):  # 2026, 2022, 2018, 2014
        url = URL_CAND.format(ano=ano)
        zf, publicado = obter_zip(url, pasta)
        with zf:
            por_ano[ano] = eleitos(ler_csv(zf, COLUNAS), ano)
        fontes.append({
            "nome": f"Candidatos {ano}",
            "orgao": "Tribunal Superior Eleitoral (TSE)",
            "url": url,
            "pagina": PAGINA_TSE.format(ano=ano),
            "publicado_em": publicado,
            "uso": "perfil e renovação" if ano in (ANO, ANTERIOR) else "renovação (eleitos na eleição anterior)",
        })
    for ano in (ANO, ANTERIOR):
        url = URL_COMPL.format(ano=ano)
        zf, publicado = obter_zip(url, pasta)
        with zf:
            declarou[ano] = st_reeleicao(ler_csv(zf, COLUNAS_COMPL))
        fontes.append({
            "nome": f"Candidatos {ano}: informações complementares",
            "orgao": "Tribunal Superior Eleitoral (TSE)",
            "url": url,
            "pagina": PAGINA_TSE.format(ano=ano),
            "publicado_em": publicado,
            "uso": "declaração de candidatura à reeleição (ST_REELEICAO)",
        })
    if not por_ano[ANO] or not por_ano[ANTERIOR]:
        raise FonteIndisponivel("nenhum eleito encontrado no arquivo do TSE")

    dados = montar(por_ano, declarou, eleitos_site, fontes)
    # A data de publicação muda sem mudar o conteúdo: só regrava quando as contagens mudam.
    sem_datas = lambda d: {k: v for k, v in d.items() if k not in ("gerado_em", "fontes")}  # noqa: E731
    if anterior and sem_datas(anterior) == sem_datas(dados):
        print("perfil-eleitos: sem mudança")
        return False
    dados["gerado_em"] = datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds")
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_text(json.dumps(dados, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    resumo = {c: {a: v["total"] for a, v in d["anos"].items()} for c, d in dados["casas"].items()}
    print(f"perfil-eleitos: {json.dumps(resumo)} completo={dados['completo']}")
    return True


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("site", type=Path)
    ap.add_argument("--zips", type=Path, default=None, help="pasta com os ZIPs do TSE já baixados (teste local)")
    a = ap.parse_args()
    try:
        mudou = run(a.site, a.zips)
    except FonteIndisponivel as exc:
        # Mantém o que está publicado; o job falha para o aviso aparecer no GitHub.
        print(f"::error title=Perfil do Congresso eleito (TSE)::{exc}. Nada foi alterado no site.")
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
                f.write(f"⚠ Perfil do Congresso eleito: {exc}. O site mantém os dados anteriores.\n")
        return 1
    print(f"mudou={int(mudou)}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"mudou={int(mudou)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
