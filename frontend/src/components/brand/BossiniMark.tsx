import { useId } from 'react';
import { Box, type SxProps, type Theme } from '@mui/material';

export interface BossiniMarkProps {
  /** Rendered size in pixels. */
  size?: number;
  sx?: SxProps<Theme>;
}

const LIME = '#C6EF34';

/**
 * Rodrigo Bossini's mark: a lime "B" with a spark on a violet tile, the
 * counterpart of the Faísca mark. It always sits next to the Faísca name
 * and, per the LICENSE, must be kept unaltered (resizing is fine).
 */
export function BossiniMark({ size = 24, sx }: BossiniMarkProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tileId = `bossini-tile-${uid}`;

  return (
    <Box
      component="svg"
      viewBox="0 0 48 48"
      width={size}
      height={size}
      aria-hidden="true"
      data-marca="bossini"
      sx={[{ display: 'block', flexShrink: 0 }, ...(Array.isArray(sx) ? sx : [sx])]}
    >
      <defs>
        <linearGradient id={tileId} x1="6" y1="4" x2="42" y2="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7649CF" />
          <stop offset="1" stopColor="#2A1263" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="13" fill={`url(#${tileId})`} />
      <g stroke={LIME} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 12.5V35.5" />
        <path d="M16 12.5H25a5.5 5.5 0 0 1 0 11H16" />
        <path d="M16 23.5H26.5a6 6 0 0 1 0 12H16" />
      </g>
      <circle cx="37.5" cy="11" r="2.4" fill={LIME} />
    </Box>
  );
}
