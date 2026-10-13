"""Candidaturas federais e finanças de campanha (FEC, Federal Election Commission).

Fontes oficiais (arquivos em massa, sem chave de acesso; atualizados pela FEC todos os dias):
  cn<aa>.zip      Candidate master: cada candidatura registrada (cargo, estado, distrito, ano da
                  eleição, partido, incumbente/desafiante/vaga aberta, situação do registro)
  weball<aa>.zip  All candidates: totais declarados no ciclo de dois anos (receitas, despesas, caixa,
                  dívidas, doações de pessoas físicas no total, recursos próprios e empréstimos)
  Dicionários: https://www.fec.gov/campaign-finance-data/candidate-master-file-description/
               https://www.fec.gov/campaign-finance-data/all-candidates-file-description/

O que NÃO usamos, de propósito: a lista de doadores pessoas físicas (nome, endereço, empregador).
A lei americana (52 U.S.C. § 30111(a)(4)) proíbe usar esses dados para pedir doações ou para fins
comerciais; aqui só entram TOTAIS por candidatura. O endereço de correspondência da candidatura
que consta no cn.txt também não é publicado.

Atenção (dito na página): a FEC registra quem se declara candidato(a) e movimenta recursos; ela NÃO
informa quem está na cédula de novembro (isso é decidido pelas primárias e pelas regras de cada
estado). Por isso a lista inclui quem perdeu primárias ou desistiu.

Grava:
  api/eua/candidatos/<UF>.json        candidaturas de <ano> à Câmara e ao Senado no estado, com finanças
  api/eua/candidatos/resumo.json      contagem e totais por estado e cargo, cadeiras em disputa
  api/eua/fec/membro/<bioguide>.json  finanças de campanha de cada parlamentar em exercício
"""

from __future__ import annotations

import io
import re
import zipfile
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from .comum import (
    DOMINIO_PUBLICO,
    ESTADOS,
    ET,
    TERRITORIOS,
    agora,
    baixar,
    fonte,
    gravar,
    gravar_se_mudou,
    ler,
    publicado_em,
)

BULK = "https://www.fec.gov/files/bulk-downloads/{ano}/{arq}{aa}.zip"
PAGINA_BULK = "https://www.fec.gov/data/browse-data/?tab=bulk-data"
CANDIDATO = "https://www.fec.gov/data/candidate/{id}/?cycle={ciclo}"

# Códigos de partido usados pela FEC (https://www.fec.gov/campaign-finance-data/party-code-descriptions/).
PARTIDOS_FEC = {
    "DEM": "Democrata", "REP": "Republicano", "LIB": "Libertário", "GRE": "Verde", "IND": "Independente",
    "NPA": "Sem partido", "NNE": "Nenhum", "UNK": "Não informado", "CON": "Constitution", "OTH": "Outro",
    "W": "Write-in", "DFL": "Democrata (Minnesota: Democratic-Farmer-Labor)", "REF": "Reform", "NOP": "Sem partido",
    "AIP": "American Independent", "IAP": "Independent American", "FWP": "Forward", "WFP": "Working Families",
    "PAF": "Peace and Freedom", "SWP": "Socialist Workers", "SOC": "Socialista", "NLP": "Natural Law", "UN": "Não filiado",
}
SITUACAO_ICI = {"I": "incumbente", "C": "desafiante", "O": "vaga aberta"}
STATUS = {"C": "candidatura oficializada na FEC", "F": "para eleição futura", "N": "ainda não oficializada", "P": "de ciclo anterior"}

# Colunas (sem cabeçalho nos arquivos; ordem do dicionário oficial da FEC).
CN = ["CAND_ID", "CAND_NAME", "CAND_PTY_AFFILIATION", "CAND_ELECTION_YR", "CAND_OFFICE_ST", "CAND_OFFICE", "CAND_OFFICE_DISTRICT",
      "CAND_ICI", "CAND_STATUS", "CAND_PCC", "CAND_ST1", "CAND_ST2", "CAND_CITY", "CAND_ST", "CAND_ZIP"]
WEBALL = ["CAND_ID", "CAND_NAME", "CAND_ICI", "PTY_CD", "CAND_PTY_AFFILIATION", "TTL_RECEIPTS", "TRANS_FROM_AUTH", "TTL_DISB",
          "TRANS_TO_AUTH", "COH_BOP", "COH_COP", "CAND_CONTRIB", "CAND_LOANS", "OTHER_LOANS", "CAND_LOAN_REPAY", "OTHER_LOAN_REPAY",
          "DEBTS_OWED_BY", "TTL_INDIV_CONTRIB", "CAND_OFFICE_ST", "CAND_OFFICE_DISTRICT", "SPEC_ELECTION", "PRIM_ELECTION",
          "RUN_ELECTION", "GEN_ELECTION", "GEN_ELECTION_PRECENT", "OTHER_POL_CMTE_CONTRIB", "POL_PTY_CONTRIB", "CVG_END_DT",
          "INDIV_REFUNDS", "CMTE_REFUNDS"]


def ciclo_atual(hoje: datetime | None = None) -> int:
    """Ciclo eleitoral de dois anos (termina no ano par)."""
    a = (hoje or datetime.now(ET)).year
    return a if a % 2 == 0 else a + 1


def _zip_linhas(conteudo: bytes, colunas: list[str]) -> list[dict]:
    with zipfile.ZipFile(io.BytesIO(conteudo)) as z:
        nome = next(n for n in z.namelist() if n.endswith(".txt"))
        texto = z.read(nome).decode("latin-1")
    out = []
    for linha in texto.splitlines():
        partes = linha.split("|")
        if len(partes) >= len(colunas) - 1:
            out.append(dict(zip(colunas, (p.strip() for p in partes))))
    return out


def _num(v: str | None) -> float | None:
    try:
        return round(float(v), 2) if v not in (None, "") else None
    except ValueError:
        return None


def nome_legivel(nome_fec: str) -> str:
    """'PELTOLA, MARY S. MRS.' → 'Mary S. Peltola' (só ordem e maiúsculas; o texto oficial segue ao lado)."""
    tratamentos = {"MR", "MRS", "MS", "DR", "HON", "SEN", "SENATOR", "REP", "REPRESENTATIVE", "GOV", "JUDGE", "REV", "PROF", "COL", "GEN", "SGT", "CPT", "MAJ", "LT"}
    if "," in nome_fec:
        sob, resto = nome_fec.split(",", 1)
        palavras = [p for p in resto.split() if p.upper().rstrip(".") not in tratamentos]
        sufixos = [p for p in palavras if p.upper().rstrip(".") in ("JR", "SR", "II", "III", "IV")]
        palavras = [p for p in palavras if p not in sufixos]
        nome = " ".join([*palavras, sob.strip(), *sufixos])
    else:
        nome = nome_fec
    def palavra(x: str) -> str:
        m = re.match(r"^([^A-Za-z]*)(.*)$", x)
        pre, resto = m.group(1), m.group(2).lower()
        if resto.startswith("mc") and len(resto) > 2:
            return pre + "Mc" + resto[2:3].upper() + resto[3:]
        return pre + resto[:1].upper() + resto[1:]

    def cap(p: str) -> str:
        if p.upper().rstrip(".") in ("II", "III", "IV") or re.fullmatch(r"([A-Za-z]\.)+", p):
            return p.upper()  # algarismos romanos e iniciais (H.W.)
        return "-".join("'".join(palavra(x) for x in s.split("'")) for s in p.split("-"))
    return " ".join(cap(p) for p in nome.split())


def _data_cobertura(v: str | None) -> str | None:
    try:
        return datetime.strptime(v or "", "%m/%d/%Y").date().isoformat()
    except ValueError:
        return None


def _financas(w: dict | None) -> dict | None:
    if not w:
        return None
    return {
        "receitas": _num(w["TTL_RECEIPTS"]),
        "despesas": _num(w["TTL_DISB"]),
        "caixa": _num(w["COH_COP"]),
        "dividas": _num(w["DEBTS_OWED_BY"]),
        "pessoas_fisicas": _num(w["TTL_INDIV_CONTRIB"]),
        "outros_comites": _num(w["OTHER_POL_CMTE_CONTRIB"]),
        "partido": _num(w["POL_PTY_CONTRIB"]),
        "proprio": _num(w["CAND_CONTRIB"]),
        "emprestimos_proprios": _num(w["CAND_LOANS"]),
        "ate": _data_cobertura(w["CVG_END_DT"]),
    }


def montar(api: Path) -> tuple[bool, list[dict]]:
    ciclo = ciclo_atual()
    aa = str(ciclo)[2:]
    r_cn = baixar(BULK.format(ano=ciclo, arq="cn", aa=aa))
    r_cn.raise_for_status()
    r_w = baixar(BULK.format(ano=ciclo, arq="weball", aa=aa))
    r_w.raise_for_status()
    cn = _zip_linhas(r_cn.content, CN)
    weball = {w["CAND_ID"]: w for w in _zip_linhas(r_w.content, WEBALL)}

    # Vínculo FEC → parlamentar em exercício (códigos da compilação congress-legislators).
    fec_bio: dict[str, str] = {}
    membros = {}
    for p in (api / "membro").glob("*.json"):
        d = ler(p) or {}
        membros[d.get("id")] = d
        for f in d.get("fec") or []:
            fec_bio[f] = d["id"]

    candidatos = defaultdict(lambda: {"senado": [], "camara": defaultdict(list)})
    for c in cn:
        if c["CAND_ELECTION_YR"] != str(ciclo) or c["CAND_OFFICE"] not in ("H", "S"):
            continue
        uf = c["CAND_OFFICE_ST"]
        if uf not in ESTADOS and uf not in TERRITORIOS:
            continue
        w = weball.get(c["CAND_ID"])
        item = {
            "fec": c["CAND_ID"],
            "nome": nome_legivel(c["CAND_NAME"]),
            "nome_fec": c["CAND_NAME"],
            "partido": c["CAND_PTY_AFFILIATION"] or None,
            "situacao": c["CAND_ICI"] or None,
            "status": c["CAND_STATUS"] or None,
            "bioguide": fec_bio.get(c["CAND_ID"]),
            "financas": _financas(w),
            "url": CANDIDATO.format(id=c["CAND_ID"], ciclo=ciclo),
        }
        if c["CAND_OFFICE"] == "S":
            candidatos[uf]["senado"].append(item)
        else:
            d = int(c["CAND_OFFICE_DISTRICT"] or 0)
            candidatos[uf]["camara"][str(d)].append(item)

    mudou = False
    resumo = {}
    ordem = lambda i: i["nome_fec"].lower()  # noqa: E731 - ordem alfabética do registro oficial ("SOBRENOME, NOME")
    for uf in sorted(set(ESTADOS) | set(TERRITORIOS)):
        d = candidatos.get(uf, {"senado": [], "camara": {}})
        sen = sorted(d["senado"], key=ordem)
        cam = {k: sorted(v, key=ordem) for k, v in sorted(d["camara"].items(), key=lambda kv: int(kv[0]))}
        todos = sen + [x for v in cam.values() for x in v]
        resumo[uf] = {
            "senado": len(sen),
            "camara": sum(len(v) for v in cam.values()),
            "com_movimentacao": sum(1 for x in todos if x["financas"] and (x["financas"]["receitas"] or 0) > 0),
            "receitas": round(sum((x["financas"] or {}).get("receitas") or 0 for x in todos), 2),
        }
        mudou |= gravar_se_mudou(api / "candidatos" / f"{uf}.json", {"uf": uf, "ciclo": ciclo, "senado": sen, "camara": cam, "coletado_em": agora()})

    # Finanças de cada parlamentar em exercício: as candidaturas dele(a) com movimentação no ciclo.
    for bio, d in membros.items():
        if not bio:
            continue
        lista = []
        for f in d.get("fec") or []:
            w = weball.get(f)
            if w:
                cargo = {"H": "Câmara", "S": "Senado", "P": "Presidência"}.get(f[0], f[0])
                lista.append({"fec": f, "cargo": cargo, "uf": w["CAND_OFFICE_ST"] or None, "financas": _financas(w), "url": CANDIDATO.format(id=f, ciclo=ciclo)})
        mudou |= gravar(api / "fec" / "membro" / f"{bio}.json", {"id": bio, "ciclo": ciclo, "candidaturas": lista})

    pub = publicado_em(r_w)
    mudou |= gravar_se_mudou(api / "candidatos" / "resumo.json", {"ciclo": ciclo, "estados": resumo, "partidos": PARTIDOS_FEC, "coletado_em": agora(), "fonte_publicada_em": pub})
    fontes = [
        fonte("eua-fec-candidatos", nome=f"Candidate master file (cn{aa})", orgao="Federal Election Commission (FEC)",
              url=BULK.format(ano=ciclo, arq="cn", aa=aa), pagina=PAGINA_BULK, licenca=DOMINIO_PUBLICO, publicado=publicado_em(r_cn),
              descricao=f"Todas as candidaturas federais registradas para {ciclo}: cargo, estado, distrito, partido e situação (incumbente, desafiante ou vaga aberta)."),
        fonte("eua-fec-financas", nome=f"All candidates file (weball{aa})", orgao="Federal Election Commission (FEC)",
              url=BULK.format(ano=ciclo, arq="weball", aa=aa), pagina=PAGINA_BULK, licenca=DOMINIO_PUBLICO, publicado=pub,
              descricao="Totais declarados por candidatura no ciclo: receitas, despesas, caixa, dívidas, doações de pessoas físicas (só o total), recursos próprios e empréstimos."),
    ]
    return mudou, fontes


if __name__ == "__main__":
    import sys

    print(montar(Path(sys.argv[1]) / "api" / "eua")[0])
