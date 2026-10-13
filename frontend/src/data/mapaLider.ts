import { oklab } from './mapaVotos';
import { REGIAO_DA_UF, REGIOES } from './regioes';

/**
 * "Quem lidera" no mapa do voto: cada município pintado com a cor de quem teve mais votos nele, no
 * estado dele ou na região dele (conforme o nível escolhido), mais forte quanto maior a vantagem
 * sobre o 2º colocado. As cores seguem a ordem alfabética do nome na urna (nunca a cor do partido),
 * como no mapa da apuração.
 */

export type Nivel = 'mun' | 'uf' | 'regiao';

/** Linha de votos: [válidos, votos da candidatura 0, 1, ...] (o formato de mapaVotos). */
type Linha = number[];

/** Linha que vale para cada município no nível escolhido (a dele, a do estado ou a da região) e o nome da unidade. */
export function linhasDoNivel(
  municipios: Map<string, { uf: string; linha: Linha }>,
  porUf: { uf: string; linha: Linha }[],
  nivel: Nivel,
  tamanho: number,
): Map<string, { unidade: string; linha: Linha }> {
  const out = new Map<string, { unidade: string; linha: Linha }>();
  const ufs = new Map(porUf.map((r) => [r.uf, r.linha]));
  const regioes = new Map<string, Linha>();
  if (nivel === 'regiao') {
    for (const r of REGIOES) {
      const soma = new Array<number>(tamanho).fill(0);
      for (const uf of r.ufs) (ufs.get(uf) ?? []).forEach((v, i) => (soma[i] += v));
      regioes.set(r.nome, soma);
    }
  }
  for (const [cd, m] of municipios) {
    if (m.uf === 'ZZ') continue;
    if (nivel === 'mun') out.set(cd, { unidade: cd, linha: m.linha });
    else if (nivel === 'uf') out.set(cd, { unidade: m.uf, linha: ufs.get(m.uf) ?? m.linha });
    else {
      const reg = REGIAO_DA_UF[m.uf];
      out.set(cd, { unidade: reg ?? m.uf, linha: (reg && regioes.get(reg)) || m.linha });
    }
  }
  return out;
}

/** Quem lidera numa linha: índice da candidatura, % dos válidos e vantagem (pontos) sobre o 2º. */
export function liderDaLinha(linha: Linha): { indice: number; pct: number; vantagem: number } | null {
  const validos = linha[0] ?? 0;
  if (!validos) return null;
  let a = -1;
  let b = -1;
  for (let i = 1; i < linha.length; i++) {
    if (a < 0 || linha[i] > linha[a]) {
      b = a;
      a = i;
    } else if (b < 0 || linha[i] > linha[b]) b = i;
  }
  if (a < 0 || linha[a] <= 0) return null;
  const pct = (100 * linha[a]) / validos;
  const segundo = b > 0 ? (100 * linha[b]) / validos : 0;
  return { indice: a - 1, pct, vantagem: pct - segundo };
}

/** Degraus de vantagem (pontos percentuais): até 10, até 25, até 45, mais. */
export const DEGRAUS_VANTAGEM = [10, 25, 45] as const;

export function degrauVantagem(v: number): number {
  const i = DEGRAUS_VANTAGEM.findIndex((d) => v < d);
  return i < 0 ? DEGRAUS_VANTAGEM.length : i;
}

/** Quanto da cor entra em cada degrau (o resto é o fundo): vantagem pequena = cor mais suave. */
const FORCA = [0.42, 0.62, 0.8, 1];

/** Mistura duas cores em OKLab (t = 0 → a, t = 1 → b). */
export function misturar(a: string, b: string, t: number): string {
  const [x, y] = [oklab(a), oklab(b)];
  const L = x[0] + (y[0] - x[0]) * t;
  const A = x[1] + (y[1] - x[1]) * t;
  const B = x[2] + (y[2] - x[2]) * t;
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
  const gama = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);
  return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, gama(c))) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/** As 4 cores (degraus de vantagem) de uma candidatura, sobre o fundo do mapa. */
export function tonsDe(cor: string, fundo: string): string[] {
  return FORCA.map((t) => misturar(fundo, cor, t));
}

export interface PinturaLider {
  /** Faixa de cada município: grupo × 4 + degrau de vantagem. */
  faixas: Map<string, number>;
  /** Cores na ordem das faixas. */
  cores: string[];
  /** Quem aparece no mapa, em ordem alfabética, com a cor base e quantas unidades lidera. */
  legenda: { indice: number; cor: string; n: number }[];
}

/**
 * Pinta o mapa por quem lidera. `nomes[i]` = nome na urna da candidatura i (para a ordem
 * alfabética); `paleta` = cores categóricas validadas; quem passar delas fica com `neutra`.
 */
export function pintarLider(niveis: Map<string, { unidade: string; linha: Linha }>, nomes: string[], paleta: readonly string[], neutra: string, fundo: string): PinturaLider {
  const lider = new Map<string, ReturnType<typeof liderDaLinha>>();
  const unidades = new Map<number, Set<string>>();
  for (const [cd, { unidade, linha }] of niveis) {
    const l = liderDaLinha(linha);
    lider.set(cd, l);
    if (l) (unidades.get(l.indice) ?? unidades.set(l.indice, new Set()).get(l.indice)!).add(unidade);
  }
  const ordem = [...unidades.keys()].sort((a, b) => (nomes[a] ?? '').localeCompare(nomes[b] ?? '', 'pt-BR'));
  const grupo = new Map(ordem.map((ind, i) => [ind, Math.min(i, paleta.length)]));
  const cores: string[] = [];
  for (let g = 0; g <= paleta.length; g++) cores.push(...tonsDe(paleta[g] ?? neutra, fundo));
  const faixas = new Map<string, number>();
  for (const [cd, l] of lider) if (l) faixas.set(cd, grupo.get(l.indice)! * 4 + degrauVantagem(l.vantagem));
  return { faixas, cores, legenda: ordem.map((ind, i) => ({ indice: ind, cor: paleta[i] ?? neutra, n: unidades.get(ind)!.size })) };
}
