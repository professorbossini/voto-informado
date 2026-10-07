import type { BarDatum } from '@/components/charts/charts';
import { ordenarNatural } from '@/components/numeros/numeros';
import { number, percent } from '@/data/format';
import type { CasaPerfil, ContagemPerfil } from '@/data/types';

export const CASAS_PERFIL: readonly CasaPerfil[] = ['camara', 'senado', 'assembleias'];

export const ABA_CASA: Record<CasaPerfil, string> = {
  camara: 'Câmara',
  senado: 'Senado',
  assembleias: 'Assembleias',
};

/** Fração com o total como base; sem total, null (vira "Não informado"). */
export function fracao(n: number, total: number): number | null {
  return total > 0 ? n / total : null;
}

/** "90 · 17,5%" */
export function rotuloContagem(n: number, total: number): string {
  return `${number(n)} · ${percent(fracao(n, total))}`;
}

/**
 * As mesmas categorias, na mesma ordem, nos dois anos: as que só aparecem num deles entram com 0
 * no outro, para as linhas ficarem lado a lado. Ordem: `ordem` (faixa, instrução), depois
 * alfabética, "Não informado" por último.
 */
export function alinhar(antes: ContagemPerfil[], depois: ContagemPerfil[], ordem: string[] = []): { nome: string; antes: number; depois: number }[] {
  const a = new Map(antes.map((c) => [c.nome, c.n]));
  const d = new Map(depois.map((c) => [c.nome, c.n]));
  const nomes = ordenarNatural([...new Set([...a.keys(), ...d.keys()])].map((k): [string, number] => [k, 0]), ordem).map(([k]) => k);
  return nomes.map((nome) => ({ nome, antes: a.get(nome) ?? 0, depois: d.get(nome) ?? 0 }));
}

/**
 * Barras em porcentagem do total do ano (para comparar anos com totais diferentes), com o número
 * absoluto no rótulo. `escala` é o maior percentual dos dois anos: as duas listas na mesma régua.
 */
export function barrasPercentuais(itens: { nome: string; n: number }[], total: number): BarDatum[] {
  return itens.map(({ nome, n }) => {
    const txt = rotuloContagem(n, total);
    return { label: nome, value: fracao(n, total) ?? 0, display: txt, hint: `${nome}: ${txt}` };
  });
}

export function escalaComum(...listas: BarDatum[][]): number {
  return Math.max(0, ...listas.flat().map((d) => d.value));
}

/** "+3,7 p.p." / "−1,2 p.p." / "0 p.p.": diferença entre duas frações, em pontos percentuais. */
export function pontosPercentuais(antes: number | null, depois: number | null): string | null {
  if (antes == null || depois == null) return null;
  const pp = Math.round((depois - antes) * 1000) / 10;
  const abs = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(Math.abs(pp));
  return `${pp > 0 ? '+' : pp < 0 ? '−' : ''}${abs} p.p.`;
}

export function contagemDe(lista: ContagemPerfil[], nome: string): number {
  return lista.find((c) => c.nome === nome)?.n ?? 0;
}
