import { createBrowserRouter, type RouteObject } from 'react-router';
import { RedirectIfAuthenticated, RequireAuth } from '@/auth';
import { env } from '@/config/env';
import { AuthLayout } from '@/layouts/AuthLayout';
import { PublicLayout } from '@/layouts/PublicLayout';
import { AccountPage } from '@/pages/AccountPage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { SplashScreen } from '@/components/SplashScreen';
import { SomenteNoPeriodo } from '@/components/SomenteNoPeriodo';

/** Lazy route helper: each page is its own chunk. */
const page = (load: () => Promise<Record<string, React.ComponentType>>, name: string) => ({
  lazy: async () => ({ Component: (await load())[name] }),
});

/** Página que só existe no período eleitoral (simulador, cola, 2º turno): fora dele, um aviso. */
const pageEleitoral = (load: () => Promise<Record<string, React.ComponentType>>, name: string, periodo: 'eleicao' | 'segundo-turno', nome: string) => ({
  lazy: async () => {
    const Page = (await load())[name];
    return {
      Component: () => (
        <SomenteNoPeriodo periodo={periodo} nome={nome}>
          <Page />
        </SomenteNoPeriodo>
      ),
    };
  },
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
      { path: '/cola', ...pageEleitoral(() => import('@/pages/election/ColaPage'), 'ColaPage', 'eleicao', 'A cola') },
      // Pesquisas: pendente de conferência no PesqEle; rota só existe com VITE_ENABLE_PESQUISAS=true.
      ...(env.enablePesquisas ? [{ path: '/pesquisas', ...page(() => import('@/pages/election/PesquisasPage'), 'PesquisasPage') }] : []),
      { path: '/simulador', ...pageEleitoral(() => import('@/pages/election/SimuladorPage'), 'SimuladorPage', 'eleicao', 'O simulador de urna') },
      { path: '/resultados', ...page(() => import('@/pages/election/ResultadosPage'), 'ResultadosPage') },
      { path: '/segundo-turno', ...pageEleitoral(() => import('@/pages/election/SegundoTurnoPage'), 'SegundoTurnoPage', 'segundo-turno', 'O 2º turno') },
      { path: '/gastos', ...page(() => import('@/pages/election/GastosPage'), 'GastosPage') },
      { path: '/emendas', ...page(() => import('@/pages/election/EmendasPage'), 'EmendasPage') },
      { path: '/parlamentar/:id', ...page(() => import('@/pages/election/ParlamentarPage'), 'ParlamentarPage') },
      { path: '/partidos', ...page(() => import('@/pages/election/PartidosPage'), 'PartidosPage') },
      { path: '/partido/:slug', ...page(() => import('@/pages/election/PartidoPage'), 'PartidoPage') },
      { path: '/stf/:id', ...page(() => import('@/pages/election/MinistroStfPage'), 'MinistroStfPage') },
      { path: '/presidentes', ...page(() => import('@/pages/presidentes/PresidentesPage'), 'PresidentesPage') },
      { path: '/plenario', ...page(() => import('@/pages/election/PlenarioPage'), 'PlenarioPage') },
      { path: '/numeros', ...page(() => import('@/pages/election/NumerosPage'), 'NumerosPage') },
      { path: '/sobre', ...page(() => import('@/pages/election/SobrePage'), 'SobrePage') },
      { path: '/privacidade', ...page(() => import('@/pages/legal/PrivacidadePage'), 'PrivacidadePage') },
      { path: '/termos', ...page(() => import('@/pages/legal/TermosPage'), 'TermosPage') },
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
