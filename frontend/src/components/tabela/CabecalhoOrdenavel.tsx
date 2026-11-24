import type { ReactNode } from 'react';
import { TableCell, TableSortLabel, type TableCellProps } from '@mui/material';
import type { Ordem } from './ordenacao';

/** Célula de cabeçalho que ordena (focável pelo teclado; aria-sort vem do sortDirection do MUI). */
export function CabecalhoOrdenavel<C extends string>({
  coluna,
  ordem,
  onOrdenar,
  children,
  ...props
}: { coluna: C; ordem: Ordem<C> | null; onOrdenar: (c: C) => void; children: ReactNode } & Omit<TableCellProps, 'children'>) {
  const ativa = ordem?.coluna === coluna;
  return (
    <TableCell {...props} sortDirection={ativa ? ordem.sentido : false}>
      <TableSortLabel
        active={ativa}
        direction={ativa ? ordem.sentido : 'asc'}
        onClick={() => onOrdenar(coluna)}
        sx={props.align === 'right' ? { flexDirection: 'row-reverse' } : undefined}
      >
        {children}
      </TableSortLabel>
    </TableCell>
  );
}

export interface ColunaCabecalho<C extends string> {
  coluna: C;
  rotulo: ReactNode;
  align?: TableCellProps['align'];
  sx?: TableCellProps['sx'];
  /** Coluna sem valor ordenável (ações, textos livres): cabeçalho comum. */
  fixa?: boolean;
}

/** As células do cabeçalho de uma tabela, cada uma ordenável (menos as `fixa`). */
export function CabecalhosOrdenaveis<C extends string>({ colunas, ordem, onOrdenar }: { colunas: readonly ColunaCabecalho<C>[]; ordem: Ordem<C> | null; onOrdenar: (c: C) => void }) {
  return (
    <>
      {colunas.map((c) =>
        c.fixa ? (
          <TableCell key={c.coluna} align={c.align} sx={c.sx}>
            {c.rotulo}
          </TableCell>
        ) : (
          <CabecalhoOrdenavel key={c.coluna} coluna={c.coluna} ordem={ordem} onOrdenar={onOrdenar} align={c.align} sx={c.sx}>
            {c.rotulo}
          </CabecalhoOrdenavel>
        ),
      )}
    </>
  );
}
