import { describe, expect, it } from 'vitest';
import type { Apuracao, CandidatoApurado } from '@/data/apuracao';
import { disputasApertadas, somarRegioes } from './disputas';
import { dataTse } from './serie';

const cand = (sq: string, nomeUrna: string, votos: number, pct: number, extra: Partial<CandidatoApurado> = {}): CandidatoApurado => ({
  sq,
  numero: sq,
  nomeUrna,
  nome: nomeUrna,
  partido: 'P',
  agremiacao: null,
  votos,
  pct,
  posicao: 0,
  eleito: false,
  situacao: null,
  destinacao: 'Válido',
  vices: [],
  ...extra,
});

const ap = (uf: string, cands: CandidatoApurado[], { vagas = 1, secoes = [100, 50], final = false } = {}): Apuracao => ({
  turno: 1,
  cargo: 'presidente',
  uf,
  url: '',
  atualizado: '',
  final,
  vagas,
  secoes: { total: secoes[0], totalizadas: secoes[1], pct: (100 * secoes[1]) / secoes[0] },
  eleitorado: { total: 0, comparecimento: 0, pctComparecimento: 0, abstencao: 0, pctAbstencao: 0 },
  votos: { total: 0, validos: cands.reduce((s, c) => s + c.votos, 0), brancos: 0, pctBrancos: 0, nulos: 0, pctNulos: 0 },
  candidatos: [...cands].sort((a, b) => b.votos - a.votos),
  bancadas: [],
});

describe('somarRegioes', () => {
  it('soma os votos das UFs da região e calcula o % sobre os válidos da região', () => {
    const porUf = {
      SP: ap('SP', [cand('1', 'ANA', 600, 60), cand('2', 'BIA', 400, 40)], { secoes: [100, 100] }),
      RJ: ap('RJ', [cand('1', 'ANA', 100, 20), cand('2', 'BIA', 400, 80)], { secoes: [100, 0] }),
    };
    const [sudeste] = somarRegioes(porUf);
    expect(sudeste.nome).toBe('Sudeste');
    expect(sudeste.primeiros.map((p) => [p.c.nomeUrna, p.votos])).toEqual([
      ['BIA', 800],
      ['ANA', 700],
    ]);
    expect(sudeste.primeiros[0].pct).toBeCloseTo((100 * 800) / 1500);
    expect(sudeste.secoes).toBe(50);
  });

  it('põe o exterior numa linha própria, depois das regiões', () => {
    const linhas = somarRegioes({ SC: ap('SC', [cand('1', 'ANA', 10, 100)]) }, ap('ZZ', [cand('1', 'ANA', 5, 100)]));
    expect(linhas.map((l) => l.nome)).toEqual(['Sul', 'Exterior']);
  });

  it('região sem voto ainda aparece, sem líder', () => {
    const [norte] = somarRegioes({ AC: ap('AC', [cand('1', 'ANA', 0, 0)]) });
    expect(norte.primeiros).toEqual([]);
  });
});

describe('disputasApertadas', () => {
  it('ordena da menor para a maior diferença entre 1º e 2º', () => {
    const d = disputasApertadas({
      SP: ap('SP', [cand('1', 'ANA', 600, 60), cand('2', 'BIA', 400, 40)]),
      MG: ap('MG', [cand('1', 'ANA', 510, 51), cand('2', 'BIA', 490, 49)]),
    });
    expect(d.map((x) => [x.uf, x.pontos])).toEqual([
      ['MG', 2],
      ['SP', 20],
    ]);
    expect(d[0].votos).toBe(20);
  });

  it('com duas vagas (Senado), compara a 2ª com a 3ª', () => {
    const [d] = disputasApertadas({ BA: ap('BA', [cand('1', 'A', 500, 50), cand('2', 'B', 300, 30), cand('3', 'C', 200, 20)], { vagas: 2 }) });
    expect([d.dentro.nomeUrna, d.fora.nomeUrna, d.pontos]).toEqual(['B', 'C', 10]);
  });

  it('marca como definida a disputa com eleito ou com 2º turno', () => {
    const [d] = disputasApertadas({ PE: ap('PE', [cand('1', 'A', 500, 50, { situacao: '2º turno' }), cand('2', 'B', 490, 49, { situacao: '2º turno' })]) });
    expect(d.definida).toBe(true);
  });

  it('ignora UF sem votos ou sem segundo colocado', () => {
    expect(disputasApertadas({ AC: ap('AC', [cand('1', 'A', 0, 0), cand('2', 'B', 0, 0)]), AP: ap('AP', [cand('1', 'A', 10, 100)]), AM: null })).toEqual([]);
  });
});

describe('dataTse', () => {
  it('lê a hora do TSE como horário de Brasília', () => {
    expect(dataTse('25/10/2026 19:02:11')?.toISOString()).toBe('2026-10-25T22:02:11.000Z');
    expect(dataTse('lixo')).toBeNull();
  });
});
