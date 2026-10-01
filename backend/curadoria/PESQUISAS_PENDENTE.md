# Pesquisas eleitorais — PENDENTE (fora do ar)

`pesquisas.json` reúne 55 pesquisas registradas no TSE (1º turno, cenários de 2º turno e governador),
transcritas de divulgações dos institutos e da imprensa, cada uma com suas fontes.

**Por que está desligado:** os números de registro foram confirmados em duas ou mais fontes de imprensa,
mas não diretamente no sistema PesqEle do TSE (o acesso automatizado é bloqueado). Divulgar pesquisa sem
registro válido sujeita a multa (Lei 9.504/97, art. 33, §3º).

**Para publicar de novo:**
1. Conferir cada `registro_tse` em https://pesqele-divulgacao.tse.jus.br (instituto, datas e amostra).
2. Atualizar `pesquisas.json` com rodadas mais recentes, se houver.
3. Ligar as chaves: `PESQUISAS_ATIVAS=1` (backend) e `VITE_ENABLE_PESQUISAS=true` (frontend/.env).
4. `PESQUISAS_ATIVAS=1 make dados` e `PESQUISAS_ATIVAS=1 make publicar`.

A carga (`etl/pesquisas.py`) recusa qualquer pesquisa com campo obrigatório ausente, registro fora do
padrão, soma incoerente ou nome que não exista na base do TSE.
