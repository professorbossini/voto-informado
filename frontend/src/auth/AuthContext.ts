import { createContext } from 'react';
import type { AuthProviderId } from '@/config/env';
import type { AuthCapabilities, AuthUser, SignUpInput } from './types';

export type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  providerId: AuthProviderId;
  capabilities: AuthCapabilities;
  signInWithGoogle(): Promise<AuthUser>;
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  signUpWithEmail(input: SignUpInput): Promise<AuthUser>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
