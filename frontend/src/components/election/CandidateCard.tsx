import { Box, Card, CardActionArea, Chip, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import CompareArrowsRounded from '@mui/icons-material/CompareArrowsRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import { Link as RouterLink } from 'react-router';
import { useNotify } from '@/components/feedback/notificationsContext';
import { CARGO_LABEL, moneyCompact, nomeProprio, NAO_INFORMADO } from '@/data/format';
import { MAX_COMPARAR, useComparar } from '@/data/localStore';
import type { Candidato } from '@/data/types';
import { CandidatePhoto } from './CandidatePhoto';
import { StatusChip } from './StatusChip';

const WRAP_CHIP = { height: 'auto', maxWidth: '100%', '& .MuiChip-label': { whiteSpace: 'normal', py: 0.25 } } as const;

export function CompareToggle({ sq, nome }: { sq: string; nome: string }) {
  const { has, toggle, lista } = useComparar();
  const notify = useNotify();
  const active = has(sq);
  return (
    <Tooltip title={active ? 'Remover da comparação' : 'Adicionar à comparação'}>
      <IconButton
        size="small"
        aria-pressed={active}
        aria-label={active ? `Remover ${nome} da comparação` : `Adicionar ${nome} à comparação`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (!active && lista.length >= MAX_COMPARAR) notify(`A comparação mostra até ${MAX_COMPARAR}. O mais antigo saiu da lista.`, 'info');
          else notify(active ? `${nome} saiu da comparação.` : `${nome} entrou na comparação.`);
          toggle(sq);
        }}
        sx={(theme) => ({
          border: `1px solid ${theme.vars.palette.divider}`,
          ...(active && { bgcolor: 'primary.container', color: 'primary.onContainer', borderColor: 'transparent' }),
        })}
      >
        {active ? <CheckRounded fontSize="small" /> : <CompareArrowsRounded fontSize="small" />}
      </IconButton>
    </Tooltip>
  );
}

function Fact({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary" component="div">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: 500, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: 1.3 }}
        title={String(value ?? NAO_INFORMADO)}
      >
        {value ?? NAO_INFORMADO}
      </Typography>
    </Box>
  );
}

/**
 * Same layout, same fields, same order for every candidate. Nothing is highlighted
 * or hidden based on who the person is.
 */
export function CandidateCard({ c }: { c: Candidato }) {
  const nome = nomeProprio(c.nome_urna);
  const companheiros = (c.companheiros ?? []).filter((x) => x.na_urna === c.na_urna);
  return (
    <Card sx={{ height: '100%', position: 'relative', '&:hover': { borderColor: 'primary.light' }, opacity: c.na_urna ? 1 : 0.85 }}>
      <CardActionArea component={RouterLink} to={`/candidato/${c.sq}`} sx={{ height: '100%', alignItems: 'stretch', justifyContent: 'flex-start', display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" spacing={2} sx={{ p: 2, pb: 1.5, width: '100%' }}>
          <CandidatePhoto src={c.foto} alt={`Foto de ${nome}`} width={84} />
          <Stack spacing={0.5} sx={{ minWidth: 0, flex: 1, pr: 4 }}>
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.3 }}>
              {CARGO_LABEL[c.cargo]} · {c.uf === 'BR' ? 'Brasil' : c.uf}
            </Typography>
            <Typography variant="h6" component="h3" sx={{ lineHeight: 1.2 }}>
              {nome}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'baseline' }}>
              <Typography sx={{ fontFamily: 'monospace', fontSize: '1.25rem', fontWeight: 700, letterSpacing: '0.08em' }} aria-label={`Número ${c.numero}`}>
                {c.numero}
              </Typography>
              <Typography variant="body2" color="text.secondary" noWrap title={c.partido_nome}>
                {c.partido}
              </Typography>
            </Stack>
            <Box>
              <StatusChip situacao={c.situacao} naUrna={c.na_urna} />
            </Box>
          </Stack>
        </Stack>
        {companheiros.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 2, display: 'block', width: '100%' }}>
            {companheiros.map((x) => `${CARGO_LABEL[x.cargo]}: ${nomeProprio(x.nome_urna)} (${x.partido})`).join(' · ')}
          </Typography>
        )}
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.5, p: 2, pt: 1.5, width: '100%' }}>
          <Fact label="Idade" value={c.idade != null ? `${c.idade} anos` : null} />
          <Fact label="Instrução" value={c.instrucao} />
          <Fact label="Ocupação" value={c.ocupacao} />
          <Fact label="Bens declarados" value={c.declarou_bens || c.bens_total ? moneyCompact(c.bens_total) : 'Não declarou'} />
          <Fact label="Arrecadou" value={c.receitas != null ? moneyCompact(c.receitas) : 'Sem registro'} />
          <Fact label="Gastou (contratado)" value={c.despesas != null ? moneyCompact(c.despesas) : 'Sem registro'} />
        </Box>
        {(c.mandato_atual || c.eleito_ultima) && (
          <Stack direction="row" spacing={1} sx={{ px: 2, pb: 2, flexWrap: 'wrap', gap: 0.75, width: '100%' }} useFlexGap>
            {c.mandato_atual && <Chip size="small" variant="outlined" sx={WRAP_CHIP} label={`Mandato atual no Congresso: ${c.mandato_atual}`} />}
            {c.eleito_ultima && <Chip size="small" variant="outlined" sx={WRAP_CHIP} label={`Eleito(a): ${c.eleito_ultima}`} />}
          </Stack>
        )}
      </CardActionArea>
      <Box sx={{ position: 'absolute', top: 12, right: 12 }}>
        <CompareToggle sq={c.sq} nome={nome} />
      </Box>
    </Card>
  );
}
