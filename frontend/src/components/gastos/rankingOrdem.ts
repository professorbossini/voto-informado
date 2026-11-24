import { ordenarPor, type Ordem as OrdemTabela, type Sentido } from '@/components/tabela/ordenacao';
import { NAO_INFORMADO } from '@/data/format';
import type { ParlamentarResumo } from '@/data/types';
import type { RankingRow } from './RankingList';

/** Ordem do ranking de gastos, como fica na URL (?ordem=): "coluna-sentido"; nome e partido A–Z sem sufixo. */
export function partidoUf(p: ParlamentarResumo) {
  return `${p.partido ?? NAO_INFORMADO}-${p.uf ?? NAO_INFORMADO}`;
}

export type Ordem =
  | 'valor-desc'
  | 'valor-asc'
  | 'mensal-desc'
  | 'mensal-asc'
  | 'nome'
  | 'nome-desc'
  | 'partido'
  | 'partido-desc'
  | 'comparacao-desc'
  | 'comparacao-asc';

/** Colunas da tabela do ranking e o valor de cada uma (a ordem fica na URL como "coluna-sentido"). */
export const COLUNAS_RANKING = {
  nome: (r: RankingRow) => r.p.nome,
  partido: (r: RankingRow) => partidoUf(r.p),
  valor: (r: RankingRow) => r.valor,
  mensal: (r: RankingRow) => r.mediaMensal,
  comparacao: (r: RankingRow) => r.diff,
};
export type ColunaRanking = keyof typeof COLUNAS_RANKING;

export function ordemDaUrl(o: Ordem): OrdemTabela<ColunaRanking> {
  const [coluna, sentido] = o.split('-') as [ColunaRanking, Sentido | undefined];
  return { coluna, sentido: sentido ?? 'asc' };
}

export function ordemParaUrl(o: OrdemTabela<ColunaRanking>): Ordem {
  return (o.sentido === 'asc' && (o.coluna === 'nome' || o.coluna === 'partido') ? o.coluna : `${o.coluna}-${o.sentido}`) as Ordem;
}

/** Linhas na ordem escolhida (vazios por último; empate fica na ordem do ranking por valor). */
export function ordenarRanking(rows: RankingRow[], o: Ordem): RankingRow[] {
  return ordenarPor(rows, COLUNAS_RANKING, ordemDaUrl(o));
}
