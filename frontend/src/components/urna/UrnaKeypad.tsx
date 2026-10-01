import { Box, ButtonBase, Typography } from '@mui/material';

export type UrnaKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'branco' | 'corrige' | 'confirma';

const DIGIT_ROWS: (UrnaKey | null)[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', null];

/** Real machine colours for the three action keys. */
const ACTION = {
  branco: { label: 'BRANCO', bg: '#f4f4f2', hover: '#ffffff', fg: '#111', aria: 'Branco: votar em branco' },
  corrige: { label: 'CORRIGE', bg: '#e8742a', hover: '#f08540', fg: '#111', aria: 'Corrige: apagar e reiniciar este voto' },
  confirma: { label: 'CONFIRMA', bg: '#2f9d4c', hover: '#38b058', fg: '#111', aria: 'Confirma: confirmar este voto' },
} as const;

function pressedSx(active: boolean) {
  return active
    ? { transform: 'translateY(2px)', boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.55)' }
    : { boxShadow: '0 3px 0 rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.12)' };
}

/**
 * Keypad of the simulated voting machine: digits in phone layout on a dark panel,
 * then BRANCO, CORRIGE and CONFIRMA. `pressed` animates keys hit on the keyboard.
 */
export function UrnaKeypad({
  onKey,
  pressed,
  disabled = false,
}: {
  onKey: (key: UrnaKey) => void;
  pressed: UrnaKey | null;
  disabled?: boolean;
}) {
  return (
    <Box
      role="group"
      aria-label="Teclado da urna"
      sx={{
        bgcolor: '#1c1c1e',
        borderRadius: '10px',
        p: { xs: 1.5, sm: 2 },
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), inset 0 6px 14px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
        gap: { xs: 1.25, sm: 1.5 },
        width: '100%',
      }}
    >
      <Typography
        aria-hidden
        sx={{ color: '#bdbdbd', fontSize: '0.625rem', letterSpacing: '0.2em', fontWeight: 700, textAlign: 'center' }}
      >
        SIMULADOR EDUCATIVO
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: { xs: 1, sm: 1.25 }, px: { xs: 1, sm: 2 } }}>
        {DIGIT_ROWS.map((k, i) =>
          k == null ? (
            <Box key={`gap-${i}`} />
          ) : (
            <ButtonBase
              key={k}
              aria-label={`Tecla ${k}`}
              disabled={disabled}
              onClick={() => onKey(k)}
              sx={{
                height: { xs: 48, sm: 52 },
                borderRadius: '6px',
                bgcolor: '#0b0b0c',
                color: '#f5f5f5',
                fontSize: { xs: '1.375rem', sm: '1.5rem' },
                fontWeight: 600,
                fontFamily: 'Arial, Helvetica, sans-serif',
                border: '1px solid #333',
                transition: 'transform 60ms, box-shadow 60ms, background-color 120ms',
                '&:hover': { bgcolor: '#26262a' },
                '&:active': pressedSx(true),
                '&.Mui-focusVisible': { outline: '3px solid #8ab4f8', outlineOffset: 2 },
                ...pressedSx(pressed === k),
              }}
            >
              {k}
            </ButtonBase>
          ),
        )}
      </Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.15fr', gap: { xs: 0.75, sm: 1 }, alignItems: 'end' }}>
        {(['branco', 'corrige', 'confirma'] as const).map((k) => {
          const a = ACTION[k];
          return (
            <ButtonBase
              key={k}
              aria-label={a.aria}
              disabled={disabled}
              onClick={() => onKey(k)}
              sx={{
                height: k === 'confirma' ? { xs: 58, sm: 64 } : { xs: 44, sm: 48 },
                borderRadius: '6px',
                bgcolor: a.bg,
                color: a.fg,
                fontFamily: 'Arial, Helvetica, sans-serif',
                fontWeight: 700,
                fontSize: { xs: '0.6875rem', sm: '0.8125rem' },
                letterSpacing: '0.04em',
                transition: 'transform 60ms, box-shadow 60ms, background-color 120ms',
                '&:hover': { bgcolor: a.hover },
                '&:active': pressedSx(true),
                '&.Mui-focusVisible': { outline: '3px solid #8ab4f8', outlineOffset: 2 },
                ...pressedSx(pressed === k),
              }}
            >
              {a.label}
            </ButtonBase>
          );
        })}
      </Box>
    </Box>
  );
}
