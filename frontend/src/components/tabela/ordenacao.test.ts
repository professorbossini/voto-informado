import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { comparar, ordenarLinhas, useOrdenacao } from './ordenacao';

describe('ordenação de tabelas', () => {
  it('texto em pt-BR, sem diferenciar acento e caixa, com números no meio', () => {
    expect(ordenarLinhas(['Ébano', 'abacate', 'Zé', 'item 10', 'item 2'], (x) => x, 'asc')).toEqual(['abacate', 'Ébano', 'item 2', 'item 10', 'Zé']);
  });

  it('números, datas e booleanos pelo valor', () => {
    expect(ordenarLinhas([10, 2, 33], (x) => x, 'desc')).toEqual([33, 10, 2]);
    const d = [new Date('2026-01-02'), new Date('2025-05-01')];
    expect(ordenarLinhas(d, (x) => x, 'asc')[0]).toBe(d[1]);
    expect(comparar(true, false)).toBeGreaterThan(0);
  });

  it('vazios sempre por último, nos dois sentidos', () => {
    const l = [{ v: 2 }, { v: null }, { v: 5 }, { v: undefined }];
    expect(ordenarLinhas(l, (x) => x.v, 'asc').map((x) => x.v)).toEqual([2, 5, null, undefined]);
    expect(ordenarLinhas(l, (x) => x.v, 'desc').map((x) => x.v)).toEqual([5, 2, null, undefined]);
  });

  it('o hook alterna o sentido e começa pelo sentido pedido para a coluna', () => {
    const linhas = [{ n: 'B', v: 1 }, { n: 'a', v: 3 }];
    const cols = { nome: (l: (typeof linhas)[number]) => l.n, valor: (l: (typeof linhas)[number]) => l.v };
    const { result } = renderHook(() => useOrdenacao(linhas, cols, null, { valor: 'desc' }));
    expect(result.current.ordenadas).toEqual(linhas);
    act(() => result.current.alternar('nome'));
    expect(result.current.ordenadas.map((l) => l.n)).toEqual(['a', 'B']);
    act(() => result.current.alternar('nome'));
    expect(result.current.ordem).toEqual({ coluna: 'nome', sentido: 'desc' });
    act(() => result.current.alternar('valor'));
    expect(result.current.ordenadas.map((l) => l.v)).toEqual([3, 1]);
  });
});
