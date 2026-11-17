import { Link, type SxProps, type Theme } from '@mui/material';
import { FAISCA_URL } from '@/config/brand';
import { duration, easing } from '@/theme/motion';
import { SeloBossiniLabs } from './SeloBossiniLabs';

/**
 * Crédito do template Faísca, centralizado no fim da página: só o selo da Bossini Labs (o texto
 * "Powered by Faísca" já vem na imagem), como link para o site da Bossini Labs. Sobe um pouco
 * ao passar o mouse ou ao focar com o teclado.
 */
export function FaiscaCredito({ sx }: { sx?: SxProps<Theme> }) {
  return (
    <Link
      href={FAISCA_URL}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      aria-label="Powered by Faísca, da Bossini Labs"
      sx={[
        (theme) => ({
          display: 'inline-block',
          lineHeight: 0,
          borderRadius: 2,
          transition: `transform ${duration.medium2}ms ${easing.standard}, opacity ${duration.medium2}ms ${easing.standard}`,
          '&:hover, &:focus-visible': { transform: 'translateY(-2px)', opacity: 0.92 },
          '&:focus-visible': {
            outline: `2px solid ${theme.vars.palette.primary.main}`,
            outlineOffset: 3,
          },
          '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <SeloBossiniLabs altura={48} />
    </Link>
  );
}
