import type { AuthProviderId } from '@/config/env';

/** Provider-agnostic user shape. Map whatever your provider returns into this. */
export interface AuthUser {
  id: string;
  email: string | null;
  name: string | null;
  photoUrl: string | null;
  emailVerified: boolean;
  /** Which sign-in method was used, e.g. "google" or "password". */
  signInMethod: 'google' | 'password' | 'unknown';
}

/** What the active adapter can do. The UI hides features that are not supported. */
export interface AuthCapabilities {
  emailPassword: boolean;
  signUp: boolean;
  passwordReset: boolean;
}

export interface SignUpInput {
  name: string;
  email: string;
  password: string;
}

export type AuthStateListener = (user: AuthUser | null) => void;

/**
 * The single contract every auth backend implements.
 *
 * To support a new provider (Supabase, Auth0, Cognito, Keycloak...), create a
 * file in `src/auth/adapters/`, implement this interface and register it in
 * `src/auth/adapters/index.ts`. Nothing else in the app needs to change.
 */
export interface AuthAdapter {
  readonly id: AuthProviderId;
  readonly capabilities: AuthCapabilities;

  /**
   * Subscribes to session changes. MUST call the listener once as soon as the
   * initial session is known (user or null) and again on every change.
   * Returns an unsubscribe function.
   */
  onAuthStateChanged(listener: AuthStateListener): () => void;

  signInWithGoogle(): Promise<AuthUser>;
  signInWithEmail(email: string, password: string): Promise<AuthUser>;
  signUpWithEmail(input: SignUpInput): Promise<AuthUser>;
  sendPasswordReset(email: string): Promise<void>;
  signOut(): Promise<void>;

  /**
   * Returns a token your API can verify (Firebase ID token, your own JWT...),
   * or `null` when the session is cookie-based or there is no user.
   * `forceRefresh` asks the provider for a brand-new token (used after a 401).
   */
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<string | null>;
}
