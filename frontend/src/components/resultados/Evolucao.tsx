import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Box, Button, Stack, Typography } from '@mui/material';
import TableRowsRounded from '@mui/icons-material/TableRowsRounded';
import ShowChartRounded from '@mui/icons-material/ShowChartRounded';
import { CATEGORICAL } from '@/components/charts/palette';
import { CARGO_APURACAO_LABEL } from '@/data/apuracao';
import { nomeProprio } from '@/data/format';
import { dataTse, type DisputaSerie, type EventoSerie } from './serie';

const hhmm = (t: string) => /\s(\d{2}):(\d{2})/.exec(t)?.slice(1, 3).join('h') ?? t;
const pctFmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const pct = (n: number) => `${pctFmt.format(n)}%`;

// ── Gráfico ──────────────────────────────────────────────────────────────────

const H = 260;

/** Largura do contêiner em px (o SVG é desenhado no tamanho real, para o texto não encolher no celular). */
function useLargura(ref: React.RefObject<HTMLElement | null>, inicial = 640) {
  const [w, setW] = useState(inicial);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const obs = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))));
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return w;
}

/**
 * Linhas com o % dos votos válidos de cada candidatura ao longo da noite (eixo x = hora da
 * totalização no TSE). Cores em ordem alfabética do nome na urna, como no mapa; legenda e rótulo
 * no fim de cada linha (a cor nunca é a única pista). Passe o dedo ou o mouse para ver cada ponto.
 */
export function GraficoEvolucao({ disputa, dark }: { disputa: DisputaSerie; dark: boolean }) {
  const id = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [tabela, setTabela] = useState(false);
  const cores = dark ? CATEGORICAL.dark : CATEGORICAL.light;
  const caixa = useRef<HTMLDivElement | null>(null);
  const W = useLargura(caixa);
  const estreito = W < 480;
  // No celular, o rótulo no fim da linha é só o %: o nome está na legenda logo acima, com a mesma cor.
  const M = { top: 14, right: estreito ? 58 : 118, bottom: 28, left: 40 };

  const { series, xs, x, y, ticksY, ticksX } = useMemo(() => {
    const pts = disputa.pontos.filter((p) => p.vv > 0);
    // Eixo x: % das seções totalizadas (0 a 100%), como a contagem avança, e não a hora.
    const xs = pts.map((p) => p.s);
    // Só quem tem voto; no máximo 3 linhas (as cores validadas) — no 2º turno são 2.
    const ultimo = pts.at(-1);
    const idx = disputa.candidatos
      .map((c, i) => ({ c, i, votos: ultimo?.v[i] ?? 0 }))
      .filter((x) => x.votos > 0)
      .sort((a, b) => b.votos - a.votos)
      .slice(0, 3)
      .sort((a, b) => a.c.nome.localeCompare(b.c.nome, 'pt-BR'));
    const series = idx.map(({ c, i }, k) => ({ c, cor: cores[k], vals: pts.map((p) => (100 * (p.v[i] ?? 0)) / p.vv) }));
    const todos = series.flatMap((s) => s.vals);
    let lo = Math.min(...todos, 50);
    let hi = Math.max(...todos, 50);
    const folga = Math.max(1, (hi - lo) * 0.12);
    lo = Math.max(0, Math.floor(lo - folga));
    hi = Math.min(100, Math.ceil(hi + folga));
    const x0 = 0;
    const x1 = 100;
    const x = (t: number) => M.left + ((t - x0) / (x1 - x0)) * (W - M.left - M.right);
    const y = (v: number) => M.top + (1 - (v - lo) / (hi - lo)) * (H - M.top - M.bottom);
    const passo = hi - lo > 24 ? 10 : hi - lo > 10 ? 5 : 2;
    const ticksY: number[] = [];
    for (let v = Math.ceil(lo / passo) * passo; v <= hi; v += passo) ticksY.push(v);
    const ticksX = estreito ? [0, 50, 100] : [0, 25, 50, 75, 100];
    return { series, xs, x, y, ticksY, ticksX };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputa, cores, W, estreito]);

  if (xs.length < 2 || !series.length) return null;
  const pts = disputa.pontos.filter((p) => p.vv > 0);
  const i = hover ?? xs.length - 1;
  const resumo = `${series.map((s) => `${nomeProprio(s.c.nome)}: ${pct(s.vals.at(-1) ?? 0)}`).join('; ')}, com ${pct(pts.at(-1)?.s ?? 0)} das seções.`;

  const mover = (ev: React.PointerEvent<SVGRectElement>) => {
    const r = ev.currentTarget.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * (W - M.left - M.right) + M.left;
    let melhor = 0;
    for (let k = 1; k < xs.length; k++) if (Math.abs(x(xs[k]) - px) < Math.abs(x(xs[melhor]) - px)) melhor = k;
    setHover(melhor);
  };

  // Rótulos no fim das linhas sem encavalar (mínimo de 14px entre eles).
  const fins = series.map((s) => ({ s, yy: y(s.vals.at(-1) ?? 0) })).sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < fins.length; k++) if (fins[k].yy - fins[k - 1].yy < 14) fins[k].yy = fins[k - 1].yy + 14;

  return (
    <Box>
      <Stack direction="row" useFlexGap sx={{ gap: 1.5, flexWrap: 'wrap', mb: 0.5 }} aria-label="Legenda do gráfico">
        {series.map((s) => (
          <Stack key={s.c.sq} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Box sx={{ width: 14, height: 3, borderRadius: 2, bgcolor: s.cor }} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {nomeProprio(s.c.nome)}
            </Typography>
          </Stack>
        ))}
      </Stack>
      {tabela ? (
        <Box sx={{ maxHeight: 260, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2 }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem', fontVariantNumeric: 'tabular-nums', '& th, & td': { px: 1, py: 0.5, textAlign: 'right', borderBottom: 1, borderColor: 'divider' }, '& th:first-of-type, & td:first-of-type': { textAlign: 'left' } }}>
            <thead>
              <tr>
                <th>Hora (TSE)</th>
                <th>Seções</th>
                {series.map((s) => (
                  <th key={s.c.sq}>{nomeProprio(s.c.nome)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pts.map((p, k) => (
                <tr key={p.t}>
                  <td>{hhmm(p.t)}</td>
                  <td>{pct(p.s)}</td>
                  {series.map((s) => (
                    <td key={s.c.sq}>{pct(s.vals[k])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      ) : (
        <Box ref={caixa} sx={{ position: 'relative' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-labelledby={`${id}-r`} style={{ display: 'block', touchAction: 'pan-y' }}>
            <title id={`${id}-r`}>{`Evolução da apuração. Agora: ${resumo}`}</title>
            {ticksY.map((v) => (
              <g key={v}>
                <line x1={M.left} x2={W - M.right} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={v === 50 ? 0.35 : 0.1} strokeDasharray={v === 50 ? '4 4' : undefined} />
                <text x={M.left - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="currentColor" opacity={0.6}>
                  {v}%
                </text>
              </g>
            ))}
            {ticksX.map((t) => (
              <text key={t} x={x(t)} y={H - 8} textAnchor={t === 0 ? 'start' : t === 100 ? 'end' : 'middle'} fontSize="11" fill="currentColor" opacity={0.6}>
                {t === 0 ? '0% das seções' : `${t}%`}
              </text>
            ))}
            {series.map((s) => (
              <polyline key={s.c.sq} points={s.vals.map((v, k) => `${x(xs[k]).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {series.map((s) => (
              <circle key={`fim-${s.c.sq}`} cx={x(xs.at(-1) ?? 0)} cy={y(s.vals.at(-1) ?? 0)} r={4.5} fill={s.cor} stroke="var(--mui-palette-background-paper, #fff)" strokeWidth={2} />
            ))}
            {fins.map(({ s, yy }) => (
              <text key={s.c.sq} x={W - M.right + 8} y={yy + 4} fontSize="12" fontWeight={700} fill="currentColor">
                {estreito ? '' : `${nomeProprio(s.c.nome).split(' ')[0]} `}
                {pct(s.vals.at(-1) ?? 0)}
              </text>
            ))}
            {hover != null && (
              <g pointerEvents="none">
                <line x1={x(xs[i])} x2={x(xs[i])} y1={M.top} y2={H - M.bottom} stroke="currentColor" strokeOpacity={0.4} />
                {series.map((s) => (
                  <circle key={s.c.sq} cx={x(xs[i])} cy={y(s.vals[i])} r={4.5} fill={s.cor} stroke="var(--mui-palette-background-paper, #fff)" strokeWidth={2} />
                ))}
              </g>
            )}
            <rect x={M.left} y={M.top} width={W - M.left - M.right} height={H - M.top - M.bottom} fill="transparent" onPointerMove={mover} onPointerDown={mover} onPointerLeave={() => setHover(null)} />
          </svg>
          {hover != null && (
            <Box
              aria-live="polite"
              sx={{ position: 'absolute', top: 4, left: `${(100 * x(xs[i])) / W}%`, transform: x(xs[i]) > W / 2 ? 'translateX(calc(-100% - 10px))' : 'translateX(10px)', bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, px: 1, py: 0.5, boxShadow: 2, pointerEvents: 'none', whiteSpace: 'nowrap' }}
            >
              <Typography variant="caption" component="div" sx={{ fontWeight: 800 }}>
                {hhmm(pts[i].t)} · {pct(pts[i].s)} das seções
              </Typography>
              {[...series]
                .sort((a, b) => b.vals[i] - a.vals[i])
                .map((s) => (
                  <Stack key={s.c.sq} direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: s.cor }} />
                    <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                      {nomeProprio(s.c.nome)} <b>{pct(s.vals[i])}</b>
                    </Typography>
                  </Stack>
                ))}
            </Box>
          )}
        </Box>
      )}
      <Button size="small" onClick={() => setTabela((v) => !v)} startIcon={tabela ? <ShowChartRounded /> : <TableRowsRounded />} sx={{ mt: 0.5 }}>
        {tabela ? 'Ver como gráfico' : 'Ver como tabela'}
      </Button>
    </Box>
  );
}

// ── Últimas atualizações ─────────────────────────────────────────────────────

export function UltimasAtualizacoes({ eventos, nomeUf, max = 12 }: { eventos: EventoSerie[]; nomeUf: (uf: string) => string; max?: number }) {
  if (!eventos.length) return null;
  const ordem = [...eventos].sort((a, b) => (dataTse(b.t)?.getTime() ?? 0) - (dataTse(a.t)?.getTime() ?? 0)).slice(0, max);
  const onde = (e: EventoSerie) => `${CARGO_APURACAO_LABEL[e.cargo]}${e.uf === 'BR' ? '' : ` · ${nomeUf(e.uf)}`}`;
  return (
    <Stack component="ol" sx={{ listStyle: 'none', m: 0, p: 0 }} aria-label="Últimas atualizações">
      {ordem.map((e) => (
        <Stack component="li" key={`${e.tipo}-${e.uf}-${e.cargo}-${e.sq ?? ''}`} direction="row" spacing={1.25} sx={{ py: 0.9, borderBottom: 1, borderColor: 'divider', '&:last-of-type': { borderBottom: 0 } }}>
          <Typography variant="caption" color="text.secondary" sx={{ width: 42, flexShrink: 0, fontVariantNumeric: 'tabular-nums', pt: '1px' }}>
            {hhmm(e.t)}
          </Typography>
          <Typography variant="body2" sx={{ minWidth: 0 }}>
            <Box component="span" sx={{ color: 'text.secondary' }}>
              {onde(e)}:{' '}
            </Box>
            {e.tipo === 'eleito' ? (
              <>
                <b>{nomeProprio(e.nome ?? '')}</b> ({e.numero} · {e.partido}) eleito(a), segundo o TSE.
              </>
            ) : (
              <>apuração concluída (100% das seções).</>
            )}
          </Typography>
        </Stack>
      ))}
    </Stack>
  );
}
