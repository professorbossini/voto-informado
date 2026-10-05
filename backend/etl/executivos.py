"""Executivo com mandato regular 2023–2026: Presidente, Vice e governadores (com vices) eleitos em 2022.

Fonte: arquivo oficial de candidaturas 2022 do TSE (consulta_cand_2022, situação ELEITO), cruzado
pelo CPF com os registros de candidatura de 2026, que dão o partido ATUAL de quem concorre de novo
(muitos trocaram de partido depois de 2022) e a foto oficial de 2026.

Gera backend/curadoria/executivos.json (versionado; o CPF NÃO sai do banco). O plenario.yml copia
o arquivo para api/executivos.json no site. Rodar de novo quando houver novos eleitos (2027–2030
virão dos resultados de 2026).

Uso: .venv/bin/python -m etl.executivos
"""

from __future__ import annotations

import csv
import io
import json
import zipfile
from datetime import datetime
from zoneinfo import ZoneInfo

from . import common
from .common import RAW

SAIDA = common.ROOT / "curadoria" / "executivos.json"
CARGOS = {"PRESIDENTE": "presidente", "VICE-PRESIDENTE": "vice-presidente", "GOVERNADOR": "governador", "VICE-GOVERNADOR": "vice-governador"}


def run() -> None:
    z = zipfile.ZipFile(RAW / "consulta_cand_2022.zip")
    nome = next(n for n in z.namelist() if n.endswith("_BRASIL.csv"))
    eleitos: dict[str, dict] = {}
    with z.open(nome) as f:
        for row in csv.DictReader(io.TextIOWrapper(f, encoding="latin-1"), delimiter=";"):
            cargo = CARGOS.get(row["DS_CARGO"])
            if not cargo or not row["DS_SIT_TOT_TURNO"].startswith("ELEITO"):
                continue
            # Vices aparecem como "ELEITO" junto com a chapa; um registro por pessoa.
            eleitos[row["SQ_CANDIDATO"]] = {
                "cpf": row["NR_CPF_CANDIDATO"],
                "cargo": cargo,
                "uf": "BR" if cargo.endswith("presidente") else row["SG_UF"],
                "nome_urna": row["NM_URNA_CANDIDATO"],
                "partido_2022": row["SG_PARTIDO"],
                "sq_2022": row["SQ_CANDIDATO"],
            }

    conn = common.connect()
    out = []
    for e in eleitos.values():
        atual = conn.execute(
            "SELECT sq, partido, cargo, nome_urna, EXISTS(SELECT 1 FROM fotos f WHERE f.sq = c.sq) FROM candidatos c WHERE cpf = ? ORDER BY na_urna DESC LIMIT 1",
            (e.pop("cpf"),),
        ).fetchone()
        e["sq_2026"] = atual[0] if atual else None
        e["partido_2026"] = atual[1] if atual else None
        e["candidatura_2026"] = atual[2] if atual else None
        e["foto"] = f"/fotos/{atual[0]}.jpg" if atual and atual[4] else None
        # Partido para agrupar: o do registro de 2026 (atual), senão o da eleição de 2022.
        e["partido"] = e["partido_2026"] or e["partido_2022"]
        e["partido_origem"] = "registro de candidatura 2026" if e["partido_2026"] else "eleição de 2022"
        # Presidente/governador que concorre a OUTRO cargo em 2026 teve de renunciar até 6 meses antes
        # da eleição (Constituição, art. 14, § 6º): já não exerce o mandato.
        e["deixou_cargo"] = e["cargo"] in ("presidente", "governador") and e["candidatura_2026"] not in (None, e["cargo"])
        out.append(e)
    conn.close()
    ordem = list(CARGOS.values())
    out.sort(key=lambda e: (ordem.index(e["cargo"]), e["uf"], e["nome_urna"]))
    dados = {
        "mandato": "2023–2026",
        "fonte": "TSE · consulta_cand_2022 (situação ELEITO) e consulta_cand 2026 (partido atual de quem concorre)",
        "aviso": "Eleitos em 2022. Quem concorre a outro cargo em 2026 aparece como tendo deixado o cargo (Constituição, art. 14, § 6º); outras renúncias, afastamentos e substituições não aparecem. O partido é o do registro de candidatura de 2026 quando a pessoa concorre de novo, senão o da eleição de 2022.",
        "gerado_em": datetime.now(ZoneInfo("America/Sao_Paulo")).isoformat(timespec="seconds"),
        "eleitos": out,
    }
    SAIDA.write_text(json.dumps(dados, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    trocaram = sum(1 for e in out if e["partido_2026"] and e["partido_2026"] != e["partido_2022"])
    print(f"executivos: {sum(e['deixou_cargo'] for e in out)} deixaram o cargo para concorrer;", end=" ")
    print(f"executivos: {len(out)} eleitos em 2022; {sum(1 for e in out if e['sq_2026'])} concorrem em 2026 ({trocaram} trocaram de partido) → {SAIDA}")


if __name__ == "__main__":
    run()
