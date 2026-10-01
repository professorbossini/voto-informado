import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { LoginPage } from '@/pages/auth/LoginPage';
import { renderWithProviders } from '@/test/renderApp';
import { createMockAdapter } from './adapters/mock';
import { RedirectIfAuthenticated, RequireAuth } from './guards';
import { useAuth } from './useAuth';

function Private() {
  const { user, signOut } = useAuth();
  return (
    <div>
      <p>Bem-vindo, {user?.name}</p>
      <button onClick={() => void signOut()}>Sair</button>
    </div>
  );
}

const routes = [
  { path: '/', element: <p>Início</p> },
  {
    path: '/login',
    element: (
      <RedirectIfAuthenticated>
        <LoginPage />
      </RedirectIfAuthenticated>
    ),
  },
  {
    path: '/reports',
    element: (
      <RequireAuth>
        <Private />
      </RequireAuth>
    ),
  },
];

describe('auth flow', () => {
  it('redirects to login, signs in with Google and returns to the original page', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders(routes, createMockAdapter({ latencyMs: 0 }), '/reports');

    await user.click(await screen.findByRole('button', { name: /entrar com google/i }));

    expect(await screen.findByText('Bem-vindo, Ana Lima')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/reports');
  });

  it('shows validation and provider errors on e-mail login', async () => {
    const user = userEvent.setup();
    renderWithProviders(routes, createMockAdapter({ latencyMs: 0 }), '/login');

    await user.click(await screen.findByRole('button', { name: /^entrar$/i }));
    expect(screen.getByText('Digite um e-mail válido.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('E-mail'), 'erro@exemplo.com');
    await user.type(screen.getByLabelText('Senha'), 'qualquer');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  });

  it('signs out and goes back to login', async () => {
    const user = userEvent.setup();
    const { router } = renderWithProviders(routes, createMockAdapter({ latencyMs: 0 }), '/login');

    await user.click(await screen.findByRole('button', { name: /entrar com google/i }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/'));

    await router.navigate('/reports');
    await user.click(await screen.findByRole('button', { name: 'Sair' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
  });

  it('hides e-mail/password when disabled', async () => {
    renderWithProviders(routes, createMockAdapter({ latencyMs: 0 }), '/login', {
      enableEmailPassword: false,
    });
    expect(await screen.findByRole('button', { name: /entrar com google/i })).toBeInTheDocument();
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    expect(screen.queryByText('Criar conta')).not.toBeInTheDocument();
  });
});
