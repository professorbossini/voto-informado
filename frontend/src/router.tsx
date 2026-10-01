import { createBrowserRouter, type RouteObject } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '@/auth';
import { env } from '@/config/env';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AccountPage } from '@/pages/AccountPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SplashScreen } from '@/components/SplashScreen';

/** Lazy route helper: each page is its own chunk. */
const page = (load: () => Promise<Record<string, React.ComponentType>>, name: string) => ({
  lazy: async () => ({ Component: (await load())[name] }),
});

/**
 * Every election page is public. Sign-in routes exist only when
 * VITE_ENABLE_LOGIN=true (Google sign-in is wired through the auth adapters).
 */
const authRoutes: RouteObject[] = env.enableLogin
  ? [
      {
        element: (
          <RedirectIfAuthenticated>
            <AuthLayout />
          </RedirectIfAuthenticated>
        ),
        children: [
          { path: '/login', ...page(() => import('@/pages/auth/LoginPage'), 'LoginPage') },
          { path: '/signup', ...page(() => import('@/pages/auth/SignUpPage'), 'SignUpPage') },
          { path: '/forgot-password', ...page(() => import('@/pages/auth/ForgotPasswordPage'), 'ForgotPasswordPage') },
        ],
      },
    ]
  : [];

export const router = createBrowserRouter([
  ...authRoutes,
  {
    element: <PublicLayout />,
    // Shown only while the first lazy page chunk loads.
    hydrateFallbackElement: <SplashScreen />,
    children: [
      { index: true, path: '/', ...page(() => import('@/pages/election/HomePage'), 'HomePage') },
      { path: '/eleicao', ...page(() => import('@/pages/election/EleicaoPage'), 'EleicaoPage') },
      { path: '/eleicao/:uf', ...page(() => import('@/pages/election/EleicaoPage'), 'EleicaoPage') },
      { path: '/eleicao/:uf/:cargo', ...page(() => import('@/pages/election/EleicaoPage'), 'EleicaoPage') },
      { path: '/candidato/:sq', ...page(() => import('@/pages/election/CandidatoPage'), 'CandidatoPage') },
      { path: '/comparar', ...page(() => import('@/pages/election/CompararPage'), 'CompararPage') },
      { path: '/cola', ...page(() => import('@/pages/election/ColaPage'), 'ColaPage') },
      { path: '/simulador', ...page(() => import('@/pages/election/SimuladorPage'), 'SimuladorPage') },
      { path: '/segundo-turno', ...page(() => import('@/pages/election/SegundoTurnoPage'), 'SegundoTurnoPage') },
      { path: '/gastos', ...page(() => import('@/pages/election/GastosPage'), 'GastosPage') },
      { path: '/parlamentar/:id', ...page(() => import('@/pages/election/ParlamentarPage'), 'ParlamentarPage') },
      { path: '/numeros', ...page(() => import('@/pages/election/NumerosPage'), 'NumerosPage') },
      { path: '/sobre', ...page(() => import('@/pages/election/SobrePage'), 'SobrePage') },
      { path: '*', element: <NotFoundPage /> },
      ...(env.enableLogin
        ? [
            {
              path: '/account',
              element: (
                <RequireAuth>
                  <AccountPage />
                </RequireAuth>
              ),
            },
          ]
        : []),
    ],
  },
], { basename: import.meta.env.BASE_URL.replace(/\/+$/, '') || '/' });
