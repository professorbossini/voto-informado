import {
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { UfTileMap } from '@/components/election/UfTileMap';
import { number } from '@/data/format';
import type { Estatisticas } from '@/data/types';
import { porVaga } from './numeros';
import { CabecalhoOrdenavel } from '@/components/tabela/CabecalhoOrdenavel';
import { useOrdenacao } from '@/components/tabela/ordenacao';

type Linha = Estatisticas['concorrencia'][number];
const COLUNAS = { uf: (l: Linha) => l.uf, vagas: (l: Linha) => l.vagas, candidatos: (l: Linha) => l.candidatos, por_vaga: (l: Linha) => l.por_vaga };
const MAIOR_PRIMEIRO = { vagas: 'desc', candidatos: 'desc', por_vaga: 'desc' } as const;

/** Candidates per seat by UF: equal-size tile map + sortable compact table. */
export function Concorrencia({ linhas, nomes }: { linhas: Linha[]; nomes: Record<string, string> }) {
  const theme = useTheme();
  const xs = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const values = Object.fromEntries(linhas.map((l) => [l.uf, l.por_vaga]));
  const { ordenadas, ordem, alternar } = useOrdenacao(linhas, COLUNAS, { coluna: 'uf', sentido: 'asc' }, MAIOR_PRIMEIRO);

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
                <CabecalhoOrdenavel coluna="uf" ordem={ordem} onOrdenar={alternar}>
                  UF
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="vagas" ordem={ordem} onOrdenar={alternar} align="right">
                  Vagas
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="candidatos" ordem={ordem} onOrdenar={alternar} align="right">
                  Candidaturas
                </CabecalhoOrdenavel>
                <CabecalhoOrdenavel coluna="por_vaga" ordem={ordem} onOrdenar={alternar} align="right">
                  Por vaga
                </CabecalhoOrdenavel>
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
