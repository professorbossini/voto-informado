import { UF_SHAPES } from '@/components/election/brazilMapData';

/**
 * Descobre a UF de um ponto (latitude/longitude) usando a malha oficial do IBGE que
 * o site já embute para o mapa. O cálculo é feito no próprio aparelho: a posição
 * nunca sai dele (nem para nós, nem para serviço de mapas).
 *
 * Os caminhos da malha estão em graus × 10⁴: x = longitude, y = latitude.
 */

type Ring = [number, number][];

let cache: Forma[] | null = null;

/** Lê os comandos usados pela malha (M absoluto, l/h relativos, Z). */
function parsePath(d: string): Ring[] {
  const rings: Ring[] = [];
  let ring: Ring = [];
  let x = 0;
  let y = 0;
  const tokens = d.match(/[MmLlHhVvZz]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let cmd = '';
  let i = 0;
  const next = () => Number(tokens[i++]);
  while (i < tokens.length) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      cmd = t;
      i++;
      if (cmd === 'Z' || cmd === 'z') {
        if (ring.length) rings.push(ring);
        ring = [];
      }
      continue;
    }
    switch (cmd) {
      case 'M':
        if (ring.length) rings.push(ring);
        x = next();
        y = next();
        ring = [[x, y]];
        cmd = 'L';
        break;
      case 'm':
        if (ring.length) rings.push(ring);
        x += next();
        y += next();
        ring = [[x, y]];
        cmd = 'l';
        break;
      case 'L':
        x = next();
        y = next();
        ring.push([x, y]);
        break;
      case 'l':
        x += next();
        y += next();
        ring.push([x, y]);
        break;
      case 'H':
        x = next();
        ring.push([x, y]);
        break;
      case 'h':
        x += next();
        ring.push([x, y]);
        break;
      case 'V':
        y = next();
        ring.push([x, y]);
        break;
      case 'v':
        y += next();
        ring.push([x, y]);
        break;
      default:
        i++;
    }
  }
  if (ring.length) rings.push(ring);
  return rings;
}

type Forma = { id: string; rings: Ring[]; box: [number, number, number, number] };

function forma(id: string, rings: Ring[]): Forma {
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);
  return { id, rings, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

function shapes() {
  if (!cache) cache = UF_SHAPES.map(({ uf, d }) => forma(uf, parsePath(d)));
  return cache;
}

function inside(x: number, y: number, rings: Ring[]): boolean {
  // Regra par-ímpar sobre todos os anéis (ilhas e buracos incluídos).
  let dentro = false;
  for (const r of rings) {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const [xi, yi] = r[i];
      const [xj, yj] = r[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
    }
  }
  return dentro;
}

function distSegmento(px: number, py: number, [ax, ay]: [number, number], [bx, by]: [number, number]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Forma que contém o ponto ou, se nenhuma, a mais próxima a até `tolerancia` (graus × 10⁴). */
function procurar(formas: Forma[], x: number, y: number, tolerancia: number): string | null {
  for (const s of formas) {
    const [x0, y0, x1, y1] = s.box;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    if (inside(x, y, s.rings)) return s.id;
  }
  let melhor: { id: string; d: number } | null = null;
  for (const s of formas) {
    const [x0, y0, x1, y1] = s.box;
    if (x < x0 - tolerancia || x > x1 + tolerancia || y < y0 - tolerancia || y > y1 + tolerancia) continue;
    for (const r of s.rings) {
      for (let i = 0; i < r.length - 1; i++) {
        const d = distSegmento(x, y, r[i], r[i + 1]);
        if (d <= tolerancia && (!melhor || d < melhor.d)) melhor = { id: s.id, d };
      }
    }
  }
  return melhor?.id ?? null;
}

/**
 * UF que contém o ponto. A malha é simplificada, então um ponto no litoral ou numa
 * divisa pode cair um pouco fora: nesse caso vale a UF mais próxima a até ~30 km.
 * Fora do Brasil, `null`.
 */
export function ufDoPonto(lat: number, lon: number): string | null {
  return procurar(shapes(), lon * 1e4, lat * 1e4, 0.3 * 1e4);
}

/**
 * Malha dos municípios de uma UF (IBGE), publicada em api/legislativos/malhas/<UF>.json pelo
 * etl.malhas_municipais: código do município no TSE → anéis em graus × 10⁴, com o primeiro
 * ponto absoluto e os demais como diferença do anterior.
 */
export interface MalhaMunicipal {
  uf: string;
  fonte: string;
  municipios: Record<string, number[][]>;
}

const cacheMunicipios = new WeakMap<MalhaMunicipal, Forma[]>();

function anel(cods: number[]): Ring {
  const r: Ring = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < cods.length; i += 2) {
    x += cods[i];
    y += cods[i + 1];
    r.push([x, y]);
  }
  return r;
}

/**
 * Código TSE do município que contém o ponto, também calculado no aparelho. Malha simplificada:
 * um ponto na praia ou na divisa vale para o município mais próximo a até ~5 km.
 */
export function municipioDoPonto(lat: number, lon: number, malha: MalhaMunicipal): string | null {
  let formas = cacheMunicipios.get(malha);
  if (!formas) {
    formas = Object.entries(malha.municipios).map(([cd, aneis]) => forma(cd, aneis.map(anel)));
    cacheMunicipios.set(malha, formas);
  }
  return procurar(formas, lon * 1e4, lat * 1e4, 0.05 * 1e4);
}
