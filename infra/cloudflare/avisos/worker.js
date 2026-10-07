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
];

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

async function lerCorpo(req) {
  if ((Number(req.headers.get('content-length')) || 0) > 4096) return null;
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
  const ch = await chaves(env);
  const { results } = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM inscricoes WHERE ',' || ufs || ',' LIKE ?").bind(`%,${ufAlvo},%`).all();
  let ok = 0;
  for (let i = 0; i < results.length; i += 50) {
    const lote = results.slice(i, i + 50);
    const st = await Promise.all(lote.map((s) => enviar(s, msg, ch, SITE).catch(() => 0)));
    const mortos = lote.filter((_, k) => st[k] === 404 || st[k] === 410).map((s) => s.endpoint);
    ok += st.filter((x) => x >= 200 && x < 300).length;
    if (mortos.length) await env.DB.batch(mortos.map((e) => env.DB.prepare('DELETE FROM inscricoes WHERE endpoint = ?').bind(e)));
  }
  return { inscritos: results.length, entregues: ok };
}

async function verificar(env) {
  const c = await eleicaoAtual(Date.now());
  if (!c) return 'fora do período de divulgação';
  await preparar(env);
  const { results } = await env.DB.prepare('SELECT ufs FROM inscricoes').all();
  const ufs = new Set(results.flatMap((r) => r.ufs.split(',')));
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
      if (b?.endpoint) await env.DB.prepare('DELETE FROM inscricoes WHERE endpoint = ?').bind(b.endpoint).run();
      return json(req, { ok: true });
    }
    return json(req, { erro: 'não encontrado' }, 404);
  },

  async scheduled(evento, env, ctx) {
    ctx.waitUntil(verificar(env).then((r) => console.log(`avisos: ${r}`)));
  },
};
