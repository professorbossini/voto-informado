/**
 * Registro de visitas do Tá na Urna (Cloudflare Worker "tanaurna-visitas", banco D1 binding DB).
 *
 * O site chama POST /visita a cada página vista (carregamento e cada troca de rota). O Worker grava o
 * caminho (sem query nem fragmento), a origem de onde a pessoa veio, o IP e o local aproximado como a
 * própria Cloudflare os vê (request.cf: país, estado, cidade; ninguém consegue informar outro), o
 * navegador e um código anônimo do dia (hash de sal + dia + IP + navegador, sem cookie). Com login, guarda
 * só que a visita tinha login: NUNCA a conta (a Política de Privacidade promete não acompanhar o que cada
 * pessoa consulta, item 2). Nada de corpo, query, cookie ou token.
 *
 *   POST /visita          {caminho, origem?}  (Authorization: Bearer <ID token do Firebase>, opcional)
 *   GET  /eu              → {admin}           (com token)
 *   GET  /admin/visitas   ?caminho=&quem=todos|login → {visitas, resumo, top, retencaoMeses}  (só admin)
 *   cron (de hora em hora): apaga o que passou de RETENCAO_MESES.
 *
 * Admins: e-mails verificados da variável ADMIN_EMAILS (wrangler.jsonc), com login Google no Firebase
 * do site (projeto FIREBASE_PROJECT).
 */

/**
 * Por quantos meses as visitas ficam guardadas (decisão do responsável em 23/11/2026, o mesmo prazo do
 * registro de acessos dos outros projetos). É o prazo que a Política de Privacidade (item 7) informa:
 * mudar aqui exige mudar a política junto.
 */
export const RETENCAO_MESES = 12;

/** Momento antes do qual uma visita já passou do prazo. */
export function limiteRetencao(agora = new Date()) {
  const d = new Date(agora.getTime());
  d.setUTCMonth(d.getUTCMonth() - RETENCAO_MESES);
  return d;
}

const SITE = 'https://www.tanaurna.com.br';
const ORIGENS = [/^https:\/\/(www\.)?tanaurna\.com\.br$/, /^https:\/\/tanaurna-site\.insta-publisher\.workers\.dev$/, /^http:\/\/localhost(:\d+)?$/];

const ESQUEMA = [
  'CREATE TABLE IF NOT EXISTS config (chave TEXT PRIMARY KEY, valor TEXT)',
  `CREATE TABLE IF NOT EXISTS visitas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitante TEXT NOT NULL,
    com_login INTEGER NOT NULL DEFAULT 0,
    caminho TEXT NOT NULL,
    origem TEXT,
    ip TEXT,
    pais TEXT,
    regiao TEXT,
    cidade TEXT,
    navegador TEXT,
    criado_em TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS ix_visitas_criado ON visitas (criado_em)',
];

/* ------------------------------------------------------------------ utilidades puras (testadas) */

/** "/candidato/123?x=1#y" → "/candidato/123". Só caminhos do próprio site, até 300 caracteres. */
export function limparCaminho(c) {
  if (typeof c !== 'string') return null;
  const s = c.split(/[?#]/)[0];
  if (!s.startsWith('/') || s.startsWith('//') || s.length > 300) return null;
  return s;
}

/** Só a origem do referrer ("https://www.google.com"), nunca o endereço completo. */
export function origemDe(ref) {
  if (typeof ref !== 'string' || !ref) return null;
  try {
    const u = new URL(ref);
    return /^https?:$/.test(u.protocol) ? u.origin : null;
  } catch {
    return null;
  }
}

/** Data ISO sem milissegundos ("2026-11-23T14:05:00Z"), comparável como texto. */
export const isoSegundos = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');

export async function sha256(texto) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Código anônimo do visitante: muda todo dia e não sai do sal guardado no D1. */
export async function codigoVisitante(sal, dia, ip, ua) {
  return (await sha256(`${sal}:${dia}:${ip ?? ''}:${ua ?? ''}`)).slice(0, 16);
}

export const listaAdmins = (v) =>
  String(v ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/* ------------------------------------------------------------------ ID token do Firebase */

const JWKS_FIREBASE = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let jwks = null;
let jwksEm = 0;
const b64 = (x) => Uint8Array.from(atob(x.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (x.length % 4)) % 4)), (c) => c.charCodeAt(0));
const parte = (x) => JSON.parse(new TextDecoder().decode(b64(x)));

/** Confere o ID token do Firebase (assinatura RS256, emissor, público, validade). Devolve os dados ou null. */
export async function verificarToken(token, projeto, { agora = Date.now(), buscar = fetch } = {}) {
  const partes = (token || '').split('.');
  if (partes.length !== 3 || !projeto) return null;
  let cab, d;
  try {
    cab = parte(partes[0]);
    d = parte(partes[1]);
  } catch {
    return null;
  }
  const s = Math.floor(agora / 1000);
  if (cab.alg !== 'RS256' || d.iss !== `https://securetoken.google.com/${projeto}` || d.aud !== projeto) return null;
  if (!(d.exp > s) || !(d.iat <= s + 300) || !d.sub) return null;
  if (!jwks || agora - jwksEm > 3_600_000 || !jwks.some((k) => k.kid === cab.kid)) {
    jwks = (await (await buscar(JWKS_FIREBASE)).json()).keys ?? [];
    jwksEm = agora;
  }
  const jwk = jwks.find((k) => k.kid === cab.kid);
  if (!jwk) return null;
  try {
    const chave = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', chave, b64(partes[2]), new TextEncoder().encode(`${partes[0]}.${partes[1]}`));
    return ok ? d : null;
  } catch {
    return null;
  }
}

export function ehAdmin(dados, env) {
  const email = typeof dados?.email === 'string' ? dados.email.toLowerCase() : '';
  return Boolean(email && dados.email_verified === true && listaAdmins(env.ADMIN_EMAILS).includes(email));
}

const tokenDe = (req) => (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();

/* ------------------------------------------------------------------ HTTP */

function cors(req) {
  const origem = req.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': ORIGENS.some((o) => o.test(origem)) ? origem : SITE,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (req, corpo, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors(req) } });

async function lerCorpo(req, limite = 2048) {
  if ((Number(req.headers.get('content-length')) || 0) > limite) return null;
  try {
    const t = await req.text();
    return t.length > limite ? null : JSON.parse(t);
  } catch {
    return null;
  }
}

let pronto = false;
async function preparar(env) {
  if (pronto) return;
  await env.DB.batch(ESQUEMA.map((s) => env.DB.prepare(s)));
  pronto = true;
}

let salEmCache = null;
async function sal(env) {
  if (salEmCache) return salEmCache;
  const ler = async () => (await env.DB.prepare("SELECT valor FROM config WHERE chave = 'sal'").first())?.valor;
  let v = await ler();
  if (!v) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    await env.DB.prepare("INSERT OR IGNORE INTO config (chave, valor) VALUES ('sal', ?)")
      .bind([...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''))
      .run();
    v = await ler();
  }
  salEmCache = v;
  return v;
}

// Limite simples por IP (por instância do Worker): página vista não chega a 120 por minuto.
const janela = new Map();
function excedeu(ip, agora = Date.now()) {
  const min = Math.floor(agora / 60_000);
  const chave = `${ip}:${min}`;
  const n = (janela.get(chave) ?? 0) + 1;
  janela.set(chave, n);
  if (janela.size > 5000) for (const k of janela.keys()) if (!k.endsWith(`:${min}`)) janela.delete(k);
  return n > 120;
}

const texto = (v, max = 120) => (typeof v === 'string' && v ? v.slice(0, max) : null);

async function registrar(req, env) {
  const origemPedido = req.headers.get('origin') || '';
  if (!ORIGENS.some((o) => o.test(origemPedido))) return json(req, { erro: 'origem não permitida' }, 403);
  const b = await lerCorpo(req);
  const caminho = limparCaminho(b?.caminho);
  if (!caminho) return json(req, { erro: 'caminho inválido' }, 400);
  const ip = req.headers.get('cf-connecting-ip');
  if (ip && excedeu(ip)) return json(req, { ok: true, ignorado: true });
  const ua = texto(req.headers.get('user-agent'), 300);
  const cf = req.cf ?? {};
  const token = tokenDe(req);
  const comLogin = token ? Boolean(await verificarToken(token, env.FIREBASE_PROJECT)) : false;
  const agora = new Date();
  const visitante = await codigoVisitante(await sal(env), agora.toISOString().slice(0, 10), ip, ua);
  await env.DB.prepare(
    'INSERT INTO visitas (visitante, com_login, caminho, origem, ip, pais, regiao, cidade, navegador, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  )
    .bind(visitante, comLogin ? 1 : 0, caminho, origemDe(b?.origem), ip, texto(cf.country, 8), texto(cf.region), texto(cf.city), ua, isoSegundos(agora))
    .run();
  return json(req, { ok: true });
}

export async function apagarAntigas(env, agora = new Date()) {
  const limite = isoSegundos(limiteRetencao(agora));
  await env.DB.prepare('DELETE FROM visitas WHERE criado_em < ?').bind(limite).run();
}

async function listar(req, env, url) {
  const agora = new Date();
  const h24 = isoSegundos(new Date(agora.getTime() - 86_400_000));
  const d7 = isoSegundos(new Date(agora.getTime() - 7 * 86_400_000));
  const caminho = `%${(url.searchParams.get('caminho') ?? '').toLowerCase().slice(0, 300)}%`;
  const soLogin = url.searchParams.get('quem') === 'login' ? 1 : 0;
  const [visitas, resumo, top] = await env.DB.batch([
    env.DB.prepare(
      `SELECT id, visitante, com_login AS comLogin, caminho, origem, ip, pais, regiao, cidade, navegador, criado_em AS criadoEm
       FROM visitas WHERE lower(caminho) LIKE ? AND (? = 0 OR com_login = 1) ORDER BY id DESC LIMIT 200`,
    ).bind(caminho, soLogin),
    env.DB.prepare(
      `SELECT
         SUM(CASE WHEN criado_em >= ?1 THEN 1 ELSE 0 END) AS paginas24h,
         COUNT(DISTINCT CASE WHEN criado_em >= ?1 THEN visitante END) AS visitantes24h,
         COUNT(*) AS paginas7d,
         COUNT(DISTINCT visitante) AS visitantes7d,
         COUNT(DISTINCT CASE WHEN com_login = 1 THEN visitante END) AS comLogin7d
       FROM visitas WHERE criado_em >= ?2`,
    ).bind(h24, d7),
    env.DB.prepare('SELECT caminho, COUNT(*) AS visitas FROM visitas WHERE criado_em >= ? GROUP BY caminho ORDER BY visitas DESC LIMIT 10').bind(d7),
  ]);
  const r = resumo.results[0] ?? {};
  return json(req, {
    visitas: visitas.results.map((v) => ({ ...v, comLogin: v.comLogin === 1 })),
    resumo: {
      paginas24h: r.paginas24h ?? 0,
      visitantes24h: r.visitantes24h ?? 0,
      paginas7d: r.paginas7d ?? 0,
      visitantes7d: r.visitantes7d ?? 0,
      comLogin7d: r.comLogin7d ?? 0,
    },
    top: top.results,
    retencaoMeses: RETENCAO_MESES,
  });
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
    const url = new URL(req.url);
    await preparar(env);

    if (url.pathname === '/visita' && req.method === 'POST') return registrar(req, env);

    if ((url.pathname === '/eu' || url.pathname === '/admin/visitas') && req.method === 'GET') {
      const dados = await verificarToken(tokenDe(req), env.FIREBASE_PROJECT);
      if (!dados) return json(req, { erro: 'entre com o Google' }, 401);
      const admin = ehAdmin(dados, env);
      if (url.pathname === '/eu') return json(req, { admin });
      if (!admin) return json(req, { erro: 'só para administradores' }, 403);
      return listar(req, env, url);
    }

    if (url.pathname === '/' && req.method === 'GET') return json(req, { ok: true, servico: 'tanaurna-visitas' });
    return json(req, { erro: 'não encontrado' }, 404);
  },

  async scheduled(_evento, env) {
    await preparar(env);
    await apagarAntigas(env);
  },
};
