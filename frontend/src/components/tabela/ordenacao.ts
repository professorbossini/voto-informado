import { useCallback, useMemo, useState } from 'react';

/**
 * Ordenação de tabelas (toda tabela com cabeçalho de colunas do site ordena ao clicar no nome da coluna):
 * clicar ordena, clicar de novo inverte, a seta mostra coluna e sentido (aria-sort no cabeçalho). Vazios
 * ficam sempre por último. Use `useOrdenacao` com as linhas que a tela já tem e `CabecalhoOrdenavel` no
 * lugar de cada <TableCell> do cabeçalho (CabecalhoOrdenavel.tsx). `primeiro` diz o sentido do primeiro
 * clique em cada coluna (números e valores costumam começar do maior).
 */

export type Sentido = 'asc' | 'desc';
export type Valor = string | number | boolean | Date | null | undefined;
export interface Ordem<C extends string = string> {
  coluna: C;
  sentido: Sentido;
}

const collator = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

const vazio = (v: Valor) => v == null || v === '' || (typeof v === 'number' && Number.isNaN(v)) || (v instanceof Date && Number.isNaN(v.getTime()));

/** Compara dois valores do mesmo tipo em ordem crescente (texto em pt-BR, número, data, booleano). */
export function comparar(a: Valor, b: Valor): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b);
  return collator.compare(String(a), String(b));
}

/** Ordena uma cópia das linhas pela função de valor; vazios no fim nos dois sentidos; empate mantém a ordem. */
export function ordenarLinhas<T>(linhas: readonly T[], valor: (l: T) => Valor, sentido: Sentido): T[] {
  const s = sentido === 'asc' ? 1 : -1;
  return linhas
    .map((l, i) => ({ l, i, v: valor(l) }))
    .sort((x, y) => {
      const vx = vazio(x.v);
      const vy = vazio(y.v);
      if (vx || vy) return vx === vy ? x.i - y.i : vx ? 1 : -1;
      return comparar(x.v, y.v) * s || x.i - y.i;
    })
    .map((x) => x.l);
}

/** Próxima ordem ao clicar numa coluna: a mesma coluna inverte; outra coluna começa por `primeiro`. */
export function proximaOrdem<C extends string>(o: Ordem<C> | null, coluna: C, primeiro: Sentido = 'asc'): Ordem<C> {
  return o?.coluna === coluna ? { coluna, sentido: o.sentido === 'asc' ? 'desc' : 'asc' } : { coluna, sentido: primeiro };
}

/**
 * Só o estado (coluna e sentido) e o clique, para telas que ordenam as linhas mais adiante (depois de
 * carregar os dados) com `ordenarPor`.
 */
export function useOrdem<C extends string>(inicial: Ordem<C> | null = null, primeiro: Partial<Record<C, Sentido>> | ((c: C) => Sentido) = {}) {
  const [ordem, setOrdem] = useState<Ordem<C> | null>(inicial);
  const ordenar = useCallback(
    (coluna: C) => setOrdem((o) => proximaOrdem(o, coluna, typeof primeiro === 'function' ? primeiro(coluna) : primeiro[coluna])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return { ordem, ordenar, setOrdem };
}

/** Ordena pelas funções de valor de cada coluna; sem ordem escolhida, devolve as linhas como vieram. */
export function ordenarPor<T, C extends string>(linhas: readonly T[], colunas: Record<C, (l: T) => Valor>, ordem: Ordem<C> | null): T[] {
  return ordem ? ordenarLinhas(linhas, colunas[ordem.coluna], ordem.sentido) : [...linhas];
}

/**
 * Estado e linhas ordenadas de uma tabela. `inicial` = a ordem que a tela já tinha; `null` = a ordem em que
 * as linhas chegaram, até alguém clicar.
 */
export function useOrdenacao<T, C extends string>(
  linhas: readonly T[],
  colunas: Record<C, (l: T) => Valor>,
  inicial: Ordem<NoInfer<C>> | null = null,
  primeiro: Partial<Record<NoInfer<C>, Sentido>> = {},
) {
  const { ordem, ordenar, setOrdem } = useOrdem<C>(inicial, primeiro);
  const ordenadas = useMemo(() => ordenarPor(linhas, colunas, ordem), [linhas, ordem, colunas]);
  return { ordenadas, ordem, alternar: ordenar, setOrdem };
}
