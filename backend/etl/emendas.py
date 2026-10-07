"""Emendas parlamentares: quanto foi pago a cada município e estado, por quem indicou a emenda
(parlamentar, bancada, comissão ou relator) e para quê (área de governo e ação orçamentária).
Roda sozinho no GitHub Actions (.github/workflows/emendas.yml), direto sobre o site publicado.

Fonte oficial e pública: Portal da Transparência (Controladoria-Geral da União), download completo
  https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/emendas-parlamentares/EmendasParlamentares.zip
com três planilhas (latin-1, separadas por ";"):
  EmendasParlamentares.csv               uma linha por emenda e localidade de aplicação, com os
                                          valores empenhado, liquidado, pago e restos a pagar;
  EmendasParlamentares_PorFavorecido.csv cada pagamento (mês a mês) a cada favorecido, com a UF e
                                          o município do favorecido;
  EmendasParlamentares_Convenios.csv     convênios ligados às emendas (não usado aqui).

Por que duas visões. No arquivo principal, a "localidade de aplicação" é o município em só ~6% do
valor pago desde 2019: o resto é "MÚLTIPLO", "Nacional" ou o estado inteiro. Quem diz onde o
dinheiro chegou é a planilha por favorecido (a soma dela por emenda bate com pago + restos a pagar
pagos do arquivo principal). Então:
  - "recebido": pagamentos a favorecidos sediados no município (prefeitura e fundos municipais,
    empresas, entidades, órgãos federais ali sediados, pessoas físicas), pela data do pagamento;
  - "destinadas": emendas cuja localidade de aplicação é o próprio município, com os estágios
    (empenhado, liquidado, pago, restos a pagar pagos), pelo ano da emenda.
Pagamentos ao governo do estado (estado, fundos e órgãos estaduais) contam só no estado, não no
município da sede (no DF, que não tem prefeitura, o Governo do DF conta em Brasília). Pagamentos registrados em nome de bancos operadores (Banco do Brasil, Caixa) ou
de inscrições genéricas não dizem o município de destino e ficam fora dos municípios (o resumo
mostra quanto é isso por ano; até 2024 inclui boa parte dos repasses fundo a fundo da saúde).

Município: o arquivo principal traz o código IBGE; a planilha por favorecido, só o nome e a UF,
casados pelo nome (sem acento, maiúsculas, só letras e números) com os nomes do arquivo principal e
com a configuração oficial de municípios do TSE, que também dá o código TSE usado no site.

Recorte: emendas de 2019 em diante e pagamentos feitos de janeiro de 2019 em diante (EMENDAS_ANO_INICIAL).
Valores em reais correntes, como publicados: sem correção monetária.

Grava (JSON compacto):
  api/emendas/resumo.json                   fonte, datas, totais nacionais e cobertura
  api/emendas/uf/<UF>.json                  totais do estado e todos os municípios, com o recebido
  api/emendas/municipio/<UF>/<cd TSE>.json  por ano, autor, área, favorecido e as maiores emendas
  api/emendas/parlamentar/<id>.json         emendas indicadas por quem está no plenário do site

Uso: python -m etl.emendas <site> [--zip arquivo.zip] [--tse mun-e006257-cm.json]   (saída: mudou=1|0)
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import unicodedata
import zipfile
from collections import Counter, defaultdict
from datetime import datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable
from zoneinfo import ZoneInfo

import requests

BRT = ZoneInfo("America/Sao_Paulo")
CGU_ZIP = "https://dadosabertos-download.cgu.gov.br/PortalDaTransparencia/saida/emendas-parlamentares/EmendasParlamentares.zip"
PAGINA = "https://portaldatransparencia.gov.br/download-de-dados/emendas-parlamentares"
DICIONARIO = "https://portaldatransparencia.gov.br/pagina-interna/603482-dicionario-de-dados-emendas-parlamentares"
DETALHE = "https://portaldatransparencia.gov.br/emendas/detalhe?codigoEmenda={codigo}"
TSE_MUN = "https://resultados.tse.jus.br/oficial/ele2026/6257/config/mun-e006257-cm.json"
ARQ_EMENDAS = "EmendasParlamentares.csv"
ARQ_FAVORECIDOS = "EmendasParlamentares_PorFavorecido.csv"
ANO_INICIAL = int(os.environ.get("EMENDAS_ANO_INICIAL", "2019"))
MAIORES = 50  # emendas listadas por município (maior valor recebido no município)
UA = "Mozilla/5.0 (compatible; tanaurna/1.0; dados abertos)"

NOMES_UF = {
    "AC": "Acre", "AL": "Alagoas", "AM": "Amazonas", "AP": "Amapá", "BA": "Bahia", "CE": "Ceará", "DF": "Distrito Federal",
    "ES": "Espírito Santo", "GO": "Goiás", "MA": "Maranhão", "MG": "Minas Gerais", "MS": "Mato Grosso do Sul", "MT": "Mato Grosso",
    "PA": "Pará", "PB": "Paraíba", "PE": "Pernambuco", "PI": "Piauí", "PR": "Paraná", "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte",
    "RO": "Rondônia", "RR": "Roraima", "RS": "Rio Grande do Sul", "SC": "Santa Catarina", "SE": "Sergipe", "SP": "São Paulo", "TO": "Tocantins",
}
# Código IBGE da UF (dois primeiros dígitos do código do município).
UF_IBGE = {
    "11": "RO", "12": "AC", "13": "AM", "14": "RR", "15": "PA", "16": "AP", "17": "TO", "21": "MA", "22": "PI", "23": "CE", "24": "RN",
    "25": "PB", "26": "PE", "27": "AL", "28": "SE", "29": "BA", "31": "MG", "32": "ES", "33": "RJ", "35": "SP", "41": "PR", "42": "SC",
    "43": "RS", "50": "MS", "51": "MT", "52": "GO", "53": "DF",
}

# Favorecidos que não dizem onde o dinheiro chegou: bancos que operam os repasses (raiz do CNPJ do
# Banco do Brasil e da Caixa) e inscrições genéricas/sem cadastro.
RAIZES_INTERMEDIARIOS = {"00000000": "Banco do Brasil", "00360305": "Caixa Econômica Federal"}
TIPOS_FAVORECIDO_SEM_LOCAL = {"Inscrição Genérica", "Inscrição Genéric", "Inválido", "Sem informação", "Unidade Gestora"}

CAT_MUNICIPAL = "Prefeitura e órgãos municipais"
CAT_ESTADUAL = "Governo do estado"
CAT_FEDERAL = "Órgãos e entidades federais"
CAT_EMPRESAS = "Empresas"
CAT_ENTIDADES = "Entidades privadas sem fins lucrativos"
CAT_PF = "Pessoas físicas"
CAT_OUTROS = "Outros"


class FonteIndisponivel(RuntimeError):
    """O arquivo da CGU não veio (rede, bloqueio ou resposta que não é ZIP)."""


# ------------------------------------------------------------------ utilidades


def centavos(texto: str | None) -> int:
    """'1.234.567,89' ou '245850,00' (formato da CGU) → centavos (int). Vazio/inválido → 0."""
    t = (texto or "").strip().replace(".", "").replace(",", ".")
    if not t:
        return 0
    try:
        return int((Decimal(t) * 100).to_integral_value())
    except InvalidOperation:
        return 0


def reais(c: int) -> float:
    return round(c / 100, 2)


def norm(texto: str | None) -> str:
    """Sem acento, maiúsculas, só letras e números separados por um espaço (D'OESTE = D OESTE)."""
    t = unicodedata.normalize("NFKD", texto or "")
    t = "".join(ch for ch in t if not unicodedata.combining(ch)).upper()
    return " ".join(re.sub(r"[^A-Z0-9]+", " ", t).split())


def codigo_valido(codigo: str | None) -> bool:
    return bool(codigo) and codigo.isdigit()


def link_emenda(codigo: str | None) -> str | None:
    return DETALHE.format(codigo=codigo) if codigo_valido(codigo) else None


# Tipo de emenda (texto publicado pela CGU → chave curta usada nos arquivos; o resumo traz os dois).
TIPOS_EMENDA = {
    "individual": "Emenda Individual - Transferências com Finalidade Definida",
    "especial": "Emenda Individual - Transferências Especiais",
    "bancada": "Emenda de Bancada",
    "comissao": "Emenda de Comissão",
    "relator": "Emenda de Relator",
}


def tipo_emenda(texto: str) -> str:
    t = norm(texto)
    if "INDIVIDUAL" in t:
        return "especial" if "ESPECIA" in t else "individual"
    for chave in ("bancada", "comissao", "relator"):
        if chave.upper() in t:
            return chave
    return "outro"


def tipo_autor(texto: str) -> str:
    """Quem indica: parlamentar (emenda individual), bancada, comissão ou relator."""
    t = tipo_emenda(texto)
    return "parlamentar" if t in ("individual", "especial") else t


def intermediario(cod_favorecido: str, tipo_favorecido: str) -> str | None:
    """Motivo pelo qual o pagamento não indica o município de destino (ou None)."""
    cod = (cod_favorecido or "").strip()
    if tipo_favorecido.startswith("Pessoa F"):
        return None  # CPF publicado mascarado (***.123.456-**): vale a UF e o município informados
    if tipo_favorecido in TIPOS_FAVORECIDO_SEM_LOCAL or not cod[:1].isdigit():
        return "Inscrição genérica ou sem cadastro"
    if len(cod) == 14 and cod[:8] in RAIZES_INTERMEDIARIOS:
        return RAIZES_INTERMEDIARIOS[cod[:8]]
    return None


def categoria_favorecido(natureza: str, tipo_favorecido: str) -> str:
    if tipo_favorecido.startswith("Pessoa F"):
        return CAT_PF
    n = norm(natureza)
    if "MUNICIP" in n:
        return CAT_MUNICIPAL
    if "ESTADUAL" in n or "ESTADO" in n or "DISTRITO FEDERAL" in n:
        return CAT_ESTADUAL
    if "FEDERAL" in n:
        return CAT_FEDERAL
    if any(k in n for k in ("SOCIEDADE", "EMPRES", "COOPERATIVA", "CONSORCIO DE SOCIEDADES")):
        return CAT_EMPRESAS
    if any(k in n for k in ("ASSOCIACAO", "FUNDACAO PRIVADA", "ORGANIZACAO RELIGIOSA", "SERVICO SOCIAL AUTONOMO", "ORGANIZACAO SOCIAL", "ENTIDADE SINDICAL")):
        return CAT_ENTIDADES
    return CAT_OUTROS


def _ano(texto: str | None) -> int | None:
    t = (texto or "").strip()
    return int(t[:4]) if len(t) >= 4 and t[:4].isdigit() else None


# ------------------------------------------------------------------ municípios (TSE ↔ IBGE)


def municipios_tse(cfg: dict) -> dict[str, dict]:
    """Código IBGE → {uf, cd (TSE), nome}, da configuração oficial de municípios do TSE."""
    out = {}
    for a in cfg.get("abr", []):
        uf = (a.get("cd") or "").upper()
        if uf not in NOMES_UF:
            continue  # "ZZ" é o exterior
        for m in a.get("mu", []):
            if m.get("cdi") and m.get("cd"):
                out[str(m["cdi"])] = {"uf": uf, "cd": str(m["cd"]), "nome": m["nm"]}
    return out


class IndiceMunicipios:
    """Casa (UF, nome do município como a CGU escreve) → código IBGE."""

    def __init__(self, muns: dict[str, dict]):
        self.muns = muns
        self.nomes: dict[tuple[str, str], str] = {}
        for ibge, m in muns.items():
            self.nomes.setdefault((m["uf"], norm(m["nome"])), ibge)

    def apelido(self, uf: str, nome: str, ibge: str) -> None:
        """Nome usado pela própria CGU para um código IBGE (arquivo principal)."""
        if ibge in self.muns and uf:
            self.nomes.setdefault((uf, norm(nome)), ibge)

    def __call__(self, uf: str, nome: str) -> str | None:
        return self.nomes.get((uf, norm(nome)))


# ------------------------------------------------------------------ autores ↔ parlamentares do site


def membros_plenario(plenario: dict) -> list[dict]:
    out = []
    for casa in ("camara", "senado"):
        for m in (plenario.get(casa) or {}).get("membros", []):
            if m.get("id") and m.get("nome"):
                out.append({"id": m["id"], "nome": m["nome"], "partido": m.get("partido"), "uf": m.get("uf"), "casa": casa})
    return out


def casar_autores(autores: dict[str, dict], plenario: dict) -> tuple[dict[str, dict], dict]:
    """Código do autor (CGU) → parlamentar do site, só para emendas individuais.

    Casamento pelo nome normalizado (exato; a CGU às vezes acrescenta uma observação entre
    parênteses, que não entra). Se o mesmo nome aparece mais de uma vez no plenário, desempata pela
    UF; se o autor nunca aplicou emenda na UF do parlamentar, não casa (homônimo de outro estado).
    Sem correspondência segura, o autor aparece só com o nome publicado.
    """
    por_nome: dict[str, list[dict]] = defaultdict(list)
    for m in membros_plenario(plenario):
        por_nome[norm(m["nome"])].append(m)
    casados: dict[str, dict] = {}
    rejeitados: list[str] = []
    for cod, a in autores.items():
        if a["tipo"] != "parlamentar" or not codigo_valido(cod):
            continue
        candidatos = [m for nome in a["nomes"] for m in por_nome.get(norm(nome.split("(")[0]), [])]
        candidatos = list({m["id"]: m for m in candidatos}.values())
        if len(candidatos) > 1 and a["ufs"]:
            candidatos = [m for m in candidatos if m["uf"] in a["ufs"]]
        if len(candidatos) != 1:
            continue
        m = candidatos[0]
        if a["ufs"] and m["uf"] and m["uf"] not in a["ufs"]:
            rejeitados.append(f"{sorted(a['nomes'])[0]} ({cod}, emendas em {'/'.join(sorted(a['ufs']))}) ≠ {m['nome']} ({m['uf']})")
            continue
        casados[cod] = m
    ids = {m["id"] for m in casados.values()}
    stats = {"parlamentares_no_site": len(membros_plenario(plenario)), "com_emendas": len(ids), "homonimos_descartados": rejeitados}
    return casados, stats


# ------------------------------------------------------------------ acumuladores


def _estagios() -> dict:
    return {"empenhado": 0, "liquidado": 0, "pago": 0, "rp_pago": 0, "emendas": set()}


def _estagios_json(por_ano: dict[int, dict]) -> list[dict]:
    return [
        {"ano": ano, "empenhado": reais(v["empenhado"]), "liquidado": reais(v["liquidado"]), "pago": reais(v["pago"]), "rp_pago": reais(v["rp_pago"]), "emendas": len(v["emendas"])}
        for ano, v in sorted(por_ano.items())
    ]


def _somar_estagios(alvo: dict, linha: dict, codigo: str) -> None:
    alvo["empenhado"] += linha["empenhado"]
    alvo["liquidado"] += linha["liquidado"]
    alvo["pago"] += linha["pago"]
    alvo["rp_pago"] += linha["rp_pago"]
    alvo["emendas"].add(codigo)


def _total_estagios(lista: list[dict]) -> dict:
    return {k: round(sum(x[k] for x in lista), 2) for k in ("empenhado", "liquidado", "pago", "rp_pago")} | {"emendas": sum(x["emendas"] for x in lista)}


def _lista(cont: dict, chave: str = "nome") -> list[dict]:
    return [{chave: k, "valor": reais(v)} for k, v in sorted(cont.items(), key=lambda kv: (-kv[1], str(kv[0]))) if v]


def _por_ano(cont: dict[int, int]) -> list[dict]:
    return [{"ano": a, "valor": reais(v)} for a, v in sorted(cont.items())]


class _Soma(defaultdict):
    """Chave → [total, só prefeitura e órgãos municipais] em centavos."""

    def __init__(self):
        super().__init__(lambda: [0, 0])

    def somar(self, chave, v: int, prefeitura: bool) -> None:
        x = self[chave]
        x[0] += v
        if prefeitura:
            x[1] += v

    def ordenados(self):
        return sorted(((k, x) for k, x in self.items() if x[0]), key=lambda kv: (-kv[1][0], str(kv[0])))


def _par(x: list[int]) -> dict:
    return {"valor": reais(x[0]), "prefeitura": reais(x[1])}


def _lista2(soma: "_Soma", chave: str = "nome") -> list[dict]:
    return [{chave: k, **_par(x)} for k, x in soma.ordenados()]


def _por_ano2(soma: "_Soma") -> list[dict]:
    return [{"ano": a, **_par(x)} for a, x in sorted(soma.items())]


# ------------------------------------------------------------------ montagem (sem rede, testável)


def ler_emenda(r: dict) -> dict:
    return {
        "codigo": (r.get("Código da Emenda") or "").strip(),
        "ano": _ano(r.get("Ano da Emenda")),
        "tipo": (r.get("Tipo de Emenda") or "").strip(),
        "autor_cod": (r.get("Código do Autor da Emenda") or "").strip(),
        "autor": (r.get("Nome do Autor da Emenda") or "").strip(),
        "numero": (r.get("Número da emenda") or "").strip(),
        "localidade": (r.get("Localidade de aplicação do recurso") or "").strip(),
        "ibge": (r.get("Código Município IBGE") or "").strip(),
        "municipio": (r.get("Município") or "").strip(),
        "uf_ibge": (r.get("Código UF IBGE") or "").strip(),
        "funcao": (r.get("Nome Função") or "").strip() or "Sem informação",
        "subfuncao": (r.get("Nome Subfunção") or "").strip(),
        "acao": (r.get("Nome Ação") or "").strip(),
        "empenhado": centavos(r.get("Valor Empenhado")),
        "liquidado": centavos(r.get("Valor Liquidado")),
        "pago": centavos(r.get("Valor Pago")),
        "rp_pago": centavos(r.get("Valor Restos A Pagar Pagos")),
    }


def montar(linhas_emendas: Iterable[dict], linhas_favorecidos: Iterable[dict], cfg_tse: dict, plenario: dict, fonte: dict, ano_inicial: int = ANO_INICIAL) -> tuple[dict[str, dict], dict]:
    """Monta todos os arquivos (caminho relativo a api/emendas → conteúdo) e as estatísticas."""
    muns = municipios_tse(cfg_tse)
    indice = IndiceMunicipios(muns)

    info: dict[str, dict] = {}  # código da emenda → dados da linha de maior valor
    autores: dict[str, dict] = defaultdict(lambda: {"nomes": set(), "tipo": "outro", "ufs": Counter()})
    nac_ano: dict[int, dict] = defaultdict(_estagios)
    nac_tipo: dict[str, dict] = defaultdict(_estagios)
    dest_mun: dict[str, dict[int, dict]] = defaultdict(lambda: defaultdict(_estagios))
    dest_uf: dict[str, dict[int, dict]] = defaultdict(lambda: defaultdict(_estagios))
    autor_ano: dict[str, dict[int, dict]] = defaultdict(lambda: defaultdict(_estagios))
    autor_emendas: dict[str, dict[str, dict]] = defaultdict(dict)

    for bruta in linhas_emendas:
        e = ler_emenda(bruta)
        cod = e["codigo"]
        uf = UF_IBGE.get(e["uf_ibge"][:2]) if e["uf_ibge"][:2].isdigit() else None
        if e["ibge"].isdigit() and uf:
            indice.apelido(uf, e["municipio"], e["ibge"])
        if codigo_valido(cod):
            atual = info.get(cod)
            if atual is None or e["empenhado"] > atual["empenhado"]:
                info[cod] = e
        if e["ano"] is None or e["ano"] < ano_inicial:
            continue
        chave = cod if codigo_valido(cod) else f"s/i:{e['autor_cod']}:{e['numero']}:{e['ano']}:{e['localidade']}"
        _somar_estagios(nac_ano[e["ano"]], e, chave)
        _somar_estagios(nac_tipo[tipo_emenda(e["tipo"])], e, chave)
        if e["ibge"] in muns:
            _somar_estagios(dest_mun[e["ibge"]][e["ano"]], e, chave)
        if uf:
            _somar_estagios(dest_uf[uf][e["ano"]], e, chave)
        a = autores[e["autor_cod"]]
        a["nomes"].add(e["autor"])
        a["tipo"] = tipo_autor(e["tipo"])
        if uf and a["tipo"] == "parlamentar":
            a["ufs"][uf] += 1
        _somar_estagios(autor_ano[e["autor_cod"]][e["ano"]], e, chave)
        if codigo_valido(cod):
            item = autor_emendas[e["autor_cod"]].setdefault(cod, {**e, "empenhado": 0, "liquidado": 0, "pago": 0, "rp_pago": 0, "localidades": []})
            for k in ("empenhado", "liquidado", "pago", "rp_pago"):
                item[k] += e[k]
            if e["localidade"] and e["localidade"] not in item["localidades"]:
                item["localidades"].append(e["localidade"])

    # Pagamentos por favorecido.
    pag_ano: dict[int, Counter] = defaultdict(Counter)  # ano → {municipios, governo_estadual, sem_municipio}
    sem_local_motivo: Counter = Counter()
    nao_casados: Counter = Counter()
    mun_total = _Soma()
    mun_ano: dict[str, _Soma] = defaultdict(_Soma)
    mun_autor: dict[str, _Soma] = defaultdict(_Soma)
    mun_funcao: dict[str, _Soma] = defaultdict(_Soma)
    mun_fav: dict[str, Counter] = defaultdict(Counter)
    mun_tipo: dict[str, _Soma] = defaultdict(_Soma)
    mun_emenda: dict[str, _Soma] = defaultdict(_Soma)
    mun_emendas_n: dict[str, set] = defaultdict(set)
    uf_mun_ano: dict[str, _Soma] = defaultdict(_Soma)
    uf_est_ano: dict[str, Counter] = defaultdict(Counter)
    autor_pag_ano: dict[str, Counter] = defaultdict(Counter)
    autor_dest_mun: dict[str, Counter] = defaultdict(Counter)
    autor_dest_uf: dict[str, Counter] = defaultdict(Counter)
    autor_sem_mun: Counter = Counter()
    autor_info_pag: dict[str, dict] = {}
    minimo = ano_inicial * 100 + 1

    for r in linhas_favorecidos:
        anomes = (r.get("Ano/Mês") or "").strip()
        if not anomes.isdigit() or int(anomes) < minimo:
            continue
        v = centavos(r.get("Valor Recebido"))
        if not v:
            continue
        ano = int(anomes[:4])
        cod = (r.get("Código da Emenda") or "").strip()
        autor_cod = (r.get("Código do Autor da Emenda") or "").strip()
        tipo = (r.get("Tipo de Emenda") or "").strip()
        autor_info_pag.setdefault(autor_cod, {"autor": (r.get("Nome do Autor da Emenda") or "").strip(), "tipo": tipo_autor(tipo)})
        autor_pag_ano[autor_cod][ano] += v
        uf = (r.get("UF Favorecido") or "").strip().upper()
        nome_mun = (r.get("Município Favorecido") or "").strip()
        motivo = intermediario(r.get("Código do Favorecido") or "", (r.get("Tipo Favorecido") or "").strip())
        if not motivo and (uf not in NOMES_UF or not nome_mun or norm(nome_mun) == "SEM INFORMACAO"):
            motivo = "Favorecido sem município"
        if motivo:
            pag_ano[ano]["sem_municipio"] += v
            sem_local_motivo[motivo] += v
            autor_sem_mun[autor_cod] += v
            continue
        categoria = categoria_favorecido((r.get("Natureza Jurídica") or "").strip(), (r.get("Tipo Favorecido") or "").strip())
        autor_dest_uf[autor_cod][uf] += v
        if categoria == CAT_ESTADUAL and uf == "DF":
            categoria = CAT_MUNICIPAL  # o DF não tem prefeitura: o Governo do DF faz as vezes dela em Brasília
        if categoria == CAT_ESTADUAL:
            pag_ano[ano]["governo_estadual"] += v
            uf_est_ano[uf][ano] += v
            continue
        ibge = indice(uf, nome_mun)
        if not ibge:
            nao_casados[(uf, nome_mun)] += v
            pag_ano[ano]["sem_municipio"] += v
            sem_local_motivo["Município não identificado"] += v
            autor_sem_mun[autor_cod] += v
            continue
        pag_ano[ano]["municipios"] += v
        e = info.get(cod) if codigo_valido(cod) else None
        pref = categoria == CAT_MUNICIPAL
        mun_total.somar(ibge, v, pref)
        mun_ano[ibge].somar(ano, v, pref)
        mun_autor[ibge].somar((autor_cod, tipo_autor(tipo)), v, pref)
        mun_funcao[ibge].somar(e["funcao"] if e else "Sem informação", v, pref)
        mun_fav[ibge][categoria] += v
        mun_tipo[ibge].somar(tipo_emenda(tipo), v, pref)
        if e:
            mun_emenda[ibge].somar(cod, v, pref)
        mun_emendas_n[ibge].add(cod if e else f"s/i:{autor_cod}:{tipo}")
        uf_mun_ano[uf].somar(ano, v, pref)
        autor_dest_mun[autor_cod][ibge] += v

    for cod, a in autor_info_pag.items():  # autores que só aparecem nos pagamentos (emendas antigas)
        if cod not in autores:
            autores[cod]["nomes"].add(a["autor"])
            autores[cod]["tipo"] = a["tipo"]
    casados, stats_autores = casar_autores(autores, plenario)

    def autor_json(cod: str, tipo: str | None = None) -> dict:
        a = autores.get(cod)
        nomes = sorted(a["nomes"]) if a else [autor_info_pag.get(cod, {}).get("autor", "Sem informação")]
        out = {"autor": nomes[-1] if nomes else "Sem informação", "autor_tipo": tipo or (a["tipo"] if a else "outro")}
        m = casados.get(cod)
        if m:
            out |= {"id": m["id"], "nome": m["nome"], "partido": m["partido"], "uf": m["uf"]}
        return out

    def mun_ref(ibge: str) -> dict:
        m = muns[ibge]
        return {"uf": m["uf"], "cd": m["cd"], "nome": m["nome"]}

    arquivos: dict[str, dict] = {}
    # Link de cada emenda no Portal da Transparência: troque {codigo} pelo código da emenda.
    fonte_curta = {"nome": fonte["nome"], "orgao": fonte["orgao"], "url": fonte["pagina"], "arquivo_atualizado_em": fonte.get("arquivo_atualizado_em"), "link_emenda": DETALHE}

    # Municípios.
    for ibge in sorted(set(mun_total) | set(dest_mun)):
        m = muns[ibge]
        destinadas = _estagios_json(dest_mun.get(ibge, {}))
        maiores = []
        for cod, x in mun_emenda[ibge].ordenados()[:MAIORES] if ibge in mun_emenda else []:
            e = info[cod]
            maiores.append(
                {"codigo": cod, "ano": e["ano"], "tipo": tipo_emenda(e["tipo"]), **autor_json(e["autor_cod"], tipo_autor(e["tipo"])), "funcao": e["funcao"], "acao": e["acao"], "localidade": e["localidade"], **_par(x)}
            )
        autores_mun = [{**autor_json(cod, tipo), **_par(x)} for (cod, tipo), x in mun_autor[ibge].ordenados()] if ibge in mun_autor else []
        total = mun_total.get(ibge, [0, 0])
        arquivos[f"municipio/{m['uf']}/{m['cd']}.json"] = {
            "uf": m["uf"],
            "cd": m["cd"],
            "ibge": ibge,
            "nome": m["nome"],
            "periodo": {"desde": ano_inicial},
            "recebido": {
                "total": reais(total[0]),
                "prefeitura": reais(total[1]),
                "emendas": len(mun_emendas_n.get(ibge, ())),
                "por_ano": _por_ano2(mun_ano.get(ibge, _Soma())),
                "por_autor": autores_mun,
                "por_funcao": _lista2(mun_funcao.get(ibge, _Soma())),
                "por_favorecido": _lista(mun_fav.get(ibge, {})),
                "por_tipo": _lista2(mun_tipo.get(ibge, _Soma())),
            },
            "destinadas": {"total": _total_estagios(destinadas), "por_ano": destinadas},
            "maiores": maiores,
            "fonte": fonte_curta,
        }

    # Estados.
    por_uf_muns: dict[str, list[str]] = defaultdict(list)
    for ibge, m in muns.items():
        por_uf_muns[m["uf"]].append(ibge)
    resumo_ufs = []
    for uf in sorted(NOMES_UF):
        lista = [
            {"cd": muns[i]["cd"], "nome": muns[i]["nome"], "recebido": reais(mun_total.get(i, [0, 0])[0]), "prefeitura": reais(mun_total.get(i, [0, 0])[1]), "emendas": len(mun_emendas_n.get(i, ()))}
            for i in por_uf_muns.get(uf, [])
        ]
        lista.sort(key=lambda x: (-x["recebido"], norm(x["nome"])))
        destinadas = _estagios_json(dest_uf.get(uf, {}))
        rec_mun = [sum(x[0] for x in uf_mun_ano.get(uf, {}).values()), sum(x[1] for x in uf_mun_ano.get(uf, {}).values())]
        rec_est = sum(uf_est_ano.get(uf, {}).values())
        arquivos[f"uf/{uf}.json"] = {
            "uf": uf,
            "nome": NOMES_UF[uf],
            "periodo": {"desde": ano_inicial},
            "recebido_municipios": {"total": reais(rec_mun[0]), "prefeitura": reais(rec_mun[1]), "por_ano": _por_ano2(uf_mun_ano.get(uf, _Soma()))},
            "governo_estadual": {"total": reais(rec_est), "por_ano": _por_ano(uf_est_ano.get(uf, {}))},
            "destinadas": {"total": _total_estagios(destinadas), "por_ano": destinadas},
            "municipios": lista,
            "fonte": fonte_curta,
        }
        resumo_ufs.append({"uf": uf, "nome": NOMES_UF[uf], "recebido_municipios": reais(rec_mun[0]), "prefeitura": reais(rec_mun[1]), "governo_estadual": reais(rec_est), "municipios_com_pagamento": sum(1 for x in lista if x["recebido"] > 0), "municipios": len(lista)})

    # Parlamentares do site (um arquivo por id; um parlamentar pode ter mais de um código de autor).
    por_id: dict[str, list[str]] = defaultdict(list)
    for cod, m in casados.items():
        por_id[m["id"]].append(cod)
    for pid, cods in sorted(por_id.items()):
        m = casados[cods[0]]
        anos: dict[int, dict] = defaultdict(_estagios)
        for cod in cods:
            for ano, v in autor_ano.get(cod, {}).items():
                for k in ("empenhado", "liquidado", "pago", "rp_pago"):
                    anos[ano][k] += v[k]
                anos[ano]["emendas"] |= v["emendas"]
        pag = Counter()
        dmun = Counter()
        duf = Counter()
        for cod in cods:
            pag.update(autor_pag_ano.get(cod, {}))
            dmun.update(autor_dest_mun.get(cod, {}))
            duf.update(autor_dest_uf.get(cod, {}))
        emendas = sorted((e for cod in cods for e in autor_emendas.get(cod, {}).values()), key=lambda e: (-(e["ano"] or 0), -(e["pago"] + e["rp_pago"]), e["codigo"]))
        por_ano = _estagios_json(anos)
        arquivos[f"parlamentar/{pid}.json"] = {
            "id": pid,
            "nome": m["nome"],
            "partido": m["partido"],
            "uf": m["uf"],
            "autor_cgu": sorted({n for cod in cods for n in autores[cod]["nomes"]}),
            "periodo": {"desde": ano_inicial},
            "total": _total_estagios(por_ano),
            "por_ano": por_ano,
            "pagamentos": {
                "total": reais(sum(pag.values())),
                "por_ano": _por_ano(pag),
                "sem_municipio": reais(sum(autor_sem_mun.get(c, 0) for c in cods)),
            },
            "destinos_uf": [{"uf": uf, "nome": NOMES_UF[uf], "valor": reais(v)} for uf, v in sorted(duf.items(), key=lambda kv: (-kv[1], kv[0])) if v],
            "destinos_municipio": [{**mun_ref(i), "valor": reais(v)} for i, v in sorted(dmun.items(), key=lambda kv: (-kv[1], kv[0])) if v],
            "emendas": [
                {
                    "codigo": e["codigo"], "ano": e["ano"], "tipo": tipo_emenda(e["tipo"]), "numero": e["numero"], "localidade": " · ".join(e["localidades"]),
                    "funcao": e["funcao"], "acao": e["acao"], "empenhado": reais(e["empenhado"]), "liquidado": reais(e["liquidado"]),
                    "pago": reais(e["pago"]), "rp_pago": reais(e["rp_pago"]),
                }
                for e in emendas
            ],
            "fonte": fonte_curta,
        }

    nomes_nao_casados = sorted(({"uf": uf, "municipio": n, "valor": reais(v)} for (uf, n), v in nao_casados.items()), key=lambda x: -x["valor"])
    casados_pag = sum(pag_ano[a]["municipios"] for a in pag_ano)
    stats = {
        "municipios_com_dados": sum(1 for k in arquivos if k.startswith("municipio/")),
        "municipios_com_pagamento": len(mun_total),
        "municipios_no_tse": len(muns),
        "nomes_nao_casados": len(nao_casados),
        "valor_nao_casado": reais(sum(nao_casados.values())),
        "valor_em_municipios": reais(casados_pag),
        **stats_autores,
    }
    arquivos["resumo.json"] = {
        "fonte": fonte,
        "periodo": {"desde": ano_inicial, "ate": max(list(nac_ano) + list(pag_ano) or [ano_inicial])},
        "tipos": TIPOS_EMENDA,
        "link_emenda": DETALHE,
        "valores": "Reais correntes, exatamente como publicados pela CGU: sem correção monetária (inflação).",
        "emendas_por_ano": _estagios_json(nac_ano),
        "emendas_por_tipo": [
            {"tipo": t, "nome": TIPOS_EMENDA.get(t, t), "empenhado": reais(v["empenhado"]), "liquidado": reais(v["liquidado"]), "pago": reais(v["pago"]), "rp_pago": reais(v["rp_pago"]), "emendas": len(v["emendas"])}
            for t, v in sorted(nac_tipo.items(), key=lambda kv: -kv[1]["empenhado"])
        ],
        "pagamentos_por_ano": [
            {"ano": a, "total": reais(sum(c.values())), "municipios": reais(c["municipios"]), "governo_estadual": reais(c["governo_estadual"]), "sem_municipio": reais(c["sem_municipio"])}
            for a, c in sorted(pag_ano.items())
        ],
        "sem_municipio_por_motivo": _lista(sem_local_motivo, "motivo"),
        "ufs": resumo_ufs,
        "cobertura": {**stats, "nao_casados": nomes_nao_casados[:100]},
    }
    return arquivos, stats


# ------------------------------------------------------------------ rede e gravação


def baixar_zip(destino: Path) -> dict:
    """Baixa o ZIP da CGU. Devolve {'arquivo_atualizado_em'} (Last-Modified do servidor)."""
    destino.parent.mkdir(parents=True, exist_ok=True)
    ultimo: Exception | None = None
    for tentativa in range(3):
        try:
            with requests.get(CGU_ZIP, stream=True, timeout=(15, 180), headers={"User-Agent": UA}) as r:
                if r.status_code in (401, 403, 405, 429):
                    raise FonteIndisponivel(f"a CGU recusou o download (HTTP {r.status_code}); possível bloqueio do endereço de origem")
                r.raise_for_status()
                tmp = destino.with_suffix(".part")
                with open(tmp, "wb") as fh:
                    for bloco in r.iter_content(1 << 20):
                        fh.write(bloco)
                if not zipfile.is_zipfile(tmp):
                    inicio = tmp.read_bytes()[:300].decode("latin-1", "replace")
                    tmp.unlink(missing_ok=True)
                    raise FonteIndisponivel(f"a resposta da CGU não é um ZIP (verificação humana ou página de erro?): {inicio[:120]!r}")
                tmp.replace(destino)
                return {"arquivo_atualizado_em": _iso_http(r.headers.get("Last-Modified"))}
        except FonteIndisponivel:
            raise
        except Exception as exc:  # noqa: BLE001 - qualquer falha de rede: tenta de novo
            ultimo = exc
            time.sleep(5 * (tentativa + 1))
    raise FonteIndisponivel(f"falha ao baixar {CGU_ZIP}: {ultimo}")


def _iso_http(data_http: str | None) -> str | None:
    if not data_http:
        return None
    from email.utils import parsedate_to_datetime

    try:
        return parsedate_to_datetime(data_http).astimezone(BRT).isoformat(timespec="seconds")
    except (TypeError, ValueError):
        return None


def ler_csv(zf: zipfile.ZipFile, nome: str) -> Iterable[dict]:
    with zf.open(nome) as bruto:
        texto = io.TextIOWrapper(bruto, encoding="latin-1", newline="")
        yield from csv.DictReader(texto, delimiter=";", quotechar='"')


def _data_no_zip(zf: zipfile.ZipFile, nome: str) -> str | None:
    try:
        y, mo, d, h, mi, s = zf.getinfo(nome).date_time
        return datetime(y, mo, d, h, mi, s, tzinfo=BRT).isoformat(timespec="seconds")
    except KeyError:
        return None


def _ler_json(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None


def _texto(dados) -> str:
    return json.dumps(dados, ensure_ascii=False, separators=(",", ":"))


def gravar(raiz: Path, arquivos: dict[str, dict]) -> dict:
    """Grava em <raiz> (api/emendas) só o que mudou e apaga arquivos que deixaram de existir.

    O resumo carrega a data da coleta: só é regravado quando algum outro arquivo ou o próprio
    conteúdo (fora a data da coleta) muda, para a passada semanal sem novidade não gerar commit.
    """
    gravados = apagados = 0
    for rel, dados in arquivos.items():
        if rel == "resumo.json":
            continue
        p = raiz / rel
        novo = _texto(dados)
        if p.exists() and p.read_text(encoding="utf-8") == novo:
            continue
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(novo, encoding="utf-8")
        gravados += 1
    esperados = {raiz / rel for rel in arquivos}
    for p in sorted(raiz.rglob("*.json")) if raiz.exists() else []:
        if p not in esperados:
            p.unlink()
            apagados += 1
    if "resumo.json" in arquivos:
        p = raiz / "resumo.json"
        anterior = _ler_json(p)
        sem_coleta = lambda d: {**d, "fonte": {k: v for k, v in (d.get("fonte") or {}).items() if k != "coletado_em"}}  # noqa: E731
        if gravados or apagados or anterior is None or sem_coleta(anterior) != sem_coleta(json.loads(_texto(arquivos["resumo.json"]))):
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(_texto(arquivos["resumo.json"]), encoding="utf-8")
            gravados += 1
    return {"gravados": gravados, "apagados": apagados}


def run(site: Path, zip_local: Path | None = None, tse_local: Path | None = None) -> bool:
    api = site / "api"
    plenario = _ler_json(api / "plenario.json") or {}
    if not membros_plenario(plenario):
        print("emendas: aviso: api/plenario.json ausente ou vazio; autores ficam sem link para o parlamentar")
    agora = datetime.now(BRT).isoformat(timespec="seconds")
    if zip_local:
        caminho = zip_local
        meta = {"arquivo_atualizado_em": datetime.fromtimestamp(zip_local.stat().st_mtime, BRT).isoformat(timespec="seconds")}
    else:
        caminho = Path(os.environ.get("RUNNER_TEMP") or "/tmp") / "EmendasParlamentares.zip"
        meta = baixar_zip(caminho)
    if tse_local:
        cfg = json.loads(tse_local.read_text(encoding="utf-8"))
    else:
        cfg = requests.get(TSE_MUN, timeout=60, headers={"User-Agent": UA}).json()
    with zipfile.ZipFile(caminho) as zf:
        nomes = set(zf.namelist())
        faltam = {ARQ_EMENDAS, ARQ_FAVORECIDOS} - nomes
        if faltam:
            raise FonteIndisponivel(f"o ZIP da CGU não traz {sorted(faltam)} (mudou o formato?)")
        fonte = {
            "nome": "Emendas parlamentares (download completo)",
            "orgao": "Controladoria-Geral da União (CGU) · Portal da Transparência",
            "url": CGU_ZIP,
            "pagina": PAGINA,
            "dicionario": DICIONARIO,
            "arquivo_atualizado_em": meta.get("arquivo_atualizado_em") or _data_no_zip(zf, ARQ_EMENDAS),
            "gerado_em": _data_no_zip(zf, ARQ_EMENDAS),
            "coletado_em": agora,
        }
        colunas = next(csv.reader(io.TextIOWrapper(zf.open(ARQ_EMENDAS), encoding="latin-1"), delimiter=";"))
        for col in ("Código da Emenda", "Código Município IBGE", "Valor Pago", "Nome Função"):
            if col not in colunas:
                raise FonteIndisponivel(f"coluna {col!r} não está no arquivo da CGU (mudou o formato?)")
        arquivos, stats = montar(ler_csv(zf, ARQ_EMENDAS), ler_csv(zf, ARQ_FAVORECIDOS), cfg, plenario, fonte)
    r = gravar(api / "emendas", arquivos)
    print(f"emendas: {len(arquivos)} arquivos ({r['gravados']} gravados, {r['apagados']} apagados); {json.dumps(stats, ensure_ascii=False)}")
    return bool(r["gravados"] or r["apagados"])


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("site", type=Path)
    ap.add_argument("--zip", type=Path, default=None, help="ZIP da CGU já baixado (teste local)")
    ap.add_argument("--tse", type=Path, default=None, help="configuração de municípios do TSE já baixada")
    a = ap.parse_args()
    try:
        mudou = run(a.site, a.zip, a.tse)
    except FonteIndisponivel as exc:
        # Mantém o que está publicado; o job falha para o aviso aparecer no GitHub.
        print(f"::error title=Emendas (CGU)::{exc}. Nada foi alterado no site.")
        if os.environ.get("GITHUB_STEP_SUMMARY"):
            with open(os.environ["GITHUB_STEP_SUMMARY"], "a", encoding="utf-8") as f:
                f.write(f"⚠ Emendas: {exc}. O site mantém os dados anteriores.\n")
        return 1
    print(f"mudou={int(mudou)}")
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as f:
            f.write(f"mudou={int(mudou)}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
