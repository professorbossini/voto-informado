import { useState } from 'react';
import {
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { UfTileMap } from '@/components/election/UfTileMap';
import { number } from '@/data/format';
import type { Estatisticas } from '@/data/types';
import { porVaga } from './numeros';

type Linha = Estatisticas['concorrencia'][number];
type Ordem = 'uf' | 'por_vaga' | 'candidatos';

/** Candidates per seat by UF: equal-size tile map + sortable compact table. */
export function Concorrencia({ linhas, nomes }: { linhas: Linha[]; nomes: Record<string, string> }) {
  const theme = useTheme();
  const xs = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const [ordem, setOrdem] = useState<Ordem>('uf');
  const values = Object.fromEntries(linhas.map((l) => [l.uf, l.por_vaga]));
  const ordenadas = [...linhas].sort((a, b) =>
    ordem === 'uf' ? a.uf.localeCompare(b.uf) : ordem === 'por_vaga' ? b.por_vaga - a.por_vaga || a.uf.localeCompare(b.uf) : b.candidatos - a.candidatos || a.uf.localeCompare(b.uf),
  );

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: { xs: 'center', md: 'flex-start' } }}>
          <UfTileMap values={values} format={porVaga} names={nomes} size={xs ? 36 : 44} />
        </Box>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <TableContainer sx={{ maxHeight: 380 }}>
          <Table size="small" stickyHeader aria-label="Candidaturas por vaga em cada UF">
            <TableHead>
              <TableRow>
                <TableCell sortDirection={ordem === 'uf' ? 'asc' : false}>
                  <TableSortLabel active={ordem === 'uf'} direction="asc" onClick={() => setOrdem('uf')}>
                    UF
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">Vagas</TableCell>
                <TableCell align="right" sortDirection={ordem === 'candidatos' ? 'desc' : false}>
                  <TableSortLabel active={ordem === 'candidatos'} direction="desc" onClick={() => setOrdem('candidatos')}>
                    Candidaturas
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right" sortDirection={ordem === 'por_vaga' ? 'desc' : false}>
                  <TableSortLabel active={ordem === 'por_vaga'} direction="desc" onClick={() => setOrdem('por_vaga')}>
                    Por vaga
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {ordenadas.map((l) => (
                <TableRow key={l.uf} hover>
                  <TableCell>
                    <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>
                      {l.uf}
                    </Typography>
                    {nomes[l.uf] && (
                      <Typography variant="caption" color="text.secondary" component="span" sx={{ ml: 1, display: { xs: 'none', sm: 'inline' } }}>
                        {nomes[l.uf]}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {number(l.vagas)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {number(l.candidatos)}
                  </TableCell>
                  <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {porVaga(l.por_vaga)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Grid>
    </Grid>
  );
}
