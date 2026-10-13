import { describe, expect, it } from 'vitest';
import { degrauVantagem, liderDaLinha, linhasDoNivel, pintarLider } from './mapaLider';

describe('liderDaLinha', () => {
  it('acha quem teve mais votos, o % e a vantagem sobre o 2º', () => {
    expect(liderDaLinha([1000, 300, 550, 150])).toEqual({ indice: 1, pct: 55, vantagem: 25 });
  });
  it('sem votos válidos, ninguém lidera', () => {
    expect(liderDaLinha([0, 0, 0])).toBeNull();
  });
});

describe('degrauVantagem', () => {
  it('até 10, 25, 45 e mais pontos', () => {
    expect([0, 9.9, 10, 24.9, 25, 44.9, 45, 80].map(degrauVantagem)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });
});

describe('linhasDoNivel', () => {
  const muns = new Map([
    ['1', { uf: 'SP', linha: [100, 60, 40] }],
    ['2', { uf: 'RJ', linha: [100, 20, 80] }],
    ['3', { uf: 'ZZ', linha: [100, 50, 50] }],
  ]);
  const ufs = [
    { uf: 'SP', linha: [1000, 700, 300] },
    { uf: 'RJ', linha: [1000, 100, 900] },
  ];
  it('município: a própria linha; exterior fica fora do mapa', () => {
    const n = linhasDoNivel(muns, ufs, 'mun', 3);
    expect(n.get('1')?.linha).toEqual([100, 60, 40]);
    expect(n.has('3')).toBe(false);
  });
  it('estado: todo município recebe a linha do estado', () => {
    expect(linhasDoNivel(muns, ufs, 'uf', 3).get('2')).toEqual({ unidade: 'RJ', linha: [1000, 100, 900] });
  });
  it('região: soma dos estados da região', () => {
    expect(linhasDoNivel(muns, ufs, 'regiao', 3).get('1')).toEqual({ unidade: 'Sudeste', linha: [2000, 800, 1200] });
  });
});

describe('pintarLider', () => {
  it('cores em ordem alfabética do nome na urna, não pela ordem de votos', () => {
    const niveis = new Map([
      ['a', { unidade: 'a', linha: [100, 10, 90] }],
      ['b', { unidade: 'b', linha: [100, 70, 30] }],
    ]);
    const p = pintarLider(niveis, ['ZÉ', 'ANA'], ['#111111', '#222222', '#333333'], '#999999', '#ffffff');
    expect(p.legenda.map((l) => [l.indice, l.cor, l.n])).toEqual([
      [1, '#111111', 1],
      [0, '#222222', 1],
    ]);
    // ANA (grupo 0) lidera "a" com 80 pontos de vantagem (degrau 3); ZÉ (grupo 1) lidera "b" com 40 (degrau 2).
    expect(p.faixas.get('a')).toBe(3);
    expect(p.faixas.get('b')).toBe(4 + 2);
    expect(p.cores).toHaveLength(16);
  });
});
