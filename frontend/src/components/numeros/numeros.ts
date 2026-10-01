import type { Cargo } from '@/data/types';

export const CARGOS_NUMEROS = [
  'presidente',
  'governador',
  'senador',
  'deputado-federal',
  'deputado-estadual',
  'deputado-distrital',
] as const satisfies readonly Cargo[];

export type CargoNumeros = (typeof CARGOS_NUMEROS)[number];

export const CARGO_TAB_LABEL: Record<CargoNumeros, string> = {
  presidente: 'Presidente',
  governador: 'Governador',
  senador: 'Senador',
  'deputado-federal': 'Deputado federal',
  'deputado-estadual': 'Deputado estadual',
  'deputado-distrital': 'Deputado distrital',
};

/** Offices whose seats are filled per UF (shown on the tile map). */
export const CARGOS_POR_UF: readonly CargoNumeros[] = ['governador', 'senador', 'deputado-federal', 'deputado-estadual'];

const SEM_INFO = /^(não informad|não divulg|#nulo|nulo$)/i;

/** Keeps a natural order: known keys first (in the given order), other keys alphabetically, "Não informado" last. */
export function ordenarNatural(entries: [string, number][], ordem: string[] = []): [string, number][] {
  const norm = (s: string) => s.replace(/-/g, '–').toLocaleLowerCase('pt-BR').trim();
  const idx = new Map(ordem.map((k, i) => [norm(k), i]));
  const rank = (k: string) => (SEM_INFO.test(k) ? 2 : idx.has(norm(k)) ? 0 : 1);
  return [...entries].sort((a, b) => {
    const ra = rank(a[0]);
    const rb = rank(b[0]);
    if (ra !== rb) return ra - rb;
    if (ra === 0) return idx.get(norm(a[0]))! - idx.get(norm(b[0]))!;
    return a[0].localeCompare(b[0], 'pt-BR');
  });
}

export const ORDEM_FAIXA_ETARIA = ['18–29', '30–39', '40–49', '50–59', '60–69', '70+'];

export const ORDEM_INSTRUCAO = [
  'Analfabeto',
  'Lê e escreve',
  'Ensino fundamental incompleto',
  'Ensino fundamental completo',
  'Ensino médio incompleto',
  'Ensino médio completo',
  'Superior incompleto',
  'Superior completo',
];

/** TSE campaign-finance source codes → plain-language labels. */
export function fonteReceitaLabel(chave: string): string {
  const k = chave.toUpperCase();
  if (k.includes('ESPECIAL')) return 'FEFC (Fundo Especial de Financiamento de Campanha)';
  if (k.includes('PARTIDARIO') || k.includes('PARTIDÁRIO')) return 'Fundo Partidário';
  if (k.includes('OUTROS')) return 'Outros recursos';
  if (SEM_INFO.test(chave)) return 'Fonte não informada';
  return chave;
}

const dec1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });

/** "12,3 por vaga" */
export function porVaga(v: number): string {
  return `${dec1.format(v)} por vaga`;
}
