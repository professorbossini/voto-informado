import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { SplashScreen } from '@/components/SplashScreen';
import { useAuth } from './useAuth';

export interface RedirectState {
  from?: string;
}

/** Renders children only for signed-in users; otherwise redirects to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <SplashScreen />;
  if (status === 'unauthenticated') {
    const from = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to="/login" replace state={{ from } satisfies RedirectState} />;
  }
  return children;
}

/** For /login, /signup...: signed-in users are sent back where they came from. */
export function RedirectIfAuthenticated({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();
  const from = (location.state as RedirectState | null)?.from;

  if (status === 'loading') return <SplashScreen />;
  if (status === 'authenticated') {
    const safeFrom = from && from.startsWith('/') && !from.startsWith('//') ? from : '/';
    return <Navigate to={safeFrom} replace />;
  }
  return children;
}
