/**
 * Avisos de resultado do Tá na Urna (Cloudflare Worker "tanaurna-avisos", banco D1 binding DB).
 *
 * Quem pede (botão "Avisar o resultado" no site) recebe uma notificação do navegador quando o TSE
 * declarar o resultado da Presidência e do governo do seu estado. Guarda só o endereço de entrega
 * do navegador (Web Push) e os estados escolhidos: nenhum nome, e-mail ou CPF.
 *
 *   GET  /chave        → {publica}  chave pública VAPID (gerada aqui dentro na 1ª vez; a privada
 *                        nunca sai do D1)
 *   POST /inscrever    {endpoint, keys:{p256dh,auth}, ufs:["BR","SP"]}  → grava e manda um aviso
 *                        de confirmação
 *   POST /cancelar     {endpoint} → apaga
 *   POST /seguir       {endpoint, keys, alvos:["parlamentar:camara-1", "partido:pt", "ministro:x"]}
 *                        → troca a lista de quem este navegador acompanha (máx. 100)
 *   POST /novidades    (só GitHub Actions deste repositório, token OIDC "tanaurna-avisos")
 *                        {itens:[{alvo, chave, titulo, corpo, url}]} → avisa quem acompanha cada alvo,
 *                        uma vez por chave
 *   cron (dias de eleição, a cada 5 min): lê no TSE a configuração (ele-c.json) e os arquivos de
 *   resultado; quando houver eleito (ou definição de 2º turno), avisa uma única vez cada disputa.
 */
import { enviar, novasChavesVapid } from './webpush.js';

const SITE = 'https://www.tanaurna.com.br';
const TSE = 'https://resultados.tse.jus.br/oficial';
const ORIGENS = [/^https:\/\/(www\.)?tanaurna\.com\.br$/, /^https:\/\/tanaurna-site\.insta-publisher\.workers\.dev$/, /^http:\/\/localhost(:\d+)?$/];
const SERVICOS_PUSH = /(^|\.)(fcm\.googleapis\.com|push\.services\.mozilla\.com|notify\.windows\.com|push\.apple\.com|web\.push\.apple\.com)$/;
const UFS = new Set('BR AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
const NOMES = {
  AC: 'Acre', AL: 'Alagoas', AM: 'Amazonas', AP: 'Amapá', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MG: 'Minas Gerais', MS: 'Mato Grosso do Sul', MT: 'Mato Grosso', PA: 'Pará', PB: 'Paraíba', PE: 'Pernambuco', PI: 'Piauí',
  PR: 'Paraná', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RO: 'Rondônia', RR: 'Roraima', RS: 'Rio Grande do Sul', SC: 'Santa Catarina',
  SE: 'Sergipe', SP: 'São Paulo', TO: 'Tocantins',
};

const ESQUEMA = [
  'CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT)',
  'CREATE TABLE IF NOT EXISTS inscricoes (endpoint TEXT PRIMARY KEY, p256dh TEXT NOT NULL, auth TEXT NOT NULL, ufs TEXT NOT NULL, criado_em TEXT, atualizado_em TEXT)',
  'CREATE TABLE IF NOT EXISTS enviados (chave TEXT PRIMARY KEY, em TEXT)',
  'CREATE TABLE IF NOT EXISTS seguindo (endpoint TEXT NOT NULL, alvo TEXT NOT NULL, PRIMARY KEY (endpoint, alvo))',
  'CREATE INDEX IF NOT EXISTS ix_seguindo_alvo ON seguindo (alvo)',
];

/* ------------------------------------------------------------------ OIDC do GitHub (para /novidades) */

const REPOSITORIO = 'professorbossini/voto-informado';
const EMISSOR = 'https://token.actions.githubusercontent.com';
let jwks = null;
let jwksEm = 0;
const b64 = (x) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (x.length % 4)) % 4)), (c) => c.charCodeAt(0));
const parte = (x) => JSON.parse(new TextDecoder().decode(b64(x)));

async function doGithub(req) {
  const partes = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').split('.');
  if (partes.length !== 3) return false;
  let cab, d;
  try {
    cab = parte(partes[0]);
    d = parte(partes[1]);
  } catch {
    return false;
  }
  const agora = Math.floor(Date.now() / 1000);
  if (cab.alg !== 'RS256' || d.iss !== EMISSOR || d.aud !== 'tanaurna-avisos' || d.repository !== REPOSITORIO || !(d.exp > agora)) return false;
  if (!jwks || Date.now() - jwksEm > 3_600_000) {
    jwks = (await (await fetch(`${EMISSOR}/.well-known/jwks`)).json()).keys;
    jwksEm = Date.now();
  }
  const jwk = jwks.find((k) => k.kid === cab.kid);
  if (!jwk) return false;
  const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  return crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, b64(partes[2]), new TextEncoder().encode(`${partes[0]}.${partes[1]}`));
}

async function preparar(env) {
  await env.DB.batch(ESQUEMA.map((s) => env.DB.prepare(s)));
}

async function chaves(env) {
  const r = await env.DB.prepare("SELECT valor FROM config WHERE chave = 'vapid'").first();
  if (r) return JSON.parse(r.valor);
  const novas = await novasChavesVapid();
  await env.DB.prepare("INSERT OR IGNORE INTO config (chave, valor) VALUES ('vapid', ?)").bind(JSON.stringify(novas)).run();
  return JSON.parse((await env.DB.prepare("SELECT valor FROM config WHERE chave = 'vapid'").first()).valor);
}

function cors(req) {
  const origem = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGENS.some((o) => o.test(origem)) ? origem : SITE,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

const json = (req, corpo, status = 200) => new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json', ...cors(req) } });

async function lerCorpo(req, limite = 4096) {
  if ((Number(req.headers.get('content-length')) || 0) > limite) return null;
  try {
    return await req.json();
  } catch {
    return null;
  }
}

const mensagem = (titulo, corpo, url, tag) => JSON.stringify({ titulo, corpo, url, tag });

/* ------------------------------------------------------------------ resultados do TSE */

const data = (txt) => {
  const [d, m, a] = txt.split('/').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};

/** Eleição geral em divulgação hoje (mesma regra de backend/etl/calendario_tse.py). */
async function eleicaoAtual(agora) {
  const cfg = await (await fetch(`${TSE}/comum/config/ele-c.json`, { cf: { cacheTtl: 300 } })).json();
  const ciclos = {};
  for (const pl of cfg.pl ?? []) {
    for (const e of pl.e ?? []) {
      if (!/ordin/i.test(e.nm ?? '') || !['8', '1'].includes(e.tp)) continue;
      const c = (ciclos[pl.c] ??= { ciclo: pl.c, federal: [null, null], estadual: [null, null], t: [null, null] });
      const i = Number(e.t || 1) - 1;
      (e.tp === '8' ? c.federal : c.estadual)[i] = e.cd;
      c.t[i] = data(pl.dt);
    }
  }
  for (const c of Object.values(ciclos)) {
    if (!c.t[0] || !c.federal[0] || !c.estadual[0]) continue;
    const ano = c.t[0].getUTCFullYear();
    const fimOut = new Date(Date.UTC(ano, 9, 31));
    c.t[1] ??= new Date(fimOut.getTime() - fimOut.getUTCDay() * 86400000); // último domingo de outubro
    c.federal[1] ??= String(Number(c.federal[0]) + 1);
    c.estadual[1] ??= String(Number(c.estadual[0]) + 1);
    if (agora >= c.t[0].getTime() - 86400000 && agora <= c.t[1].getTime() + 10 * 86400000) return c;
  }
  return null;
}

/** Eleitos e quem vai ao 2º turno, no arquivo unificado do TSE de um cargo/UF. */
async function desfecho(ciclo, codigo, uf, cargo) {
  const u = uf.toLowerCase();
  const url = `${TSE}/${ciclo}/${codigo}/dados/${u}/${u}-c${String(cargo).padStart(4, '0')}-e${String(codigo).padStart(6, '0')}-u.json`;
  const r = await fetch(url, { cf: { cacheTtl: 60 } });
  if (!r.ok) return null;
  const d = await r.json();
  const cands = [];
  for (const carg of d.carg ?? []) for (const agr of carg.agr ?? []) for (const par of agr.par ?? []) for (const c of par.cand ?? []) cands.push({ ...c, partido: par.sg });
  const nome = (c) => (c.nmu || c.nm || '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase());
  const pct = (c) => (c.pvap ? `${c.pvap}%` : '');
  const eleito = cands.find((c) => String(c.e).toLowerCase() === 's' && /^eleit/i.test(c.st || ''));
  if (eleito) return { tipo: 'eleito', texto: `${nome(eleito)} (${eleito.partido}) venceu a eleição, com ${pct(eleito)} dos votos válidos, segundo o TSE.` };
  const segundo = cands.filter((c) => /2.*turno/i.test(c.st || ''));
  if (segundo.length === 2 && d.tf === 's') {
    return { tipo: '2turno', texto: `Haverá 2º turno entre ${nome(segundo[0])} (${segundo[0].partido}, ${pct(segundo[0])}) e ${nome(segundo[1])} (${segundo[1].partido}, ${pct(segundo[1])}), segundo o TSE.` };
  }
  return null;
}

async function avisarTodos(env, ufAlvo, msg) {
  const { results } = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM inscricoes WHERE ',' || ufs || ',' LIKE ?").bind(`%,${ufAlvo},%`).all();
  return entregar(env, results, msg);
}

async function entregar(env, results, msg) {
  const ch = await chaves(env);
  let ok = 0;
  for (let i = 0; i < results.length; i += 50) {
    const lote = results.slice(i, i + 50);
    const st = await Promise.all(lote.map((s) => enviar(s, msg, ch, SITE).catch(() => 0)));
    const mortos = lote.filter((_, k) => st[k] === 404 || st[k] === 410).map((s) => s.endpoint);
    ok += st.filter((x) => x >= 200 && x < 300).length;
    if (mortos.length) await env.DB.batch(mortos.flatMap((e) => [env.DB.prepare('DELETE FROM inscricoes WHERE endpoint = ?').bind(e), env.DB.prepare('DELETE FROM seguindo WHERE endpoint = ?').bind(e)]));
  }
  return { inscritos: results.length, entregues: ok };
}

async function verificar(env) {
  const c = await eleicaoAtual(Date.now());
  if (!c) return 'fora do período de divulgação';
  await preparar(env);
  const { results } = await env.DB.prepare('SELECT ufs FROM inscricoes').all();
  const ufs = new Set(results.flatMap((r) => r.ufs.split(',')).filter(Boolean));
  const log = [];
  for (const turno of [0, 1]) {
    if (Date.now() < c.t[turno].getTime()) continue;
    for (const uf of ufs) {
      const cargo = uf === 'BR' ? 1 : 3;
      const codigo = uf === 'BR' ? c.federal[turno] : c.estadual[turno];
      const chave = `${c.ciclo}-${codigo}-${uf}-${cargo}`;
      if (await env.DB.prepare('SELECT 1 FROM enviados WHERE chave = ?').bind(chave).first()) continue;
      const r = await desfecho(c.ciclo, codigo, uf, cargo).catch(() => null);
      if (!r) continue;
      const titulo = uf === 'BR' ? `${turno + 1}º turno: Presidência da República` : `${turno + 1}º turno: governo de ${NOMES[uf]}`;
      const url = uf === 'BR' ? `${SITE}/resultados` : `${SITE}/resultados?uf=${uf}`;
      await env.DB.prepare('INSERT OR IGNORE INTO enviados (chave, em) VALUES (?, ?)').bind(chave, new Date().toISOString()).run();
      const res = await avisarTodos(env, uf, mensagem(titulo, r.texto, url, chave));
      log.push(`${chave}: ${res.entregues}/${res.inscritos}`);
    }
  }
  return log.join('; ') || 'nada novo';
}

/* ------------------------------------------------------------------ HTTP */

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    await preparar(env);
    if (url.pathname === '/chave' && req.method === 'GET') return json(req, { publica: (await chaves(env)).publica });

    if (url.pathname === '/inscrever' && req.method === 'POST') {
      const b = await lerCorpo(req);
      let host = '';
      try {
        host = new URL(b?.endpoint ?? '').hostname;
      } catch {
        /* inválido */
      }
      const ufs = [...new Set((b?.ufs ?? []).map(String))].filter((u) => UFS.has(u)).slice(0, 2);
      if (!b?.endpoint?.startsWith('https://') || !SERVICOS_PUSH.test(host) || !b.keys?.p256dh || !b.keys?.auth || !ufs.length) return json(req, { erro: 'inscrição inválida' }, 400);
      const agora = new Date().toISOString();
      await env.DB.prepare(
        'INSERT INTO inscricoes (endpoint, p256dh, auth, ufs, criado_em, atualizado_em) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, ufs = excluded.ufs, atualizado_em = excluded.atualizado_em',
      )
        .bind(b.endpoint, b.keys.p256dh, b.keys.auth, ufs.join(','), agora, agora)
        .run();
      const onde = ufs.map((u) => (u === 'BR' ? 'Presidência' : `governo de ${NOMES[u]}`)).join(' e ');
      const st = await enviar({ endpoint: b.endpoint, p256dh: b.keys.p256dh, auth: b.keys.auth }, mensagem('Avisos ligados', `O aviso chega aqui quando sair o resultado: ${onde}.`, `${SITE}/resultados`, 'confirmacao'), await chaves(env), SITE).catch(() => 0);
      return json(req, { ok: true, ufs, confirmacao: st });
    }

    if (url.pathname === '/cancelar' && req.method === 'POST') {
      const b = await lerCorpo(req);
      if (b?.endpoint) {
        if (b.so === 'resultados') await env.DB.prepare("UPDATE inscricoes SET ufs = '' WHERE endpoint = ?").bind(b.endpoint).run();
        else if (b.so === 'seguindo') await env.DB.prepare('DELETE FROM seguindo WHERE endpoint = ?').bind(b.endpoint).run();
        else await env.DB.batch([env.DB.prepare('DELETE FROM inscricoes WHERE endpoint = ?').bind(b.endpoint), env.DB.prepare('DELETE FROM seguindo WHERE endpoint = ?').bind(b.endpoint)]);
      }
      return json(req, { ok: true });
    }

    if (url.pathname === '/seguir' && req.method === 'POST') {
      const b = await lerCorpo(req, 16384);
      let host = '';
      try {
        host = new URL(b?.endpoint ?? '').hostname;
      } catch {
        /* inválido */
      }
      const alvos = [...new Set((b?.alvos ?? []).map(String))].filter((a) => /^(parlamentar|partido|ministro):[a-z0-9-]{1,60}$/.test(a)).slice(0, 100);
      if (!b?.endpoint?.startsWith('https://') || !SERVICOS_PUSH.test(host) || !b.keys?.p256dh || !b.keys?.auth) return json(req, { erro: 'inscrição inválida' }, 400);
      const agora = new Date().toISOString();
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO inscricoes (endpoint, p256dh, auth, ufs, criado_em, atualizado_em) VALUES (?, ?, ?, '', ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh = excluded.p256dh, auth = excluded.auth, atualizado_em = excluded.atualizado_em",
        ).bind(b.endpoint, b.keys.p256dh, b.keys.auth, agora, agora),
        env.DB.prepare('DELETE FROM seguindo WHERE endpoint = ?').bind(b.endpoint),
        ...alvos.map((a) => env.DB.prepare('INSERT OR IGNORE INTO seguindo (endpoint, alvo) VALUES (?, ?)').bind(b.endpoint, a)),
      ]);
      return json(req, { ok: true, alvos: alvos.length });
    }

    if (url.pathname === '/novidades' && req.method === 'POST') {
      if (!(await doGithub(req))) return json(req, { erro: 'não autorizado' }, 401);
      const b = await req.json().catch(() => null);
      const log = [];
      for (const it of (b?.itens ?? []).slice(0, 2000)) {
        if (!it?.alvo || !it?.chave || !it?.titulo) continue;
        if (await env.DB.prepare('SELECT 1 FROM enviados WHERE chave = ?').bind(it.chave).first()) continue;
        await env.DB.prepare('INSERT OR IGNORE INTO enviados (chave, em) VALUES (?, ?)').bind(it.chave, new Date().toISOString()).run();
        const { results } = await env.DB.prepare('SELECT i.endpoint, i.p256dh, i.auth FROM seguindo s JOIN inscricoes i ON i.endpoint = s.endpoint WHERE s.alvo = ?').bind(it.alvo).all();
        if (!results.length) continue;
        const r = await entregar(env, results, mensagem(it.titulo, it.corpo || '', it.url || SITE, it.alvo));
        log.push({ alvo: it.alvo, ...r });
      }
      return json(req, { ok: true, enviados: log });
    }
    return json(req, { erro: 'não encontrado' }, 404);
  },

  async scheduled(evento, env, ctx) {
    ctx.waitUntil(verificar(env).then((r) => console.log(`avisos: ${r}`)));
  },
};
