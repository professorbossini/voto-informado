import { Box } from '@mui/material';
import { keyframes } from '@mui/material/styles';

const blink = keyframes`
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
`;

const SIZES = {
  sm: { w: 26, h: 34, font: '1.125rem', gap: 4, radius: 6 },
  md: { w: 38, h: 50, font: '1.625rem', gap: 6, radius: 8 },
  lg: { w: 48, h: 62, font: '2.125rem', gap: 6, radius: 10 },
} as const;

/**
 * Ballot number in one box per digit, like the voting machine. `tone="urna"` uses
 * the fixed black-on-white look of the machine screen, independent of the theme.
 */
export function DigitBoxes({
  count,
  value,
  size = 'md',
  tone = 'paper',
  cursor = false,
  label,
}: {
  count: number;
  value: string;
  size?: keyof typeof SIZES;
  tone?: 'paper' | 'urna';
  /** Blink the next empty box (machine screen while typing). */
  cursor?: boolean;
  label?: string;
}) {
  const s = SIZES[size];
  const chars = Array.from({ length: count }, (_, i) => value[i] ?? '');
  const aria = label ?? (value ? `Número ${value.split('').join(' ')}` : 'Número não escolhido');
  return (
    <Box role="img" aria-label={aria} className="vi-digits" sx={{ display: 'inline-flex', gap: `${s.gap}px`, flexShrink: 0 }}>
      {chars.map((ch, i) => {
        const isCursor = cursor && i === value.length;
        return (
          <Box
            key={i}
            aria-hidden
            className="vi-digit"
            sx={(theme) => ({
              width: s.w,
              height: s.h,
              display: 'grid',
              placeItems: 'center',
              fontFamily: '"Google Sans Code", "Roboto Mono", ui-monospace, monospace',
              fontWeight: 700,
              fontSize: s.font,
              lineHeight: 1,
              fontVariantNumeric: 'tabular-nums',
              ...(tone === 'urna'
                ? {
                    border: '2px solid #1a1a1a',
                    borderRadius: '3px',
                    bgcolor: '#fff',
                    color: '#000',
                  }
                : {
                    border: `2px solid ${ch ? theme.vars.palette.text.primary : theme.vars.palette.divider}`,
                    borderRadius: `${s.radius}px`,
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                  }),
              ...(isCursor && {
                position: 'relative',
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  inset: 3,
                  bgcolor: '#1a1a1a',
                  opacity: 0.85,
                  animation: `${blink} 1s steps(1) infinite`,
                },
              }),
            })}
          >
            {ch}
          </Box>
        );
      })}
    </Box>
  );
}
