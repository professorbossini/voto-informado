"""Notícias: as 5 mais recentes, com veículo e data, sem repetidos e sem o veículo no título."""

from __future__ import annotations

from etl.noticias import consulta_parlamentar, consulta_partido, itens


def _item(titulo, fonte, data, n):
    return f"""<item><title>{titulo} - {fonte}</title><link>https://news.google.com/rss/articles/{n}</link>
    <pubDate>{data}</pubDate><source url="https://{fonte.lower()}.com.br">{fonte}</source></item>"""


def test_cinco_mais_recentes_com_fonte_e_data():
    corpo = "".join(
        [
            _item("Notícia antiga", "Jornal A", "Mon, 01 Sep 2026 10:00:00 GMT", 1),
            _item("Notícia nova", "Jornal B", "Sun, 04 Oct 2026 23:00:00 GMT", 2),
            _item("Notícia nova", "Jornal C", "Sun, 04 Oct 2026 22:00:00 GMT", 3),  # mesmo título: repetida
            *[_item(f"Outra {i}", "Jornal D", f"Sat, {10 + i:02d} Sep 2026 10:00:00 GMT", 10 + i) for i in range(6)],
        ]
    )
    out = itens(f"<rss><channel>{corpo}</channel></rss>".encode())
    assert len(out) == 5
    assert out[0] == {
        "titulo": "Notícia nova",
        "fonte": "Jornal B",
        "fonte_url": "https://jornal b.com.br",
        "link": "https://news.google.com/rss/articles/2",
        "data": "2026-10-04T20:00-03:00",
    }
    assert [o["data"] for o in out] == sorted((o["data"] for o in out), reverse=True)
    assert all(" - Jornal" not in o["titulo"] for o in out)


def test_consultas():
    assert consulta_parlamentar("Alan Rick", "senado") == '"Alan Rick" senador when:30d'
    assert consulta_parlamentar("AJ Albuquerque", "camara") == '"AJ Albuquerque" deputado when:30d'
    assert consulta_partido("PODE", "PODEMOS") == '"partido Podemos" when:30d'
    assert consulta_partido("PL", "PARTIDO LIBERAL") == '"Partido Liberal" when:30d'
