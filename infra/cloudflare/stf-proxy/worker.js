/**
 * Intermediário (Cloudflare Worker "tanaurna-stf") para o GitHub Actions ler páginas PÚBLICAS do STF.
 *
 * Os portais do STF recusam conexões vindas dos servidores do GitHub (403), mas aceitam a rede da
 * Cloudflare. O etl/stf.py, rodando no stf.yml, pede aqui cada endereço do STF.
 *
 * Segurança: só atende quem apresentar um token OIDC emitido pelo próprio GitHub Actions para o
 * repositório professorbossini/voto-informado (assinatura conferida com as chaves públicas do
 * GitHub; nada de senha guardada), e só abre endereços dos domínios do STF listados abaixo.
 *
 * Uso: GET https://tanaurna-stf.<subdomínio>.workers.dev/?url=<endereço do STF>
 *      Authorization: Bearer <token OIDC, audience "tanaurna-stf">
 * WebSocket (painel de transparência): o mesmo, com url=wss://transparencia.stf.jus.br/...
 *
 * Publicado pela API da Cloudflare (conta do projeto). Para atualizar, publique este arquivo como
 * módulo ES no script "tanaurna-stf".
 */
const PERMITIDOS = new Set(['portal.stf.jus.br', 'www.stf.jus.br', 'transparencia.stf.jus.br']);
const REPOSITORIO = 'professorbossini/voto-informado';
const AUDIENCIA = 'tanaurna-stf';
const EMISSOR = 'https://token.actions.githubusercontent.com';
const REPASSAR = [
  'user-agent', 'accept', 'accept-language', 'cookie', 'referer', 'origin', 'x-requested-with', 'x-csrf-token',
  'upgrade', 'connection', 'sec-websocket-key', 'sec-websocket-version', 'sec-websocket-protocol', 'sec-websocket-extensions',
];

let chaves = null;
let chavesEm = 0;

const b64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0));
const json = (s) => JSON.parse(new TextDecoder().decode(b64url(s)));

async function tokenValido(token) {
  const partes = (token || '').split('.');
  if (partes.length !== 3) return false;
  let cab, dados;
  try {
    cab = json(partes[0]);
    dados = json(partes[1]);
  } catch {
    return false;
  }
  if (cab.alg !== 'RS256') return false;
  const agora = Math.floor(Date.now() / 1000);
  if (dados.iss !== EMISSOR || dados.aud !== AUDIENCIA || dados.repository !== REPOSITORIO) return false;
  if (!(dados.exp > agora) || (dados.nbf && dados.nbf > agora + 60)) return false;
  if (!chaves || Date.now() - chavesEm > 3_600_000) {
    chaves = (await (await fetch(`${EMISSOR}/.well-known/jwks`)).json()).keys;
    chavesEm = Date.now();
  }
  const jwk = chaves.find((k) => k.kid === cab.kid);
  if (!jwk) return false;
  const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, b64url(partes[2]), new TextEncoder().encode(`${partes[0]}.${partes[1]}`));
}

export default {
  async fetch(req) {
    const auth = req.headers.get('authorization') || '';
    if (!(await tokenValido(auth.replace(/^Bearer\s+/i, '')))) return new Response('não autorizado', { status: 401 });
    let alvo;
    try {
      alvo = new URL(new URL(req.url).searchParams.get('url') || '');
    } catch {
      return new Response('url inválida', { status: 400 });
    }
    if (!PERMITIDOS.has(alvo.hostname)) return new Response('domínio não permitido', { status: 403 });
    if (alvo.protocol === 'wss:') alvo.protocol = 'https:';
    if (alvo.protocol === 'ws:') alvo.protocol = 'http:';
    const cab = new Headers();
    for (const h of REPASSAR) {
      const v = req.headers.get(h);
      if (v) cab.set(h, v);
    }
    if (req.method !== 'GET') return new Response('só GET', { status: 405 });
    // WebSocket: devolver a resposta do fetch repassa a conexão inteira.
    if ((req.headers.get('upgrade') || '').toLowerCase() === 'websocket') return fetch(alvo.toString(), { headers: cab });
    const r = await fetch(alvo.toString(), { headers: cab, redirect: 'follow' });
    return new Response(r.body, { status: r.status, headers: r.headers });
  },
};
