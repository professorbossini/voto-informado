import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { connectApiToAuth } from '@/api';
import { env } from '@/config/env';
import { AuthContext, type AuthContextValue, type AuthStatus } from './AuthContext';
import { toAuthError } from './errors';
import type { AuthAdapter, AuthUser } from './types';

interface AuthProviderProps {
  adapter: AuthAdapter;
  /** Overrides VITE_ENABLE_EMAIL_PASSWORD (useful in tests). */
  enableEmailPassword?: boolean;
  children: ReactNode;
}

export function AuthProvider({
  adapter,
  enableEmailPassword = env.enableEmailPassword,
  children,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    const unsubscribe = adapter.onAuthStateChanged((next) => {
      setUser(next);
      setStatus(next ? 'authenticated' : 'unauthenticated');
    });
    connectApiToAuth({
      getAccessToken: (options) => adapter.getAccessToken(options),
      onUnauthorized: () => void adapter.signOut(),
    });
    return unsubscribe;
  }, [adapter]);

  const value = useMemo<AuthContextValue>(() => {
    const wrap =
      <Args extends unknown[], R>(fn: (...args: Args) => Promise<R>) =>
      async (...args: Args) => {
        try {
          return await fn(...args);
        } catch (error) {
          throw toAuthError(error);
        }
      };

    const caps = adapter.capabilities;
    return {
      status,
      user,
      providerId: adapter.id,
      capabilities: {
        emailPassword: enableEmailPassword && caps.emailPassword,
        signUp: enableEmailPassword && caps.signUp,
        passwordReset: enableEmailPassword && caps.passwordReset,
      },
      signInWithGoogle: wrap(() => adapter.signInWithGoogle()),
      signInWithEmail: wrap((email: string, password: string) =>
        adapter.signInWithEmail(email, password),
      ),
      signUpWithEmail: wrap((input) => adapter.signUpWithEmail(input)),
      sendPasswordReset: wrap((email: string) => adapter.sendPasswordReset(email)),
      signOut: wrap(() => adapter.signOut()),
      getAccessToken: (options) => adapter.getAccessToken(options),
    };
  }, [adapter, enableEmailPassword, status, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
