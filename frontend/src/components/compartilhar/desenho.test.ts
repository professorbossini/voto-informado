import type { CartaoDados } from './dados';
import { desenharCartao, RODAPE, TAMANHOS, type Formato } from './desenho';

/** Contexto 2D falso: registra os textos escritos e mede cada caractere como 0,55 × o tamanho da fonte. */
function contextoFalso() {
  let font = '';
  let textAlign: CanvasTextAlign = 'left';
  const textos: { texto: string; x: number; y: number; largura: number; alinhar: CanvasTextAlign }[] = [];
  const tamanho = () => Number(/(\d+(?:\.\d+)?)px/.exec(font)?.[1] ?? 10);
  const ctx = {
    set font(v: string) {
      font = v;
    },
    get font() {
      return font;
    },
    set textAlign(v: CanvasTextAlign) {
      textAlign = v;
    },
    get textAlign() {
      return textAlign;
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textBaseline: 'alphabetic',
    measureText: (t: string) => ({ width: t.length * tamanho() * 0.55 }),
    fillText: vi.fn((texto: string, x: number, y: number) => textos.push({ texto, x, y, largura: texto.length * tamanho() * 0.55, alinhar: textAlign })),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    clip: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetY: 0,
  };
  return { ctx, textos };
}

const pessoa = (nome: string, numero = '1234') => ({ nome, foto: null, numero, detalhe: 'ABC · Partido Abc de Nome Bem Comprido' });
const base: Omit<CartaoDados, 'pessoas' | 'fatos'> = {
  titulo: 'Deputado(a) federal · SP',
  url: 'https://www.tanaurna.com.br/candidato/250002540578',
  fonte: 'Fonte: TSE · Candidatos 2026, Bens declarados pelos candidatos 2026, Prestação de contas eleitorais de candidatos 2026',
  dataDados: '06/10/2026',
};
const fatos = (n: number) =>
  ['Patrimônio declarado (2026)', 'Receitas de campanha (parcial)', 'Despesas contratadas (parcial)', 'Idade na eleição', 'Candidaturas anteriores', 'Cota parlamentar desde 2023'].map((rotulo, i) => ({
    rotulo,
    valores: Array.from({ length: n }, (_, j) => (i === 0 && j === 0 ? '47,03% (56.104.503 votos)' : `R$ ${i + j},3 mi`)),
  }));

const casos: [string, CartaoDados][] = [
  ['uma pessoa com nome longo', { ...base, pessoas: [pessoa('Andréa Viegart Coletivo Animal Defensora dos Bichos', '55505')], fatos: fatos(1) }],
  ['parlamentar sem número', { ...base, pessoas: [{ nome: 'Fulana', foto: null, detalhe: 'ABC · SP' }], fatos: fatos(1) }],
  ['duas pessoas', { ...base, pessoas: [pessoa('Flavio Bolsonaro', '22'), pessoa('Lula', '13')], fatos: fatos(2) }],
  ['quatro pessoas', { ...base, pessoas: ['Andréa Viegart Coletivo Animal', 'Lula', 'Adriana Ventura', 'Maria'].map((n) => pessoa(n, '55505')), fatos: fatos(4) }],
];

describe('desenharCartao', () => {
  for (const formato of ['retrato', 'paisagem'] as Formato[]) {
    for (const [nome, dados] of casos) {
      it(`${formato}: ${nome} — todo texto dentro do cartão, com rodapé, endereço e fonte`, () => {
        const { ctx, textos } = contextoFalso();
        desenharCartao(ctx as unknown as CanvasRenderingContext2D, dados, formato, { logo: null, fotos: [] });
        const { w, h } = TAMANHOS[formato];
        for (const t of textos) {
          const x0 = t.alinhar === 'center' ? t.x - t.largura / 2 : t.alinhar === 'right' ? t.x - t.largura : t.x;
          expect(x0, t.texto).toBeGreaterThanOrEqual(0);
          expect(x0 + t.largura, t.texto).toBeLessThanOrEqual(w);
          expect(t.y, t.texto).toBeGreaterThan(0);
          expect(t.y, t.texto).toBeLessThan(h);
        }
        const escritos = textos.map((t) => t.texto);
        expect(escritos).toContain(RODAPE);
        expect(escritos.join(' ')).toContain('tanaurna.com.br/candidato/250002540578');
        // Convite para visitar o site, em todo formato.
        expect(escritos.join(' ')).toMatch(formato === 'paisagem' ? /Veja mais/ : /no Tá na Urna/);
        expect(escritos.join(' ')).toContain('Dados de 06/10/2026');
        expect(escritos.join(' ')).toContain('Fonte: TSE');
        // Sem foto: silhueta neutra para cada pessoa.
        expect(ctx.arc).toHaveBeenCalledTimes(dados.pessoas.length);
        // Pelo menos dois fatos sempre aparecem.
        expect(escritos.filter((t) => t.startsWith('R$')).length).toBeGreaterThanOrEqual(2 * dados.pessoas.length - 1);
      });
    }
  }

  it('cartões de pessoas levam o QR code do endereço (quadradinhos desenhados)', () => {
    const { ctx } = contextoFalso();
    desenharCartao(ctx as unknown as CanvasRenderingContext2D, casos[0][1], 'retrato', { logo: null, fotos: [] });
    const comQr = ctx.fillRect.mock.calls.length;
    const { ctx: semQr } = contextoFalso();
    desenharCartao(semQr as unknown as CanvasRenderingContext2D, casos[0][1], 'retrato', { logo: null, fotos: [] }, { qr: false });
    expect(comQr - semQr.fillRect.mock.calls.length).toBeGreaterThan(100);
  });

  for (const formato of ['retrato', 'paisagem', 'stories'] as Formato[]) {
    it(`${formato}: capa de página sem pessoas — título, chamada, resumo, endereço e rodapé dentro da imagem`, () => {
      const { ctx, textos } = contextoFalso();
      const capa: CartaoDados = {
        titulo: 'Plenário: como votou cada parlamentar nas votações nominais da Câmara e do Senado',
        chamada: 'Congresso',
        descricao: 'Todas as votações nominais do ano, com o voto de cada deputado e senador, direto dos dados abertos da Câmara e do Senado, sem nenhuma interpretação.',
        pessoas: [],
        fatos: [],
        url: 'https://www.tanaurna.com.br/plenario',
        fonte: 'Fontes oficiais citadas na página (TSE, Câmara, Senado, STF)',
        dataDados: null,
      };
      desenharCartao(ctx as unknown as CanvasRenderingContext2D, capa, formato, { logo: null, fotos: [] });
      const { w, h } = TAMANHOS[formato];
      for (const t of textos) {
        const x0 = t.alinhar === 'center' ? t.x - t.largura / 2 : t.alinhar === 'right' ? t.x - t.largura : t.x;
        expect(x0, t.texto).toBeGreaterThanOrEqual(0);
        expect(x0 + t.largura, t.texto).toBeLessThanOrEqual(w);
        expect(t.y, t.texto).toBeGreaterThan(0);
        expect(t.y, t.texto).toBeLessThan(h);
      }
      const tudo = textos.map((t) => t.texto).join(' ');
      expect(tudo).toContain('CONGRESSO');
      expect(tudo).toContain('Plenário');
      expect(tudo).toContain('tanaurna.com.br/plenario');
      expect(tudo).toContain(RODAPE);
      expect(ctx.createLinearGradient).toHaveBeenCalled();
    });
  }

  it('stories com pessoas: o cartão retrato inteiro, reduzido, sobre o fundo da marca', () => {
    const { ctx, textos } = contextoFalso();
    desenharCartao(ctx as unknown as CanvasRenderingContext2D, casos[2][1], 'stories', { logo: null, fotos: [] });
    expect(ctx.scale).toHaveBeenCalledTimes(1);
    const escritos = textos.map((t) => t.texto);
    expect(escritos).toContain('Flavio Bolsonaro');
    expect(escritos.join(' ')).toContain('tanaurna.com.br/candidato/250002540578');
  });

  it('lado a lado, todos os nomes saem com o mesmo tamanho de letra', () => {
    const { ctx } = contextoFalso();
    const fontes: string[] = [];
    ctx.fillText.mockImplementation(() => fontes.push(ctx.font));
    const dados = casos[2][1];
    desenharCartao(ctx as unknown as CanvasRenderingContext2D, dados, 'retrato', { logo: null, fotos: [] });
    const nomes = ctx.fillText.mock.calls.map((c, i) => [c[0], fontes[i]]).filter(([t]) => t === 'Flavio Bolsonaro' || t === 'Lula');
    expect(nomes).toHaveLength(2);
    expect(nomes[0][1]).toBe(nomes[1][1]);
  });

  it('desenha o logo e as fotos recebidos', () => {
    const { ctx } = contextoFalso();
    const img = { naturalWidth: 300, naturalHeight: 400 } as unknown as HTMLImageElement;
    desenharCartao(ctx as unknown as CanvasRenderingContext2D, casos[2][1], 'paisagem', { logo: img, fotos: [img, null] });
    expect(ctx.drawImage).toHaveBeenCalledTimes(2);
    expect(ctx.arc).toHaveBeenCalledTimes(1);
  });
});
