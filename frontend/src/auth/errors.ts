export type AuthErrorCode =
  | 'cancelled'
  | 'popup-blocked'
  | 'invalid-credentials'
  | 'email-in-use'
  | 'weak-password'
  | 'invalid-email'
  | 'user-disabled'
  | 'too-many-requests'
  | 'network'
  | 'not-supported'
  | 'unauthorized-domain'
  | 'config'
  | 'unknown';

/** Normalized error thrown by every adapter so the UI never deals with SDK-specific codes. */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly cause?: unknown;

  constructor(code: AuthErrorCode, message?: string, cause?: unknown) {
    super(message ?? code);
    this.name = 'AuthError';
    this.code = code;
    this.cause = cause;
  }
}

/** User-facing messages (pt-BR). Translate here to localize the whole auth flow. */
const MESSAGES: Record<AuthErrorCode, string> = {
  cancelled: 'Login cancelado.',
  'popup-blocked': 'O navegador bloqueou a janela do Google. Permita pop-ups e tente de novo.',
  'invalid-credentials': 'E-mail ou senha incorretos.',
  'email-in-use': 'Já existe uma conta com este e-mail.',
  'weak-password': 'A senha precisa ter pelo menos 8 caracteres.',
  'invalid-email': 'Digite um e-mail válido.',
  'user-disabled': 'Esta conta foi desativada.',
  'too-many-requests': 'Muitas tentativas. Aguarde um pouco e tente novamente.',
  network: 'Sem conexão com o servidor. Verifique sua internet.',
  'not-supported': 'Este método de login não está disponível.',
  'unauthorized-domain': 'Este domínio não está autorizado no provedor de login.',
  config: 'O login não está configurado corretamente. Veja o console.',
  unknown: 'Algo deu errado. Tente novamente.',
};

export function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error;
  if (error instanceof TypeError && /fetch|network/i.test(error.message)) {
    return new AuthError('network', error.message, error);
  }
  return new AuthError('unknown', error instanceof Error ? error.message : String(error), error);
}

export function getAuthErrorMessage(error: unknown): string {
  return MESSAGES[toAuthError(error).code];
}

export function notSupported(feature: string): never {
  throw new AuthError('not-supported', `${feature} is not supported by this auth adapter.`);
}
