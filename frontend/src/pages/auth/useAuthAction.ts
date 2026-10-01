import { useState } from 'react';
import { AuthError, getAuthErrorMessage } from '@/auth';

/** Runs an auth action tracking loading/error; "cancelled" is not shown as an error. */
export function useAuthAction() {
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run<T>(key: string, action: () => Promise<T>): Promise<T | undefined> {
    setPending(key);
    setError(null);
    try {
      return await action();
    } catch (err) {
      if (!(err instanceof AuthError && err.code === 'cancelled')) {
        setError(getAuthErrorMessage(err));
        if (!(err instanceof AuthError) || err.code === 'unknown' || err.code === 'config') {
          console.error('[auth]', err);
        }
      }
      return undefined;
    } finally {
      setPending(null);
    }
  }

  return { pending, error, setError, run };
}
