import { gruposPorAssento, hemiciclo } from './hemiciclo';

describe('hemiciclo do plenário', () => {
  it.each([512, 513, 80, 81, 1, 10])('%i cadeiras: todas desenhadas, sem sobreposição e dentro do desenho', (n) => {
    const h = hemiciclo(n);
    expect(h.assentos).toHaveLength(n);
    for (const a of h.assentos) {
      expect(a.x - a.r).toBeGreaterThanOrEqual(0);
      expect(a.x + a.r).toBeLessThanOrEqual(h.largura);
      expect(a.y - a.r).toBeGreaterThanOrEqual(0);
      expect(a.y + a.r).toBeLessThanOrEqual(h.altura);
    }
    for (let i = 0; i < h.assentos.length; i++) {
      for (let j = i + 1; j < h.assentos.length; j++) {
        const a = h.assentos[i];
        const b = h.assentos[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - 1e-6);
      }
    }
  });

  it.each([
    [80, [15, 14, 9, 9, 8, 6, 6, 4, 3, 3, 2, 1]],
    [512, [99, 1, 67, 59, 44, 45, 42, 30, 25, 18, 17, 14, 13, 12, 9, 7, 6, 4]],
    [10, [0, 7, 3]],
  ])('%i cadeiras: cada partido recebe exatamente as suas, em fatias da esquerda para a direita', (n, qs) => {
    const h = hemiciclo(n);
    const g = gruposPorAssento(h.assentos, qs);
    qs.forEach((q, i) => expect(g.filter((x) => x === i)).toHaveLength(q));
    // Em cada fileira, os grupos aparecem em ordem (sem voltar a um grupo anterior).
    for (let f = 0; f <= Math.max(...h.assentos.map((a) => a.fileira)); f++) {
      const linha = h.assentos.map((a, i) => [a, g[i]] as const).filter(([a]) => a.fileira === f).sort((x, y) => y[0].angulo - x[0].angulo);
      for (let j = 1; j < linha.length; j++) expect(linha[j][1]).toBeGreaterThanOrEqual(linha[j - 1][1]);
    }
  });
});
