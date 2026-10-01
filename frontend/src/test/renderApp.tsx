import { render } from '@testing-library/react';
import { CssBaseline } from '@mui/material';
import { ThemeProvider } from '@mui/material/styles';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { AuthProvider, type AuthAdapter } from '@/auth';
import { NotificationsProvider } from '@/components/feedback/NotificationsProvider';
import { theme } from '@/theme';

export function renderWithProviders(
  routes: RouteObject[],
  adapter: AuthAdapter,
  initialPath = '/',
  { enableEmailPassword = true } = {},
) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] });
  const utils = render(
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider adapter={adapter} enableEmailPassword={enableEmailPassword}>
        <NotificationsProvider>
          <RouterProvider router={router} />
        </NotificationsProvider>
      </AuthProvider>
    </ThemeProvider>,
  );
  return { ...utils, router };
}
