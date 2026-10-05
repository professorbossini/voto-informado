/**
 * Geometria do plenário em semicírculo (hemiciclo): uma posição por cadeira, em fileiras
 * concêntricas, e a distribuição dos grupos em "fatias" da esquerda para a direita.
 */

export interface Assento {
  x: number;
  y: number;
  /** Raio da bolinha. */
  r: number;
  /** Ângulo em radianos (π = extrema esquerda, 0 = extrema direita). */
  angulo: number;
  fileira: number;
}

export interface Hemiciclo {
  largura: number;
  altura: number;
  cx: number;
  cy: number;
  raioInterno: number;
  raioExterno: number;
  assentos: Assento[];
}

/**
 * Posições de `n` cadeiras num semicírculo de raio `raio` com centro na base. Escolhe o menor
 * número de fileiras em que todas cabem e reparte as cadeiras proporcionalmente ao
 * comprimento de cada fileira (as de fora têm mais lugares).
 */
export function hemiciclo(n: number, { raio = 480, proporcaoInterna = 0.4, margem = 4 } = {}): Hemiciclo {
  const r0 = raio * proporcaoInterna;
  if (n <= 0) return { largura: (raio + margem) * 2, altura: raio + margem * 2, cx: raio + margem, cy: raio + margem, raioInterno: r0, raioExterno: raio, assentos: [] };

  // Menor número de fileiras em que cabem n cadeiras com espaçamento ~igual ao das fileiras.
  let fileiras = 1;
  let passo = raio - r0;
  for (; fileiras < 60; fileiras++) {
    passo = (raio - r0) / Math.max(fileiras - 1, 1);
    const raios = Array.from({ length: fileiras }, (_, i) => (fileiras === 1 ? (raio + r0) / 2 : r0 + i * passo));
    const cabem = raios.reduce((s, ri) => s + Math.floor((Math.PI * ri) / passo) + 1, 0);
    if (cabem >= n) break;
  }
  const raios = Array.from({ length: fileiras }, (_, i) => (fileiras === 1 ? (raio + r0) / 2 : r0 + i * passo));

  // Cadeiras por fileira proporcional ao raio (maiores restos), cada uma com pelo menos 1.
  const soma = raios.reduce((s, r) => s + r, 0);
  const exatos = raios.map((r) => (n * r) / soma);
  const porFileira = exatos.map(Math.floor);
  let falta = n - porFileira.reduce((s, v) => s + v, 0);
  const ordem = exatos.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; falta > 0; k = (k + 1) % ordem.length, falta--) porFileira[ordem[k][1]]++;

  // Tamanho da bolinha: cabe na fileira e entre fileiras.
  const espacoNaFileira = Math.min(...raios.map((ri, i) => (porFileira[i] > 1 ? (Math.PI * ri) / (porFileira[i] - 1) : Infinity)));
  const r = Math.max(2, Math.min(espacoNaFileira, fileiras > 1 ? passo : raio - r0) * 0.42);
  // A bolinha da ponta não pode ser cortada: o desenho cresce o raio dela além do semicírculo.
  const cx = raio + r + margem;
  const cy = raio + r + margem;

  const assentos: Assento[] = [];
  raios.forEach((ri, f) => {
    const k = porFileira[f];
    for (let j = 0; j < k; j++) {
      const angulo = k === 1 ? Math.PI / 2 : Math.PI - (Math.PI * j) / (k - 1);
      assentos.push({ x: cx + ri * Math.cos(angulo), y: cy - ri * Math.sin(angulo), r, angulo, fileira: f });
    }
  });
  // Da esquerda para a direita; no mesmo ângulo, de dentro para fora (fatias por grupo).
  assentos.sort((a, b) => b.angulo - a.angulo || a.fileira - b.fileira);
  return { largura: cx * 2, altura: cy + r + margem, cx, cy, raioInterno: r0, raioExterno: raio, assentos };
}

/**
 * Partido (índice do grupo) de cada cadeira, na ordem de `assentos`. Cada fileira recebe os
 * grupos na mesma proporção, da esquerda para a direita, o que forma "fatias" retas; a soma
 * por grupo é sempre exata. `quantidades` precisa somar o número de cadeiras.
 */
export function gruposPorAssento(assentos: Assento[], quantidades: number[]): number[] {
  const n = assentos.length;
  const sequencial = () => {
    const ordem = assentos.map((_, i) => i).sort((a, b) => assentos[b].angulo - assentos[a].angulo || assentos[a].fileira - assentos[b].fileira);
    const grupos = quantidades.flatMap((q, g) => Array.from({ length: q }, () => g));
    const out = new Array<number>(n);
    ordem.forEach((idx, k) => (out[idx] = grupos[k]));
    return out;
  };
  if (quantidades.reduce((s, q) => s + q, 0) !== n || n === 0) return sequencial();

  const nFileiras = Math.max(...assentos.map((a) => a.fileira)) + 1;
  const fileiras = Array.from({ length: nFileiras }, (_, f) =>
    assentos
      .map((a, i) => [a, i] as const)
      .filter(([a]) => a.fileira === f)
      .sort((x, y) => y[0].angulo - x[0].angulo)
      .map(([, i]) => i),
  );
  const k = fileiras.map((l) => l.length);
  const out = new Array<number>(n);
  let antes = k.map(() => 0);
  let acumulado = 0;
  for (let g = 0; g < quantidades.length; g++) {
    acumulado += quantidades[g];
    // Até onde, em cada fileira, vão os grupos 0..g: proporcional, inteiro e nunca recuando.
    const ideal = k.map((kf) => (kf * acumulado) / n);
    const ate = ideal.map((x, f) => Math.max(Math.floor(x), antes[f]));
    let falta = acumulado - ate.reduce((s, v) => s + v, 0);
    const candidatas = ideal
      .map((x, f) => [x - Math.floor(x), f] as const)
      .filter(([, f]) => ate[f] === Math.floor(ideal[f]) && ate[f] < k[f])
      .sort((a, b) => b[0] - a[0]);
    if (falta < 0 || falta > candidatas.length) return sequencial();
    for (const [, f] of candidatas) {
      if (falta-- <= 0) break;
      ate[f]++;
    }
    fileiras.forEach((lista, f) => {
      for (let j = antes[f]; j < ate[f]; j++) out[lista[j]] = g;
    });
    antes = ate;
  }
  return out;
}
