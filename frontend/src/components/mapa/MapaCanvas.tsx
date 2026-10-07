import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Box, IconButton, Paper, Stack, Tooltip } from '@mui/material';
import AddRounded from '@mui/icons-material/AddRounded';
import RemoveRounded from '@mui/icons-material/RemoveRounded';
import CenterFocusStrongRounded from '@mui/icons-material/CenterFocusStrongRounded';
import { FAIXAS, municipioEm, ufsNoMapa, type Caixa, type FormaMunicipio } from '@/data/mapaVotos';

/**
 * Mapa dos municípios em <canvas> (milhares de polígonos: em SVG ficaria lento no celular).
 *
 * Desempenho: os municípios de cada faixa de cor viram um só Path2D (11 preenchimentos por quadro,
 * não 5.570). Durante o arraste e a pinça só a última imagem completa é reposicionada (barato), e o
 * mapa é redesenhado de verdade quando o gesto para. O contorno do município em destaque fica numa
 * segunda camada, para o "passar o mouse" não redesenhar o mapa todo.
 */

interface Vista {
  s: number; // pixels (CSS) por grau
  tx: number;
  ty: number;
}

export interface MapaCanvasProps {
  formas: FormaMunicipio[];
  /** Faixa de cor (0 a FAIXAS-1) de cada município; ausente = sem resultado final. */
  faixas: Map<string, number> | null;
  cores: string[];
  semDado: { fundo: string; traco: string };
  /** Cor de fundo do cartão (bordas entre municípios). */
  fundo: string;
  dark: boolean;
  /** Área a enquadrar (país ou UF); ao mudar, o mapa se reenquadra. */
  foco: Caixa;
  selecionado: string | null;
  onSelect: (cd: string | null) => void;
  /** Conteúdo do rótulo que acompanha o mouse. */
  rotulo: (cd: string) => ReactNode;
  ariaLabel: string;
}

const DPR_MAX = 2; // acima disso o ganho visual não compensa o custo no celular
const PAUSA_GESTO = 140; // ms sem movimento para redesenhar com nitidez

function caminho(f: FormaMunicipio): Path2D {
  const p = new Path2D();
  for (const r of f.aneis) {
    p.moveTo(r[0], r[1]);
    for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]);
    p.closePath();
  }
  return p;
}

function hachura(ctx: CanvasRenderingContext2D, fundo: string, traco: string, dpr: number): CanvasPattern | string {
  const lado = Math.round(6 * dpr);
  const c = document.createElement('canvas');
  c.width = lado;
  c.height = lado;
  const g = c.getContext('2d');
  if (!g) return fundo;
  g.fillStyle = fundo;
  g.fillRect(0, 0, lado, lado);
  g.strokeStyle = traco;
  g.lineWidth = Math.max(1, dpr * 0.8);
  g.beginPath();
  g.moveTo(-1, lado + 1);
  g.lineTo(lado + 1, -1);
  g.stroke();
  return ctx.createPattern(c, 'repeat') ?? fundo;
}

export function MapaCanvas({ formas, faixas, cores, semDado, fundo, dark, foco, selecionado, onSelect, rotulo, ariaLabel }: MapaCanvasProps) {
  const caixaRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef<HTMLCanvasElement>(null);
  const topoRef = useRef<HTMLCanvasElement>(null);
  const rotuloRef = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState<{ w: number; h: number } | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const vista = useRef<Vista>({ s: 1, tx: 0, ty: 0 });
  const ajuste = useRef(1); // escala que enquadra o foco
  const foto = useRef<{ canvas: HTMLCanvasElement; vista: Vista } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const quadro = useRef<number | undefined>(undefined);
  const dpr = typeof window === 'undefined' ? 1 : Math.min(window.devicePixelRatio || 1, DPR_MAX);

  // Tamanho: largura do contêiner; altura proporcional (o Brasil é quase quadrado).
  useEffect(() => {
    const el = caixaRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const w = Math.round(e.contentRect.width);
      const h = Math.round(Math.min(Math.max(w * 0.92, 300), 640));
      setTam((t) => (t && t.w === w && t.h === h ? t : { w, h }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Geometria em Path2D, montada uma vez.
  const caminhos = useMemo(() => new Map(formas.map((f) => [f.cd, caminho(f)])), [formas]);
  const divisas = useMemo(() => {
    const p = new Path2D();
    for (const uf of ufsNoMapa()) for (const r of uf.aneis) {
      p.moveTo(r[0], r[1]);
      for (let i = 2; i < r.length; i += 2) p.lineTo(r[i], r[i + 1]);
      p.closePath();
    }
    return p;
  }, []);
  const bordas = useMemo(() => {
    const p = new Path2D();
    for (const c of caminhos.values()) p.addPath(c);
    return p;
  }, [caminhos]);
  // Um Path2D por faixa (+ 1 para "sem resultado"): poucos preenchimentos por quadro.
  const porFaixa = useMemo(() => {
    const out = Array.from({ length: FAIXAS + 1 }, () => new Path2D());
    for (const f of formas) {
      const k = faixas?.get(f.cd);
      out[k ?? FAIXAS].addPath(caminhos.get(f.cd)!);
    }
    return out;
  }, [formas, faixas, caminhos]);

  const desenharTopo = useCallback(() => {
    const cv = topoRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const { s, tx, ty } = vista.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty);
    ctx.lineJoin = 'round';
    const contorno = (cd: string | null, largura: number) => {
      const p = cd ? caminhos.get(cd) : null;
      if (!p) return;
      ctx.strokeStyle = dark ? '#140E26' : '#FFFFFF';
      ctx.lineWidth = (largura + 2.5) / s;
      ctx.stroke(p);
      ctx.strokeStyle = dark ? '#FFFFFF' : '#140E26';
      ctx.lineWidth = largura / s;
      ctx.stroke(p);
    };
    if (hover !== selecionado) contorno(hover, 1.25);
    contorno(selecionado, 2.25);
  }, [caminhos, dark, dpr, hover, selecionado]);

  const desenharBase = useCallback(() => {
    const cv = baseRef.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const { s, tx, ty } = vista.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * tx, dpr * ty);
    ctx.lineJoin = 'round';
    for (let i = 0; i < FAIXAS; i++) {
      ctx.fillStyle = cores[i];
      ctx.fill(porFaixa[i]);
    }
    const padrao = hachura(ctx, semDado.fundo, semDado.traco, dpr);
    if (typeof padrao !== 'string') padrao.setTransform(new DOMMatrix().scale(1 / (dpr * s)));
    ctx.fillStyle = padrao;
    ctx.fill(porFaixa[FAIXAS]);
    // Divisas entre municípios só quando há espaço para elas (de perto); de longe, sujariam o mapa.
    const borda = Math.min(0.8, (s - 22) / 50);
    if (borda > 0.05) {
      ctx.strokeStyle = fundo;
      ctx.lineWidth = borda / s;
      ctx.stroke(bordas);
    }
    ctx.strokeStyle = dark ? 'rgba(255,255,255,0.6)' : 'rgba(20,14,38,0.55)';
    ctx.lineWidth = 0.9 / s;
    ctx.stroke(divisas);
    // Guarda a imagem para reposicionar durante os gestos.
    const snap = foto.current?.canvas ?? document.createElement('canvas');
    snap.width = cv.width;
    snap.height = cv.height;
    snap.getContext('2d')?.drawImage(cv, 0, 0);
    foto.current = { canvas: snap, vista: { ...vista.current } };
  }, [bordas, cores, dark, divisas, dpr, fundo, porFaixa, semDado]);

  /** Quadro rápido durante o gesto: a última imagem completa, reposicionada. */
  const desenharFoto = useCallback(() => {
    const cv = baseRef.current;
    const ctx = cv?.getContext('2d');
    const f = foto.current;
    if (!cv || !ctx || !f) return desenharBase();
    const { s, tx, ty } = vista.current;
    const k = s / f.vista.s;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.setTransform(k, 0, 0, k, dpr * (tx - f.vista.tx * k), dpr * (ty - f.vista.ty * k));
    ctx.drawImage(f.canvas, 0, 0);
  }, [desenharBase, dpr]);

  const desenharTudo = useCallback(() => {
    desenharBase();
    desenharTopo();
  }, [desenharBase, desenharTopo]);

  /** Depois de mudar a vista num gesto: quadro rápido agora, nítido quando parar. */
  const mover = useCallback(() => {
    if (quadro.current == null) {
      quadro.current = requestAnimationFrame(() => {
        quadro.current = undefined;
        desenharFoto();
        desenharTopo();
      });
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(desenharTudo, PAUSA_GESTO);
    const perto = vista.current.s > ajuste.current * 1.02;
    // De longe, um dedo rola a página; de perto, arrasta o mapa. A pinça é sempre do mapa.
    if (topoRef.current) topoRef.current.style.touchAction = perto ? 'none' : 'pan-y';
  }, [desenharFoto, desenharTopo, desenharTudo]);

  const limitar = (s: number) => Math.min(Math.max(s, ajuste.current * 0.6), ajuste.current * 80);

  const enquadrar = useCallback(() => {
    if (!tam) return;
    const [x0, y0, x1, y1] = foco;
    const margem = 12;
    const s = Math.min((tam.w - 2 * margem) / (x1 - x0), (tam.h - 2 * margem) / (y1 - y0));
    ajuste.current = s;
    vista.current = { s, tx: tam.w / 2 - s * ((x0 + x1) / 2), ty: tam.h / 2 - s * ((y0 + y1) / 2) };
    if (topoRef.current) topoRef.current.style.touchAction = 'pan-y';
  }, [foco, tam]);

  // Tamanho ou foco mudou: reenquadra e redesenha.
  useEffect(() => {
    if (!tam) return;
    for (const cv of [baseRef.current, topoRef.current]) {
      if (!cv) continue;
      cv.width = Math.round(tam.w * dpr);
      cv.height = Math.round(tam.h * dpr);
    }
    enquadrar();
    desenharTudo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tam, foco, dpr]);

  // Cores, faixas ou tema mudaram: redesenha a base.
  useEffect(() => {
    if (tam) desenharBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desenharBase]);

  useEffect(() => {
    if (tam) desenharTopo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desenharTopo]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (quadro.current != null) cancelAnimationFrame(quadro.current);
    },
    [],
  );

  const zoom = useCallback(
    (fator: number, x: number, y: number) => {
      const v = vista.current;
      const s = limitar(v.s * fator);
      const k = s / v.s;
      vista.current = { s, tx: x - (x - v.tx) * k, ty: y - (y - v.ty) * k };
      mover();
    },
    [mover],
  );

  const municipioNoPonto = useCallback(
    (x: number, y: number) => {
      const { s, tx, ty } = vista.current;
      return municipioEm(formas, (x - tx) / s, (y - ty) / s)?.cd ?? null;
    },
    [formas],
  );

  // ── Gestos: arrastar (1 dedo/mouse), pinça (2 dedos), Ctrl + roda, teclado ──
  const dedos = useRef(new Map<number, { x: number; y: number }>());
  const gesto = useRef<{ v0: Vista; p0: { x: number; y: number }; d0: number; moveu: boolean } | null>(null);

  const local = (e: { clientX: number; clientY: number }) => {
    const r = topoRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const iniciarGesto = () => {
    const pts = [...dedos.current.values()];
    const meio = pts.length >= 2 ? { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 } : pts[0];
    const d0 = pts.length >= 2 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0;
    gesto.current = { v0: { ...vista.current }, p0: meio, d0, moveu: gesto.current?.moveu ?? false };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    if (dedos.current.size === 0) gesto.current = null;
    dedos.current.set(e.pointerId, local(e));
    iniciarGesto();
    if (dedos.current.size >= 2 && gesto.current) gesto.current.moveu = true;
  };

  const posicionarRotulo = (p: { x: number; y: number } | null) => {
    const el = rotuloRef.current;
    if (!el || !tam) return;
    if (!p) {
      el.style.visibility = 'hidden';
      return;
    }
    const direita = p.x > tam.w * 0.6;
    el.style.visibility = 'visible';
    el.style.transform = `translate(${direita ? `calc(${p.x - 14}px - 100%)` : `${p.x + 14}px`}, ${Math.max(4, p.y - 40)}px)`;
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = local(e);
    if (!dedos.current.has(e.pointerId)) {
      if (e.pointerType !== 'mouse') return;
      const cd = municipioNoPonto(p.x, p.y);
      setHover((h) => (h === cd ? h : cd));
      posicionarRotulo(cd ? p : null);
      return;
    }
    dedos.current.set(e.pointerId, p);
    const g = gesto.current;
    if (!g) return;
    const pts = [...dedos.current.values()];
    if (pts.length >= 2) {
      const meio = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      const s = limitar(g.v0.s * (g.d0 ? d / g.d0 : 1));
      const wx = (g.p0.x - g.v0.tx) / g.v0.s;
      const wy = (g.p0.y - g.v0.ty) / g.v0.s;
      vista.current = { s, tx: meio.x - wx * s, ty: meio.y - wy * s };
      mover();
      return;
    }
    const dx = p.x - g.p0.x;
    const dy = p.y - g.p0.y;
    if (!g.moveu && Math.hypot(dx, dy) < 6) return;
    g.moveu = true;
    posicionarRotulo(null);
    vista.current = { ...g.v0, tx: g.v0.tx + dx, ty: g.v0.ty + dy };
    mover();
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dedos.current.has(e.pointerId)) return;
    const p = local(e);
    dedos.current.delete(e.pointerId);
    const g = gesto.current;
    if (dedos.current.size === 0) {
      if (g && !g.moveu && e.type === 'pointerup') onSelect(municipioNoPonto(p.x, p.y));
      gesto.current = null;
    } else {
      iniciarGesto(); // sobrou um dedo da pinça: continua arrastando a partir dele
    }
  };

  // Roda do mouse só com Ctrl/⌘ (ou pinça no touchpad): sem isso, a página rola normalmente.
  useEffect(() => {
    const cv = topoRef.current;
    if (!cv) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const r = cv.getBoundingClientRect();
      zoom(Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
    };
    cv.addEventListener('wheel', onWheel, { passive: false });
    return () => cv.removeEventListener('wheel', onWheel);
  }, [zoom]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!tam) return;
    const passo = 60;
    const v = vista.current;
    const mov: Record<string, [number, number]> = { ArrowLeft: [passo, 0], ArrowRight: [-passo, 0], ArrowUp: [0, passo], ArrowDown: [0, -passo] };
    if (mov[e.key]) {
      vista.current = { ...v, tx: v.tx + mov[e.key][0], ty: v.ty + mov[e.key][1] };
      mover();
    } else if (e.key === '+' || e.key === '=') zoom(1.5, tam.w / 2, tam.h / 2);
    else if (e.key === '-') zoom(1 / 1.5, tam.w / 2, tam.h / 2);
    else if (e.key === '0') {
      enquadrar();
      desenharTudo();
    } else return;
    e.preventDefault();
  };

  return (
    <Box ref={caixaRef} sx={{ position: 'relative', width: '100%', height: tam?.h ?? 360, userSelect: 'none' }}>
      <canvas ref={baseRef} aria-hidden style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      <canvas
        ref={topoRef}
        role="img"
        aria-label={ariaLabel}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') {
            setHover(null);
            posicionarRotulo(null);
          }
        }}
        onKeyDown={onKeyDown}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: 'pan-y',
          cursor: hover ? 'pointer' : 'grab',
          outlineOffset: -2,
        }}
      />
      <Paper
        ref={rotuloRef}
        elevation={4}
        sx={{ position: 'absolute', top: 0, left: 0, px: 1.25, py: 0.75, pointerEvents: 'none', visibility: 'hidden', maxWidth: 260, zIndex: 1 }}
      >
        {hover && rotulo(hover)}
      </Paper>
      <Stack spacing={0.5} sx={{ position: 'absolute', right: 8, top: 8, zIndex: 2 }}>
        <Tooltip title="Aproximar" placement="left">
          <IconButton size="small" aria-label="Aproximar" onClick={() => tam && zoom(1.6, tam.w / 2, tam.h / 2)} sx={{ bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}>
            <AddRounded fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Afastar" placement="left">
          <IconButton size="small" aria-label="Afastar" onClick={() => tam && zoom(1 / 1.6, tam.w / 2, tam.h / 2)} sx={{ bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}>
            <RemoveRounded fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Enquadrar de novo" placement="left">
          <IconButton
            size="small"
            aria-label="Enquadrar de novo"
            onClick={() => {
              enquadrar();
              desenharTudo();
            }}
            sx={{ bgcolor: 'background.paper', boxShadow: 1, '&:hover': { bgcolor: 'background.paper' } }}
          >
            <CenterFocusStrongRounded fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    </Box>
  );
}
