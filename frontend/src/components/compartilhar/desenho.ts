import { brand } from '@/config/brand';
import { fontFamily } from '@/theme';
import { ink, lime, violet } from '@/theme/tokens';
import type { CartaoDados } from './dados';
import { ajustarJuntos, ajustarTexto, quebrarLinhas, urlCurta, type Ajuste, type Medidor } from './texto';

/**
 * Desenho dos cartões para compartilhar (PNG gerado no navegador, sem servidor). Um só modelo
 * para todo mundo: cores da marca do site (violeta e neutros, nunca de partido), mesmas medidas
 * e mesmo tamanho de letra para todas as pessoas de um cartão. O tamanho final em pixels é fixo
 * (não depende da densidade da tela do aparelho).
 */

export type Formato = 'retrato' | 'paisagem';

export const TAMANHOS: Record<Formato, { w: number; h: number }> = {
  retrato: { w: 1080, h: 1350 },
  paisagem: { w: 1200, h: 630 },
};

export const RODAPE = 'Dados públicos oficiais · sem recomendação de voto';

/** Imagens já carregadas (null = não carregou: logo omitido, foto vira silhueta). */
export interface Imagens {
  logo: CanvasImageSource | null;
  fotos: (CanvasImageSource | null)[];
}

type Ctx = CanvasRenderingContext2D;
type Peso = 400 | 500 | 600 | 700;

const COR = {
  fundo: ink[25],
  cartao: ink[0],
  borda: ink[200],
  texto: ink[900],
  texto2: ink[600],
  texto3: ink[500],
  marca: violet[600],
  marcaTexto: violet[700],
  marcaClara: violet[50],
  sobreMarca: violet[100],
  destaque: lime[400],
  fotoFundo: ink[100],
  silhueta: ink[300],
};

/** Medidas por formato. */
const M = {
  retrato: { m: 64, cab: 136, logo: 76, marca: 46, sub: 28, titulo: 30, rodape: 26, fonte: 24, url: 32 },
  paisagem: { m: 48, cab: 88, logo: 52, marca: 32, sub: 22, titulo: 24, rodape: 19, fonte: 18, url: 24 },
} as const;

function fonte(ctx: Ctx, peso: Peso, tamanho: number) {
  ctx.font = `${peso} ${tamanho}px ${fontFamily}`;
}

function medidor(ctx: Ctx, peso: Peso): Medidor {
  return (texto, tamanho) => {
    fonte(ctx, peso, tamanho);
    return ctx.measureText(texto).width;
  };
}

/** Escreve as linhas a partir do topo `y`; devolve a altura usada. */
function escrever(ctx: Ctx, a: Ajuste, x: number, y: number, peso: Peso, cor: string, alinhar: CanvasTextAlign = 'left', entrelinha = 1.15): number {
  fonte(ctx, peso, a.tamanho);
  ctx.fillStyle = cor;
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'middle';
  const lh = a.tamanho * entrelinha;
  a.linhas.forEach((l, i) => ctx.fillText(l, x, y + i * lh + lh / 2));
  return a.linhas.length * lh;
}

const altura = (a: Ajuste, entrelinha = 1.15) => a.linhas.length * a.tamanho * entrelinha;

function retangulo(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function dimensoes(img: CanvasImageSource): { w: number; h: number } {
  const i = img as { naturalWidth?: number; naturalHeight?: number; width?: number | { baseVal?: { value: number } }; height?: number | { baseVal?: { value: number } } };
  const w = i.naturalWidth || (typeof i.width === 'number' ? i.width : 0);
  const h = i.naturalHeight || (typeof i.height === 'number' ? i.height : 0);
  return { w, h };
}

/** Foto oficial em 3:4, recortada como "cover" (um pouco acima do centro, onde fica o rosto); sem foto, silhueta neutra. */
function foto(ctx: Ctx, img: CanvasImageSource | null, x: number, y: number, w: number, h: number, r: number) {
  ctx.save();
  retangulo(ctx, x, y, w, h, r);
  ctx.fillStyle = COR.fotoFundo;
  ctx.fill();
  ctx.clip();
  const d = img ? dimensoes(img) : { w: 0, h: 0 };
  if (img && d.w > 0 && d.h > 0) {
    const escala = Math.max(w / d.w, h / d.h);
    const sw = w / escala;
    const sh = h / escala;
    ctx.drawImage(img, (d.w - sw) / 2, (d.h - sh) * 0.3, sw, sh, x, y, w, h);
  } else {
    ctx.fillStyle = COR.silhueta;
    ctx.beginPath();
    ctx.arc(x + w / 2, y + h * 0.4, w * 0.19, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h * 0.98, w * 0.38, h * 0.3, 0, Math.PI, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  retangulo(ctx, x, y, w, h, r);
  ctx.strokeStyle = COR.borda;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

/** Número na urna em quadradinhos (como no perfil). Devolve a largura usada. */
function numeroUrna(ctx: Ctx, numero: string, x: number, y: number, lado: number, alinhar: 'left' | 'center' = 'left'): number {
  const w = lado;
  const h = Math.round(lado * 1.3);
  const gap = Math.round(lado * 0.16);
  const total = numero.length * w + (numero.length - 1) * gap;
  const x0 = alinhar === 'center' ? x - total / 2 : x;
  fonte(ctx, 700, Math.round(lado * 0.78));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  [...numero].forEach((dig, i) => {
    const bx = x0 + i * (w + gap);
    retangulo(ctx, bx, y, w, h, lado * 0.18);
    ctx.fillStyle = COR.cartao;
    ctx.fill();
    ctx.strokeStyle = COR.texto;
    ctx.lineWidth = Math.max(2, lado / 18);
    ctx.stroke();
    ctx.fillStyle = COR.texto;
    ctx.fillText(dig, bx + w / 2, y + h / 2 + 1);
  });
  return total;
}

function cabecalho(ctx: Ctx, formato: Formato, logo: CanvasImageSource | null) {
  const { w } = TAMANHOS[formato];
  const p = M[formato];
  ctx.fillStyle = COR.marca;
  ctx.fillRect(0, 0, w, p.cab);
  ctx.fillStyle = COR.destaque;
  ctx.fillRect(0, p.cab, w, formato === 'retrato' ? 6 : 4);
  let x = p.m;
  if (logo) {
    ctx.drawImage(logo, x, (p.cab - p.logo) / 2, p.logo, p.logo);
    x += p.logo + Math.round(p.logo * 0.28);
  }
  fonte(ctx, 700, p.marca);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(brand.name ?? 'Tá na Urna', x, p.cab / 2);
  fonte(ctx, 500, p.sub);
  ctx.fillStyle = COR.sobreMarca;
  ctx.textAlign = 'right';
  ctx.fillText('Eleições 2026 · dados oficiais', w - p.m, p.cab / 2);
}

/** Endereço, data, fonte e rodapé, de baixo para cima. Devolve o topo do bloco. */
function base(ctx: Ctx, formato: Formato, d: CartaoDados): number {
  const { w, h } = TAMANHOS[formato];
  const p = M[formato];
  const largura = w - 2 * p.m;

  // Rodapé neutro, separado por uma linha.
  const faixa = Math.round(p.rodape * 2.6);
  ctx.fillStyle = COR.borda;
  ctx.fillRect(p.m, h - faixa, largura, 2);
  fonte(ctx, 500, p.rodape);
  ctx.fillStyle = COR.texto3;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(RODAPE, w / 2, h - faixa / 2 + 1);

  // Data dos dados e fonte oficial (até 3 linhas no retrato, 2 na paisagem).
  const texto = `${d.dataDados ? `Dados de ${d.dataDados} · ` : ''}${d.fonte}`;
  const af = ajustarTexto(texto, { largura, max: p.fonte, min: p.fonte - 6, maxLinhas: formato === 'retrato' ? 3 : 2 }, medidor(ctx, 400));
  const yf = h - faixa - Math.round(p.m * 0.4) - altura(af, 1.3);
  escrever(ctx, af, p.m, yf, 400, COR.texto2, 'left', 1.3);

  // Endereço da página, em destaque e com a largura toda (o da comparação é longo).
  const hu = Math.round(p.url * 1.9);
  const yu = yf - Math.round(p.m * 0.3) - hu;
  const pad = Math.round(p.url * 0.6);
  const au = ajustarTexto(urlCurta(d.url), { largura: largura - 2 * pad, max: p.url, min: Math.round(p.url * 0.55), maxLinhas: 1 }, medidor(ctx, 700));
  fonte(ctx, 700, au.tamanho);
  const wu = ctx.measureText(au.linhas[0] ?? '').width + 2 * pad;
  retangulo(ctx, p.m, yu, wu, hu, hu / 2);
  ctx.fillStyle = COR.marcaClara;
  ctx.fill();
  escrever(ctx, au, p.m + pad, yu + (hu - altura(au, 1)) / 2, 700, COR.marcaTexto, 'left', 1);
  return yu;
}

/** Quadro de um fato: rótulo pequeno em cima, valor grande embaixo (textos já ajustados). */
function quadro(ctx: Ctx, ar: Ajuste, av: Ajuste, x: number, y: number, w: number, h: number, escala: number) {
  retangulo(ctx, x, y, w, h, 20 * escala);
  ctx.fillStyle = COR.cartao;
  ctx.fill();
  ctx.strokeStyle = COR.borda;
  ctx.lineWidth = 2;
  ctx.stroke();
  const pad = Math.round(22 * escala);
  const total = altura(ar) + 6 * escala + altura(av, 1.1);
  const y0 = y + (h - total) / 2;
  escrever(ctx, ar, x + pad, y0, 500, COR.texto3);
  escrever(ctx, av, x + pad, y0 + altura(ar) + 6 * escala, 700, COR.texto, 'left', 1.1);
}

/** Uma pessoa: foto à esquerda, nome/número/partido ao lado e os fatos em quadros. */
function individual(ctx: Ctx, formato: Formato, d: CartaoDados, fotoImg: CanvasImageSource | null, y0: number, y1: number) {
  const { w } = TAMANHOS[formato];
  const p = M[formato];
  const ret = formato === 'retrato';
  const pessoa = d.pessoas[0];
  const fh = ret ? 360 : Math.min(300, y1 - y0);
  const fw = Math.round(fh * 0.75);
  foto(ctx, fotoImg, p.m, y0, fw, fh, ret ? 28 : 20);

  const x = p.m + fw + (ret ? 40 : 32);
  const rw = w - p.m - x;
  let y = y0 + (ret ? 4 : 0);
  const an = ajustarTexto(pessoa.nome, { largura: rw, max: ret ? 76 : 52, min: ret ? 40 : 30, maxLinhas: ret ? 3 : 2, entrelinha: 1.08 }, medidor(ctx, 700));
  y += escrever(ctx, an, x, y, 700, COR.texto, 'left', 1.08) + (ret ? 18 : 12);
  if (pessoa.numero) {
    const lado = ret ? 50 : 36;
    numeroUrna(ctx, pessoa.numero, x, y, lado);
    y += Math.round(lado * 1.3) + (ret ? 18 : 12);
  }
  if (pessoa.detalhe) {
    const ad = ajustarTexto(pessoa.detalhe, { largura: rw, max: ret ? 30 : 22, min: ret ? 22 : 16, maxLinhas: 2 }, medidor(ctx, 500));
    y += escrever(ctx, ad, x, y, 500, COR.texto2);
  }

  // Fatos: 2 colunas no retrato (abaixo da foto), 3 na paisagem (ao lado da foto).
  const cols = ret ? 2 : 3;
  const gap = ret ? 20 : 14;
  const fx = ret ? p.m : x;
  const fwid = ret ? w - 2 * p.m : rw;
  const topo = ret ? Math.max(y0 + fh, y) + 36 : y + 16;
  let fatos = d.fatos;
  const alturaQuadro = (n: number) => {
    const linhas = Math.ceil(n / cols);
    return (y1 - topo - (linhas - 1) * gap) / linhas;
  };
  // Pouco espaço (nome muito longo, por exemplo): menos fatos, nunca letras minúsculas.
  while (fatos.length > cols && alturaQuadro(fatos.length) < (ret ? 100 : 96)) fatos = fatos.slice(0, fatos.length - (fatos.length % cols || cols));
  if (!fatos.length || alturaQuadro(fatos.length) < 40) return;
  const n = fatos.length;
  const c = n < cols ? n : cols;
  const qh = Math.min(ret ? 150 : 110, alturaQuadro(n));
  const qw = (fwid - (c - 1) * gap) / c;
  // Mesmo tamanho de letra em todos os quadros (nenhum dado parece mais importante que outro).
  const e = ret ? 1 : 0.8;
  const lw = qw - 2 * Math.round(22 * e);
  // Um rótulo ou valor bem mais longo diminui sozinho, sem arrastar os outros para baixo do piso.
  const maxRot = Math.round(24 * e);
  const rotulos = ajustarJuntos(fatos.map((f) => f.rotulo), { largura: lw, max: maxRot, min: Math.round(16 * e), maxLinhas: 1 }, medidor(ctx, 500), maxRot - 2);
  const resto = qh - 2 * Math.round(22 * e) - maxRot * 1.15 - 6 * e;
  const maxVal = Math.round(Math.min(44 * e, resto * 0.8));
  const valores = ajustarJuntos(fatos.map((f) => f.valores[0] ?? '—'), { largura: lw, max: maxVal, min: Math.round(18 * e), maxLinhas: 2, altura: resto, entrelinha: 1.1 }, medidor(ctx, 700), Math.round(maxVal * 0.8));
  fatos.forEach((_, i) => {
    const qx = fx + (i % c) * (qw + gap);
    const qy = topo + Math.floor(i / c) * (qh + gap);
    quadro(ctx, rotulos[i], valores[i], qx, qy, qw, qh, e);
  });
}

/** Várias pessoas lado a lado, na ordem recebida, com as mesmas linhas de fatos para todas. */
function ladoALado(ctx: Ctx, formato: Formato, d: CartaoDados, fotos: (CanvasImageSource | null)[], y0: number, y1: number) {
  const { w } = TAMANHOS[formato];
  const p = M[formato];
  const ret = formato === 'retrato';
  const n = d.pessoas.length;
  // Retrato: foto em cima e rótulo acima de cada linha. Paisagem: foto ao lado do nome e os
  // rótulos numa coluna à esquerda (tabela), para caber mais linhas na altura menor.
  const colRotulo = ret ? 0 : 220;
  const gap = ret ? 24 : 16;
  const x0 = p.m + colRotulo + (ret ? 0 : gap);
  const colW = (w - p.m - x0 - (n - 1) * gap) / n;
  const esquerda = (i: number) => x0 + i * (colW + gap);
  const centro = (i: number) => esquerda(i) + colW / 2;

  // Cabeçalho de cada coluna: foto, nome, número e partido, com as mesmas medidas para todas.
  const fh = Math.round(ret ? Math.min(n <= 2 ? 240 : n === 3 ? 220 : 180, colW * 0.62 * (4 / 3)) : 96);
  const fw = Math.round(fh * 0.75);
  const tx = ret ? 0 : fw + 12; // na paisagem, o texto começa depois da foto
  const tw = colW - tx - 8;
  const nomes = ajustarJuntos(d.pessoas.map((x) => x.nome), { largura: tw, max: ret ? (n <= 2 ? 46 : 36) : 26, min: ret ? 22 : 15, maxLinhas: ret ? 2 : 3, entrelinha: 1.08 }, medidor(ctx, 700));
  const temNumero = d.pessoas.some((x) => x.numero);
  // Quadradinhos do número: menores se o número mais longo não couber na coluna (mesmo tamanho para todos).
  const digitos = Math.max(1, ...d.pessoas.map((x) => x.numero?.length ?? 0));
  const lado = Math.min(ret ? (n <= 2 ? 40 : 32) : 22, Math.floor(tw / (digitos * 1.16)));
  const detOpc = { largura: tw, max: ret ? 24 : 16, min: ret ? 17 : 12, maxLinhas: ret ? 2 : 1 };
  // Coluna estreita: se o partido por extenso não couber em ninguém, todos ficam só com a sigla.
  const cabeExtenso = d.pessoas.every((x) => quebrarLinhas(x.detalhe ?? '', detOpc.largura, detOpc.min, medidor(ctx, 500)).length <= detOpc.maxLinhas);
  const detalhes = ajustarJuntos(d.pessoas.map((x) => (cabeExtenso ? (x.detalhe ?? '') : (x.detalhe ?? '').split(' · ')[0])), detOpc, medidor(ctx, 500));
  const hNome = Math.max(...nomes.map((a) => altura(a, 1.08)));
  const hDet = Math.max(...detalhes.map((a) => altura(a)));
  const hNum = temNumero ? Math.round(lado * 1.3) + (ret ? 10 : 6) : 0;
  const hTexto = hNome + 6 + hNum + hDet;
  d.pessoas.forEach((pessoa, i) => {
    if (ret) {
      const cx = centro(i);
      foto(ctx, fotos[i] ?? null, cx - fw / 2, y0, fw, fh, 22);
      const y = y0 + fh + 16 + hNome + 6;
      escrever(ctx, nomes[i], cx, y0 + fh + 16, 700, COR.texto, 'center', 1.08);
      if (pessoa.numero) numeroUrna(ctx, pessoa.numero, cx, y, lado, 'center');
      escrever(ctx, detalhes[i], cx, y + hNum, 500, COR.texto2, 'center');
    } else {
      const x = esquerda(i);
      foto(ctx, fotos[i] ?? null, x, y0, fw, fh, 14);
      const yn = y0 + Math.max(0, (fh - hTexto) / 2);
      const y = yn + hNome + 6;
      escrever(ctx, nomes[i], x + tx, yn, 700, COR.texto, 'left', 1.08);
      if (pessoa.numero) numeroUrna(ctx, pessoa.numero, x + tx, y, lado);
      escrever(ctx, detalhes[i], x + tx, y + hNum, 500, COR.texto2);
    }
  });
  const topo = ret ? y0 + fh + 16 + hTexto + 24 : y0 + Math.max(fh, hTexto) + 14;

  // Linhas de fatos: corta as últimas se não houver espaço (a ordem já é de prioridade).
  const valorOpc = { largura: colW - 8, max: ret ? (n <= 2 ? 36 : 30) : 22, min: ret ? 18 : 14, maxLinhas: ret ? 2 : 1, entrelinha: 1.1 };
  const linhas = d.fatos.map((f) => {
    const rot = ajustarTexto(f.rotulo, { largura: ret ? w - 2 * p.m : colRotulo, max: ret ? 22 : 17, min: ret ? 16 : 13, maxLinhas: ret ? 1 : 2 }, medidor(ctx, 600));
    const vals = ajustarJuntos(f.valores, valorOpc, medidor(ctx, 700));
    const hv = Math.max(...vals.map((a) => altura(a, 1.1)));
    const pad = ret ? 12 : 9;
    const h = ret ? pad + altura(rot) + 6 + hv + pad : pad + Math.max(altura(rot), hv) + pad;
    return { rot, vals, hv, h, pad };
  });
  let y = topo;
  for (const l of linhas) {
    if (y + l.h > y1) break;
    ctx.fillStyle = COR.borda;
    ctx.fillRect(p.m, y, w - 2 * p.m, 2);
    if (ret) {
      escrever(ctx, l.rot, p.m, y + l.pad, 600, COR.texto3);
      const yv = y + l.pad + altura(l.rot) + 6;
      l.vals.forEach((a, i) => escrever(ctx, a, centro(i), yv + (l.hv - altura(a, 1.1)) / 2, 700, COR.texto, 'center', 1.1));
    } else {
      const meio = y + l.h / 2;
      escrever(ctx, l.rot, p.m, meio - altura(l.rot) / 2, 600, COR.texto3);
      l.vals.forEach((a, i) => escrever(ctx, a, esquerda(i), meio - altura(a, 1.1) / 2, 700, COR.texto, 'left', 1.1));
    }
    y += l.h;
  }
}

/** Desenha o cartão inteiro no contexto (canvas já no tamanho do formato). */
export function desenharCartao(ctx: Ctx, d: CartaoDados, formato: Formato, imagens: Imagens) {
  const { w, h } = TAMANHOS[formato];
  const p = M[formato];
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, w, h);
  cabecalho(ctx, formato, imagens.logo);
  const yBase = base(ctx, formato, d);

  let y = p.cab + Math.round(p.m * (formato === 'retrato' ? 0.7 : 0.45));
  const at = ajustarTexto(d.titulo, { largura: w - 2 * p.m, max: p.titulo, min: p.titulo - 6, maxLinhas: 1 }, medidor(ctx, 600));
  y += escrever(ctx, at, p.m, y, 600, COR.marcaTexto) + Math.round(p.m * (formato === 'retrato' ? 0.4 : 0.25));
  const y1 = yBase - Math.round(p.m * (formato === 'retrato' ? 0.55 : 0.4));
  if (d.pessoas.length <= 1) individual(ctx, formato, d, imagens.fotos[0] ?? null, y, y1);
  else ladoALado(ctx, formato, d, imagens.fotos, y, y1);
}

/** Carrega uma imagem para o canvas sem "contaminá-lo" (CORS); falha ou demora → null. */
export function carregarImagem(url: string | null | undefined, tempo = 8000): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    const fim = (ok: boolean) => {
      clearTimeout(t);
      resolve(ok ? img : null);
    };
    const t = setTimeout(() => fim(false), tempo);
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => fim(img.naturalWidth > 0 || /svg/i.test(url));
    img.onerror = () => fim(false);
    img.src = url;
  });
}

/** Logo em SVG sem largura/altura não desenha em alguns navegadores: damos um tamanho a ele antes. */
async function carregarLogo(): Promise<HTMLImageElement | null> {
  const url = brand.logoUrl;
  if (!url) return null;
  if (!/svg/i.test(url)) return carregarImagem(url);
  try {
    const svg = await (await fetch(url)).text();
    const comTamanho = /<svg[^>]*\swidth=/.test(svg) ? svg : svg.replace('<svg', '<svg width="512" height="512"');
    const obj = URL.createObjectURL(new Blob([comTamanho], { type: 'image/svg+xml' }));
    const img = await carregarImagem(obj);
    URL.revokeObjectURL(obj);
    return img;
  } catch {
    return carregarImagem(url);
  }
}

/** Espera a fonte do site (todos os pesos usados) antes de desenhar, para não sair com a fonte reserva. */
async function esperarFontes() {
  if (typeof document === 'undefined' || !document.fonts) return;
  const amostra = 'Tá na Urna ÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç 0123456789 R$ % º ·';
  await Promise.all([400, 500, 600, 700].map((peso) => document.fonts.load(`${peso} 32px "Google Sans Flex Variable"`, amostra).catch(() => [])));
  await document.fonts.ready;
}

/** Gera o PNG do cartão (tamanho fixo em pixels, independente do devicePixelRatio). */
export async function gerarCartao(d: CartaoDados, formato: Formato): Promise<Blob> {
  const [, logo, ...fotos] = await Promise.all([esperarFontes(), carregarLogo(), ...d.pessoas.map((x) => carregarImagem(x.foto))]);
  const { w, h } = TAMANHOS[formato];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  desenharCartao(ctx, d, formato, { logo, fotos });
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar a imagem'))), 'image/png'));
}
