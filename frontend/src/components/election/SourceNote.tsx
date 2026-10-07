import { useState } from 'react';
import { Box, ButtonBase, Divider, Link, Popover, Stack, Typography, type SxProps, type Theme } from '@mui/material';
import VerifiedRounded from '@mui/icons-material/VerifiedRounded';
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded';
import { useMeta } from '@/data/MetaContext';
import { dateTime } from '@/data/format';
import type { Fonte } from '@/data/types';
import { orgaoCurto } from './orgao';

export function FonteDetalhe({ fonte }: { fonte: Fonte }) {
  return (
    <Stack spacing={0.75}>
      <Typography variant="subtitle2">{fonte.nome}</Typography>
      <Typography variant="caption" color="text.secondary">
        {fonte.orgao}
      </Typography>
      <Typography variant="body2">{fonte.descricao}</Typography>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 1.5, rowGap: 0.25 }}>
        {fonte.gerado_em && (
          <>
            <Typography component="dt" variant="caption" color="text.secondary">
              Gerado pelo órgão
            </Typography>
            <Typography component="dd" variant="caption" sx={{ m: 0 }}>
              {dateTime(fonte.gerado_em)}
            </Typography>
          </>
        )}
        {fonte.publicado_em && (
          <>
            <Typography component="dt" variant="caption" color="text.secondary">
              Publicado no servidor oficial
            </Typography>
            <Typography component="dd" variant="caption" sx={{ m: 0 }}>
              {dateTime(fonte.publicado_em)}
            </Typography>
          </>
        )}
        <Typography component="dt" variant="caption" color="text.secondary">
          Coletado por este site
        </Typography>
        <Typography component="dd" variant="caption" sx={{ m: 0 }}>
          {dateTime(fonte.coletado_em)}
        </Typography>
      </Box>
      <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
        <Link href={fonte.url} target="_blank" rel="noopener noreferrer" variant="caption">
          Arquivo oficial <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
        </Link>
        {fonte.pagina && (
          <Link href={fonte.pagina} target="_blank" rel="noopener noreferrer" variant="caption">
            Página do conjunto de dados <OpenInNewRounded sx={{ fontSize: 12, verticalAlign: 'middle' }} />
          </Link>
        )}
      </Stack>
    </Stack>
  );
}

/**
 * "Fonte: TSE · ..." line placed under every block of data. Clicking opens the full
 * provenance: official file link, dataset page, generation/publication/collection dates.
 */
export function SourceNote({ keys, note, sx }: { keys: string[]; note?: string; sx?: SxProps<Theme> }) {
  const { fontes } = useMeta();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const list = keys.map((k) => fontes.get(k)).filter((f): f is Fonte => Boolean(f));
  const orgaos = [...new Set(list.map((f) => orgaoCurto(f.orgao)))];
  const label = list.length ? `Fonte oficial: ${orgaos.join(', ')} · ${list.map((f) => f.nome).join('; ')}` : 'Fonte oficial';

  return (
    <>
      <ButtonBase
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-label={`${label}. Ver detalhes da fonte`}
        sx={[
          {
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: 0.75,
            textAlign: 'left',
            borderRadius: 1,
            px: 0.5,
            py: 0.25,
            mx: -0.5,
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          },
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <VerifiedRounded sx={{ fontSize: 15, mt: '2px', color: 'primary.main' }} />
        <Typography variant="caption" component="span" sx={{ textDecoration: 'underline dotted', textUnderlineOffset: 3 }}>
          {label}
          {note ? ` · ${note}` : ''}
        </Typography>
      </ButtonBase>
      <Popover
        open={Boolean(anchor)}
        anchorEl={anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 420, borderRadius: 3 } } }}
      >
        <Stack spacing={1.5} divider={<Divider flexItem />}>
          {list.length === 0 && <Typography variant="body2">Carregando fontes…</Typography>}
          {list.map((f) => (
            <FonteDetalhe key={f.chave} fonte={f} />
          ))}
        </Stack>
      </Popover>
    </>
  );
}
