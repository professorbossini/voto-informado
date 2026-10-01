import { AuthError, type AuthErrorCode } from '../errors';
import type { AuthAdapter, AuthStateListener, AuthUser } from '../types';
import { requestGoogleAuthCode } from './googleIdentity';

/**
 * Endpoints of the auth contract, relative to VITE_API_URL.
 * Full specification: docs/backend-contract.md. Change them here if your API differs.
 */
export const BACKEND_AUTH_ENDPOINTS = {
  google: '/auth/google',
  login: '/auth/login',
  register: '/auth/register',
  passwordReset: '/auth/password-reset',
  refresh: '/auth/refresh',
  logout: '/auth/logout',
} as const;

/** Body returned by google/login/register/refresh. */
export interface SessionResponse {
  user: Partial<AuthUser> & { id: string };
  /** Short-lived bearer token. Omit it if your API uses session cookies only. */
  accessToken?: string;
  /** Seconds until `accessToken` expires. */
  expiresIn?: number;
}

export interface BackendAdapterOptions {
  apiUrl: string;
  googleClientId: string;
  fetchImpl?: typeof fetch;
}

/** Refresh the access token this many ms before it expires. */
const EXPIRY_MARGIN_MS = 30_000;

const STATUS_ERRORS: Record<number, AuthErrorCode> = {
  401: 'invalid-credentials',
  403: 'user-disabled',
  409: 'email-in-use',
  429: 'too-many-requests',
};

const KNOWN_CODES = new Set<string>([
  'cancelled',
  'popup-blocked',
  'invalid-credentials',
  'email-in-use',
  'weak-password',
  'invalid-email',
  'user-disabled',
  'too-many-requests',
  'network',
  'not-supported',
  'unauthorized-domain',
  'config',
  'unknown',
]);

function normalizeUser(user: SessionResponse['user']): AuthUser {
  return {
    id: String(user.id),
    email: user.email ?? null,
    name: user.name ?? null,
    photoUrl: user.photoUrl ?? null,
    emailVerified: user.emailVerified ?? false,
    signInMethod: user.signInMethod ?? 'unknown',
  };
}

/**
 * "Bring your own backend" adapter.
 *
 * Google sign-in uses the authorization-code flow: the browser gets a one-time
 * code from Google and POSTs it to your API, which exchanges it (with the client
 * secret), validates the ID token and starts a session. Works with any stack:
 * Node, Spring, .NET, Django, Laravel, Go...
 *
 * Session strategy is up to the backend:
 * - bearer: return `accessToken` + keep a refresh token in an httpOnly cookie;
 * - cookie: omit `accessToken` and rely on an httpOnly session cookie.
 * The access token lives only in memory, never in localStorage.
 */
export function createBackendAdapter(options: BackendAdapterOptions): AuthAdapter {
  const { apiUrl, googleClientId } = options;
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const listeners = new Set<AuthStateListener>();

  let user: AuthUser | null = null;
  let accessToken: string | null = null;
  let expiresAt = 0;
  let initialized: Promise<void> | null = null;
  let refreshing: Promise<boolean> | null = null;

  const emit = () => listeners.forEach((listener) => listener(user));

  function applySession(session: SessionResponse | null) {
    user = session ? normalizeUser(session.user) : null;
    accessToken = session?.accessToken ?? null;
    expiresAt = session?.expiresIn ? Date.now() + session.expiresIn * 1000 : 0;
    emit();
    return user;
  }

  async function post<T>(path: string, body?: unknown): Promise<T> {
    let response: Response;
    try {
      response = await doFetch(`${apiUrl}${path}`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (error) {
      throw new AuthError('network', 'Could not reach the API.', error);
    }

    if (response.status === 204) return undefined as T;
    const data = (await response.json().catch(() => null)) as
      (T & { code?: string; message?: string }) | null;

    if (!response.ok) {
      const code =
        data?.code && KNOWN_CODES.has(data.code)
          ? (data.code as AuthErrorCode)
          : (STATUS_ERRORS[response.status] ?? 'unknown');
      throw new AuthError(code, data?.message ?? `HTTP ${response.status}`);
    }
    return data as T;
  }

  /** Renews the session using the refresh cookie. Resolves false when there is no session. */
  function refresh(): Promise<boolean> {
    refreshing ??= post<SessionResponse>(BACKEND_AUTH_ENDPOINTS.refresh)
      .then((session) => {
        applySession(session);
        return true;
      })
      .catch((error: unknown) => {
        const code = error instanceof AuthError ? error.code : 'unknown';
        if (code !== 'network') applySession(null);
        if (code !== 'invalid-credentials' && code !== 'user-disabled') {
          console.warn('[auth] Session refresh failed:', error);
        }
        return false;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  function init() {
    initialized ??= refresh().then(() => undefined);
    return initialized;
  }

  return {
    id: 'backend',
    capabilities: { emailPassword: true, signUp: true, passwordReset: true },

    onAuthStateChanged(listener) {
      listeners.add(listener);
      void init().then(() => {
        if (listeners.has(listener)) listener(user);
      });
      return () => listeners.delete(listener);
    },

    async signInWithGoogle() {
      const code = await requestGoogleAuthCode(googleClientId);
      const session = await post<SessionResponse>(BACKEND_AUTH_ENDPOINTS.google, { code });
      return applySession(session)!;
    },

    async signInWithEmail(email, password) {
      const session = await post<SessionResponse>(BACKEND_AUTH_ENDPOINTS.login, {
        email,
        password,
      });
      return applySession(session)!;
    },

    async signUpWithEmail(input) {
      const session = await post<SessionResponse>(BACKEND_AUTH_ENDPOINTS.register, input);
      return applySession(session)!;
    },

    async sendPasswordReset(email) {
      await post<void>(BACKEND_AUTH_ENDPOINTS.passwordReset, { email });
    },

    async signOut() {
      try {
        await post<void>(BACKEND_AUTH_ENDPOINTS.logout);
      } catch (error) {
        console.warn('[auth] Logout request failed; clearing local session anyway.', error);
      }
      applySession(null);
    },

    async getAccessToken(opts) {
      await init();
      if (!user) return null;
      const expiringSoon = expiresAt > 0 && Date.now() > expiresAt - EXPIRY_MARGIN_MS;
      if (opts?.forceRefresh || (accessToken && expiringSoon)) {
        await refresh();
      }
      return accessToken;
    },
  };
}
