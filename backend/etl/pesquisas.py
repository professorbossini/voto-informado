"""Pesquisas eleitorais registradas no TSE (curadoria manual, versionada no repositório).

Os números são transcritos das divulgações oficiais dos institutos e da imprensa, cada
pesquisa com suas fontes, e conferidos na carga:
- todos os campos de divulgação obrigatória (Lei 9.504/97, art. 33; Res. TSE 23.600/2019);
- número de registro no formato do TSE (UF-NNNNN/AAAA);
- percentuais entre 0 e 100 e soma plausível;
- cada nome corresponde a uma candidatura da base do TSE (para foto e link).
Qualquer falha interrompe a carga: nada entra no site sem passar na conferência.

STATUS: PENDENTE. Desligado por padrão (etl.common.PESQUISAS_ATIVAS): enquanto os registros não
forem conferidos no PesqEle, este passo apenas remove tabelas e fonte de pesquisas do banco.

Uso: PESQUISAS_ATIVAS=1 .venv/bin/python -m etl.pesquisas
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
from pathlib import Path

from . import common
from .tse import normalize

ARQUIVO = common.ROOT / "curadoria" / "pesquisas.json"
OBRIGATORIOS = [
    "id", "cargo", "turno", "cenario", "abrangencia", "instituto", "contratante", "registro_tse",
    "campo_inicio", "campo_fim", "divulgacao", "entrevistas", "margem_erro_pp", "confianca_pct", "resultados", "fontes",
]
REGISTRO = re.compile(r"^[A-Z]{2}-\d{5}/20\d{2}$")
DATA = re.compile(r"^\d{4}-\d{2}-\d{2}$")
CARGOS = {"presidente", "governador", "senador"}


def _match(conn: sqlite3.Connection, nome: str, cargo: str, uf: str) -> str | None:
    """Candidatura do TSE com esse nome. Prefere quem está na urna; pesquisas feitas antes de um
    indeferimento podem citar quem saiu da urna (a tela sinaliza isso)."""
    alvo = normalize(nome)
    for na_urna in (1, 0):
        rows = conn.execute(
            "SELECT sq, nome_urna, nome FROM candidatos WHERE cargo=? AND uf=? AND na_urna=?", (cargo, uf, na_urna)
        ).fetchall()
        for sq, urna, completo in rows:
            if alvo in (normalize(urna), normalize(completo)):
                return sq
        # nomes de urna com prefixo ("Escritor Augusto Cury") ou abreviados
        cand = [sq for sq, urna, completo in rows if alvo and (alvo in normalize(urna) or normalize(urna) in alvo)]
        if len(cand) == 1:
            return cand[0]
    return None


def validar(conn: sqlite3.Connection, pesquisas: list[dict]) -> list[str]:
    erros = []
    ids = set()
    for p in pesquisas:
        pid = p.get("id", "?")
        faltando = [k for k in OBRIGATORIOS if p.get(k) in (None, "", [])]
        if faltando:
            erros.append(f"{pid}: campos obrigatórios ausentes: {', '.join(faltando)}")
            continue
        if pid in ids:
            erros.append(f"{pid}: id repetido")
        ids.add(pid)
        if p["cargo"] not in CARGOS:
            erros.append(f"{pid}: cargo inválido {p['cargo']}")
        if not REGISTRO.match(p["registro_tse"]):
            erros.append(f"{pid}: registro fora do padrão do TSE: {p['registro_tse']}")
        for k in ("campo_inicio", "campo_fim", "divulgacao"):
            if not DATA.match(str(p[k])):
                erros.append(f"{pid}: data inválida em {k}")
        if p["campo_inicio"] > p["campo_fim"] or p["campo_fim"] > p["divulgacao"]:
            erros.append(f"{pid}: datas fora de ordem (início ≤ fim ≤ divulgação)")
        if not (0 < float(p["margem_erro_pp"]) <= 10 and 80 <= float(p["confianca_pct"]) <= 99.9 and int(p["entrevistas"]) >= 300):
            erros.append(f"{pid}: margem/confiança/amostra implausíveis")
        valores = [float(r["pct"]) for r in p["resultados"]] + [float(o["pct"]) for o in p.get("outros", [])]
        if any(v < 0 or v > 100 for v in valores):
            erros.append(f"{pid}: percentual fora de 0–100")
        if not (90 <= sum(valores) <= 110):
            erros.append(f"{pid}: soma dos percentuais = {sum(valores):.1f} (esperado ~100)")
        uf = "BR" if p["cargo"] == "presidente" else p["abrangencia"]
        for r in p["resultados"]:
            if not _match(conn, r["nome"], p["cargo"], uf):
                erros.append(f"{pid}: '{r['nome']}' não corresponde a nenhuma candidatura do TSE ({p['cargo']}/{uf})")
        if not all(f.get("url", "").startswith("https://") for f in p["fontes"]):
            erros.append(f"{pid}: toda fonte precisa de URL https")
    return erros


def run() -> None:
    conn = common.connect()
    if not common.PESQUISAS_ATIVAS:
        conn.executescript("DROP TABLE IF EXISTS pesquisas; DROP TABLE IF EXISTS pesquisa_resultados;")
        conn.execute("CREATE TABLE IF NOT EXISTS fontes (chave TEXT PRIMARY KEY)")
        conn.execute("DELETE FROM fontes WHERE chave = 'pesquisas_registradas'")
        conn.commit()
        print("pesquisas: DESATIVADAS (pendente de conferência no PesqEle); nada publicado")
        return
    conn.executescript(
        """
        DROP TABLE IF EXISTS pesquisas;
        DROP TABLE IF EXISTS pesquisa_resultados;
        CREATE TABLE pesquisas (
            id TEXT PRIMARY KEY, cargo TEXT, turno INTEGER, cenario TEXT, abrangencia TEXT,
            instituto TEXT, instituto_curto TEXT, contratante TEXT, registro_tse TEXT, campo_inicio TEXT, campo_fim TEXT,
            divulgacao TEXT, entrevistas INTEGER, margem_erro_pp REAL, confianca_pct REAL,
            metodologia TEXT, observacoes TEXT, fontes_json TEXT, outros_json TEXT
        );
        CREATE TABLE pesquisa_resultados (pesquisa_id TEXT, nome TEXT, partido TEXT, pct REAL, sq TEXT);
        """
    )
    if not ARQUIVO.exists():
        print("pesquisas: nenhum arquivo de curadoria; tabela vazia")
        conn.commit()
        return
    dados = json.loads(ARQUIVO.read_text(encoding="utf-8"))
    pesquisas = dados["pesquisas"]
    erros = validar(conn, pesquisas)
    if erros:
        conn.rollback()
        sys.exit("pesquisas: conferência falhou, nada foi carregado:\n  - " + "\n  - ".join(erros))
    for p in pesquisas:
        conn.execute(
            "INSERT INTO pesquisas VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            (
                p["id"], p["cargo"], int(p["turno"]), p["cenario"], p["abrangencia"], p["instituto"],
                p.get("instituto_curto") or p["instituto"], p["contratante"],
                p["registro_tse"], p["campo_inicio"], p["campo_fim"], p["divulgacao"], int(p["entrevistas"]),
                float(p["margem_erro_pp"]), float(p["confianca_pct"]), p.get("metodologia"), p.get("observacoes"),
                json.dumps(p["fontes"], ensure_ascii=False), json.dumps(p.get("outros", []), ensure_ascii=False),
            ),
        )
        uf = "BR" if p["cargo"] == "presidente" else p["abrangencia"]
        conn.executemany(
            "INSERT INTO pesquisa_resultados VALUES (?,?,?,?,?)",
            [(p["id"], r["nome"], r.get("partido"), float(r["pct"]), _match(conn, r["nome"], p["cargo"], uf)) for r in p["resultados"]],
        )
    common.register_source(
        conn,
        "pesquisas_registradas",
        nome="Pesquisas eleitorais registradas no TSE",
        orgao="Institutos de pesquisa · registro no TSE (PesqEle)",
        url="https://pesqele-divulgacao.tse.jus.br/",
        pagina="https://pesqele-divulgacao.tse.jus.br/",
        descricao=(
            "Resultados transcritos das divulgações oficiais de cada instituto (fontes listadas em cada pesquisa), "
            "com número de registro no sistema PesqEle do TSE. O TSE registra as pesquisas, mas não as realiza nem as valida."
        ),
        gerado_em=dados.get("coletado_em"),
    )
    conn.commit()
    print(f"pesquisas: {len(pesquisas)} carregadas e conferidas")


if __name__ == "__main__":
    run()
