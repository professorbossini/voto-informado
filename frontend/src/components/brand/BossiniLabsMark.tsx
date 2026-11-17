import { Box, type SxProps, type Theme } from '@mui/material';
import icone from './bossini-labs.svg';

export interface BossiniLabsMarkProps {
  /** Rendered size in pixels. */
  size?: number;
  sx?: SxProps<Theme>;
}

/**
 * Ícone da Bossini Labs (o mesmo do site bossinilabs.com.br): "B" branco com detalhe lima num
 * azulejo violeta. É decorativo: quem dá o nome acessível é o link do crédito em volta.
 */
export function BossiniLabsMark({ size = 24, sx }: BossiniLabsMarkProps) {
  return (
    <Box
      component="img"
      src={icone}
      alt=""
      width={size}
      height={size}
      data-marca="bossini-labs"
      sx={[{ display: 'block', flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
    />
  );
}
