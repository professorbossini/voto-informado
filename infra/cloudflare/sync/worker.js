/**
 * Gravação no R2 do site (Cloudflare Worker "tanaurna-sync"), para as automações do GitHub Actions.
 *
 * Só atende quem apresentar um token OIDC emitido pelo GitHub Actions para o repositório
 * professorbossini/voto-informado (audience "tanaurna-r2"), conferido com as chaves públicas do
 * GitHub: nenhuma senha guardada em lugar nenhum. O R2 fica ligado ao Worker (binding SITE).
 *
 *   GET    /list?prefix=<p>&cursor=<c>   → {objects:[{key,size,etag}], cursor, truncated}
 *   GET    /obj/<chave>                 → conteúdo
 *   PUT    /obj/<chave>                 → grava (Content-Type do pedido)
 *   DELETE /obj/<chave>                 → apaga
 *
 * Publicado pela API da Cloudflare (conta do projeto), como módulo ES, com o binding SITE →
 * bucket tanaurna-site.
 */
const REPOSITORIO = 'professorbossini/voto-informado';
const AUDIENCIA = 'tanaurna-r2';
const EMISSOR = 'https://token.actions.githubusercontent.com';

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

const resposta = (corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(req, env) {
    const auth = req.headers.get('authorization') || '';
    if (!(await tokenValido(auth.replace(/^Bearer\s+/i, '')))) return resposta({ erro: 'não autorizado' }, 401);
    const url = new URL(req.url);
    if (url.pathname === '/list' && req.method === 'GET') {
      const r = await env.SITE.list({ prefix: url.searchParams.get('prefix') || undefined, cursor: url.searchParams.get('cursor') || undefined, limit: 1000 });
      return resposta({ objects: r.objects.map((o) => ({ key: o.key, size: o.size, etag: o.etag })), cursor: r.truncated ? r.cursor : null, truncated: r.truncated });
    }
    if (!url.pathname.startsWith('/obj/')) return resposta({ erro: 'rota desconhecida' }, 404);
    const chave = decodeURIComponent(url.pathname.slice(5));
    if (!chave || chave.includes('..')) return resposta({ erro: 'chave inválida' }, 400);
    if (req.method === 'GET') {
      const o = await env.SITE.get(chave);
      if (!o) return resposta({ erro: 'não encontrado' }, 404);
      return new Response(o.body, { headers: { 'content-type': o.httpMetadata?.contentType || 'application/octet-stream', etag: o.httpEtag } });
    }
    if (req.method === 'PUT') {
      const o = await env.SITE.put(chave, req.body, { httpMetadata: { contentType: req.headers.get('content-type') || 'application/octet-stream' } });
      return resposta({ key: o.key, etag: o.etag, size: o.size });
    }
    if (req.method === 'DELETE') {
      await env.SITE.delete(chave);
      return resposta({ key: chave, apagado: true });
    }
    return resposta({ erro: 'método não permitido' }, 405);
  },
};
