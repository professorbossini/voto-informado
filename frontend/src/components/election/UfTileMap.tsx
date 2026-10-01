import { Box, ButtonBase, Tooltip, Typography } from '@mui/material';

/** Tile-grid cartogram of Brazil: every UF is the same size, so none dominates visually. */
const GRID: Record<string, [number, number]> = {
  RR: [0, 2], AP: [0, 4],
  AM: [1, 1], PA: [1, 3], MA: [1, 4], CE: [1, 5], RN: [1, 6],
  AC: [2, 0], RO: [2, 1], MT: [2, 2], TO: [2, 3], PI: [2, 4], PE: [2, 5], PB: [2, 6],
  MS: [3, 2], GO: [3, 3], DF: [3, 4], BA: [3, 5], AL: [3, 6],
  PR: [4, 2], SP: [4, 3], MG: [4, 4], ES: [4, 5], SE: [4, 6],
  SC: [5, 2], RJ: [5, 4],
  RS: [6, 2],
};

/** Sequential blue ramp (light→dark) for magnitude; text color flips by luminance. */
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

export function UfTileMap({
  selected,
  onSelect,
  values,
  format,
  names,
  size = 44,
}: {
  selected?: string | null;
  onSelect?: (uf: string) => void;
  /** Optional magnitude per UF → sequential fill. */
  values?: Record<string, number>;
  format?: (v: number) => string;
  names?: Record<string, string>;
  size?: number;
}) {
  const nums = values ? Object.values(values) : [];
  const min = nums.length ? Math.min(...nums) : 0;
  const max = nums.length ? Math.max(...nums) : 1;
  const step = (v: number) => Math.min(RAMP.length - 1, Math.floor(((v - min) / (max - min || 1)) * RAMP.length));

  return (
    <Box>
      <Box
        role={onSelect ? 'radiogroup' : undefined}
        aria-label="Unidades da federação"
        sx={{ display: 'grid', gridTemplateColumns: `repeat(7, ${size}px)`, gridAutoRows: `${size}px`, gap: '4px', width: 'max-content', maxWidth: '100%' }}
      >
        {Object.entries(GRID).map(([uf, [r, c]]) => {
          const v = values?.[uf];
          const s = v != null ? step(v) : null;
          const isSel = selected === uf;
          const label = `${names?.[uf] ?? uf}${v != null && format ? `: ${format(v)}` : ''}`;
          const tile = (
            <ButtonBase
              role={onSelect ? 'radio' : undefined}
              aria-checked={onSelect ? isSel : undefined}
              aria-label={label}
              disabled={!onSelect}
              onClick={() => onSelect?.(uf)}
              sx={(theme) => ({
                width: '100%',
                height: '100%',
                borderRadius: '10px',
                fontWeight: 700,
                fontSize: size < 40 ? '0.7rem' : '0.8125rem',
                letterSpacing: '0.02em',
                transition: 'transform 200ms cubic-bezier(0.34, 1.56, 0.64, 1), background-color 200ms',
                ...(s != null
                  ? { backgroundColor: RAMP[s], color: s >= 3 ? '#fff' : '#0d366b' }
                  : {
                      backgroundColor: isSel ? theme.vars.palette.primary.main : theme.vars.palette.background.subtle,
                      color: isSel ? theme.vars.palette.primary.contrastText : theme.vars.palette.text.primary,
                      border: `1px solid ${theme.vars.palette.divider}`,
                    }),
                ...(isSel && s != null && { outline: `3px solid ${theme.vars.palette.primary.main}`, outlineOffset: 1 }),
                '&:hover': onSelect ? { transform: 'scale(1.08)' } : undefined,
                '&.Mui-disabled': { color: s != null ? (s >= 3 ? '#fff' : '#0d366b') : theme.vars.palette.text.primary },
              })}
            >
              {uf}
            </ButtonBase>
          );
          return (
            <Tooltip key={uf} title={label}>
              <Box sx={{ gridRow: r + 1, gridColumn: c + 1, display: 'grid' }}>{tile}</Box>
            </Tooltip>
          );
        })}
      </Box>
      {values && format && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary">
            {format(min)}
          </Typography>
          <Box sx={{ display: 'flex', gap: '2px' }}>
            {RAMP.map((c) => (
              <Box key={c} sx={{ width: 18, height: 10, bgcolor: c, borderRadius: '2px' }} />
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            {format(max)}
          </Typography>
        </Box>
      )}
    </Box>
  );
}
