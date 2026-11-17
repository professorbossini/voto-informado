import { Link, type SxProps, type Theme } from '@mui/material';
import { brand, FAISCA_URL } from '@/config/brand';
import { duration, easing } from '@/theme/motion';
import { SeloBossiniLabs } from './SeloBossiniLabs';

/**
 * "Powered by Faísca" badge pinned to a bottom corner: the Bossini Labs image (the text is part
 * of the image), linking to Bossini Labs.
 * VITE_SHOW_POWERED_BY=false hides it, but the LICENSE then requires an equivalent
 * visible credit elsewhere (e.g. a footer or an "About" page).
 */
export function PoweredByFaisca({ sx }: { sx?: SxProps<Theme> }) {
  if (!brand.showPoweredBy) return null;

  return (
    <Link
      href={FAISCA_URL}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      aria-label="Powered by Faísca, da Bossini Labs"
      sx={[
        (theme) => ({
          position: 'fixed',
          right: 16,
          bottom: 16,
          zIndex: theme.zIndex.speedDial,
          display: 'block',
          lineHeight: 0,
          borderRadius: 2,
          animation: `faisca-badge-in ${duration.long2}ms ${easing.emphasizedDecelerate} 600ms backwards`,
          transition: `transform ${duration.medium2}ms ${easing.standard}, opacity ${duration.medium2}ms ${easing.standard}`,
          '@keyframes faisca-badge-in': {
            from: { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
            to: { opacity: 1, transform: 'none' },
          },
          '&:hover, &:focus-visible': { transform: 'translateY(-2px)', opacity: 0.92 },
          '&:focus-visible': {
            outline: `2px solid ${theme.vars.palette.primary.main}`,
            outlineOffset: 3,
          },
          '@media (prefers-reduced-motion: reduce)': {
            animation: 'none',
            transition: 'none',
            transform: 'none',
          },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <SeloBossiniLabs altura={40} />
    </Link>
  );
}
