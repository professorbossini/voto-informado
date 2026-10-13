"""Estados Unidos: dados públicos oficiais do governo federal americano (e compilações em domínio
público), no mesmo espírito do Tá na Urna para o Brasil. Módulo isolado: grava só em
<site>/api/eua/ e <site>/eua/ (páginas por rota) e não lê nem altera nada dos dados do Brasil.

Orquestração e agenda em etl.eua.montar (rodado por .github/workflows/eua.yml).
"""
