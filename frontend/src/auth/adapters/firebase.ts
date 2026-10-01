import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import type { FirebaseConfig } from '@/config/env';
import { AuthError, type AuthErrorCode } from '../errors';
import type { AuthAdapter, AuthUser } from '../types';

const FIREBASE_ERRORS: Record<string, AuthErrorCode> = {
  'auth/popup-closed-by-user': 'cancelled',
  'auth/cancelled-popup-request': 'cancelled',
  'auth/user-cancelled': 'cancelled',
  'auth/popup-blocked': 'popup-blocked',
  'auth/invalid-credential': 'invalid-credentials',
  'auth/invalid-login-credentials': 'invalid-credentials',
  'auth/wrong-password': 'invalid-credentials',
  'auth/user-not-found': 'invalid-credentials',
  'auth/email-already-in-use': 'email-in-use',
  'auth/account-exists-with-different-credential': 'email-in-use',
  'auth/weak-password': 'weak-password',
  'auth/invalid-email': 'invalid-email',
  'auth/missing-email': 'invalid-email',
  'auth/user-disabled': 'user-disabled',
  'auth/too-many-requests': 'too-many-requests',
  'auth/network-request-failed': 'network',
  'auth/unauthorized-domain': 'unauthorized-domain',
  'auth/operation-not-allowed': 'not-supported',
  'auth/invalid-api-key': 'config',
  'auth/api-key-not-valid': 'config',
  'auth/configuration-not-found': 'config',
};

function mapError(error: unknown): AuthError {
  const code = (error as { code?: string } | null)?.code ?? '';
  const message = error instanceof Error ? error.message : String(error);
  return new AuthError(FIREBASE_ERRORS[code] ?? 'unknown', message, error);
}

function toAuthUser(user: User): AuthUser {
  const providerId = user.providerData[0]?.providerId;
  return {
    id: user.uid,
    email: user.email,
    name: user.displayName,
    photoUrl: user.photoURL,
    emailVerified: user.emailVerified,
    signInMethod:
      providerId === 'google.com' ? 'google' : providerId === 'password' ? 'password' : 'unknown',
  };
}

/**
 * Firebase Authentication adapter (recommended default for real projects).
 * Sessions persist across reloads and ID tokens refresh automatically.
 * Your API validates the token with the Firebase Admin SDK or any JWT library
 * (see docs/backend-contract.md).
 */
export function createFirebaseAdapter(config: FirebaseConfig): AuthAdapter {
  const app: FirebaseApp = getApps()[0] ?? initializeApp(config);
  const auth = getAuth(app);
  auth.languageCode = navigator.language || 'pt-BR';

  const googleProvider = new GoogleAuthProvider();
  googleProvider.setCustomParameters({ prompt: 'select_account' });

  // Completes a pending redirect sign-in (fallback used when popups are blocked).
  getRedirectResult(auth).catch((error: unknown) => {
    console.error('[auth] Redirect sign-in failed:', mapError(error));
  });

  return {
    id: 'firebase',
    capabilities: { emailPassword: true, signUp: true, passwordReset: true },

    onAuthStateChanged(listener) {
      return onAuthStateChanged(auth, (user) => listener(user ? toAuthUser(user) : null));
    },

    async signInWithGoogle() {
      try {
        const credential = await signInWithPopup(auth, googleProvider);
        return toAuthUser(credential.user);
      } catch (error) {
        const mapped = mapError(error);
        if (mapped.code === 'popup-blocked') {
          await signInWithRedirect(auth, googleProvider);
          // The browser navigates away; this promise intentionally never settles.
          return new Promise<AuthUser>(() => {});
        }
        throw mapped;
      }
    },

    async signInWithEmail(email, password) {
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        return toAuthUser(credential.user);
      } catch (error) {
        throw mapError(error);
      }
    },

    async signUpWithEmail({ name, email, password }) {
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password);
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
          await credential.user.reload();
        }
        return toAuthUser(auth.currentUser ?? credential.user);
      } catch (error) {
        throw mapError(error);
      }
    },

    async sendPasswordReset(email) {
      try {
        await sendPasswordResetEmail(auth, email);
      } catch (error) {
        const mapped = mapError(error);
        // Don't reveal whether an account exists for this e-mail.
        if (mapped.code === 'invalid-credentials') return;
        throw mapped;
      }
    },

    async signOut() {
      await signOut(auth);
    },

    async getAccessToken(options) {
      const user = auth.currentUser;
      return user ? user.getIdToken(options?.forceRefresh ?? false) : null;
    },
  };
}
