import {
  Box,
  Card,
  CardActionArea,
  Chip,
  Link,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import HowToVoteOutlined from '@mui/icons-material/HowToVoteOutlined';
import { Link as RouterLink } from 'react-router';
import { SERIES } from '@/components/charts/palette';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { CARGO_LABEL, money, money0, NAO_INFORMADO } from '@/data/format';
import type { ParlamentarResumo } from '@/data/types';
import { CASA_LABEL, CASA_NOME, mesesTexto, percentSigned } from './gastos';

export interface RankingRow {
  p: ParlamentarResumo;
  /** Position in the value ranking (largest = 1), independent of the current sort. */
  posicao: number;
  valor: number;
  meses: number;
  /** valor ÷ meses with records. */
  mediaMensal: number | null;
  /** Mean of colleagues' monthly averages (same casa + UF, same period). */
  media: { media: number; n: number } | null;
  /** mediaMensal ÷ media − 1 */
  diff: number | null;
}

export type Ordem = 'valor-desc' | 'valor-asc' | 'mensal-desc' | 'mensal-asc' | 'nome';

/** Thin value bar, same neutral color for everyone. */
function InlineBar({ value, max }: { value: number; max: number }) {
  const ratio = max > 0 ? Math.max(0, value) / max : 0;
  return (
    <Box sx={{ flex: 1, minWidth: 64, height: 10, display: 'flex', alignItems: 'center' }} aria-hidden>
      <Box
        sx={(theme) => ({
          height: 10,
          width: `${ratio * 100}%`,
          minWidth: value > 0 ? 2 : 0,
          borderRadius: '0 4px 4px 0',
          backgroundColor: SERIES.light,
          ...theme.applyStyles('dark', { backgroundColor: SERIES.dark }),
        })}
      />
    </Box>
  );
}

function partidoUf(p: ParlamentarResumo) {
  return `${p.partido ?? NAO_INFORMADO}-${p.uf ?? NAO_INFORMADO}`;
}

function DiffText({ row, stacked = false }: { row: RankingRow; stacked?: boolean }) {
  const txt = percentSigned(row.diff);
  if (!txt || !row.media) {
    return (
      <Typography variant="body2" color="text.secondary">
        {NAO_INFORMADO}
      </Typography>
    );
  }
  return (
    <Tooltip
      title={`Média por mês deste parlamentar: ${money(row.mediaMensal)}. Média das médias mensais na ${CASA_NOME[row.p.casa]} em ${row.p.uf}, no mesmo período: ${money(row.media.media)} (${row.media.n} parlamentares com lançamentos, incluindo este).`}
    >
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {txt}{' '}
        <Box component="span" sx={{ color: 'text.secondary', ...(stacked && { display: 'block', fontSize: '0.75rem' }) }}>
          {stacked ? `vs. média ${row.p.uf}` : `vs. média mensal ${row.p.uf}`}
        </Box>
      </Typography>
    </Tooltip>
  );
}

function CandidaturaChip({ p }: { p: ParlamentarResumo }) {
  if (!p.candidato_sq || !p.candidato_na_urna || !p.candidato_cargo) return null;
  return (
    <Chip
      size="small"
      variant="outlined"
      icon={<HowToVoteOutlined />}
      component={RouterLink}
      to={`/candidato/${p.candidato_sq}`}
      clickable
      label={`Candidato(a) em 2026: ${CARGO_LABEL[p.candidato_cargo]}${p.candidato_uf && p.candidato_uf !== 'BR' ? ` (${p.candidato_uf})` : ''}`}
      sx={{ maxWidth: '100%', alignSelf: 'flex-start' }}
    />
  );
}

function RankingCards({ rows, max }: { rows: RankingRow[]; max: number }) {
  return (
    <Stack component="ol" spacing={1.25} sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {rows.map((r) => (
        <Card component="li" key={r.p.id} variant="outlined">
          <CardActionArea component={RouterLink} to={`/parlamentar/${r.p.id}`} sx={{ p: 1.5 }}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
              <CandidatePhoto src={r.p.foto_url} alt={`Foto oficial de ${r.p.nome}`} width={44} rounded={8} />
              <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="subtitle2" sx={{ lineHeight: 1.25 }}>
                  {r.p.nome}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {partidoUf(r.p)} · {CASA_LABEL[r.p.casa]} · {mesesTexto(r.meses)} com lançamento
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <InlineBar value={r.valor} max={max} />
                  <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                    {money(r.valor)}
                  </Typography>
                </Stack>
                <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {r.mediaMensal != null ? `${money0(r.mediaMensal)} por mês` : NAO_INFORMADO}
                </Typography>
                <DiffText row={r} />
              </Stack>
            </Stack>
          </CardActionArea>
          {r.p.candidato_sq && r.p.candidato_na_urna && (
            <Box sx={{ px: 1.5, pb: 1.5, pl: { xs: 1.5, sm: 'calc(12px + 28px + 12px + 44px + 12px)' } }}>
              <CandidaturaChip p={r.p} />
            </Box>
          )}
        </Card>
      ))}
    </Stack>
  );
}

function RankingTable({ rows, max, ordem, onOrdem }: { rows: RankingRow[]; max: number; ordem: Ordem; onOrdem: (o: Ordem) => void }) {
  return (
    <TableContainer>
      <Table size="small" aria-label="Gastos da cota parlamentar por parlamentar">
        <TableHead>
          <TableRow>
            <TableCell sortDirection={ordem === 'nome' ? 'asc' : false}>
              <TableSortLabel active={ordem === 'nome'} direction="asc" onClick={() => onOrdem('nome')}>
                Parlamentar
              </TableSortLabel>
            </TableCell>
            <TableCell>Partido-UF · Casa</TableCell>
            <TableCell sortDirection={ordem.startsWith('valor') ? (ordem === 'valor-asc' ? 'asc' : 'desc') : false} sx={{ minWidth: 200 }}>
              <TableSortLabel
                active={ordem.startsWith('valor')}
                direction={ordem === 'valor-asc' ? 'asc' : 'desc'}
                onClick={() => onOrdem(ordem === 'valor-desc' ? 'valor-asc' : 'valor-desc')}
              >
                Valor no período
              </TableSortLabel>
            </TableCell>
            <TableCell align="right" sx={{ whiteSpace: 'nowrap' }} sortDirection={ordem.startsWith('mensal') ? (ordem === 'mensal-asc' ? 'asc' : 'desc') : false}>
              <Tooltip title="Valor no período ÷ meses com lançamento (o número de meses aparece abaixo)">
                <TableSortLabel
                  active={ordem.startsWith('mensal')}
                  direction={ordem === 'mensal-asc' ? 'asc' : 'desc'}
                  onClick={() => onOrdem(ordem === 'mensal-desc' ? 'mensal-asc' : 'mensal-desc')}
                >
                  Média por mês
                </TableSortLabel>
              </Tooltip>
            </TableCell>
            <TableCell>
              <Tooltip title="Diferença entre a média por mês deste parlamentar e a média das médias mensais dos colegas da mesma casa e UF, no mesmo período">
                <span>Comparação</span>
              </Tooltip>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.p.id} hover>
              <TableCell>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', py: 0.5 }}>
                  <CandidatePhoto src={r.p.foto_url} alt={`Foto oficial de ${r.p.nome}`} width={36} rounded={6} />
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Link component={RouterLink} to={`/parlamentar/${r.p.id}`} underline="hover" sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {r.p.nome}
                    </Link>
                    <CandidaturaChip p={r.p} />
                  </Stack>
                </Stack>
              </TableCell>
              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                {partidoUf(r.p)}
                <Typography variant="caption" color="text.secondary" component="div">
                  {CASA_LABEL[r.p.casa]}
                </Typography>
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <InlineBar value={r.valor} max={max} />
                  <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', minWidth: 104, textAlign: 'right' }}>
                    {money(r.valor)}
                  </Typography>
                </Stack>
              </TableCell>
              <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                {r.mediaMensal != null ? money0(r.mediaMensal) : NAO_INFORMADO}
                <Typography variant="caption" color="text.secondary" component="div">
                  {mesesTexto(r.meses)}
                </Typography>
              </TableCell>
              <TableCell>
                <DiffText row={r} stacked />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/** Ranking: table on wide screens, card list on phones. */
export function RankingList({ rows, max, ordem, onOrdem }: { rows: RankingRow[]; max: number; ordem: Ordem; onOrdem: (o: Ordem) => void }) {
  const theme = useTheme();
  const wide = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });
  return wide ? <RankingTable rows={rows} max={max} ordem={ordem} onOrdem={onOrdem} /> : <RankingCards rows={rows} max={max} />;
}
