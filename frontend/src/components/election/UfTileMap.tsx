import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { IBGE_VIEWBOX, UF_SHAPES } from './brazilMapData';

/** Sequential blue ramp (light→dark) for magnitude; label color flips by luminance. */
const RAMP = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];

/** Small coastal states get their label in the ocean, with a leader line. */
const CALLOUT: Record<string, [number, number]> = {
  RN: [-34.4, 4.6],
  PB: [-34.4, 6.5],
  PE: [-34.4, 8.3],
  AL: [-34.4, 10.0],
  SE: [-34.4, 11.7],
  ES: [-37.6, 20.4],
  RJ: [-40.2, 24.3],
};
/** Labels nudged so DF (inside GO) stays readable. */
const NUDGE: Record<string, [number, number]> = { GO: [-50.4, 15.4], DF: [-47.79, 15.95] };

const [VB_X, VB_Y, VB_W, VB_H] = IBGE_VIEWBOX.split(/\s+/).map(Number);
// a little room on the right for the coastal labels
const VIEWBOX = `${VB_X - 0.5} ${VB_Y - 0.5} ${VB_W + 4.2} ${VB_H + 1}`;

export interface BrazilMapProps {
  selected?: string | null;
  onSelect?: (uf: string) => void;
  /** Optional magnitude per UF → sequential fill (choropleth). */
  values?: Record<string, number>;
  format?: (v: number) => string;
  names?: Record<string, string>;
  /** Map width in px (height follows the aspect ratio). Defaults to 100% of the container, max 560. */
  width?: number | string;
  /** Legacy prop from the tile version: tile size → map width ≈ size × 9. */
  size?: number;
}

/**
 * Map of Brazil drawn from the official IBGE state boundaries. Click (or Tab + Enter) a state to
 * select it. Every state has the same visual weight; color only encodes a value the user asked for.
 */
export function BrazilMap({ selected, onSelect, values, format, names, width, size }: BrazilMapProps) {
  const [hover, setHover] = useState<string | null>(null);
  const nums = values ? Object.values(values) : [];
  const min = nums.length ? Math.min(...nums) : 0;
  const max = nums.length ? Math.max(...nums) : 1;
  const step = (v: number) => Math.min(RAMP.length - 1, Math.floor(((v - min) / (max - min || 1)) * RAMP.length));
  const label = (uf: string) => `${names?.[uf] ?? uf}${values?.[uf] != null && format ? `: ${format(values[uf])}` : ''}`;
  const active = hover ?? selected ?? null;

  return (
    <Box sx={{ width: width ?? (size ? size * 9 : '100%'), maxWidth: '100%', mx: 'auto' }}>
      <Box
        component="svg"
        viewBox={VIEWBOX}
        role={onSelect ? 'group' : 'img'}
        aria-label={onSelect ? 'Mapa do Brasil: escolha um estado' : 'Mapa do Brasil por estado'}
        sx={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <g transform="scale(0.0001,-0.0001)">
          {UF_SHAPES.map(({ uf, d }) => {
            const v = values?.[uf];
            const s = v != null ? step(v) : null;
            const isSel = selected === uf;
            return (
              <Box
                key={uf}
                component="path"
                d={d}
                role={onSelect ? 'button' : undefined}
                tabIndex={onSelect ? 0 : undefined}
                aria-label={label(uf)}
                aria-pressed={onSelect ? isSel : undefined}
                onClick={() => onSelect?.(uf)}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    onSelect(uf);
                  }
                }}
                onMouseEnter={() => setHover(uf)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(uf)}
                onBlur={() => setHover(null)}
                vectorEffect="non-scaling-stroke"
                sx={(theme) => ({
                  cursor: onSelect ? 'pointer' : 'default',
                  strokeWidth: isSel ? 2 : 1,
                  stroke: theme.vars.palette.background.paper,
                  transition: 'fill 150ms',
                  outline: 'none',
                  fill:
                    s != null
                      ? RAMP[s]
                      : isSel
                        ? theme.vars.palette.primary.main
                        : hover === uf
                          ? theme.alpha(theme.vars.palette.primary.main, 0.35)
                          : theme.alpha(theme.vars.palette.primary.main, 0.13),
                  ...(s != null && hover === uf && { filter: 'brightness(0.9)' }),
                  ...(s != null && isSel && { stroke: theme.vars.palette.text.primary }),
                  '&:focus-visible': { stroke: theme.vars.palette.text.primary, strokeWidth: 2.5 },
                })}
              >
                <title>{label(uf)}</title>
              </Box>
            );
          })}
        </g>
        {UF_SHAPES.map(({ uf, cx, cy }) => {
          const callout = CALLOUT[uf];
          const v = values?.[uf];
          const s = v != null ? step(v) : null;
          const onFill = selected === uf || (s != null && s >= 3);
          const [lx, ly] = callout ?? NUDGE[uf] ?? [cx, cy];
          return (
            <g key={uf} pointerEvents="none">
              {callout && <line x1={cx} y1={cy} x2={lx - 0.25} y2={ly - 0.25} strokeWidth={0.06} stroke="currentColor" opacity={0.45} />}
              <Box
                component="text"
                x={lx}
                y={ly}
                textAnchor={callout ? 'start' : 'middle'}
                dominantBaseline="middle"
                sx={(theme) => ({
                  fontSize: uf === 'DF' ? 0.8 : 1.15,
                  fontWeight: active === uf ? 800 : 700,
                  fontFamily: theme.typography.fontFamily,
                  fill: !callout && onFill ? '#fff' : theme.vars.palette.text.primary,
                  letterSpacing: '0.02em',
                })}
              >
                {uf}
              </Box>
            </g>
          );
        })}
      </Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', minHeight: '1.4em', mt: 0.5 }} aria-live="polite">
        {active ? label(active) : onSelect ? 'Toque ou clique em um estado' : ''}
      </Typography>
      {values && format && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mt: 0.5 }}>
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
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', fontSize: '0.65rem', mt: 0.5 }}>
        Contornos: malha oficial do IBGE
      </Typography>
    </Box>
  );
}

/** Kept for existing call sites: the tile cartogram became the real map. */
export const UfTileMap = BrazilMap;
