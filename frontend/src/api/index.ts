import { env } from '@/config/env';
import { createApiClient } from './client';

export { ApiError, createApiClient, type ApiClient, type RequestOptions } from './client';

interface AuthBridge {
  getAccessToken: (options?: { forceRefresh?: boolean }) => Promise<string | null>;
  onUnauthorized: () => void;
}

let bridge: AuthBridge = {
  getAccessToken: async () => null,
  onUnauthorized: () => {},
};

/** Called by AuthProvider so the API client always uses the active session. */
export function connectApiToAuth(next: AuthBridge) {
  bridge = next;
}

/**
 * App-wide API client. Usage:
 *   const projects = await api.get<Project[]>('/projects');
 */
export const api = createApiClient({
  baseUrl: env.apiUrl,
  getAccessToken: (options) => bridge.getAccessToken(options),
  onUnauthorized: () => bridge.onUnauthorized(),
});
