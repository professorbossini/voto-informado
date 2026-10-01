import { describe, expect, it, vi } from 'vitest';
import { AuthError } from '../errors';
import { createBackendAdapter } from './backend';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

const session = {
  user: { id: 'u1', email: 'ana@exemplo.com', name: 'Ana' },
  accessToken: 'access-1',
  expiresIn: 900,
};

function firstState(adapter: ReturnType<typeof createBackendAdapter>) {
  return new Promise((resolve) => {
    const off = adapter.onAuthStateChanged((user) => {
      off();
      resolve(user);
    });
  });
}

describe('backend adapter', () => {
  it('restores the session via /auth/refresh on startup', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, session));
    const adapter = createBackendAdapter({
      apiUrl: 'https://api.test',
      googleClientId: 'cid',
      fetchImpl,
    });

    await expect(firstState(adapter)).resolves.toMatchObject({
      id: 'u1',
      name: 'Ana',
      photoUrl: null,
    });
    expect(fetchImpl.mock.calls[0]![0]).toBe('https://api.test/auth/refresh');
    await expect(adapter.getAccessToken()).resolves.toBe('access-1');
  });

  it('starts signed out when the refresh cookie is missing', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(401));
    const adapter = createBackendAdapter({
      apiUrl: 'https://api.test',
      googleClientId: 'cid',
      fetchImpl,
    });

    await expect(firstState(adapter)).resolves.toBeNull();
    await expect(adapter.getAccessToken()).resolves.toBeNull();
  });

  it('maps API error codes on e-mail login', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(429, { code: 'too-many-requests', message: 'slow down' }));
    const adapter = createBackendAdapter({
      apiUrl: 'https://api.test',
      googleClientId: 'cid',
      fetchImpl,
    });
    await firstState(adapter);

    const error = await adapter.signInWithEmail('a@b.co', 'x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect((error as AuthError).code).toBe('too-many-requests');
  });

  it('forces a refresh when asked and dedupes concurrent calls', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(200, session))
      .mockResolvedValue(json(200, { ...session, accessToken: 'access-2' }));
    const adapter = createBackendAdapter({
      apiUrl: 'https://api.test',
      googleClientId: 'cid',
      fetchImpl,
    });
    await firstState(adapter);

    const tokens = await Promise.all([
      adapter.getAccessToken({ forceRefresh: true }),
      adapter.getAccessToken({ forceRefresh: true }),
    ]);
    expect(tokens).toEqual(['access-2', 'access-2']);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('clears the session on sign out even if the request fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(200, session))
      .mockRejectedValueOnce(new TypeError('offline'));
    const adapter = createBackendAdapter({
      apiUrl: 'https://api.test',
      googleClientId: 'cid',
      fetchImpl,
    });
    await firstState(adapter);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await adapter.signOut();
    await expect(adapter.getAccessToken()).resolves.toBeNull();
  });
});
