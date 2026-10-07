import { Link, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import { dateTime } from '@/data/format';
import type { FonteEmendas } from '@/data/types';
import { PAGINA_CGU } from './emendas';

/** "Fonte oficial: CGU · Portal da Transparência", com a data do arquivo e o link do conjunto de dados. */
export function FonteEmendasNota({ fonte, sx }: { fonte: FonteEmendas | undefined; sx?: SxProps<Theme> }) {
  return (
    <Stack direction="row" spacing={0.75} sx={[{ alignItems: 'flex-start', color: 'text.secondary' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <VerifiedRounded sx={{ fontSize: 15, mt: '2px', color: 'primary.main' }} />
      <Typography variant="caption" component="p" sx={{ m: 0 }}>
        Fonte oficial: Controladoria-Geral da União (CGU) · Portal da Transparência, emendas parlamentares
        {fonte?.arquivo_atualizado_em ? ` · arquivo de ${dateTime(fonte.arquivo_atualizado_em)}` : ''} · valores em reais da época, sem correção monetária ·{' '}
        <Link href={fonte?.url ?? PAGINA_CGU} target="_blank" rel="noopener noreferrer">
          dados abertos <OpenInNewRounded sx={{ fontSize: 11, verticalAlign: 'middle' }} />
        </Link>
      </Typography>
    </Stack>
  );
}
