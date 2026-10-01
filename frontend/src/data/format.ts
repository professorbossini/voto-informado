import type { Cargo } from './types';

const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const int = new Intl.NumberFormat('pt-BR');
const pct1 = new Intl.NumberFormat('pt-BR', { style: 'percent', maximumFractionDigits: 1 });

export const NAO_INFORMADO = 'Não informado';

/** R$ 1.234,56 — exact value, as published. */
export function money(value: number | null | undefined): string {
  return value == null ? NAO_INFORMADO : brl.format(value);
}

/** R$ 1.235 — rounded, for big totals in tables. */
export function money0(value: number | null | undefined): string {
  return value == null ? NAO_INFORMADO : brl0.format(value);
}

/** R$ 4,2 mi / R$ 950 mil — compact, for chart labels and tiles. */
export function moneyCompact(value: number | null | undefined): string {
  if (value == null) return NAO_INFORMADO;
  const abs = Math.abs(value);
  const fmt = (n: number, unit: string) =>
    `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: n < 10 ? 1 : 0 })} ${unit}`;
  if (abs >= 1e9) return fmt(value / 1e9, 'bi');
  if (abs >= 1e6) return fmt(value / 1e6, 'mi');
  if (abs >= 1e3) return fmt(value / 1e3, 'mil');
  return brl0.format(value);
}

export function number(value: number | null | undefined): string {
  return value == null ? NAO_INFORMADO : int.format(value);
}

export function percent(ratio: number | null | undefined): string {
  return ratio == null || !Number.isFinite(ratio) ? NAO_INFORMADO : pct1.format(ratio);
}

/** "30/09/2026 19:30:35" or ISO → "30/09/2026, 19:30". */
export function dateTime(value: string | null | undefined): string {
  if (!value) return NAO_INFORMADO;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/.exec(value);
  if (br) return `${br[1]}/${br[2]}/${br[3]}, ${br[4]}:${br[5]}`;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' });
}

export function dateLong(iso: string): string {
  return new Date(`${iso}T12:00:00-03:00`).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export const CARGO_LABEL: Record<Cargo, string> = {
  presidente: 'Presidente',
  'vice-presidente': 'Vice-presidente',
  governador: 'Governador(a)',
  'vice-governador': 'Vice-governador(a)',
  senador: 'Senador(a)',
  '1-suplente': '1º suplente',
  '2-suplente': '2º suplente',
  'deputado-federal': 'Deputado(a) federal',
  'deputado-estadual': 'Deputado(a) estadual',
  'deputado-distrital': 'Deputado(a) distrital',
};

export const CARGO_PLURAL: Partial<Record<Cargo, string>> = {
  presidente: 'Presidente',
  governador: 'Governador',
  senador: 'Senado',
  'deputado-federal': 'Deputados federais',
  'deputado-estadual': 'Deputados estaduais',
  'deputado-distrital': 'Deputados distritais',
};

/** Digits typed on the voting machine for each office. */
export const DIGITOS: Partial<Record<Cargo, number>> = {
  'deputado-federal': 4,
  'deputado-estadual': 5,
  'deputado-distrital': 5,
  senador: 3,
  governador: 2,
  presidente: 2,
};

/** Names keep the official spelling (TSE publishes them in capitals); we only soften the case. */
export function nomeProprio(nome: string | null | undefined): string {
  if (!nome) return '';
  const lower = new Set(['da', 'de', 'do', 'das', 'dos', 'e']);
  return nome
    .toLocaleLowerCase('pt-BR')
    .split(/(\s+|-)/)
    .map((w, i) => (i > 0 && lower.has(w) ? w : w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1)))
    .join('');
}

export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

/** Ratio change between two declared totals, or null when there is no baseline. */
export function variation(now: number | null | undefined, before: number | null | undefined): number | null {
  if (now == null || before == null || before <= 0) return null;
  return now / before - 1;
}
