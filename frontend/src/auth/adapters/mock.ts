import { AuthError } from '../errors';
import type { AuthAdapter, AuthStateListener, AuthUser, SignUpInput } from '../types';

const STORAGE_KEY = 'faisca.mock-session';

/** Simulated network latency so loading states are visible while designing screens. */
const LATENCY_MS = 700;

const GOOGLE_DEMO_USER: AuthUser = {
  id: 'mock-google-ana',
  email: 'ana.lima@exemplo.com',
  name: 'Ana Lima',
  photoUrl: null,
  emailVerified: true,
  signInMethod: 'google',
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function readSession(): AuthUser | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeSession(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode); the session just won't persist.
  }
}

function nameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? 'Pessoa';
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(' ');
}

function validateEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError('invalid-email');
}

/**
 * Development-only adapter: fakes every flow locally so the template runs
 * with zero configuration. Tips for testing the UI:
 * - any e-mail containing "erro" fails with invalid credentials;
 * - passwords shorter than 8 characters fail on sign up.
 */
export function createMockAdapter(options: { latencyMs?: number } = {}): AuthAdapter {
  const latency = options.latencyMs ?? LATENCY_MS;
  const listeners = new Set<AuthStateListener>();
  let current: AuthUser | null = readSession();
  let ready = false;

  const setUser = (user: AuthUser | null) => {
    current = user;
    writeSession(user);
    listeners.forEach((listener) => listener(user));
  };

  return {
    id: 'mock',
    capabilities: { emailPassword: true, signUp: true, passwordReset: true },

    onAuthStateChanged(listener) {
      listeners.add(listener);
      if (ready) {
        listener(current);
      } else {
        // Simulates the provider restoring the session on page load.
        setTimeout(
          () => {
            ready = true;
            if (listeners.has(listener)) listener(current);
          },
          Math.min(latency, 400),
        );
      }
      return () => listeners.delete(listener);
    },

    async signInWithGoogle() {
      await wait(latency);
      setUser(GOOGLE_DEMO_USER);
      return GOOGLE_DEMO_USER;
    },

    async signInWithEmail(email, password) {
      await wait(latency);
      validateEmail(email);
      if (email.includes('erro') || !password) throw new AuthError('invalid-credentials');
      const user: AuthUser = {
        id: `mock-${email}`,
        email,
        name: nameFromEmail(email),
        photoUrl: null,
        emailVerified: false,
        signInMethod: 'password',
      };
      setUser(user);
      return user;
    },

    async signUpWithEmail({ name, email, password }: SignUpInput) {
      await wait(latency);
      validateEmail(email);
      if (password.length < 8) throw new AuthError('weak-password');
      if (email.includes('erro')) throw new AuthError('email-in-use');
      const user: AuthUser = {
        id: `mock-${email}`,
        email,
        name: name.trim() || nameFromEmail(email),
        photoUrl: null,
        emailVerified: false,
        signInMethod: 'password',
      };
      setUser(user);
      return user;
    },

    async sendPasswordReset(email) {
      await wait(latency);
      validateEmail(email);
    },

    async signOut() {
      await wait(latency / 3);
      setUser(null);
    },

    async getAccessToken() {
      if (!current) return null;
      const payload = btoa(JSON.stringify({ sub: current.id, email: current.email }));
      return `mock.${payload}.signature`;
    },
  };
}
