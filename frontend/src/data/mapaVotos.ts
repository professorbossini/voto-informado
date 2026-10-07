import { contornosUf, type MalhaMunicipal } from './localizacao';

/**
 * Mapa do voto por município: dados publicados pelo etl.mapa_votos em api/mapa/presidente-<turno>t.json
 * (arquivos de cada município no TSE, só os de totalização final) e a geometria das malhas
 * municipais do IBGE já publicadas no site (api/legislativos/malhas/<UF>.json).
 */

export interface CandidatoMapa {
  sq: string;
  numero: string;
  nome_urna: string;
  partido: string;
}

export interface MapaVotos {
  cargo: 'presidente';
  turno: 1 | 2;
  eleicao: string;
  ciclo: string;
  fonte: { nome: string; url: string; config: string; pagina: string };
  gerado_em: string;
  /** Arquivo mais recente do TSE, horário de Brasília ("05/10/2026 12:53:07"). */
  atualizado_tse: string;
  municipios_finais: number;
  municipios_total: number;
  /** Em ordem alfabética do nome na urna. */
  candidatos: CandidatoMapa[];
  /** UF → código TSE → nome como publicado pelo TSE (todos os municípios, inclusive sem resultado final). */
  nomes: Record<string, Record<string, string>>;
  /** UF → código TSE → [votos válidos, votos de cada candidato na ordem de `candidatos`]. ZZ = exterior. */
  municipios: Record<string, Record<string, number[]>>;
}

// ── Geometria ────────────────────────────────────────────────────────────────

/**
 * Projeção equirretangular com a longitude encolhida pelo cosseno de 15° S (latitude média do
 * país): x = lon × cos 15°, y = −lat, em graus. Simples e sem distorção visível nessa faixa.
 */
export const ESCALA_X = Math.cos((15 * Math.PI) / 180);

export type Caixa = [number, number, number, number];

export interface FormaMunicipio {
  cd: string;
  uf: string;
  /** Anéis projetados: x0, y0, x1, y1, ... */
  aneis: Float32Array[];
  caixa: Caixa;
}

/** Anel da malha (graus × 10⁴, 1º ponto absoluto e os demais como diferença) → anel projetado. */
export function decodificarAnel(cods: number[]): Float32Array {
  const out = new Float32Array(cods.length - (cods.length % 2));
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < cods.length; i += 2) {
    x += cods[i];
    y += cods[i + 1];
    out[i] = x * 1e-4 * ESCALA_X;
    out[i + 1] = -y * 1e-4;
  }
  return out;
}

/** Anel absoluto em graus × 10⁴ ([lon, lat]) → anel projetado. */
export function projetarAnel(pontos: [number, number][]): Float32Array {
  const out = new Float32Array(pontos.length * 2);
  pontos.forEach(([x, y], i) => {
    out[2 * i] = x * 1e-4 * ESCALA_X;
    out[2 * i + 1] = -y * 1e-4;
  });
  return out;
}

export function caixaDe(aneis: Float32Array[]): Caixa {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const r of aneis) {
    for (let i = 0; i < r.length; i += 2) {
      if (r[i] < x0) x0 = r[i];
      if (r[i] > x1) x1 = r[i];
      if (r[i + 1] < y0) y0 = r[i + 1];
      if (r[i + 1] > y1) y1 = r[i + 1];
    }
  }
  return [x0, y0, x1, y1];
}

export function unirCaixas(caixas: Caixa[]): Caixa | null {
  if (!caixas.length) return null;
  return caixas.reduce((a, b) => [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.max(a[2], b[2]), Math.max(a[3], b[3])]);
}

/** Municípios de uma malha estadual, decodificados uma vez. */
export function formasDaMalha(malha: MalhaMunicipal): FormaMunicipio[] {
  return Object.entries(malha.municipios).map(([cd, aneis]) => {
    const r = aneis.map(decodificarAnel);
    return { cd, uf: malha.uf, aneis: r, caixa: caixaDe(r) };
  });
}

/** Contornos das UFs, projetados (divisas no mapa; o DF, que não tem malha municipal, usa o seu). */
let ufsProjetadas: { uf: string; aneis: Float32Array[]; caixa: Caixa }[] | null = null;
export function ufsNoMapa() {
  ufsProjetadas ??= contornosUf().map(({ uf, rings }) => {
    const aneis = rings.map(projetarAnel);
    return { uf, aneis, caixa: caixaDe(aneis) };
  });
  return ufsProjetadas;
}

/** Brasília: o DF é um município só, sem malha municipal publicada; vale o contorno do DF. */
export const MUN_BRASILIA = '97012';
export function formaBrasilia(): FormaMunicipio | null {
  const df = ufsNoMapa().find((u) => u.uf === 'DF');
  return df ? { cd: MUN_BRASILIA, uf: 'DF', aneis: df.aneis, caixa: df.caixa } : null;
}

/** Ponto dentro dos anéis (regra par-ímpar: ilhas e buracos incluídos). */
export function contemPonto(aneis: Float32Array[], x: number, y: number): boolean {
  let dentro = false;
  for (const r of aneis) {
    const n = r.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = r[2 * i];
      const yi = r[2 * i + 1];
      const xj = r[2 * j];
      const yj = r[2 * j + 1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

/** Município sob o ponto (coordenadas projetadas), ou null. */
export function municipioEm(formas: FormaMunicipio[], x: number, y: number): FormaMunicipio | null {
  for (const f of formas) {
    const [x0, y0, x1, y1] = f.caixa;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    if (contemPonto(f.aneis, x, y)) return f;
  }
  return null;
}

// ── Escala de cor ────────────────────────────────────────────────────────────

/**
 * Escala fixa, igual para todas as candidaturas: 10 faixas de 10 pontos percentuais dos votos
 * válidos (0–10%, 10–20%, ..., 90–100%). A mesma cor quer dizer a mesma porcentagem, seja qual for
 * a candidatura escolhida; faixas calculadas a partir dos dados (quantis) mudariam de candidatura
 * para candidatura e exagerariam diferenças pequenas.
 */
export const FAIXAS = 10;

/** Faixa (0 a 9) de uma porcentagem (0 a 100). */
export function faixa(pct: number): number {
  if (!Number.isFinite(pct) || pct <= 0) return 0;
  return Math.min(FAIXAS - 1, Math.floor(pct / (100 / FAIXAS)));
}

type Rgb = [number, number, number];

function hexParaRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as Rgb;
}

const linear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const gama = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB → OKLab (L de 0 a 1). */
export function oklab(hex: string): Rgb {
  const [r, g, b] = hexParaRgb(hex).map(linear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function oklabParaHex([L, A, B]: Rgb): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const rgb = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  return `#${rgb.map((c) => Math.round(Math.min(1, Math.max(0, gama(c))) * 255).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Uma só cor (o violeta da marca do site, a mesma para todas as candidaturas), do claro ao escuro, em passos iguais de luminosidade (OKLab). No tema escuro a escala se inverte:
 * mais voto = mais claro, para contrastar com o fundo.
 */
const EXTREMOS = {
  light: ['#EDE7FA', '#2A1263'], // violet 100 → violet 900 (tokens do tema)
  dark: ['#3B3158', '#EDE7FA'], // ink 700 → violet 100
} as const;

export function rampa(modo: 'light' | 'dark'): string[] {
  const [a, b] = EXTREMOS[modo].map(oklab);
  return Array.from({ length: FAIXAS }, (_, i) => {
    const t = i / (FAIXAS - 1);
    return oklabParaHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]);
  });
}

/** Cor neutra (cinza, com hachura no mapa) de "sem resultado final". */
export const SEM_DADO = { light: { fundo: '#E3E3E3', traco: '#9A9A9A' }, dark: { fundo: '#2A2A2E', traco: '#66666C' } } as const;

// ── Resultados ───────────────────────────────────────────────────────────────

/** Linha publicada de um município (código TSE → [válidos, votos...]), procurando em todas as UFs. */
export function indexarMunicipios(mapa: MapaVotos): Map<string, { uf: string; linha: number[] }> {
  const out = new Map<string, { uf: string; linha: number[] }>();
  for (const [uf, muns] of Object.entries(mapa.municipios)) {
    for (const [cd, linha] of Object.entries(muns)) out.set(cd, { uf, linha });
  }
  return out;
}

/** % dos votos válidos de um candidato (índice na lista) no município; null sem votos válidos. */
export function pctNaLinha(linha: number[], indice: number): number | null {
  const validos = linha[0];
  if (!validos) return null;
  return (100 * (linha[indice + 1] ?? 0)) / validos;
}

export interface VotoCandidato {
  candidato: CandidatoMapa;
  votos: number;
  pct: number;
}

/**
 * Votação de todas as candidaturas num município (ou num total), na ordem oficial do TSE:
 * mais votados primeiro; empate em ordem alfabética.
 */
export function votacaoDaLinha(mapa: MapaVotos, linha: number[]): VotoCandidato[] {
  const validos = linha[0] || 0;
  return mapa.candidatos
    .map((candidato, i) => ({ candidato, votos: linha[i + 1] ?? 0, pct: validos ? (100 * (linha[i + 1] ?? 0)) / validos : 0 }))
    .sort((a, b) => b.votos - a.votos || a.candidato.nome_urna.localeCompare(b.candidato.nome_urna, 'pt-BR'));
}

/** Soma de várias linhas (total de uma UF, do exterior ou do país). */
export function somarLinhas(linhas: Iterable<number[]>, tamanho: number): number[] {
  const total = new Array<number>(tamanho).fill(0);
  for (const l of linhas) for (let i = 0; i < tamanho; i++) total[i] += l[i] ?? 0;
  return total;
}

export interface ResumoUf {
  uf: string;
  /** Municípios com totalização final / todos os municípios da UF. */
  finais: number;
  total: number;
  /** [válidos, votos de cada candidato] somados nos municípios com totalização final. */
  linha: number[];
}

/** Total de cada UF (e do exterior, ZZ) somando os municípios de totalização final. */
export function resumoPorUf(mapa: MapaVotos): ResumoUf[] {
  const tamanho = mapa.candidatos.length + 1;
  return Object.keys(mapa.nomes)
    .sort()
    .map((uf) => {
      const muns = mapa.municipios[uf] ?? {};
      return {
        uf,
        finais: Object.keys(muns).length,
        total: Object.keys(mapa.nomes[uf]).length,
        linha: somarLinhas(Object.values(muns), tamanho),
      };
    });
}
