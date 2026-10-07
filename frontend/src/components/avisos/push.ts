import { isNativeApp } from '@/native/platform';

/** Worker que guarda as inscrições e envia os avisos (infra/cloudflare/avisos). */
export const AVISOS = (import.meta.env.VITE_AVISOS_URL as string | undefined) || 'https://tanaurna-avisos.insta-publisher.workers.dev';

/** Notificações do navegador (Web Push) disponíveis aqui? (o app Android não tem). */
export const pushSuportado = () =>
  !isNativeApp && typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const chaveBytes = (b64: string) => Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4)), (c) => c.charCodeAt(0));

/** Pede permissão (se preciso) e devolve a inscrição de push deste navegador; null se negada. */
export async function inscricaoPush(): Promise<PushSubscription | null> {
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') return null;
  const reg = await navigator.serviceWorker.register('/sw-avisos.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const atual = await reg.pushManager.getSubscription();
  if (atual) return atual;
  const { publica } = (await (await fetch(`${AVISOS}/chave`)).json()) as { publica: string };
  return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chaveBytes(publica) });
}

/** Inscrição já existente (sem pedir nada). */
export async function inscricaoAtual(): Promise<PushSubscription | null> {
  if (!pushSuportado()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function postar(caminho: string, corpo: unknown): Promise<Response> {
  return fetch(`${AVISOS}${caminho}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
}
