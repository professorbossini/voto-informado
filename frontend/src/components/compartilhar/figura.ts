/**
 * Figura da página para a capa do compartilhamento: o mapa, o plenário ou o gráfico que a página
 * já mostra, copiado da tela (SVG com as cores calculadas e imagens embutidas; canvas como está),
 * com a legenda redesenhada em letra grande. A página pode marcar o quadro com `data-figura` (e a
 * legenda com `data-figura-legenda`); sem marca, vale o maior SVG ou canvas visível no conteúdo.
 * Tudo no aparelho, sem servidor.
 */

export interface Figura {
  img: CanvasImageSource;
  w: number;
  h: number;
  /** Cor de fundo da figura (a do cartão em que ela está na página). */
  fundo: string;
}

const transparente = (c: string) => !c || c === 'transparent' || /rgba\([^)]*,\s*0\)$/.test(c);

/** Fundo visível atrás do elemento: o primeiro ancestral com cor de fundo. */
function fundoDe(el: Element): string {
  for (let e: Element | null = el; e; e = e.parentElement) {
    const c = getComputedStyle(e).backgroundColor;
    if (!transparente(c)) return c;
  }
  return '#ffffff';
}

/** Elemento visual principal da página (ou null se ela não tiver um). */
export function acharFigura(raiz: ParentNode = document): HTMLElement | SVGElement | null {
  const main = raiz.querySelector('main');
  if (!main) return null;
  // Marcado pela página (o primeiro visível: abas escondidas não contam).
  for (const m of Array.from(main.querySelectorAll<HTMLElement>('[data-figura]'))) if (m.getBoundingClientRect().width > 0) return m;
  let melhor: HTMLElement | SVGElement | null = null;
  let area = 0;
  for (const el of Array.from(main.querySelectorAll<HTMLElement | SVGElement>('svg, canvas'))) {
    // Ícones, botões e o que está em diálogos não contam.
    if (el.closest('[role="dialog"], button, a, header, nav') || el.parentElement?.closest('svg')) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 240 || r.height < 150) continue;
    if (r.width * r.height > area) {
      area = r.width * r.height;
      melhor = el;
    }
  }
  if (melhor) return melhor;
  // Sem mapa nem gráfico: o primeiro quadro do conteúdo com imagens (fotos, retratos, logos).
  for (const c of Array.from(main.querySelectorAll<HTMLElement>('.MuiCard-root, .MuiPaper-root'))) {
    if (c.closest('[role="dialog"], header, nav')) continue;
    const r = c.getBoundingClientRect();
    if (r.width >= 240 && r.height >= 180 && r.height <= 1800 && c.querySelectorAll('img').length >= 2) return c;
  }
  return null;
}

// ── SVG: conversão própria (rápida mesmo com 513 cadeiras) ───────────────────

/** Propriedades que o SVG fora da página precisa receber prontas (as classes e variáveis CSS não vão junto). */
const PROPRIEDADES = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'opacity', 'font-family', 'font-size', 'font-weight', 'letter-spacing', 'text-anchor', 'dominant-baseline', 'display', 'visibility'];

/** Imagem → data URL pequena (cadeira, logo): o SVG desenhado como imagem não pode buscar nada fora. */
async function embutir(url: string, lado: number): Promise<string | null> {
  try {
    const r = await fetch(url, { cache: 'force-cache' });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (/svg/i.test(blob.type)) {
      return await new Promise<string>((ok, erro) => {
        const fr = new FileReader();
        fr.onload = () => ok(String(fr.result));
        fr.onerror = erro;
        fr.readAsDataURL(blob);
      });
    }
    const bmp = await createImageBitmap(blob);
    const s = Math.min(1, lado / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(bmp.width * s));
    c.height = Math.max(1, Math.round(bmp.height * s));
    c.getContext('2d')?.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    return c.toDataURL(/png|webp|gif/i.test(blob.type) ? 'image/png' : 'image/jpeg', 0.85);
  } catch {
    return null;
  }
}

async function rasterizarSvg(svg: SVGSVGElement, fundo: string, largura: number): Promise<HTMLCanvasElement | null> {
  const r = svg.getBoundingClientRect();
  const escala = largura / Math.max(1, r.width);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const originais = [svg, ...Array.from(svg.querySelectorAll('*'))];
  const copias = [clone, ...Array.from(clone.querySelectorAll('*'))];
  originais.forEach((o, i) => {
    const c = copias[i];
    if (!c) return;
    const cs = getComputedStyle(o);
    c.removeAttribute('class');
    c.setAttribute('style', PROPRIEDADES.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';'));
  });
  // Imagens (logos dos partidos, fotos): embutidas, já no tamanho em que aparecem.
  const imagens = Array.from(clone.querySelectorAll('image'));
  const urls = [...new Set(imagens.map((im) => im.getAttribute('href') ?? im.getAttribute('xlink:href') ?? '').filter(Boolean))];
  const dados = new Map<string, string | null>();
  for (let i = 0; i < urls.length; i += 16) {
    await Promise.all(urls.slice(i, i + 16).map(async (u) => dados.set(u, await embutir(new URL(u, location.href).href, 160))));
  }
  for (const im of imagens) {
    const u = im.getAttribute('href') ?? im.getAttribute('xlink:href') ?? '';
    const d = dados.get(u);
    if (d) im.setAttribute('href', d);
    else im.remove();
  }
  const w = Math.round(r.width * escala);
  const h = Math.round(r.height * escala);
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(w));
  clone.setAttribute('height', String(h));
  const texto = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((ok, erro) => {
      img.onload = () => ok();
      img.onerror = () => erro(new Error('SVG não carregou'));
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Quadro em HTML (fotos, linha do tempo, arco do STF...) → canvas pela html-to-image. Os rótulos de
 * SVG dentro dele têm o tamanho de letra fixado antes (a biblioteca troca o tamanho do atributo
 * pelo do CSS, e os rótulos saíam gigantes) e devolvido depois.
 */
async function rasterizarHtml(el: HTMLElement, fundo: string, largura: number): Promise<HTMLCanvasElement | null> {
  const r = el.getBoundingClientRect();
  const fixados: [SVGElement, string][] = [];
  for (const t of Array.from(el.querySelectorAll<SVGElement>('svg [font-size]'))) {
    fixados.push([t, t.style.fontSize]);
    t.style.fontSize = `${t.getAttribute('font-size')}px`;
  }
  try {
    const { toCanvas } = await import('html-to-image');
    const c = await toCanvas(el, {
      backgroundColor: fundo,
      pixelRatio: Math.min(3, Math.max(1, largura / Math.max(1, r.width))),
      // Botões e controles marcados com data-figura-fora não entram na imagem.
      filter: (n) => !(n instanceof Element && n.hasAttribute('data-figura-fora')),
    });
    return c.width && c.height ? c : null;
  } finally {
    for (const [t, v] of fixados) t.style.fontSize = v;
  }
}

/** Imagem do próprio site → bitmap (SVG passa por um <img>, que createImageBitmap não lê direto). */
async function bitmap(url: string): Promise<ImageBitmap | null> {
  try {
    const r = await fetch(url, { cache: 'force-cache' });
    if (!r.ok) return null;
    const blob = await r.blob();
    if (!/svg/i.test(blob.type)) return await createImageBitmap(blob);
    // SVG sem largura/altura sai em branco: declara um tamanho na proporção do viewBox.
    let texto = await blob.text();
    if (!/<svg[^>]*\swidth=/i.test(texto)) {
      const vb = /viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(texto);
      const proporcao = vb ? Number(vb[2]) / Number(vb[1]) || 1 : 1;
      texto = texto.replace(/<svg/i, `<svg width="512" height="${Math.round(512 * proporcao)}"`);
    }
    const obj = URL.createObjectURL(new Blob([texto], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      await new Promise<void>((ok, erro) => {
        img.onload = () => ok();
        img.onerror = () => erro(new Error('svg'));
        img.src = obj;
      });
      const w = img.naturalWidth || 400;
      const h = img.naturalHeight || 400;
      return await createImageBitmap(img, { resizeWidth: w > 800 ? 800 : w, resizeHeight: Math.round((h * (w > 800 ? 800 : w)) / w) });
    } finally {
      URL.revokeObjectURL(obj);
    }
  } catch {
    return null;
  }
}

/**
 * Mosaico com as fotos que a página mostra (retratos dos presidentes, ministros...), na ordem da
 * página, em círculos com borda branca. Só imagens do próprio site (sem CORS, o canvas não exporta).
 */
async function mosaico(el: HTMLElement, fundo: string, largura: number, logos = false, max = 48): Promise<HTMLCanvasElement | null> {
  const vistos = new Set<string>();
  const srcs: { src: string; fundo: string }[] = [];
  for (const img of Array.from(el.querySelectorAll('img'))) {
    const src = img.currentSrc || img.src;
    if (!src || vistos.has(src) || img.getBoundingClientRect().width < 20) continue;
    vistos.add(src);
    // Logo claro sobre fundo escuro: o quadrado leva o fundo que ele tem na página.
    srcs.push({ src, fundo: img.parentElement ? fundoDe(img.parentElement) : '#ffffff' });
    if (srcs.length >= max) break;
  }
  const imgs: ImageBitmap[] = [];
  const fundos: string[] = [];
  for (let i = 0; i < srcs.length; i += 12) {
    const parte = srcs.slice(i, i + 12);
    const lote = await Promise.all(parte.map((x) => bitmap(x.src)));
    lote.forEach((b, k) => {
      if (!b) return;
      imgs.push(b);
      fundos.push(parte[k].fundo);
    });
  }
  if (imgs.length < 2) return null;
  const n = imgs.length;
  const cols = Math.ceil(Math.sqrt(n * 1.25));
  const linhas = Math.ceil(n / cols);
  const gap = Math.round(largura * 0.012);
  const lado = Math.floor((largura - gap * (cols + 1)) / cols);
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = linhas * lado + (linhas + 1) * gap;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, c.width, c.height);
  imgs.forEach((b, i) => {
    const linha = Math.floor(i / cols);
    // Última linha incompleta: centralizada.
    const naLinha = linha === linhas - 1 ? n - linha * cols : cols;
    const x0 = (largura - (naLinha * lado + (naLinha - 1) * gap)) / 2;
    const x = x0 + (i % cols) * (lado + gap);
    const y = gap + linha * (lado + gap);
    if (logos) {
      // Símbolo inteiro, sem corte, num quadrado branco arredondado.
      ctx.save();
      ctx.beginPath();
      ctx.roundRect?.(x, y, lado, lado, lado * 0.16);
      if (!ctx.roundRect) ctx.rect(x, y, lado, lado);
      ctx.fillStyle = fundos[i] ?? '#ffffff';
      ctx.shadowColor = 'rgba(13, 9, 25, 0.18)';
      ctx.shadowBlur = lado * 0.08;
      ctx.fill();
      ctx.restore();
      const pad = lado * 0.12;
      const s = Math.min((lado - 2 * pad) / b.width, (lado - 2 * pad) / b.height);
      ctx.drawImage(b, x + (lado - b.width * s) / 2, y + (lado - b.height * s) / 2, b.width * s, b.height * s);
      b.close();
      return;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + lado / 2, y + lado / 2, lado / 2, 0, Math.PI * 2);
    ctx.clip();
    const s = Math.max(lado / b.width, lado / b.height);
    const sw = lado / s;
    const sh = lado / s;
    ctx.drawImage(b, (b.width - sw) / 2, (b.height - sh) * 0.2, sw, sh, x, y, lado, lado);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x + lado / 2, y + lado / 2, lado / 2 - 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = Math.max(3, lado * 0.035);
    ctx.stroke();
    b.close();
  });
  return c;
}

/** Itens da legenda lidos da tela: a cor do quadradinho e o texto da linha. */
export function lerLegenda(el: Element): { cor: string; texto: string }[] {
  const itens: { cor: string; texto: string }[] = [];
  for (const linha of Array.from(el.children)) {
    // Textos das partes da linha (nome, contagem...), separados por " · ".
    const partes = Array.from(linha.querySelectorAll('*'))
      .filter((d) => !d.children.length)
      .map((d) => (d.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const texto = (partes.length ? partes.join(' · ') : (linha.textContent ?? '')).replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    let cor: string | null = null;
    for (const d of Array.from(linha.querySelectorAll('*'))) {
      const r = d.getBoundingClientRect();
      const bg = getComputedStyle(d).backgroundColor;
      if (r.width > 0 && r.width <= 32 && r.height <= 32 && !transparente(bg)) {
        cor = bg;
        break;
      }
    }
    if (cor) itens.push({ cor, texto });
  }
  return itens;
}

/** Desenha a legenda em letra grande (uma ou duas colunas), na largura da figura. */
function desenharLegenda(itens: { cor: string; texto: string }[], largura: number, fundo: string, corTexto: string, familia: string): HTMLCanvasElement {
  const t = Math.round(largura / 28);
  const colunas = itens.length > 3 ? 2 : 1;
  const linhas = Math.ceil(itens.length / colunas);
  const lh = Math.round(t * 1.7);
  const c = document.createElement('canvas');
  c.width = largura;
  c.height = linhas * lh + Math.round(t * 0.6);
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.textBaseline = 'middle';
  const colW = (largura - t) / colunas;
  itens.forEach((it, i) => {
    const x = Math.round(t * 0.5 + Math.floor(i / linhas) * colW);
    const y = Math.round((i % linhas) * lh + lh / 2);
    ctx.fillStyle = it.cor;
    ctx.beginPath();
    ctx.roundRect?.(x, y - t * 0.45, t * 0.9, t * 0.9, t * 0.18);
    if (!ctx.roundRect) ctx.rect(x, y - t * 0.45, t * 0.9, t * 0.9);
    ctx.fill();
    ctx.fillStyle = corTexto;
    ctx.font = `600 ${t}px ${familia}`;
    let txt = it.texto;
    const max = colW - t * 1.6;
    while (txt.length > 4 && ctx.measureText(txt).width > max) txt = `${txt.slice(0, -2).trimEnd()}…`;
    ctx.fillText(txt, x + t * 1.3, y);
  });
  return c;
}

/** Canvas da página (mapa por município) copiado como está na tela. */
function copiarCanvas(src: HTMLCanvasElement, fundo: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0);
  return c;
}

/** Empilha partes (figura e legenda) numa só imagem, na mesma largura. */
function empilhar(partes: HTMLCanvasElement[], fundo: string): HTMLCanvasElement {
  const w = Math.max(...partes.map((p) => p.width));
  const gap = Math.round(w * 0.02);
  const alturas = partes.map((p) => (p.height * w) / p.width);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = Math.round(alturas.reduce((s, h) => s + h, 0) + gap * (partes.length - 1));
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, c.width, c.height);
  let y = 0;
  partes.forEach((p, i) => {
    ctx.drawImage(p, 0, y, w, alturas[i]);
    y += alturas[i] + gap;
  });
  return c;
}

const area = (e: Element) => {
  const r = e.getBoundingClientRect();
  return r.width * r.height;
};

/**
 * Converte a figura: o maior SVG (conversão própria) ou canvas (cópia) do elemento, mais a
 * legenda marcada com `data-figura-legenda`, desenhada em letra grande embaixo.
 */
async function rasterizar(el: HTMLElement | SVGElement, fundo: string): Promise<HTMLCanvasElement | null> {
  const L = 1600;
  // data-figura="html": o quadro inteiro como está na tela; "mosaico": as fotos dele num mosaico.
  if (el instanceof HTMLElement && el.dataset.figura === 'html') return rasterizarHtml(el, fundo, L);
  if (el instanceof HTMLElement && el.dataset.figura === 'mosaico') return mosaico(el, fundo, L);
  if (el instanceof HTMLElement && el.dataset.figura === 'logos') return mosaico(el, fundo, L, true);
  const candidatos = el instanceof SVGSVGElement || el instanceof HTMLCanvasElement ? [el] : Array.from(el.querySelectorAll<SVGSVGElement | HTMLCanvasElement>('svg, canvas')).filter((x) => !x.parentElement?.closest('svg') && x.getBoundingClientRect().width >= 200);
  const principal = candidatos.sort((a, b) => area(b) - area(a))[0];
  if (!principal) return el instanceof HTMLElement ? rasterizarHtml(el, fundo, L) : null;
  const figura = principal instanceof HTMLCanvasElement ? copiarCanvas(principal, fundo) : await rasterizarSvg(principal, fundo, L);
  if (!figura) return null;
  const leg = el.querySelector('[data-figura-legenda]');
  const itens = leg ? lerLegenda(leg) : [];
  if (!itens.length) return figura;
  const cs = getComputedStyle(leg!);
  return empilhar([figura, desenharLegenda(itens, figura.width, fundo, cs.color, cs.fontFamily)], fundo);
}

/** Fotografa a figura da página; falha ou demora (8 s) → null (a capa sai sem figura). */
export async function capturarFigura(tempo = 8000): Promise<Figura | null> {
  const el = acharFigura();
  if (!el) return null;
  const fundo = fundoDe(el);
  try {
    const c = await Promise.race([rasterizar(el, fundo), new Promise<null>((ok) => setTimeout(() => ok(null), tempo))]);
    return c ? { img: c, w: c.width, h: c.height, fundo } : null;
  } catch {
    return null;
  }
}
