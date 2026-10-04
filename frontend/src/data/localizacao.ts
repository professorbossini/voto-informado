import { UF_SHAPES } from '@/components/election/brazilMapData';

/**
 * Descobre a UF de um ponto (latitude/longitude) usando a malha oficial do IBGE que
 * o site já embute para o mapa. O cálculo é feito no próprio aparelho: a posição
 * nunca sai dele (nem para nós, nem para serviço de mapas).
 *
 * Os caminhos da malha estão em graus × 10⁴: x = longitude, y = latitude.
 */

type Ring = [number, number][];

let cache: { uf: string; rings: Ring[]; box: [number, number, number, number] }[] | null = null;

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

function shapes() {
  if (!cache) {
    cache = UF_SHAPES.map(({ uf, d }) => {
      const rings = parsePath(d);
      const xs = rings.flat().map((p) => p[0]);
      const ys = rings.flat().map((p) => p[1]);
      return { uf, rings, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] as [number, number, number, number] };
    });
  }
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

/**
 * UF que contém o ponto. A malha é simplificada, então um ponto no litoral ou numa
 * divisa pode cair um pouco fora: nesse caso vale a UF mais próxima a até ~30 km.
 * Fora do Brasil, `null`.
 */
export function ufDoPonto(lat: number, lon: number): string | null {
  const x = lon * 1e4;
  const y = lat * 1e4;
  const todas = shapes();
  for (const s of todas) {
    const [x0, y0, x1, y1] = s.box;
    if (x < x0 || x > x1 || y < y0 || y > y1) continue;
    if (inside(x, y, s.rings)) return s.uf;
  }
  const TOLERANCIA = 0.3 * 1e4; // ~0,3° ≈ 30 km
  let melhor: { uf: string; d: number } | null = null;
  for (const s of todas) {
    const [x0, y0, x1, y1] = s.box;
    if (x < x0 - TOLERANCIA || x > x1 + TOLERANCIA || y < y0 - TOLERANCIA || y > y1 + TOLERANCIA) continue;
    for (const r of s.rings) {
      for (let i = 0; i < r.length - 1; i++) {
        const d = distSegmento(x, y, r[i], r[i + 1]);
        if (d <= TOLERANCIA && (!melhor || d < melhor.d)) melhor = { uf: s.uf, d };
      }
    }
  }
  return melhor?.uf ?? null;
}
