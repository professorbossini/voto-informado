import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApiClient } from './client';

const json = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('createApiClient', () => {
  it('attaches the bearer token and parses JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(200, { ok: true }));
    const api = createApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: async () => 'token-123',
      fetchImpl,
    });

    await expect(api.get('/me', { query: { page: 2, empty: undefined } })).resolves.toEqual({
      ok: true,
    });

    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(url).toBe('https://api.test/me?page=2');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token-123');
    expect(init.credentials).toBe('include');
  });

  it('serializes JSON bodies', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(201, { id: 1 }));
    const api = createApiClient({ baseUrl: 'https://api.test', fetchImpl });

    await api.post('/projects', { name: 'X' });

    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"name":"X"}');
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
  });

  it('refreshes the token and retries once on 401', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(401))
      .mockResolvedValueOnce(json(200, [1]));
    const getAccessToken = vi.fn(async (opts?: { forceRefresh?: boolean }) =>
      opts?.forceRefresh ? 'fresh' : 'stale',
    );
    const api = createApiClient({ baseUrl: 'https://api.test', getAccessToken, fetchImpl });

    await expect(api.get('/projects')).resolves.toEqual([1]);
    expect(getAccessToken).toHaveBeenLastCalledWith({ forceRefresh: true });
    expect(new Headers(fetchImpl.mock.calls[1]![1].headers).get('Authorization')).toBe(
      'Bearer fresh',
    );
  });

  it('calls onUnauthorized when the retry still fails', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(401, { message: 'expired' }));
    const onUnauthorized = vi.fn();
    const api = createApiClient({
      baseUrl: 'https://api.test',
      getAccessToken: async () => 't',
      onUnauthorized,
      fetchImpl,
    });

    const error = await api.get('/me').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe('expired');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('skips the token for public endpoints', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json(204));
    const getAccessToken = vi.fn(async () => 't');
    const api = createApiClient({ baseUrl: 'https://api.test', getAccessToken, fetchImpl });

    await expect(api.get('/health', { auth: false })).resolves.toBeUndefined();
    expect(getAccessToken).not.toHaveBeenCalled();
  });

  it('wraps network failures in ApiError with status 0', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const api = createApiClient({ baseUrl: 'https://api.test', fetchImpl });
    await expect(api.get('/x')).rejects.toMatchObject({ name: 'ApiError', status: 0 });
  });

  it('fails clearly when no base URL is configured', async () => {
    const api = createApiClient({ baseUrl: null });
    await expect(api.get('/x')).rejects.toThrow(/VITE_API_URL/);
  });
});
