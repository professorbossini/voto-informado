import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { NotificationsProvider } from '@/components/feedback/NotificationsProvider';
import { theme } from '@/theme';
import { BotaoCompartilharImagem } from './BotaoCompartilharImagem';
import type { CartaoDados } from './dados';

// O canvas não existe no jsdom: o desenho é testado à parte (desenho.test.ts).
const gerarCartao = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
vi.mock('./desenho', () => ({ gerarCartao: (...a: unknown[]) => gerarCartao(...(a as [])) }));

const dados: CartaoDados = {
  titulo: 'Deputado(a) federal · SP',
  pessoas: [{ nome: 'Fulana de Tal', foto: null, numero: '3030', detalhe: 'ABC' }],
  fatos: [{ rotulo: 'Patrimônio declarado (2026)', valores: ['R$ 1,3 mi'] }],
  url: 'https://www.tanaurna.com.br/candidato/1',
  fonte: 'Fonte: TSE',
  dataDados: '06/10/2026',
};

describe('BotaoCompartilharImagem', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:previa'), revokeObjectURL: vi.fn() }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('gera a prévia ao abrir e, no computador, baixa a imagem e copia o link', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    const clique = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const montar = vi.fn(() => dados);
    render(
      <ThemeProvider theme={theme}>
        <NotificationsProvider>
          <BotaoCompartilharImagem montar={montar} />
        </NotificationsProvider>
      </ThemeProvider>,
    );
    expect(montar).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar imagem' }));
    const img = await screen.findByRole('img', { name: /prévia da imagem/i });
    expect(img).toHaveAttribute('src', 'blob:previa');
    expect(gerarCartao).toHaveBeenCalledWith(dados, 'retrato');

    await userEvent.click(screen.getByRole('button', { name: 'Paisagem · 1200×630' }));
    await vi.waitFor(() => expect(gerarCartao).toHaveBeenCalledWith(dados, 'paisagem'));

    await userEvent.click(await screen.findByRole('button', { name: 'Baixar imagem e copiar link' }));
    expect(clique).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(dados.url);
    expect(await screen.findByText('Imagem baixada e link da página copiado.')).toBeInTheDocument();
    clique.mockRestore();
  }, 20_000);
});
