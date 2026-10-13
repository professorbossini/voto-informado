import { useState } from 'react';
import { Box, Typography } from '@mui/material';
import { useColorScheme } from '@mui/material/styles';
import { FAIXAS, SEM_DADO, rampa } from '@/data/mapaVotos';
import { CENSUS_MALHA_URL, USA_SHAPES, USA_VIEWBOX } from '../usaMapData';
import { nomeEstado } from '../formato';

/** Estados pequenos do nordeste: rótulo à direita, com linha de chamada. */
const CHAMADA: Record<string, [number, number]> = {
  VT: [880, 58], NH: [880, 76], MA: [880, 96], RI: [880, 114], CT: [880, 132], NJ: [880, 152], DE: [880, 172], MD: [880, 190], DC: [880, 208],
};

export function useEscuro() {
  const { mode, systemMode } = useColorScheme();
  return (mode === 'system' ? systemMode : mode) === 'dark';
}

/** Branco ou tinta sobre um preenchimento, pela luminância. */
function tintaSobre(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#fff';
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(m[1].slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? '#140E26' : '#fff';
}

export interface MapaEuaProps {
  selecionado?: string | null;
  onSelect?: (uf: string) => void;
  /** Faixa de cor (0 a 9) por estado, na escala neutra (violeta) do site. Ausente = sem dado (hachura cinza). */
  faixas?: Record<string, number>;
  /** Destaque simples (sem escala): estados marcados ficam na cor principal. */
  marcados?: Set<string>;
  /** Texto de cada estado (passar o mouse, leitor de tela). */
  rotulos?: Record<string, string>;
  dica?: string;
  ariaLabel?: string;
}

/**
 * Mapa dos EUA desenhado a partir da malha oficial do Census Bureau. Nenhuma cor de partido: só a
 * escala neutra do site (mais escuro = valor maior) ou o destaque do estado escolhido.
 */
export function MapaEua({ selecionado, onSelect, faixas, marcados, rotulos, dica, ariaLabel }: MapaEuaProps) {
  const [hover, setHover] = useState<string | null>(null);
  const escuro = useEscuro();
  const cores = rampa(escuro ? 'dark' : 'light');
  const sem = SEM_DADO[escuro ? 'dark' : 'light'];
  const ativo = hover ?? selecionado ?? null;
  const rotulo = (uf: string) => rotulos?.[uf] ?? nomeEstado(uf);
  const padrao = `hachura-eua-${escuro ? 'e' : 'c'}`;

  return (
    <Box sx={{ width: '100%', maxWidth: 820, mx: 'auto' }}>
      <Box
        component="svg"
        viewBox={USA_VIEWBOX}
        role={onSelect ? 'group' : 'img'}
        aria-label={ariaLabel ?? (onSelect ? 'Mapa dos Estados Unidos: escolha um estado' : 'Mapa dos Estados Unidos por estado')}
        sx={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      >
        <defs>
          <pattern id={padrao} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill={sem.fundo} />
            <line x1="0" y1="0" x2="0" y2="6" stroke={sem.traco} strokeWidth="1.2" />
          </pattern>
        </defs>
        {USA_SHAPES.map(({ uf, d }) => {
          const f = faixas?.[uf];
          const sel = selecionado === uf;
          const cor = faixas ? (f != null ? cores[Math.max(0, Math.min(FAIXAS - 1, f))] : `url(#${padrao})`) : null;
          return (
            <Box
              key={uf}
              component="path"
              d={d}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              aria-label={rotulo(uf)}
              aria-pressed={onSelect ? sel : undefined}
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
              sx={(theme) => ({
                cursor: onSelect ? 'pointer' : 'default',
                stroke: sel ? theme.vars.palette.text.primary : theme.vars.palette.background.paper,
                strokeWidth: sel ? 2.2 : 0.8,
                strokeLinejoin: 'round',
                outline: 'none',
                transition: 'fill 150ms',
                fill:
                  cor ??
                  (sel || marcados?.has(uf)
                    ? theme.vars.palette.primary.main
                    : hover === uf
                      ? theme.alpha(theme.vars.palette.primary.main, 0.35)
                      : theme.alpha(theme.vars.palette.primary.main, 0.14)),
                ...(cor && hover === uf && { filter: 'brightness(0.88)' }),
                '&:focus-visible': { stroke: theme.vars.palette.text.primary, strokeWidth: 2.5 },
              })}
            >
              <title>{rotulo(uf)}</title>
            </Box>
          );
        })}
        {USA_SHAPES.map(({ uf, cx, cy }) => {
          const ch = CHAMADA[uf];
          const f = faixas?.[uf];
          const fundo = faixas && f != null ? cores[Math.max(0, Math.min(FAIXAS - 1, f))] : selecionado === uf || marcados?.has(uf) ? '#5B2DB0' : null;
          const [lx, ly] = ch ?? [cx, cy];
          return (
            <g key={uf} pointerEvents="none">
              {ch && <line x1={cx} y1={cy} x2={lx - 4} y2={ly - 3} strokeWidth={0.6} stroke="currentColor" opacity={0.45} />}
              <Box
                component="text"
                x={lx}
                y={ly}
                textAnchor={ch ? 'start' : 'middle'}
                dominantBaseline="middle"
                sx={(theme) => ({
                  fontSize: ch ? 10 : uf === 'HI' || uf === 'AK' ? 11 : 11.5,
                  fontWeight: ativo === uf ? 800 : 700,
                  fontFamily: theme.typography.fontFamily,
                  fill: !ch && fundo ? tintaSobre(fundo) : theme.vars.palette.text.primary,
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
        {ativo ? rotulo(ativo) : (dica ?? (onSelect ? 'Toque ou clique em um estado' : ''))}
      </Typography>
      <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', fontSize: '0.65rem' }}>
        Contornos: malha oficial do{' '}
        <Box component="a" href={CENSUS_MALHA_URL} target="_blank" rel="noopener noreferrer" sx={{ color: 'inherit' }}>
          U.S. Census Bureau
        </Box>
      </Typography>
    </Box>
  );
}

/** Legenda da escala neutra (10 faixas), com os rótulos de mínimo e máximo. */
export function LegendaEscala({ min, max, titulo }: { min: string; max: string; titulo: string }) {
  const escuro = useEscuro();
  const cores = rampa(escuro ? 'dark' : 'light');
  const sem = SEM_DADO[escuro ? 'dark' : 'light'];
  return (
    <Box sx={{ maxWidth: 520, mx: 'auto', mt: 1.5 }}>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5, textAlign: 'center' }}>
        {titulo}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {min}
        </Typography>
        <Box sx={{ display: 'flex', flex: 1, borderRadius: 1, overflow: 'hidden', border: 1, borderColor: 'divider' }} aria-hidden>
          {cores.map((c) => (
            <Box key={c} sx={{ flex: 1, height: 12, bgcolor: c }} />
          ))}
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
          {max}
        </Typography>
        <Box aria-hidden sx={{ width: 18, height: 12, ml: 1, borderRadius: 0.5, border: 1, borderColor: 'divider', background: `repeating-linear-gradient(135deg, ${sem.fundo} 0 3px, ${sem.traco} 3px 4px)` }} />
        <Typography variant="caption" color="text.secondary">
          sem dado
        </Typography>
      </Box>
    </Box>
  );
}

/** Faixas (0 a 9) por estado, em escala linear entre o menor e o maior valor. */
export function faixasLineares(valores: Record<string, number | null | undefined>): Record<string, number> {
  const nums = Object.values(valores).filter((v): v is number => v != null && Number.isFinite(v));
  if (!nums.length) return {};
  const min = Math.min(...nums);
  const max = Math.max(...nums);
  const out: Record<string, number> = {};
  for (const [uf, v] of Object.entries(valores)) {
    if (v == null || !Number.isFinite(v)) continue;
    out[uf] = max === min ? FAIXAS - 1 : Math.min(FAIXAS - 1, Math.floor(((v - min) / (max - min)) * FAIXAS));
  }
  return out;
}

/** Faixas (0 a 9) pela posição de cada estado (decis): cada faixa tem o mesmo número de estados. */
export function faixasPorPosicao(valores: Record<string, number | null | undefined>): Record<string, number> {
  const lista = Object.entries(valores).filter((e): e is [string, number] => e[1] != null && Number.isFinite(e[1])).sort((a, b) => a[1] - b[1]);
  const out: Record<string, number> = {};
  lista.forEach(([uf], i) => (out[uf] = Math.min(FAIXAS - 1, Math.floor((i * FAIXAS) / lista.length))));
  return out;
}
