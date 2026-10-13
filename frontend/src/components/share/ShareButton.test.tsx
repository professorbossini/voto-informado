import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { NotificationsProvider } from '@/components/feedback/NotificationsProvider';
import { theme } from '@/theme';
import { ShareButton } from './ShareButton';
import { setShareOverride } from './shareOverride';

// O canvas não existe no jsdom: o desenho é testado à parte (desenho.test.ts).
const gerarCartao = vi.fn(async () => new Blob(['png'], { type: 'image/png' }));
vi.mock('@/components/compartilhar/desenho', () => ({ gerarCartao: (...a: unknown[]) => gerarCartao(...(a as [])) }));

function montar(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '*',
        element: (
          <main>
            <span className="MuiTypography-overline">Apuração</span>
            <h1>Resultados das Eleições 2026</h1>
            <p>Os números vêm direto do servidor do TSE, atualizados a cada minuto durante a apuração.</p>
            <ShareButton />
          </main>
        ),
      },
    ],
    { initialEntries: [path] },
  );
  render(
    <ThemeProvider theme={theme}>
      <NotificationsProvider>
        <RouterProvider router={router} />
      </NotificationsProvider>
    </ThemeProvider>,
  );
}

describe('ShareButton', () => {
  beforeEach(() => {
    gerarCartao.mockClear();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:previa'), revokeObjectURL: vi.fn() }));
  });
  afterEach(() => {
    setShareOverride(null);
    vi.unstubAllGlobals();
  });

  it('gera a capa desta página (título, chamada e resumo da tela) com o endereço com filtros', async () => {
    montar('/resultados?cargo=governador&uf=SP');
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar esta página' }));
    expect(await screen.findByRole('img', { name: /prévia da imagem/i })).toBeInTheDocument();
    const [dados, formato] = gerarCartao.mock.calls[0] as unknown as [Record<string, unknown>, string];
    expect(formato).toBe('retrato');
    expect(dados).toMatchObject({ titulo: 'Resultados das Eleições 2026', chamada: 'Apuração', pessoas: [] });
    expect(String(dados.descricao)).toContain('servidor do TSE');
    expect(String(dados.url)).toContain('/resultados?cargo=governador&uf=SP');
    for (const rede of [/whatsapp/i, /facebook/i, /x \(twitter\)/i, /instagram/i, /linkedin/i, /telegram/i]) {
      expect(screen.getByRole('button', { name: rede })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Copiar link' })).toBeInTheDocument();
  }, 20_000);

  it('usa o endereço registrado pela página quando o estado não está na URL', async () => {
    setShareOverride('comparar?c=1,2');
    montar('/comparar');
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar esta página' }));
    await screen.findByRole('img', { name: /prévia da imagem/i });
    const [dados] = gerarCartao.mock.calls[0] as unknown as [Record<string, unknown>];
    expect(String(dados.url)).toContain('/comparar?c=1,2');
  }, 20_000);
});
