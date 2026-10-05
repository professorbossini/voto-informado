import { Box, Typography, type SxProps, type Theme } from '@mui/material';
import { dataFileUrl } from '@/data/api';
import { SEM_PARTIDO } from './partidos';

/** Símbolo do partido (do site oficial do partido ou da Câmara), ou a sigla quando não há. */
export function SimboloPartido({
  sigla,
  logo,
  fundo,
  size = 40,
  quadrado = false,
  sx,
}: {
  sigla: string;
  logo: string | null;
  fundo?: string | null;
  size?: number;
  /** Cartão retangular (página do partido) em vez de círculo. */
  quadrado?: boolean;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      sx={[
        (theme) => ({
          width: quadrado ? size * 1.6 : size,
          height: size,
          flexShrink: 0,
          borderRadius: quadrado ? 3 : '50%',
          bgcolor: fundo ?? '#fff',
          border: `1px solid ${theme.vars.palette.divider}`,
          display: 'grid',
          placeItems: 'center',
          overflow: 'hidden',
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {logo ? (
        <Box component="img" src={dataFileUrl(logo)} alt={`Símbolo do ${sigla}`} loading="lazy" sx={{ width: '82%', height: '82%', objectFit: 'contain' }} />
      ) : (
        <Typography component="span" sx={{ fontSize: Math.max(10, size * 0.26), fontWeight: 800, color: '#333', lineHeight: 1 }}>
          {sigla === SEM_PARTIDO ? 'S/P' : sigla.slice(0, 5)}
        </Typography>
      )}
    </Box>
  );
}
