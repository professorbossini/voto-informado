import { useState } from 'react';
import { Box, Link, Typography, type SxProps, type Theme } from '@mui/material';
import { FAISCA_REPO_URL } from '@/config/brand';
import { duration, easing } from '@/theme/motion';
import { FaiscaMark } from './FaiscaMark';

/**
 * Crédito do template Faísca, centralizado no fim da página:
 *
 *        Powered by
 *   (logo)  Faísca
 *
 * O logo fica num botão elevado, no estilo de um FAB, que se mexe um pouco ao passar o
 * mouse (ou ao focar com o teclado). Tudo é um link para o repositório do template.
 */
export function FaiscaCredito({ sx }: { sx?: SxProps<Theme> }) {
  const [ativo, setAtivo] = useState(false);
  return (
    <Link
      href={FAISCA_REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      aria-label="Powered by Faísca (abre o repositório do template no GitHub)"
      onMouseEnter={() => setAtivo(true)}
      onMouseLeave={() => setAtivo(false)}
      onFocus={() => setAtivo(true)}
      onBlur={() => setAtivo(false)}
      sx={[
        (theme) => ({
          display: 'inline-flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
          color: 'text.secondary',
          borderRadius: 4,
          px: 2,
          py: 1,
          '&:focus-visible': { outline: `2px solid ${theme.vars.palette.primary.main}`, outlineOffset: 2 },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Typography component="span" variant="caption" sx={{ letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, fontSize: '0.7rem' }}>
        Powered by
      </Typography>
      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          aria-hidden
          sx={(theme) => ({
            display: 'block',
            lineHeight: 0,
            // O próprio logo vira o "botão": elevado como um FAB, um pouco acima da linha do nome.
            borderRadius: '28%',
            transform: ativo ? 'translateY(-6px) rotate(-8deg) scale(1.06)' : 'translateY(-3px)',
            boxShadow: ativo
              ? `0 16px 26px -10px ${theme.alpha('#8FB80F', 0.85)}, 0 4px 10px -3px ${theme.alpha('#140E26', 0.35)}`
              : `0 10px 20px -8px ${theme.alpha('#140E26', 0.45)}, 0 3px 6px -2px ${theme.alpha('#140E26', 0.25)}`,
            transition: [
              `transform ${duration.medium4}ms ${easing.springFast}`,
              `box-shadow ${duration.medium2}ms ${easing.standard}`,
            ].join(', '),
            '@media (prefers-reduced-motion: reduce)': { transition: 'none', transform: 'none' },
          })}
        >
          <FaiscaMark size={44} animated={ativo} />
        </Box>
        <Box
          component="span"
          sx={(theme) => ({
            fontSize: '1.25rem',
            fontWeight: 800,
            fontVariationSettings: "'ROND' 100",
            backgroundImage: `linear-gradient(90deg, ${theme.vars.palette.primary.main}, #7649CF)`,
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
            ...theme.applyStyles('dark', { backgroundImage: 'linear-gradient(90deg, #D4F45E, #BBA4EE)' }),
          })}
        >
          Faísca
        </Box>
      </Box>
    </Link>
  );
}
