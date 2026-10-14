import { useSyncExternalStore } from 'react';
import { isNativeApp } from '@/native/platform';

/**
 * Medição de audiência com o Google Analytics 4, só no site e só com consentimento (LGPD).
 * Nada do Google é carregado antes de a pessoa clicar em "Aceitar" no aviso; ao recusar (ou
 * revogar no rodapé), os cookies _ga são apagados. Sinais do Google e personalização de
 * anúncios ficam desligados: só números agregados (visitas, páginas, compartilhamentos).
 * ID do fluxo em VITE_GA_ID (público por natureza); sem ID, ou no app, nada acontece.
 */

const ID = (import.meta.env.VITE_GA_ID as string | undefined)?.trim() || '';
const CHAVE = 'vi:medicao';

export type Escolha = 'aceito' | 'recusado';

/** Há medição para oferecer (site com ID configurado; nunca no app). */
export const medicaoDisponivel = Boolean(ID) && !isNativeApp;

type Gtag = (...args: unknown[]) => void;
declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
  }
}

let carregado = false;
let avisoAberto = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

export function escolhaSalva(): Escolha | null {
  try {
    const v = localStorage.getItem(CHAVE);
    return v === 'aceito' || v === 'recusado' ? v : null;
  } catch {
    return null;
  }
}

function gtag(...args: unknown[]) {
  window.gtag?.(...args);
}

function carregar() {
  if (carregado || !medicaoDisponivel) return;
  carregado = true;
  window.dataLayer = window.dataLayer || [];
  // O gtag.js lê o objeto "arguments", não um array: por isso a função clássica.
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments);
  };
  gtag('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  gtag('js', new Date());
  gtag('config', ID, { send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false });
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ID)}`;
  document.head.appendChild(s);
}

/** Apaga os cookies do Google Analytics (_ga, _ga_XXXX) do domínio do site. */
function apagarCookies() {
  const dominio = location.hostname.replace(/^www\./, '');
  for (const c of document.cookie.split(';')) {
    const nome = c.split('=')[0]?.trim();
    if (!nome || !/^_ga/.test(nome)) continue;
    for (const d of ['', `; domain=.${dominio}`, `; domain=${location.hostname}`]) document.cookie = `${nome}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d}`;
  }
}

export function escolher(e: Escolha) {
  try {
    localStorage.setItem(CHAVE, e);
  } catch {
    /* sem armazenamento: vale só nesta visita */
  }
  avisoAberto = false;
  if (e === 'aceito') {
    const antes = carregado;
    carregar();
    // A página em que a pessoa aceitou também conta (a contagem dela, antes do aceite, foi descartada).
    if (!antes) {
      const h1 = document.querySelector('main h1')?.textContent?.trim();
      paginaVista(`${location.pathname}${location.search}`, h1 ? `${h1} · Tá na Urna` : document.title);
    }
  } else {
    if (carregado) gtag('consent', 'update', { analytics_storage: 'denied' });
    apagarCookies();
  }
  avisar();
}

/** Reabre o aviso (link "Preferências de medição" no rodapé). */
export function abrirPreferencias() {
  avisoAberto = true;
  avisar();
}

/** O aviso aparece na primeira visita (sem escolha) e quando reaberto pelo rodapé. */
export function useAvisoMedicao() {
  return useSyncExternalStore(
    (f) => {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    () => medicaoDisponivel && (avisoAberto || escolhaSalva() == null),
    () => false,
  );
}

/** Página vista (o site é de página única: cada troca de rota conta). */
export function paginaVista(caminho: string, titulo: string) {
  if (!carregado) return;
  gtag('event', 'page_view', { page_location: location.origin + caminho, page_path: caminho, page_title: titulo });
}

/** Evento agregado (ex.: compartilhamento). Nunca dados pessoais. */
export function evento(nome: string, parametros: Record<string, string | number> = {}) {
  if (!carregado) return;
  gtag('event', nome, parametros);
}

// Quem já aceitou antes: carrega ao abrir o site.
if (typeof window !== 'undefined' && escolhaSalva() === 'aceito') carregar();
