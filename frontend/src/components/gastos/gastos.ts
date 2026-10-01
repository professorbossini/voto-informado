/**
 * Shared helpers for the parliamentary allowance pages (cota parlamentar: CEAP/CEAPS).
 * Fair comparisons are monthly: total ÷ months with records, against the mean of the
 * same ratio among colleagues of the same house and UF in the same period.
 */
import type { AvisoGastos, ParlamentarResumo } from '@/data/types';

export type Casa = ParlamentarResumo['casa'];
export type CasaFiltro = Casa | 'todas';
/** A single year ("2024") or the whole legislature. */
export type Periodo = string;
export const LEGISLATURA = 'legislatura';

export const CASA_LABEL: Record<Casa, string> = { camara: 'Câmara', senado: 'Senado' };
export const CASA_NOME: Record<Casa, string> = { camara: 'Câmara dos Deputados', senado: 'Senado Federal' };

/** Last calendar year with complete official files (see the SIGEPA gap notice). */
export const ANO_PADRAO = '2024';

/**
 * Every travel-ticket category ("Passagens aéreas", "Passagens aéreas, aquáticas e terrestres",
 * "Passagens terrestres, marítimas ou fluviais"). Removing them makes years and houses comparable,
 * because the Câmara files lack airline tickets issued via SIGEPA from Aug/2025 on.
 */
export function isPassagem(categoria: string): boolean {
  return categoria.trim().toLocaleLowerCase('pt-BR').startsWith('passagens');
}

/** Notices relevant to a house (or both) and a set of years. */
export function avisosRelevantes(avisos: AvisoGastos[] | undefined, casa: CasaFiltro, anos: number[]): AvisoGastos[] {
  return (avisos ?? []).filter(
    (a) =>
      (casa === 'todas' || a.casa === 'ambas' || a.casa === casa) &&
      (a.anos.length === 0 || a.anos.some((y) => anos.includes(y))),
  );
}

/** Notices that point to a gap in the official source (shown as warnings). */
export function isLacuna(aviso: AvisoGastos): boolean {
  return aviso.anos.length > 0 || /^lacuna/i.test(aviso.texto);
}

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MESES_LONGOS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** "jan/24" */
export function mesCurto(ano: number, mes: number): string {
  return `${MESES[mes - 1] ?? mes}/${String(ano).slice(-2)}`;
}

/** "janeiro de 2024" */
export function mesLongo(ano: number, mes: number): string {
  return `${MESES_LONGOS[mes - 1] ?? mes} de ${ano}`;
}

const signedPct = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
  minimumFractionDigits: 1,
  signDisplay: 'exceptZero',
});

/** "+12,3%" / "−4,0%" / "0,0%" — plain text, never colored. */
export function percentSigned(ratio: number | null | undefined): string | null {
  return ratio == null || !Number.isFinite(ratio) ? null : signedPct.format(ratio);
}

export function mesesTexto(n: number): string {
  return n === 1 ? '1 mês' : `${n} meses`;
}

export interface ValorPeriodo {
  valor: number;
  meses: number;
  /** valor ÷ meses with records; null when there are no months. */
  mediaMensal: number | null;
}

/** Total, months with records and monthly average in a period, or null when there is no record. */
export function valorNoPeriodo(p: ParlamentarResumo, periodo: Periodo, semPassagens: boolean): ValorPeriodo | null {
  const anos = periodo === LEGISLATURA ? Object.values(p.por_ano) : p.por_ano[periodo] ? [p.por_ano[periodo]] : [];
  if (!anos.length) return null;
  const valor = anos.reduce((s, a) => s + a.valor - (semPassagens ? (a.passagens ?? 0) : 0), 0);
  const meses = anos.reduce((s, a) => s + a.meses, 0);
  return { valor, meses, mediaMensal: meses > 0 ? valor / meses : null };
}

/**
 * Mean of the monthly averages per house + UF in the period, over everyone with records
 * in that period (same rule as the backend's `media_uf_por_ano.media_mensal`).
 */
export function mediasPorCasaUf(
  lista: ParlamentarResumo[],
  periodo: Periodo,
  semPassagens: boolean,
): Map<string, { media: number; n: number }> {
  const acc = new Map<string, { soma: number; n: number }>();
  for (const p of lista) {
    if (!p.uf) continue;
    const v = valorNoPeriodo(p, periodo, semPassagens);
    if (!v || v.mediaMensal == null) continue;
    const key = `${p.casa}:${p.uf}`;
    const cur = acc.get(key) ?? { soma: 0, n: 0 };
    cur.soma += v.mediaMensal;
    cur.n += 1;
    acc.set(key, cur);
  }
  const out = new Map<string, { media: number; n: number }>();
  acc.forEach((v, k) => out.set(k, { media: v.n ? v.soma / v.n : 0, n: v.n }));
  return out;
}
