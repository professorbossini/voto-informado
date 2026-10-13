import { brand } from '@/config/brand';
import { fontFamily } from '@/theme';
import { ink, lime, violet } from '@/theme/tokens';
import type { CartaoDados } from './dados';
import { desenharQr } from './qr';
import { ajustarJuntos, ajustarTexto, quebrarLinhas, urlCurta, type Ajuste, type Medidor } from './texto';

/**
 * Desenho dos cartões para compartilhar (PNG gerado no navegador, sem servidor). Um só modelo
 * para todo mundo: cores da marca do site (violeta e neutros, nunca de partido), mesmas medidas
 * e mesmo tamanho de letra para todas as pessoas de um cartão. O tamanho final em pixels é fixo
 * (não depende da densidade da tela do aparelho). Todo cartão leva o endereço e um QR code dele.
 *
 * Formatos: retrato 4:5 (feed do Instagram/Facebook), paisagem 1,91:1 (X, LinkedIn, Facebook,
 * WhatsApp) e stories 9:16 (Stories, Status do WhatsApp, TikTok). Página sem pessoas (resultados,
 * plenário...) vira uma "capa": título e resumo da página sobre o fundo da marca.
 */

export type Formato = 'retrato' | 'paisagem' | 'stories';

export const TAMANHOS: Record<Formato, { w: number; h: number }> = {
  retrato: { w: 1080, h: 1350 },
  paisagem: { w: 1200, h: 630 },
  stories: { w: 1080, h: 1920 },
};

export const RODAPE = 'Dados públicos oficiais · sem recomendação de voto';

/** Convite para visitar o site (neutro: o que a pessoa encontra lá, sem induzir voto). */
export const CONVITE = 'Compare candidaturas e confira os dados oficiais no Tá na Urna';
export const CONVITE_CURTO = 'Veja mais no Tá na Urna';

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
  stories: { m: 64, cab: 136, logo: 76, marca: 46, sub: 28, titulo: 30, rodape: 26, fonte: 24, url: 32 },
} as const;

/** Lado do QR no rodapé dos cartões de pessoas. */
const LADO_QR = { retrato: 172, paisagem: 112, stories: 172 } as const;

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

/** Endereço, data, fonte, QR e rodapé, de baixo para cima. Devolve o topo do bloco. */
function base(ctx: Ctx, formato: Formato, d: CartaoDados, comQr = true): number {
  const { w, h } = TAMANHOS[formato];
  const p = M[formato];
  const ladoQr = comQr ? LADO_QR[formato] : 0;
  // O QR fica à direita do endereço e da fonte; o texto usa o resto da largura.
  const largura = w - 2 * p.m - (comQr ? ladoQr + Math.round(p.m * 0.5) : 0);

  // Rodapé neutro, separado por uma linha.
  const faixa = Math.round(p.rodape * 2.6);
  ctx.fillStyle = COR.borda;
  ctx.fillRect(p.m, h - faixa, w - 2 * p.m, 2);
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
  // No formato baixo (paisagem) o convite vai junto do endereço; nos altos, numa linha própria acima.
  const pais = formato === 'paisagem';
  const au = ajustarTexto(`${pais ? 'Veja mais: ' : ''}${urlCurta(d.url)}`, { largura: largura - 2 * pad, max: p.url, min: Math.round(p.url * 0.55), maxLinhas: 1 }, medidor(ctx, 700));
  fonte(ctx, 700, au.tamanho);
  const wu = ctx.measureText(au.linhas[0] ?? '').width + 2 * pad;
  retangulo(ctx, p.m, yu, wu, hu, hu / 2);
  ctx.fillStyle = COR.marcaClara;
  ctx.fill();
  escrever(ctx, au, p.m + pad, yu + (hu - altura(au, 1)) / 2, 700, COR.marcaTexto, 'left', 1);

  // Convite para visitar o site, logo acima do endereço, com um traço lima de destaque.
  let topo = yu;
  if (!pais) {
    const ac = ajustarTexto(CONVITE, { largura: largura - 24, max: Math.round(p.url * 0.95), min: Math.round(p.fonte * 0.9), maxLinhas: 2, entrelinha: 1.15 }, medidor(ctx, 700));
    const yc = yu - Math.round(p.m * 0.3) - altura(ac);
    retangulo(ctx, p.m, yc, 8, altura(ac), 4);
    ctx.fillStyle = COR.destaque;
    ctx.fill();
    escrever(ctx, ac, p.m + 22, yc, 700, COR.texto, 'left', 1.15);
    topo = yc;
  }
  if (!comQr) return topo;

  // QR do endereço, com moldura branca, alinhado ao pé do bloco de texto.
  const xq = w - p.m - ladoQr;
  const yq = h - faixa - Math.round(p.m * 0.4) - ladoQr;
  retangulo(ctx, xq - 6, yq - 6, ladoQr + 12, ladoQr + 12, 16);
  ctx.fillStyle = COR.cartao;
  ctx.fill();
  ctx.strokeStyle = COR.borda;
  ctx.lineWidth = 2;
  ctx.stroke();
  desenharQr(ctx, d.url, xq, yq, ladoQr, COR.texto, COR.cartao);
  return Math.min(topo, yq - 6);
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

// ── Capa (páginas sem pessoas) e stories ─────────────────────────────────────

/** Fundo da marca: degradê violeta com dois círculos discretos (um lima). */
function fundoMarca(ctx: Ctx, w: number, h: number) {
  const g = ctx.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, violet[600]);
  g.addColorStop(1, violet[900]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.arc(w * 1.02, h * 0.06, Math.max(w, h) * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.14;
  ctx.fillStyle = lime[400];
  ctx.beginPath();
  ctx.arc(-w * 0.1, h * 0.74, Math.min(w, h) * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Logo, nome do site e "Eleições 2026 · dados oficiais" em branco no topo. Devolve o y de baixo. */
function marcaTopo(ctx: Ctx, w: number, m: number, lado: number, logo: CanvasImageSource | null): number {
  let x = m;
  if (logo) {
    ctx.drawImage(logo, x, m, lado, lado);
    x += lado + Math.round(lado * 0.28);
  }
  ctx.textBaseline = 'middle';
  fonte(ctx, 700, Math.round(lado * 0.6));
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(brand.name ?? 'Tá na Urna', x, m + lado / 2);
  fonte(ctx, 500, Math.round(lado * 0.34));
  ctx.fillStyle = violet[200];
  ctx.textAlign = 'right';
  ctx.fillText('Eleições 2026 · dados oficiais', w - m, m + lado / 2);
  return m + lado;
}

/** Rodapé neutro em letra clara sobre o fundo da marca. */
function rodapeMarca(ctx: Ctx, w: number, h: number, m: number, tamanho: number, alinhar: CanvasTextAlign = 'center') {
  fonte(ctx, 500, tamanho);
  ctx.fillStyle = violet[200];
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'middle';
  ctx.fillText(RODAPE, alinhar === 'center' ? w / 2 : m, h - m * 0.65);
}

/**
 * Painel branco com o QR à esquerda (ou em cima, se `empilhado`) e, ao lado, o convite para
 * abrir a página, o endereço e a fonte dos dados.
 */
function painelQr(ctx: Ctx, d: CartaoDados, x: number, y: number, w: number, h: number, e: number, empilhado = false) {
  retangulo(ctx, x, y, w, h, 32 * e);
  ctx.fillStyle = COR.cartao;
  ctx.fill();
  const pad = Math.round(30 * e);
  const textos = (tx: number, ty: number, tw: number, th: number) => {
    const chamada = ajustarTexto(CONVITE_CURTO, { largura: tw, max: Math.round(32 * e), min: Math.round(18 * e), maxLinhas: 1 }, medidor(ctx, 700));
    const convite = ajustarTexto('Aponte a câmera do celular ou acesse:', { largura: tw, max: Math.round(24 * e), min: Math.round(15 * e), maxLinhas: 2 }, medidor(ctx, 500));
    // Endereço numa linha só (diminuindo a letra); duas linhas só se nem assim couber (ex.: comparação longa).
    const umaLinha = ajustarTexto(urlCurta(d.url), { largura: tw, max: Math.round(38 * e), min: Math.round(22 * e), maxLinhas: 1 }, medidor(ctx, 700));
    const end = umaLinha.linhas[0]?.endsWith('…') ? ajustarTexto(urlCurta(d.url), { largura: tw, max: Math.round(22 * e), min: Math.round(16 * e), maxLinhas: 2, entrelinha: 1.1 }, medidor(ctx, 700)) : umaLinha;
    const dados = `${d.dataDados ? `Dados de ${d.dataDados} · ` : ''}${d.fonte}`;
    const resto = th - altura(chamada) - 6 * e - altura(convite) - altura(end, 1.1) - 20 * e;
    const af = resto > 16 * e ? ajustarTexto(dados, { largura: tw, max: Math.round(20 * e), min: Math.round(14 * e), maxLinhas: 3, altura: resto, entrelinha: 1.25 }, medidor(ctx, 400)) : null;
    const total = altura(chamada) + 6 * e + altura(convite) + 8 * e + altura(end, 1.1) + (af ? 12 * e + altura(af, 1.25) : 0);
    let yy = ty + Math.max(0, (th - total) / 2);
    yy += escrever(ctx, chamada, tx, yy, 700, COR.texto) + 6 * e;
    yy += escrever(ctx, convite, tx, yy, 500, COR.texto3) + 8 * e;
    yy += escrever(ctx, end, tx, yy, 700, COR.marcaTexto, 'left', 1.1);
    if (af) escrever(ctx, af, tx, yy + 12 * e, 400, COR.texto2, 'left', 1.25);
  };
  if (empilhado) {
    const lado = Math.min(w - 2 * pad, h * 0.58);
    desenharQr(ctx, d.url, x + (w - lado) / 2, y + pad, lado, COR.texto, COR.cartao);
    textos(x + pad, y + pad + lado + 8 * e, w - 2 * pad, h - lado - 2 * pad - 8 * e);
  } else {
    const lado = h - 2 * pad;
    desenharQr(ctx, d.url, x + pad, y + pad, lado, COR.texto, COR.cartao);
    const tx = x + pad + lado + Math.round(pad * 1.1);
    textos(tx, y + pad, x + w - pad - tx, lado);
  }
}

/** Figura da página num painel arredondado, centralizada e inteira ("contain"), com sombra. */
function painelFigura(ctx: Ctx, f: NonNullable<CartaoDados['figura']>, x: number, y: number, w: number, h: number, e: number) {
  ctx.save();
  ctx.shadowColor = 'rgba(13, 9, 25, 0.35)';
  ctx.shadowBlur = 36 * e;
  ctx.shadowOffsetY = 10 * e;
  retangulo(ctx, x, y, w, h, 28 * e);
  ctx.fillStyle = f.fundo;
  ctx.fill();
  ctx.restore();
  const pad = Math.round(20 * e);
  const s = Math.min((w - 2 * pad) / f.w, (h - 2 * pad) / f.h);
  const fw = f.w * s;
  const fh = f.h * s;
  ctx.save();
  retangulo(ctx, x, y, w, h, 28 * e);
  ctx.clip();
  ctx.drawImage(f.img, x + (w - fw) / 2, y + (h - fh) / 2, fw, fh);
  ctx.restore();
}

/** Capa com a figura da página: chamada e título em cima, a figura grande no meio e o QR embaixo (ou ao lado). */
function capaComFigura(ctx: Ctx, formato: Formato, d: CartaoDados, logo: CanvasImageSource | null) {
  const f = d.figura!;
  const { w, h } = TAMANHOS[formato];
  fundoMarca(ctx, w, h);
  const vertical = h > w;
  const e = formato === 'stories' ? 1.15 : formato === 'retrato' ? 1 : 0.72;
  const m = Math.round(64 * (vertical ? 1 : 0.72));
  const yTopo = marcaTopo(ctx, w, m, Math.round(72 * e), logo);
  rodapeMarca(ctx, w, h, m, Math.round(22 * e), vertical ? 'center' : 'left');
  const titulos = (x: number, y: number, lw: number, maxTit: number, linhas: number) => {
    const gap = Math.round(18 * e);
    let yy = y;
    if (d.chamada) {
      const ac = ajustarTexto(d.chamada.toLocaleUpperCase('pt-BR'), { largura: lw - 48 * e, max: Math.round(24 * e), min: Math.round(16 * e), maxLinhas: 1 }, medidor(ctx, 700));
      const hc = Math.round(ac.tamanho * 1.9);
      fonte(ctx, 700, ac.tamanho);
      const cw = ctx.measureText(ac.linhas[0] ?? '').width + 40 * e;
      retangulo(ctx, x, yy, cw, hc, hc / 2);
      ctx.fillStyle = lime[400];
      ctx.fill();
      escrever(ctx, ac, x + 20 * e, yy + (hc - altura(ac, 1)) / 2, 700, ink[900], 'left', 1);
      yy += hc + gap;
    }
    const at = ajustarTexto(d.titulo, { largura: lw, max: maxTit, min: Math.round(36 * e), maxLinhas: linhas, entrelinha: 1.05 }, medidor(ctx, 700));
    yy += escrever(ctx, at, x, yy, 700, '#FFFFFF', 'left', 1.05);
    return yy;
  };
  if (vertical) {
    const yt = titulos(m, yTopo + m * 0.7, w - 2 * m, Math.round(68 * e), 2);
    const ph = formato === 'stories' ? 300 : 230;
    const py = h - m * 1.25 - ph;
    painelQr(ctx, d, m, py, w - 2 * m, ph, e * 0.9);
    // Painel da figura na proporção dela (uma figura larga, como o plenário, não deixa vazio);
    // a sobra vai para o resumo da página, entre o título e a figura.
    const pw = w - 2 * m;
    const pad = Math.round(20 * e);
    const livre = py - m * 0.6 - (yt + m * 0.6);
    const ideal = ((pw - 2 * pad) * f.h) / f.w + 2 * pad;
    let fh = Math.min(livre, ideal);
    let fy = yt + m * 0.6;
    const sobra = livre - fh;
    if (d.descricao && sobra > 110 * e) {
      const ad = ajustarTexto(d.descricao, { largura: pw, max: Math.round(34 * e), min: Math.round(24 * e), maxLinhas: formato === 'stories' ? 6 : 4, altura: sobra - 50 * e, entrelinha: 1.3 }, medidor(ctx, 500));
      const ha = altura(ad, 1.3);
      escrever(ctx, ad, m, fy, 500, violet[100], 'left', 1.3);
      fy += ha + 36 * e;
      fh = Math.min(fh, py - m * 0.6 - fy);
    }
    // O que ainda sobrar: centraliza a figura no espaço até o painel do QR.
    fy += Math.max(0, (py - m * 0.6 - fy - fh) / 2);
    painelFigura(ctx, f, m, fy, pw, fh, e);
  } else {
    const cw = 400;
    const fx = m;
    const fy = yTopo + m * 0.6;
    const fwid = w - 3 * m - cw;
    painelFigura(ctx, f, fx, fy, fwid, h - m * 1.3 - fy, e);
    const xt = w - m - cw;
    const yt = titulos(xt, fy, cw, Math.round(52 * e), 3);
    const ph = 150;
    const py = h - m * 1.3 - ph;
    if (py > yt + 12) painelQr(ctx, d, xt, py, cw, ph, e);
  }
}

/** Página sem pessoas: chamada, título grande e resumo sobre o fundo da marca, com o QR embaixo (ou ao lado). */
function capa(ctx: Ctx, formato: Formato, d: CartaoDados, logo: CanvasImageSource | null) {
  if (d.figura) return capaComFigura(ctx, formato, d, logo);
  const { w, h } = TAMANHOS[formato];
  fundoMarca(ctx, w, h);
  const vertical = h > w;
  const e = formato === 'stories' ? 1.15 : formato === 'retrato' ? 1 : 0.72;
  const m = Math.round(72 * (vertical ? 1 : 0.72));
  const yTopo = marcaTopo(ctx, w, m, Math.round(80 * e), logo);
  rodapeMarca(ctx, w, h, m, Math.round(24 * e), vertical ? 'center' : 'left');

  // Painel do QR: embaixo (vertical) ou à direita (paisagem).
  const xt = m;
  let lw = w - 2 * m;
  let topo = yTopo + m * 0.9;
  let fundo: number;
  if (vertical) {
    const ph = formato === 'stories' ? 400 : 320;
    const py = h - m * 1.3 - ph;
    painelQr(ctx, d, m, py, w - 2 * m, ph, e);
    fundo = py - m * 0.8;
  } else {
    const pw = 320;
    const py = yTopo + m * 0.6;
    painelQr(ctx, d, w - m - pw, py, pw, h - py - m * 1.25, e, true);
    lw = w - 3 * m - pw;
    topo = py;
    fundo = h - m * 1.25;
  }

  // Chamada (pílula lima), título e resumo: centralizados um pouco acima do meio do espaço livre.
  const disponivel = fundo - topo;
  const chamada = d.chamada ? ajustarTexto(d.chamada.toLocaleUpperCase('pt-BR'), { largura: lw - 48 * e, max: Math.round(28 * e), min: Math.round(18 * e), maxLinhas: 1 }, medidor(ctx, 700)) : null;
  const hChamada = chamada ? Math.round(chamada.tamanho * 1.9) : 0;
  const gap = Math.round(28 * e);
  const tit = ajustarTexto(d.titulo, { largura: lw, max: Math.round((vertical ? 104 : 84) * e), min: Math.round(44 * e), maxLinhas: formato === 'stories' ? 6 : vertical ? 5 : 3, altura: disponivel * 0.6, entrelinha: 1.05 }, medidor(ctx, 700));
  const descOpc = { largura: lw, max: Math.round((vertical ? 40 : 34) * e), min: Math.round(24 * e), maxLinhas: formato === 'stories' ? 7 : vertical ? 5 : 3, entrelinha: 1.3 };
  const resto = disponivel - hChamada - (chamada ? gap : 0) - altura(tit, 1.05) - gap * 2 - 12 * e;
  const desc = d.descricao && resto > descOpc.min * 1.3 ? ajustarTexto(d.descricao, { ...descOpc, altura: resto }, medidor(ctx, 500)) : null;
  const total = hChamada + (chamada ? gap : 0) + altura(tit, 1.05) + gap + 12 * e + (desc ? gap + altura(desc, 1.3) : 0);
  let y = topo + Math.max(0, (disponivel - total) * 0.4);
  if (chamada) {
    fonte(ctx, 700, chamada.tamanho);
    const cw = ctx.measureText(chamada.linhas[0] ?? '').width + 48 * e;
    retangulo(ctx, xt, y, cw, hChamada, hChamada / 2);
    ctx.fillStyle = lime[400];
    ctx.fill();
    escrever(ctx, chamada, xt + 24 * e, y + (hChamada - altura(chamada, 1)) / 2, 700, ink[900], 'left', 1);
    y += hChamada + gap;
  }
  y += escrever(ctx, tit, xt, y, 700, '#FFFFFF', 'left', 1.05) + gap;
  retangulo(ctx, xt, y, 120 * e, 12 * e, 6 * e);
  ctx.fillStyle = lime[400];
  ctx.fill();
  y += 12 * e;
  if (desc) escrever(ctx, desc, xt, y + gap, 500, violet[100], 'left', 1.3);
}

/** Stories (9:16) com pessoas: o cartão retrato inteiro sobre o fundo da marca e o QR grande embaixo. */
function storiesComPessoas(ctx: Ctx, d: CartaoDados, imagens: Imagens) {
  const { w, h } = TAMANHOS.stories;
  const m = 64;
  fundoMarca(ctx, w, h);
  const yTopo = marcaTopo(ctx, w, m, 84, imagens.logo);
  rodapeMarca(ctx, w, h, m, 26);
  const ph = 300;
  const py = h - m * 1.3 - ph;
  painelQr(ctx, d, m, py, w - 2 * m, ph, 1);
  // Cartão retrato (sem o QR pequeno: o grande está logo abaixo), reduzido para caber entre o topo e o painel.
  const livre = py - yTopo - 2 * 40;
  const s = Math.min((w - 2 * 48) / TAMANHOS.retrato.w, livre / TAMANHOS.retrato.h);
  const cw = TAMANHOS.retrato.w * s;
  const ch = TAMANHOS.retrato.h * s;
  const cx = (w - cw) / 2;
  const cy = yTopo + 40 + (livre - ch) / 2;
  ctx.save();
  ctx.shadowColor = 'rgba(13, 9, 25, 0.45)';
  ctx.shadowBlur = 48;
  ctx.shadowOffsetY = 16;
  retangulo(ctx, cx, cy, cw, ch, 36);
  ctx.fillStyle = COR.fundo;
  ctx.fill();
  ctx.restore();
  ctx.save();
  retangulo(ctx, cx, cy, cw, ch, 36);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  desenharCartao(ctx, d, 'retrato', imagens, { qr: false });
  ctx.restore();
}

/** Desenha o cartão inteiro no contexto (canvas já no tamanho do formato). */
export function desenharCartao(ctx: Ctx, d: CartaoDados, formato: Formato, imagens: Imagens, opcoes: { qr?: boolean } = {}) {
  if (!d.pessoas.length) return capa(ctx, formato, d, imagens.logo);
  if (formato === 'stories') return storiesComPessoas(ctx, d, imagens);
  const { w, h } = TAMANHOS[formato];
  const p = M[formato];
  ctx.fillStyle = COR.fundo;
  ctx.fillRect(0, 0, w, h);
  cabecalho(ctx, formato, imagens.logo);
  const yBase = base(ctx, formato, d, opcoes.qr ?? true);

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
