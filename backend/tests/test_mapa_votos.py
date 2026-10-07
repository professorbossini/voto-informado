"""Mapa do voto por município (etl.mapa_votos): amostras pequenas no formato do TSE, sem rede."""

from __future__ import annotations

import json

from etl import mapa_votos as M

CONFIG = {
    "abr": [
        {"cd": "sp", "ds": "SÃO PAULO", "mu": [{"cd": "71072", "cdi": "3550308", "nm": "SÃO PAULO"}, {"cd": "62910", "cdi": "3509502", "nm": "CAMPINAS"}]},
        {"cd": "df", "ds": "DISTRITO FEDERAL", "mu": [{"cd": "97012", "cdi": "5300108", "nm": "BRASÍLIA"}]},
        {"cd": "zz", "ds": "EXTERIOR", "mu": [{"cd": "29254", "cdi": "", "nm": "ABIDJÃ"}]},
    ]
}


def arquivo_tse(votos: dict[str, int], final: bool = True, validos: int | None = None, hora: str = "12:00:00") -> dict:
    """Arquivo unificado de um município, só com os campos usados (formato de sp71072-c0001-e006257-u.json)."""
    cands = {
        "1": ("22", "ZÉ DA SILVA", "PX"),
        "2": ("13", "ANA SOUZA", "PY"),
        "3": ("30", "BETO", "PZ"),
    }

    def cand(sq):
        n, nmu, _ = cands[sq]
        return {"n": n, "sqcand": sq, "nm": nmu + " COMPLETO", "nmu": nmu, "seq": sq, "vap": str(votos.get(sq, 0)), "dvt": "Válido"}

    return {
        "ele": "6257",
        "tf": "s" if final else "n",
        "dg": "05/10/2026",
        "hg": hora,
        "v": {"vv": str(validos if validos is not None else sum(votos.values()))},
        "carg": [
            {
                "cd": "1",
                "agr": [
                    {"n": "1", "tp": "i", "par": [{"n": cands[sq][0], "sg": cands[sq][2], "cand": [cand(sq)]}]}
                    for sq in ("1", "2", "3")
                ],
            }
        ],
    }


def test_urls():
    assert M.url_municipio("6257", "SP", "71072").endswith("/6257/dados/sp/sp71072-c0001-e006257-u.json")
    assert M.url_config("6258").endswith("/6258/config/mun-e006258-cm.json")


def test_municipios_inclui_exterior_e_df():
    lista = M.municipios(CONFIG)
    assert ("ZZ", "29254", "ABIDJÃ") in lista
    assert ("DF", "97012", "BRASÍLIA") in lista
    assert len(lista) == 4


def test_ler_municipio():
    m = M.ler_municipio(arquivo_tse({"1": 10, "2": 30, "3": 5}, hora="19:01:02"))
    assert m["final"] is True
    assert m["validos"] == 45
    assert m["candidatos"]["2"] == {"sq": "2", "numero": "13", "nome_urna": "ANA SOUZA", "partido": "PY", "votos": 30}
    assert m["atualizado"] == "05/10/2026 19:01:02"
    assert M.ler_municipio(arquivo_tse({}, final=False))["final"] is False


def test_montar_so_finais_e_ordem_alfabetica():
    lista = M.municipios(CONFIG)
    lidos = {
        "71072": M.ler_municipio(arquivo_tse({"1": 100, "2": 300, "3": 50}, hora="13:00:00")),
        "62910": M.ler_municipio(arquivo_tse({"1": 7, "2": 3}, final=False)),  # parcial: fica de fora
        "97012": M.ler_municipio(arquivo_tse({"1": 40, "2": 60, "3": 0}, hora="12:30:00")),
        "29254": None,  # não publicado
    }
    doc = M.montar(1, "6257", lista, lidos)
    assert doc is not None
    # Candidatos em ordem alfabética do nome na urna, cada um uma vez só.
    assert [c["nome_urna"] for c in doc["candidatos"]] == ["ANA SOUZA", "BETO", "ZÉ DA SILVA"]
    assert set(doc["candidatos"][0]) == {"sq", "numero", "nome_urna", "partido"}
    # [votos válidos, votos na ordem da lista de candidatos]
    assert doc["municipios"] == {"DF": {"97012": [100, 60, 0, 40]}, "SP": {"71072": [450, 300, 50, 100]}}
    assert doc["municipios_finais"] == 2 and doc["municipios_total"] == 4
    assert doc["nomes"]["SP"]["62910"] == "CAMPINAS" and doc["nomes"]["ZZ"] == {"29254": "ABIDJÃ"}
    assert doc["atualizado_tse"] == "05/10/2026 13:00:00"
    assert doc["turno"] == 1 and doc["eleicao"] == "6257"
    assert "<uf><municipio>" in doc["fonte"]["url"]


def test_montar_sem_final_nao_grava():
    lista = M.municipios(CONFIG)
    assert M.montar(1, "6257", lista, {"71072": M.ler_municipio(arquivo_tse({"1": 1}, final=False))}) is None


def test_gravar_so_quando_muda(tmp_path):
    lista = M.municipios(CONFIG)
    lidos = {"71072": M.ler_municipio(arquivo_tse({"1": 1, "2": 2, "3": 3}))}
    destino = M.arquivo(tmp_path, 1)
    doc = M.montar(1, "6257", lista, lidos)
    assert M.gravar(destino, doc) is True
    texto = destino.read_text(encoding="utf-8")
    assert " " not in texto.split('"nomes"')[1].split('"municipios"')[1]  # JSON compacto
    # Mesma votação, outra hora de geração: não regrava.
    assert M.gravar(destino, {**doc, "gerado_em": "2030-01-01T00:00:00-03:00"}) is False
    lidos["97012"] = M.ler_municipio(arquivo_tse({"1": 5}))
    assert M.gravar(destino, M.montar(1, "6257", lista, lidos)) is True
    assert json.loads(destino.read_text(encoding="utf-8"))["municipios_finais"] == 2


def test_anteriores_e_completo(tmp_path):
    lista = M.municipios(CONFIG)
    lidos = {cd: M.ler_municipio(arquivo_tse({"1": 1, "2": 2, "3": 3})) for _uf, cd, _n in lista}
    destino = M.arquivo(tmp_path, 1)
    M.gravar(destino, M.montar(1, "6257", lista, lidos))
    assert M.completo(destino) is True
    prev = M.anteriores(destino)
    assert prev["71072"]["validos"] == 6
    assert prev["71072"]["candidatos"]["2"]["votos"] == 2
    # Reconstruído do arquivo publicado, monta o mesmo documento.
    assert M._sem_data(M.montar(1, "6257", lista, prev)) == M._sem_data(json.loads(destino.read_text(encoding="utf-8")))


def test_run_mantem_municipio_que_falhou(tmp_path, monkeypatch):
    lista = M.municipios(CONFIG)
    arquivos = {cd: arquivo_tse({"1": 1, "2": 2, "3": 3}) for _uf, cd, _n in lista}
    arquivos["29254"] = arquivo_tse({"1": 1}, final=False)
    monkeypatch.setattr(M, "PAUSA", 0)

    def falso(_s, url, motivos=None):
        if url.endswith("-cm.json"):
            return CONFIG if "/6257/" in url else None
        cd = url.rsplit("/", 1)[1][2:7]
        return arquivos.get(cd)

    monkeypatch.setattr(M, "baixar", falso)
    assert M.run(tmp_path, [1, 2]) is True
    doc = json.loads(M.arquivo(tmp_path, 1).read_text(encoding="utf-8"))
    assert doc["municipios_finais"] == 3
    assert not M.arquivo(tmp_path, 2).exists()  # 2º turno ainda sem configuração publicada
    # O arquivo de São Paulo falha numa consulta seguinte: o valor publicado continua.
    del arquivos["71072"]
    assert M.run(tmp_path, [1]) is False
    assert json.loads(M.arquivo(tmp_path, 1).read_text(encoding="utf-8"))["municipios"]["SP"]["71072"] == [6, 2, 3, 1]
