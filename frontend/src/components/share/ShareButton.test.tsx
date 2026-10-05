import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material/styles';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { NotificationsProvider } from '@/components/feedback/NotificationsProvider';
import { theme } from '@/theme';
import { ShareButton } from './ShareButton';
import { setShareOverride } from './shareOverride';

function montar(path: string) {
  const router = createMemoryRouter(
    [{ path: '*', element: <main><h1>Resultados das Eleições 2026</h1><ShareButton /></main> }],
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
  afterEach(() => setShareOverride(null));

  it('compartilha o endereço desta página (com filtros) nas redes, com o título da página', async () => {
    montar('/resultados?cargo=governador&uf=SP');
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar esta página' }));
    const zap = screen.getByRole('menuitem', { name: /whatsapp/i });
    const href = decodeURIComponent(zap.getAttribute('href') ?? '');
    expect(href).toContain('/resultados?cargo=governador&uf=SP');
    expect(href).toContain('Resultados das Eleições 2026 · Tá na Urna');
    for (const rede of [/facebook/i, /x \(twitter\)/i, /telegram/i, /linkedin/i, /e-mail/i, /copiar link/i]) {
      expect(screen.getByRole('menuitem', { name: rede })).toBeInTheDocument();
    }
  }, 20_000);

  it('usa o endereço registrado pela página quando o estado não está na URL', async () => {
    setShareOverride('comparar?c=1,2');
    montar('/comparar');
    await userEvent.click(screen.getByRole('button', { name: 'Compartilhar esta página' }));
    const fb = screen.getByRole('menuitem', { name: /facebook/i });
    expect(decodeURIComponent(fb.getAttribute('href') ?? '')).toContain('/comparar?c=1,2');
  }, 20_000);
});
