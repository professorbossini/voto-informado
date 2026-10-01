/**
 * Tiny, dependency-free HTTP client for talking to your API.
 *
 * - Attaches `Authorization: Bearer <token>` from the active auth adapter.
 * - Sends cookies (`credentials: 'include'`) so cookie-based sessions work too.
 * - On 401, forces a token refresh and retries once; if it fails again,
 *   calls `onUnauthorized` (the app signs the user out).
 * - Serializes JSON bodies, parses JSON/text responses, supports timeouts.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  get isUnauthorized() {
    return this.status === 401;
  }
}

export type QueryParams = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  body?: unknown;
  query?: QueryParams;
  /** Abort after this many ms. Defaults to the client's timeout. */
  timeoutMs?: number;
  /** Set to false for public endpoints that must not receive the token. */
  auth?: boolean;
}

export interface ApiClientOptions {
  baseUrl: string | null;
  getAccessToken?: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
  onUnauthorized?: () => void;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export type ApiClient = ReturnType<typeof createApiClient>;

function buildUrl(baseUrl: string, path: string, query?: QueryParams) {
  const url = /^https?:\/\//.test(path)
    ? path
    : `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null) params.append(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

function isRawBody(body: unknown): body is BodyInit {
  return (
    typeof body === 'string' ||
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof URLSearchParams ||
    body instanceof ArrayBuffer
  );
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return response.json().catch(() => undefined);
  const text = await response.text();
  return text || undefined;
}

export function createApiClient(options: ApiClientOptions) {
  const { baseUrl, getAccessToken, onUnauthorized, timeoutMs: defaultTimeout = 15_000 } = options;
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function send(method: string, path: string, opts: RequestOptions, retried: boolean) {
    if (!baseUrl) {
      throw new ApiError(0, 'VITE_API_URL is not configured.');
    }
    const { body, query, timeoutMs = defaultTimeout, auth = true, headers, signal, ...init } = opts;

    const finalHeaders = new Headers(headers);
    finalHeaders.set('Accept', 'application/json');
    let finalBody: BodyInit | undefined;
    if (body !== undefined) {
      if (isRawBody(body)) {
        finalBody = body;
      } else {
        finalBody = JSON.stringify(body);
        finalHeaders.set('Content-Type', 'application/json');
      }
    }

    if (auth && getAccessToken) {
      const token = await getAccessToken({ forceRefresh: retried });
      if (token) finalHeaders.set('Authorization', `Bearer ${token}`);
    }

    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const finalSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;

    let response: Response;
    try {
      response = await doFetch(buildUrl(baseUrl, path, query), {
        credentials: 'include',
        ...init,
        method,
        headers: finalHeaders,
        body: finalBody,
        signal: finalSignal,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'TimeoutError') {
        throw new ApiError(0, `Request timed out after ${timeoutMs}ms.`);
      }
      if (error instanceof DOMException && error.name === 'AbortError') throw error;
      throw new ApiError(0, 'Network error: could not reach the API.', error);
    }

    if (response.status === 401 && auth && !retried) {
      return send(method, path, opts, true);
    }

    const data = await parseBody(response);
    if (!response.ok) {
      if (response.status === 401 && auth) onUnauthorized?.();
      const message =
        data && typeof data === 'object' && 'message' in data
          ? String(data.message)
          : `HTTP ${response.status}`;
      throw new ApiError(response.status, message, data);
    }
    return data;
  }

  const request = <T>(method: string, path: string, opts: RequestOptions = {}) =>
    send(method, path, opts, false) as Promise<T>;

  return {
    request,
    get: <T>(path: string, opts?: RequestOptions) => request<T>('GET', path, opts),
    post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('POST', path, { ...opts, body }),
    put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PUT', path, { ...opts, body }),
    patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
      request<T>('PATCH', path, { ...opts, body }),
    delete: <T>(path: string, opts?: RequestOptions) => request<T>('DELETE', path, opts),
  };
}
