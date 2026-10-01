/**
 * Small, dependency-free charts following the dataviz method:
 * thin marks (≤24px bars, 4px rounded data-end), one neutral series hue
 * (brand violet, never party colors), values written as text (never color-only),
 * hover tooltips, hairline recessive axes, and a table/list fallback built in.
 */
import { useId, useState, type ReactNode } from 'react';
import { Box, Stack, Tooltip, Typography, type SxProps, type Theme } from '@mui/material';
import { CATEGORICAL, SERIES } from './palette';

const OTHER = { light: '#9D95B3', dark: '#6E6687' } as const;

const seriesSx = (theme: Theme) => ({
  backgroundColor: SERIES.light,
  ...theme.applyStyles('dark', { backgroundColor: SERIES.dark }),
});

export interface BarDatum {
  label: string;
  value: number;
  /** Text shown at the bar tip (defaults to the formatted value). */
  display?: string;
  hint?: ReactNode;
  emphasis?: boolean;
}

/**
 * Horizontal bars, one series. Label on the left, value at the tip.
 * `max` lets several lists share a scale (e.g. comparing candidates).
 */
export function BarList({
  data,
  format,
  max,
  limit,
  emptyText = 'Nenhum dado declarado.',
  labelWidth = { xs: '42%', sm: '38%' },
}: {
  data: BarDatum[];
  format: (v: number) => string;
  max?: number;
  limit?: number;
  emptyText?: string;
  labelWidth?: Record<string, string> | string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!data.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        {emptyText}
      </Typography>
    );
  }
  const top = max ?? Math.max(...data.map((d) => d.value), 0);
  const visible = limit && !expanded ? data.slice(0, limit) : data;
  return (
    <Stack component="ul" spacing={0.75} sx={{ listStyle: 'none', p: 0, m: 0 }}>
      {visible.map((d) => {
        const ratio = top > 0 ? Math.max(0, d.value) / top : 0;
        const text = d.display ?? format(d.value);
        return (
          <Tooltip key={d.label} title={d.hint ?? `${d.label}: ${text}`} placement="top" followCursor>
            <Box component="li" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 28, py: 0.25 }}>
              <Typography
                variant="body2"
                sx={{
                  width: labelWidth,
                  flexShrink: 0,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.25,
                  fontWeight: d.emphasis ? 700 : 400,
                }}
                title={d.label}
              >
                {d.label}
              </Typography>
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box
                  sx={(theme) => ({
                    ...seriesSx(theme),
                    height: 14,
                    width: `${ratio * 100}%`,
                    minWidth: d.value > 0 ? 3 : 0,
                    borderRadius: '0 4px 4px 0',
                    opacity: d.emphasis === false ? 0.45 : 1,
                    transition: 'width 500ms cubic-bezier(0.05, 0.7, 0.1, 1)',
                  })}
                />
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
                  {text}
                </Typography>
              </Box>
            </Box>
          </Tooltip>
        );
      })}
      {limit && data.length > limit && (
        <Box component="li">
          <Typography
            component="button"
            variant="body2"
            onClick={() => setExpanded((e) => !e)}
            sx={{ border: 0, background: 'none', p: 0, cursor: 'pointer', color: 'primary.main', fontWeight: 600 }}
          >
            {expanded ? 'Mostrar menos' : `Mostrar todos (${data.length})`}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

/** Part-to-whole in one bar (≤3 named slots + "Outros"), with a legend that carries values. */
export function StackedBar({ data, format }: { data: { label: string; value: number }[]; format: (v: number) => string }) {
  const sorted = [...data].filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, 3);
  const rest = sorted.slice(3).reduce((s, d) => s + d.value, 0);
  const parts = rest > 0 ? [...head, { label: 'Outros', value: rest }] : head;
  const total = parts.reduce((s, d) => s + d.value, 0);
  if (!total) {
    return (
      <Typography variant="body2" color="text.secondary">
        Nenhum valor declarado.
      </Typography>
    );
  }
  const color = (i: number, mode: 'light' | 'dark') => (parts[i].label === 'Outros' ? OTHER[mode] : CATEGORICAL[mode][i]);
  return (
    <Stack spacing={1.25}>
      <Box sx={{ display: 'flex', gap: '2px', height: 16, borderRadius: '4px', overflow: 'hidden' }} role="img" aria-label={parts.map((p) => `${p.label}: ${format(p.value)}`).join('; ')}>
        {parts.map((p, i) => (
          <Tooltip key={p.label} title={`${p.label}: ${format(p.value)} (${((p.value / total) * 100).toFixed(1).replace('.', ',')}%)`}>
            <Box
              sx={(theme) => ({
                flex: `${p.value} 0 0`,
                minWidth: 3,
                backgroundColor: color(i, 'light'),
                ...theme.applyStyles('dark', { backgroundColor: color(i, 'dark') }),
              })}
            />
          </Tooltip>
        ))}
      </Box>
      <Stack component="ul" spacing={0.5} sx={{ listStyle: 'none', p: 0, m: 0 }}>
        {parts.map((p, i) => (
          <Stack component="li" key={p.label} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Box
              sx={(theme) => ({
                width: 10,
                height: 10,
                borderRadius: '3px',
                flexShrink: 0,
                backgroundColor: color(i, 'light'),
                ...theme.applyStyles('dark', { backgroundColor: color(i, 'dark') }),
              })}
            />
            <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
              {p.label}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
              {format(p.value)}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ width: 48, textAlign: 'right' }}>
              {((p.value / total) * 100).toFixed(1).replace('.', ',')}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

/** Vertical columns over time (e.g. monthly spending) with a per-column tooltip. */
export function ColumnChart({
  data,
  format,
  height = 180,
  reference,
}: {
  data: { label: string; value: number; tooltip?: string }[];
  format: (v: number) => string;
  height?: number;
  /** Optional horizontal reference line (e.g. state average) — drawn as a hairline, labeled. */
  reference?: { value: number; label: string };
}) {
  const id = useId();
  const max = Math.max(...data.map((d) => d.value), reference?.value ?? 0, 1);
  const ticks = [0, max / 2, max];
  if (!data.length) {
    return (
      <Typography variant="body2" color="text.secondary">
        Sem lançamentos no período.
      </Typography>
    );
  }
  return (
    <Box sx={{ position: 'relative', pl: 7 }} aria-describedby={id}>
      <Box sx={{ position: 'relative', height, borderBottom: 1, borderColor: 'divider' }}>
        {ticks.map((t) => (
          <Box key={t} sx={{ position: 'absolute', left: 0, right: 0, bottom: `${(t / max) * 100}%`, borderTop: t ? 1 : 0, borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary" sx={{ position: 'absolute', right: '100%', mr: 1, transform: 'translateY(-50%)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
              {format(t)}
            </Typography>
          </Box>
        ))}
        {reference && (
          <Box sx={{ position: 'absolute', left: 0, right: 0, bottom: `${(reference.value / max) * 100}%`, borderTop: '1px solid', borderColor: 'text.secondary', zIndex: 1 }}>
            <Typography variant="caption" sx={{ position: 'absolute', right: 0, bottom: 2, px: 0.5, bgcolor: 'background.paper', color: 'text.secondary' }}>
              {reference.label}
            </Typography>
          </Box>
        )}
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', gap: '2px' }}>
          {data.map((d) => (
            <Tooltip key={d.label} title={d.tooltip ?? `${d.label}: ${format(d.value)}`} placement="top">
              <Box sx={{ flex: 1, height: '100%', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', cursor: 'default', '&:hover > *': { opacity: 0.8 } }}>
                <Box sx={(theme) => ({ ...seriesSx(theme), width: '100%', maxWidth: 24, height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 2 : 0, borderRadius: '4px 4px 0 0' })} />
              </Box>
            </Tooltip>
          ))}
        </Box>
      </Box>
      <Box sx={{ display: 'flex', gap: '2px', mt: 0.5 }}>
        {data.map((d, i) => (
          <Typography key={d.label} variant="caption" color="text.secondary" sx={{ flex: 1, textAlign: 'center', fontSize: '0.625rem', visibility: data.length > 16 && i % 3 !== 0 ? 'hidden' : 'visible' }}>
            {d.label}
          </Typography>
        ))}
      </Box>
      <Box id={id} component="table" sx={visuallyHidden}>
        <tbody>
          {data.map((d) => (
            <tr key={d.label}>
              <th>{d.label}</th>
              <td>{format(d.value)}</td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  );
}

const visuallyHidden = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  whiteSpace: 'nowrap',
} as const;

/** How much of a cap was used (e.g. campaign spending vs legal limit). Neutral hue, value as text. */
export function Meter({ value, max, label, format }: { value: number; max: number; label: string; format: (v: number) => string }) {
  const ratio = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <Stack spacing={0.75}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
          {((value / max) * 100).toFixed(1).replace('.', ',')}% de {format(max)}
        </Typography>
      </Stack>
      <Box sx={(theme) => ({ height: 10, borderRadius: 99, backgroundColor: theme.alpha(SERIES.light, 0.14), ...theme.applyStyles('dark', { backgroundColor: theme.alpha(SERIES.dark, 0.2) }) })}>
        <Box sx={(theme) => ({ ...seriesSx(theme), height: '100%', width: `${ratio * 100}%`, borderRadius: 99 })} />
      </Box>
    </Stack>
  );
}

export function StatTile({ label, value, foot, sx }: { label: string; value: ReactNode; foot?: ReactNode; sx?: SxProps<Theme> }) {
  return (
    <Box sx={[{ p: 2, borderRadius: 3, border: 1, borderColor: 'divider', bgcolor: 'background.paper', height: '100%' }, ...(Array.isArray(sx) ? sx : [sx])]}>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" component="p" sx={{ mt: 0.5, fontVariantNumeric: 'normal' }}>
        {value}
      </Typography>
      {foot && (
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
          {foot}
        </Typography>
      )}
    </Box>
  );
}
