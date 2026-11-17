import { useState } from 'react';
import { Box, Link, Typography, type SxProps, type Theme } from '@mui/material';
import { FAISCA_URL } from '@/config/brand';
import { duration, easing } from '@/theme/motion';
import { BossiniLabsMark } from './BossiniLabsMark';

/**
 * Crédito do template Faísca, centralizado no fim da página:
 *
 *   (ícone da Bossini Labs)  Powered by Faísca
 *
 * O ícone fica num botão elevado, no estilo de um FAB, que se mexe um pouco ao passar o
 * mouse (ou ao focar com o teclado). Tudo é um link para o site da Bossini Labs. O texto é o
 * mesmo em todos os idiomas (não entra no dicionário de tradução).
 */
export function FaiscaCredito({ sx }: { sx?: SxProps<Theme> }) {
  const [ativo, setAtivo] = useState(false);
  return (
    <Link
      href={FAISCA_URL}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      aria-label="Powered by Faísca, da Bossini Labs"
      onMouseEnter={() => setAtivo(true)}
      onMouseLeave={() => setAtivo(false)}
      onFocus={() => setAtivo(true)}
      onBlur={() => setAtivo(false)}
      sx={[
        (theme) => ({
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1.25,
          color: 'text.secondary',
          borderRadius: 4,
          px: 2,
          py: 1,
          '&:focus-visible': { outline: `2px solid ${theme.vars.palette.primary.main}`, outlineOffset: 2 },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      <Box
        aria-hidden
        sx={(theme) => ({
          display: 'block',
          lineHeight: 0,
          // O próprio ícone vira o "botão": elevado como um FAB, um pouco acima da linha do texto.
          borderRadius: '25%',
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
        <BossiniLabsMark size={44} />
      </Box>
      <Typography component="span" sx={{ fontSize: '1rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
        Powered by Faísca
      </Typography>
    </Link>
  );
}
