import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { useAuth } from '@/auth';
import { isNativeApp } from '@/native/platform';

/**
 * Registro de visitas (Worker tanaurna-visitas, infra/cloudflare/visitas): cada página vista no site
 * manda só o caminho (sem query nem fragmento) e a origem de onde a pessoa veio. IP, local aproximado e
 * navegador o Worker lê da própria conexão. Com login, o token serve só para marcar "com login": a conta
 * não é guardada. Política de Privacidade, item 7. Nunca no app nem no desenvolvimento.
 */
export const VISITAS_URL = (
  (import.meta.env.VITE_VISITAS_URL as string | undefined) ||
  'https://tanaurna-visitas.insta-publisher.workers.dev'
).replace(/\/+$/, '');

const ativo = !isNativeApp && (import.meta.env.PROD || Boolean(import.meta.env.VITE_VISITAS_URL));

/** "/candidato/1?x#y" → "/candidato/1". */
export const caminhoLimpo = (c: string) => c.split(/[?#]/)[0] || '/';

interface Dicas {
  platform?: string;
  platformVersion?: string;
  model?: string;
  marcas?: { brand: string; version: string }[];
}

interface UADataHE {
  getHighEntropyValues(
    h: string[],
  ): Promise<{
    platform?: string;
    platformVersion?: string;
    model?: string;
    fullVersionList?: { brand: string; version: string }[];
  }>;
}

let dicasPromessa: Promise<Dicas | null> | null = null;

/**
 * Client Hints (Chrome, Edge, Opera...): versão exata do sistema (Windows 10 ou 11, macOS 15.1), modelo do
 * Android e versão completa do navegador, que o user agent não traz. Pedido uma vez por carregamento;
 * Firefox e Safari não têm a API e mandam nada (o Worker usa o user agent).
 */
export function dicasDoNavegador(): Promise<Dicas | null> {
  dicasPromessa ??= (async () => {
    const ua = (navigator as Navigator & { userAgentData?: UADataHE }).userAgentData;
    if (!ua?.getHighEntropyValues) return null;
    try {
      const v = await ua.getHighEntropyValues([
        'platform',
        'platformVersion',
        'fullVersionList',
        'model',
      ]);
      return {
        platform: v.platform,
        platformVersion: v.platformVersion,
        model: v.model || undefined,
        marcas: v.fullVersionList?.slice(0, 6),
      };
    } catch {
      return null;
    }
  })();
  return dicasPromessa;
}

/** As dicas, sem segurar o registro da visita mais que ~300 ms. */
const dicasRapidas = () =>
  Promise.race([dicasDoNavegador(), new Promise<null>((r) => setTimeout(() => r(null), 300))]);

async function registrar(caminho: string, origem: string, token: string | null) {
  try {
    const dicas = await dicasRapidas();
    await fetch(`${VISITAS_URL}/visita`, {
      method: 'POST',
      keepalive: true,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ caminho: caminhoLimpo(caminho), origem, ...(dicas ? { dicas } : {}) }),
    });
  } catch {
    /* bloqueador ou rede: a visita só não é contada */
  }
}

/** Conta cada página vista: o carregamento e cada troca de rota (mudança só de query não conta). */
export function RegistroDeVisitas() {
  const { pathname } = useLocation();
  const { status, getAccessToken } = useAuth();
  const pronto = status !== 'loading';
  useEffect(() => {
    if (!ativo || !pronto) return;
    // Na primeira página vale o referrer do navegador; depois, a navegação é dentro do próprio site.
    const origem = primeira ? document.referrer : '';
    primeira = false;
    void (async () => {
      const token = status === 'authenticated' ? await getAccessToken().catch(() => null) : null;
      await registrar(pathname, origem, token);
    })();
    // status/getAccessToken mudam no login; a página vista é a mesma.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, pronto]);
  return null;
}
let primeira = true;

/** Chamada autenticada ao Worker de visitas (página Visitas do admin). */
export async function pedirVisitas<T>(
  caminho: string,
  token: string,
): Promise<{ status: number; dados: T | null }> {
  const r = await fetch(`${VISITAS_URL}${caminho}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  return { status: r.status, dados: r.ok ? ((await r.json()) as T) : null };
}

/** A pessoa logada é admin? (pergunta ao Worker, que confere o e-mail verificado do Google). */
export function useEhAdmin(): boolean {
  const { status, user, getAccessToken } = useAuth();
  const [admin, setAdmin] = useState<{ id: string; ok: boolean } | null>(null);
  const id = status === 'authenticated' ? (user?.id ?? null) : null;
  useEffect(() => {
    if (!id || isNativeApp) return;
    let vivo = true;
    void (async () => {
      try {
        const token = await getAccessToken();
        if (!token) return;
        const { dados } = await pedirVisitas<{ admin: boolean }>('/eu', token);
        if (vivo) setAdmin({ id, ok: Boolean(dados?.admin) });
      } catch {
        /* sem resposta: não mostra o link */
      }
    })();
    return () => {
      vivo = false;
    };
  }, [id, getAccessToken]);
  return Boolean(id && admin?.id === id && admin.ok);
}
