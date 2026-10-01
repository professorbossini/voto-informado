import { AuthError } from '../errors';

/**
 * Minimal loader for Google Identity Services (GIS) using the OAuth 2.0
 * authorization-code flow in a popup. Unlike the "Sign in with Google"
 * rendered button, this lets us keep a fully custom-styled button.
 * The returned code must be exchanged by YOUR backend (it holds the client secret).
 */

interface CodeResponse {
  code?: string;
  error?: string;
  error_description?: string;
}

interface CodeClient {
  requestCode(): void;
}

interface GoogleAccountsOauth2 {
  initCodeClient(config: {
    client_id: string;
    scope: string;
    ux_mode: 'popup';
    select_account?: boolean;
    callback: (response: CodeResponse) => void;
    error_callback?: (error: { type: string; message?: string }) => void;
  }): CodeClient;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleAccountsOauth2 } };
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let loader: Promise<GoogleAccountsOauth2> | null = null;

export function loadGoogleIdentity(): Promise<GoogleAccountsOauth2> {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google.accounts.oauth2);
  loader ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new AuthError('config', 'Google Identity Services loaded without oauth2.'));
    };
    script.onerror = () => {
      loader = null;
      reject(new AuthError('network', 'Could not load Google Identity Services.'));
    };
    document.head.appendChild(script);
  });
  return loader;
}

/** Opens the Google account chooser and resolves with a one-time authorization code. */
export async function requestGoogleAuthCode(clientId: string): Promise<string> {
  const oauth2 = await loadGoogleIdentity();
  return new Promise((resolve, reject) => {
    const client = oauth2.initCodeClient({
      client_id: clientId,
      scope: 'openid email profile',
      ux_mode: 'popup',
      select_account: true,
      callback: (response) => {
        if (response.code) resolve(response.code);
        else if (response.error === 'access_denied') reject(new AuthError('cancelled'));
        else reject(new AuthError('unknown', response.error_description ?? response.error));
      },
      error_callback: (error) => {
        if (error.type === 'popup_closed') reject(new AuthError('cancelled'));
        else if (error.type === 'popup_failed_to_open') reject(new AuthError('popup-blocked'));
        else reject(new AuthError('unknown', error.message ?? error.type));
      },
    });
    client.requestCode();
  });
}
