import { Link, Tooltip, Typography, type SxProps, type Theme } from '@mui/material';
import { brand, FAISCA_URL } from '@/config/brand';
import { duration, easing } from '@/theme/motion';
import { BossiniLabsMark } from './BossiniLabsMark';

/**
 * "Powered by Faísca" badge pinned to a bottom corner: a reminder that this app
 * was born from the Faísca template, with the Bossini Labs icon; links to Bossini Labs.
 * VITE_SHOW_POWERED_BY=false hides it, but the LICENSE then requires an equivalent
 * visible credit elsewhere (e.g. a footer or an "About" page).
 */
export function PoweredByFaisca({ sx }: { sx?: SxProps<Theme> }) {
  if (!brand.showPoweredBy) return null;

  return (
    <Tooltip title="Este app nasceu do template Faísca, da Bossini Labs" placement="top-end">
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
            display: 'inline-flex',
            alignItems: 'center',
            gap: 1,
            height: 36,
            pl: 0.625,
            // Compact (icon only) on phones so it doesn't cover content.
            pr: { xs: 0.625, sm: 1.5 },
            borderRadius: 99,
            overflow: 'hidden',
            color: 'text.secondary',
            bgcolor: theme.alpha(theme.vars.palette.background.paper, 0.72),
            backdropFilter: 'saturate(180%) blur(12px)',
            border: `1px solid ${theme.vars.palette.divider}`,
            boxShadow: `0 6px 20px -10px ${theme.alpha('#140E26', 0.35)}`,
            animation: `faisca-badge-in ${duration.long2}ms ${easing.emphasizedDecelerate} 600ms backwards`,
            transition: [
              `transform ${duration.medium2}ms ${easing.springFast}`,
              `box-shadow ${duration.medium1}ms ${easing.standard}`,
              `border-color ${duration.medium1}ms ${easing.standard}`,
            ].join(', '),
            '@keyframes faisca-badge-in': {
              from: { opacity: 0, transform: 'translateY(12px) scale(0.96)' },
              to: { opacity: 1, transform: 'none' },
            },
            // Light sweep across the pill on hover.
            '&::after': {
              content: '""',
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(105deg, transparent 35%, ${theme.alpha('#C6EF34', 0.35)} 50%, transparent 65%)`,
              transform: 'translateX(-120%)',
              pointerEvents: 'none',
            },
            '&:hover, &:focus-visible': {
              transform: 'translateY(-2px)',
              borderColor: theme.alpha('#C6EF34', 0.7),
              boxShadow: `0 10px 28px -8px ${theme.alpha('#C6EF34', 0.55)}`,
            },
            '&:hover::after, &:focus-visible::after': {
              transition: `transform ${duration.long4 * 1.5}ms ${easing.standard}`,
              transform: 'translateX(120%)',
            },
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <BossiniLabsMark size={26} />
        <Typography
          component="span"
          sx={{
            display: { xs: 'none', sm: 'inline' },
            fontSize: '0.8125rem',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          Powered by Faísca
        </Typography>
      </Link>
    </Tooltip>
  );
}
