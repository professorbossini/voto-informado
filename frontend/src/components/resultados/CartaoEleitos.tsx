import { Box, ButtonBase, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { Link as RouterLink } from 'react-router';
import { CandidatePhoto } from '@/components/election/CandidatePhoto';
import { data } from '@/data/api';
import type { CandidatoApurado, CargoApuracao, Turno } from '@/data/apuracao';
import { nomeProprio } from '@/data/format';
import { useAsync } from '@/hooks/useAsync';

const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('pt-BR');

/** "Eleito presidente" / "Eleita governadora", pelo gênero do registro oficial (TSE). */
function rotulo(cargo: CargoApuracao, feminino: boolean | null): string {
  const e = feminino == null ? 'Eleito(a)' : feminino ? 'Eleita' : 'Eleito';
  const f = feminino === true;
  const nome: Record<CargoApuracao, string> = {
    presidente: 'presidente da República',
    governador: feminino == null ? 'governador(a)' : f ? 'governadora' : 'governador',
    senador: feminino == null ? 'senador(a)' : f ? 'senadora' : 'senador',
    'deputado-federal': feminino == null ? 'deputado(a) federal' : f ? 'deputada federal' : 'deputado federal',
    'deputado-estadual': feminino == null ? 'deputado(a) estadual' : f ? 'deputada estadual' : 'deputado estadual',
    'deputado-distrital': feminino == null ? 'deputado(a) distrital' : f ? 'deputada distrital' : 'deputado distrital',
  };
  return `${e} ${nome[cargo]}`;
}

function Eleito({ c, cargo, local, compacto }: { c: CandidatoApurado; cargo: CargoApuracao; local: string | null; compacto?: boolean }) {
  const det = useAsync(() => data.candidato(c.sq).catch(() => null), [c.sq]);
  const g = det.data?.genero?.toUpperCase();
  const feminino = g ? g.startsWith('FEM') : null;
  return (
    <ButtonBase
      component={RouterLink}
      to={`/candidato/${c.sq}`}
      sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1.5, borderRadius: 3, p: 0.5, textAlign: 'left', minWidth: 0, flex: 1 }}
      aria-label={`${nomeProprio(c.nomeUrna)}: ${rotulo(cargo, feminino)}${local ? ` · ${local}` : ''}. Ver perfil`}
    >
      <CandidatePhoto src={`/fotos/${c.sq}.jpg`} alt="" width={compacto ? 52 : 72} rounded={12} />
      <Box sx={{ minWidth: 0 }}>
        <Typography variant={compacto ? 'subtitle1' : 'h5'} component="div" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
          {nomeProprio(c.nomeUrna)}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, color: 'success.main' }}>
          {rotulo(cargo, feminino)}
          {local ? ` · ${local}` : ''}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
          {c.numero} · {c.partido} · {pctFmt.format(c.pct)}% dos válidos · {int.format(c.votos)} votos
        </Typography>
      </Box>
    </ButtonBase>
  );
}

/**
 * Destaque de quem o TSE já declarou eleito numa disputa majoritária. Mesma cor (verde de
 * "sucesso", nunca cor de partido) e mesmo formato para qualquer pessoa eleita.
 */
export function CartaoEleitos({
  eleitos,
  cargo,
  turno,
  local,
  compacto,
  sx,
}: {
  eleitos: CandidatoApurado[];
  cargo: CargoApuracao;
  turno: Turno;
  /** "Brasil", "São Paulo"... */
  local: string | null;
  compacto?: boolean;
  sx?: SxProps<Theme>;
}) {
  if (!eleitos.length) return null;
  return (
    <Box
      role="status"
      sx={[
        (theme) => ({
          borderRadius: 4,
          p: { xs: 1.5, sm: compacto ? 1.5 : 2 },
          border: `2px solid ${theme.vars.palette.success.main}`,
          background: `linear-gradient(135deg, ${theme.alpha(theme.vars.palette.success.main, 0.14)}, ${theme.alpha(theme.vars.palette.success.main, 0.04)} 70%), ${theme.vars.palette.background.paper}`,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 1, color: 'success.main' }}>
        <VerifiedRounded fontSize="small" />
        <Typography variant="overline" sx={{ fontWeight: 800, lineHeight: 1.4 }}>
          Resultado oficial do TSE · {turno === 2 ? '2º turno' : '1º turno'}
        </Typography>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 2 }}>
        {eleitos.map((c) => (
          <Eleito key={c.sq} c={c} cargo={cargo} local={local} compacto={compacto} />
        ))}
      </Stack>
    </Box>
  );
}
