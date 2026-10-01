import { env, type AppEnv } from '@/config/env';
import type { AuthAdapter } from '../types';

/**
 * Creates the adapter selected by VITE_AUTH_PROVIDER.
 * Adapters are loaded lazily, so the Firebase SDK is only downloaded when used.
 */
export async function createAuthAdapter(config: AppEnv = env): Promise<AuthAdapter> {
  switch (config.authProvider) {
    case 'firebase': {
      const { createFirebaseAdapter } = await import('./firebase');
      return createFirebaseAdapter(config.firebase);
    }
    case 'backend': {
      const { createBackendAdapter } = await import('./backend');
      return createBackendAdapter({
        apiUrl: config.apiUrl!,
        googleClientId: config.googleClientId,
      });
    }
    case 'mock':
    default: {
      const { createMockAdapter } = await import('./mock');
      return createMockAdapter();
    }
  }
}
