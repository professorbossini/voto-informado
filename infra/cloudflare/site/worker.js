/**
 * Site do Tá na Urna (Cloudflare Worker "tanaurna-site"): serve www.tanaurna.com.br a partir do R2
 * (binding SITE → bucket tanaurna-site), que guarda o site inteiro: interface (index.html, assets/),
 * dados (api/), fotos, PDFs das propostas e as páginas por rota.
 *
 * Igual ao GitHub Pages de antes, com algumas melhorias:
 *  - caminho → objeto ("/", "/plenario", "/stf/x/" → .../index.html); inexistente → a interface com
 *    status 404 (o React mostra a página de "não encontrado"), como o 404.html do Pages;
 *  - páginas por rota (prévia de link: título, descrição, og:*) usam SEMPRE a interface atual: o
 *    Worker copia os metadados da página da rota para o index.html mais recente, então publicar a
 *    interface não exige regravar as ~22 mil páginas;
 *  - cache na borda da Cloudflare (Cache API) e no navegador: arquivos com hash (assets/) por 1 ano;
 *    fotos e PDFs por 1 dia; dados e páginas por 10 min (como o Pages);
 *  - ETag/304, Range (PDFs), CORS aberto (dados públicos, usados pelo app e pelo desenvolvimento);
 *  - cabeçalhos de segurança (os do _headers) e HSTS;
 *  - tanaurna.com.br → www.tanaurna.com.br (301).
 */

const SEGURANCA = {
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000',
  'Access-Control-Allow-Origin': '*',
};

function cacheDe(chave) {
  if (chave.startsWith('assets/')) return 'public, max-age=31536000, immutable';
  if (/^(fotos|propostas|img)\//.test(chave) || /\/(fotos|logos|presidentes)\//.test(chave)) return 'public, max-age=86400';
  return 'public, max-age=600';
}

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Copia título, descrição e og:/twitter: da página da rota para a interface atual. */
function comMetadados(atual, rota) {
  const titulo = /<title>([\s\S]*?)<\/title>/.exec(rota)?.[1];
  const descricao = /<meta\s+name="description"\s+content="([^"]*)"/.exec(rota)?.[1];
  const metas = rota.match(/<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g) ?? [];
  let html = atual.replace(/\s*<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*")[^>]*>/g, '');
  if (titulo != null) html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${titulo}</title>`);
  if (descricao != null) html = html.replace(/(<meta\s+name="description"\s+content=")[^"]*(")/, (_, a, b) => a + descricao + b);
  return html.replace('</head>', `    ${metas.join('\n    ')}\n  </head>`);
}

async function objeto(env, chave, req) {
  return env.SITE.get(chave, { onlyIf: req.headers, range: req.headers });
}

function cabecalhos(o, chave, extra = {}) {
  const h = new Headers(SEGURANCA);
  o.writeHttpMetadata(h);
  if (!h.get('content-type')) h.set('content-type', 'application/octet-stream');
  if (/\.(html|json|js|css|svg|txt|xml)$/.test(chave) && !/charset/.test(h.get('content-type'))) h.set('content-type', `${h.get('content-type')}; charset=utf-8`);
  h.set('etag', o.httpEtag);
  h.set('cache-control', cacheDe(chave));
  h.set('accept-ranges', 'bytes');
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return h;
}

async function servir(req, env) {
  const url = new URL(req.url);
  let caminho;
  try {
    caminho = decodeURIComponent(url.pathname);
  } catch {
    caminho = url.pathname;
  }
  let chave = caminho.replace(/^\/+/, '');
  if (chave === '' || chave.endsWith('/')) chave += 'index.html';
  if (chave.includes('..')) return new Response('Requisição inválida', { status: 400, headers: SEGURANCA });

  let o = await objeto(env, chave, req);
  // "/plenario" ou "/stf/x": a página da rota fica em .../index.html.
  if (!o && !/\.[a-z0-9]{1,5}$/i.test(chave)) {
    chave = `${chave}/index.html`;
    o = await objeto(env, chave, req);
  }

  if (!o) {
    const shell = await env.SITE.get('index.html');
    if (!shell) return new Response('Site em manutenção', { status: 503, headers: SEGURANCA });
    return new Response(req.method === 'HEAD' ? null : shell.body, {
      status: 404,
      headers: { ...SEGURANCA, 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=600' },
    });
  }

  // Página por rota: interface atual + metadados da rota.
  if (chave.endsWith('/index.html') && chave !== 'index.html' && 'body' in o && o.body) {
    const shell = await env.SITE.get('index.html');
    const html = shell ? comMetadados(await shell.text(), await o.text()) : await o.text();
    const h = cabecalhos(o, chave);
    h.delete('etag');
    h.set('content-type', 'text/html; charset=utf-8');
    return new Response(req.method === 'HEAD' ? null : html, { headers: h });
  }

  // Sem corpo: If-None-Match/If-Modified-Since satisfeito (304) ou pré-condição falhou.
  if (!('body' in o) || !o.body) {
    return new Response(null, { status: req.headers.get('if-none-match') || req.headers.get('if-modified-since') ? 304 : 412, headers: cabecalhos(o, chave) });
  }
  const h = cabecalhos(o, chave);
  let status = 200;
  if (o.range && req.headers.get('range')) {
    const ini = o.range.offset ?? 0;
    const tam = o.range.length ?? o.size - ini;
    h.set('content-range', `bytes ${ini}-${ini + tam - 1}/${o.size}`);
    h.set('content-length', String(tam));
    status = 206;
  }
  return new Response(req.method === 'HEAD' ? null : o.body, { status, headers: h });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.hostname === 'tanaurna.com.br') return Response.redirect(`https://www.tanaurna.com.br${url.pathname}${url.search}`, 301);
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...SEGURANCA, 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': '*', 'Access-Control-Max-Age': '86400' } });
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Método não permitido', { status: 405, headers: { ...SEGURANCA, Allow: 'GET, HEAD' } });

    // Cache na borda (só GET simples, sem Range/condicionais): chave = endereço completo.
    const simples = req.method === 'GET' && !req.headers.get('range') && !req.headers.get('if-none-match') && !req.headers.get('if-modified-since');
    const cache = caches.default;
    if (simples) {
      const salvo = await cache.match(req);
      if (salvo) return salvo;
    }
    const resp = await servir(req, env);
    if (simples && (resp.status === 200 || resp.status === 404)) ctx.waitUntil(cache.put(req, resp.clone()));
    return resp;
  },
};
