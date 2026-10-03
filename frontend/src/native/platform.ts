import { Capacitor, registerPlugin } from '@capacitor/core';
import { env } from '@/config/env';
import { copyText } from '@/components/urna/clipboard';

/**
 * Bridges the few browser features that behave differently inside the Android/iOS apps
 * (Capacitor). On the website every helper falls back to the plain Web API.
 */
export const isNativeApp = Capacitor.isNativePlatform();

/** Public website address for a route, e.g. publicUrl('/candidato/123'). Never the app's local origin. */
export function publicUrl(path: string): string {
  const base = env.siteUrl || `${window.location.origin}${import.meta.env.BASE_URL}`.replace(/\/+$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}

export function canShare(): boolean {
  return isNativeApp || (typeof navigator !== 'undefined' && typeof navigator.share === 'function');
}

export type ShareOutcome = 'shared' | 'copied' | 'cancelled' | 'failed';

/** Native share sheet in the app, Web Share on the site, clipboard as the last resort. */
export async function shareContent(opts: { title: string; text?: string; url?: string }): Promise<ShareOutcome> {
  try {
    if (isNativeApp) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ ...opts, dialogTitle: opts.title });
      return 'shared';
    }
    if (typeof navigator.share === 'function') {
      await navigator.share(opts);
      return 'shared';
    }
  } catch {
    return 'cancelled';
  }
  return (await copyText(opts.url ?? opts.text ?? '')) ? 'copied' : 'failed';
}

/** Native helpers implemented in android/app/src/main/java/.../AparelhoPlugin.java. */
const Aparelho = registerPlugin<{
  imprimir(opts: { titulo: string }): Promise<void>;
  corDasBarras(opts: { cor: string }): Promise<void>;
}>('Aparelho');

export function canPrint(): boolean {
  return !isNativeApp || Capacitor.isPluginAvailable('Aparelho');
}

/** Browser print on the site; Android's print dialog (also "Salvar como PDF") in the app. */
export function printPage(titulo: string): void {
  if (isNativeApp) void Aparelho.imprimir({ titulo });
  else window.print();
}

/** Color behind the status/navigation bars, following the app's light/dark theme. */
export function setSystemBarsColor(cor: string): void {
  if (Capacitor.isPluginAvailable('Aparelho')) void Aparelho.corDasBarras({ cor }).catch(() => {});
}
