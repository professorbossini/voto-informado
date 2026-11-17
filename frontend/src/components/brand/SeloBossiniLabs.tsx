import { Box, type SxProps, type Theme } from '@mui/material';
import selo from './bossini-labs-powered-by-faisca.webp';

/** Proporção da imagem (640×224). */
const PROPORCAO = 20 / 7;

export interface SeloBossiniLabsProps {
  /** Altura em pixels (a largura acompanha a proporção 20:7). Abaixo de 40 o texto não se lê. */
  altura?: number;
  sx?: SxProps<Theme>;
}

/**
 * Selo da Bossini Labs com "Powered by Faísca" embutido na própria imagem (a mesma em todos os
 * projetos). Tem fundo próprio: funciona em tema claro e escuro, sem moldura nem texto ao lado.
 */
export function SeloBossiniLabs({ altura = 48, sx }: SeloBossiniLabsProps) {
  return (
    <Box
      component="img"
      src={selo}
      alt="Bossini Labs · Powered by Faísca"
      width={Math.round(altura * PROPORCAO)}
      height={altura}
      loading="lazy"
      decoding="async"
      data-marca="bossini-labs"
      sx={[{ display: 'block', flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
    />
  );
}
