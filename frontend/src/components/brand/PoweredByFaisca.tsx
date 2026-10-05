import { useState } from 'react';
import { Box, Link, Tooltip, Typography, type SxProps, type Theme } from '@mui/material';
import { brand, FAISCA_REPO_URL } from '@/config/brand';
import { duration, easing } from '@/theme/motion';
import { BossiniMark } from './BossiniMark';
import { FaiscaMark } from './FaiscaMark';

/**
 * Botão flutuante (FAB) do Faísca no canto inferior direito: o logo do template, com link
 * para o repositório. Ao passar o mouse ou focar, abre em "feito com Faísca" + marca Bossini.
 * VITE_SHOW_POWERED_BY=false esconde, mas a LICENSE então exige um crédito visível
 * equivalente em outro lugar (p.ex. o rodapé).
 */
export function PoweredByFaisca({ sx }: { sx?: SxProps<Theme> }) {
  const [hover, setHover] = useState(false);
  if (!brand.showPoweredBy) return null;

  return (
    <Tooltip title="Feito com Faísca, template de Rodrigo Bossini. Ver no GitHub" placement="left">
      <Link
        href={FAISCA_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        underline="none"
        aria-label="Feito com Faísca, de Rodrigo Bossini (abre o repositório no GitHub)"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onFocus={() => setHover(true)}
        onBlur={() => setHover(false)}
        sx={[
          (theme) => ({
            position: 'fixed',
            right: { xs: 16, md: 24 },
            bottom: { xs: 16, md: 24 },
            zIndex: theme.zIndex.speedDial,
            display: 'inline-flex',
            alignItems: 'center',
            height: 56,
            minWidth: 56,
            px: '13px',
            borderRadius: 99,
            overflow: 'hidden',
            color: 'text.secondary',
            bgcolor: 'background.paper',
            border: `1px solid ${theme.alpha('#C6EF34', 0.55)}`,
            boxShadow: `0 8px 24px -8px ${theme.alpha('#140E26', 0.45)}, 0 2px 6px -2px ${theme.alpha('#140E26', 0.25)}`,
            animation: `faisca-fab-in ${duration.long2}ms ${easing.emphasizedDecelerate} 600ms backwards`,
            transition: [
              `transform ${duration.medium2}ms ${easing.springFast}`,
              `box-shadow ${duration.medium1}ms ${easing.standard}`,
              `border-color ${duration.medium1}ms ${easing.standard}`,
            ].join(', '),
            '@keyframes faisca-fab-in': {
              from: { opacity: 0, transform: 'translateY(16px) scale(0.85)' },
              to: { opacity: 1, transform: 'none' },
            },
            '&:hover, &:focus-visible': {
              transform: 'translateY(-2px)',
              borderColor: theme.alpha('#C6EF34', 0.9),
              boxShadow: `0 12px 30px -8px ${theme.alpha('#C6EF34', 0.6)}`,
            },
            '&:focus-visible': { outline: `2px solid ${theme.vars.palette.primary.main}`, outlineOffset: 3 },
            '@media (prefers-reduced-motion: reduce)': { animation: 'none', transition: 'none' },
          }),
          ...(Array.isArray(sx) ? sx : [sx]),
        ]}
      >
        <FaiscaMark size={30} animated={hover} />
        {/* Extensão do FAB: só abre no hover/foco, e só em telas maiores. */}
        <Box
          sx={{
            display: { xs: 'none', sm: 'inline-flex' },
            alignItems: 'center',
            gap: 1,
            maxWidth: hover ? 220 : 0,
            opacity: hover ? 1 : 0,
            ml: hover ? 1 : 0,
            whiteSpace: 'nowrap',
            transition: `max-width ${duration.medium4}ms ${easing.emphasized}, opacity ${duration.medium2}ms ${easing.standard}, margin ${duration.medium4}ms ${easing.emphasized}`,
          }}
        >
          <Typography component="span" sx={{ fontSize: '0.875rem', fontWeight: 500 }}>
            feito com{' '}
            <Box
              component="strong"
              sx={(theme) => ({
                fontWeight: 700,
                fontVariationSettings: "'ROND' 100",
                backgroundImage: `linear-gradient(90deg, ${theme.vars.palette.primary.main}, #7649CF)`,
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                ...theme.applyStyles('dark', {
                  backgroundImage: 'linear-gradient(90deg, #D4F45E, #BBA4EE)',
                }),
              })}
            >
              Faísca
            </Box>
          </Typography>
          <BossiniMark size={22} />
        </Box>
      </Link>
    </Tooltip>
  );
}
