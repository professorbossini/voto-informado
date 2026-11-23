// Testes do Worker de visitas: node --test infra/cloudflare/visitas
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import worker, { aposentar, codigoVisitante, ehAdmin, ESQUEMA, limparCaminho, listaAdmins, mesesAntes, origemDe, RETENCAO, verificarToken } from './worker.js';

test('caminho sem query nem fragmento, só do próprio site', () => {
  assert.equal(limparCaminho('/candidato/123?x=1#y'), '/candidato/123');
  assert.equal(limparCaminho('/'), '/');
  assert.equal(limparCaminho('https://x.com/a'), null);
  assert.equal(limparCaminho('//x.com'), null);
  assert.equal(limparCaminho('/' + 'a'.repeat(400)), null);
  assert.equal(limparCaminho(42), null);
});

test('referrer vira só a origem', () => {
  assert.equal(origemDe('https://www.google.com/search?q=segredo'), 'https://www.google.com');
  assert.equal(origemDe('javascript:alert(1)'), null);
  assert.equal(origemDe('lixo'), null);
  assert.equal(origemDe(undefined), null);
});

test('código do visitante muda com o dia e não revela o IP', async () => {
  const a = await codigoVisitante('sal', '2026-11-23', '1.2.3.4', 'UA');
  const b = await codigoVisitante('sal', '2026-11-24', '1.2.3.4', 'UA');
  assert.equal(a.length, 16);
  assert.notEqual(a, b);
  assert.ok(!a.includes('1.2.3.4'));
});

test('prazos: 7 meses com IP, 12 meses detalhada', () => {
  assert.deepEqual(RETENCAO, { MESES_COM_IP: 7, MESES_DETALHADA: 12 });
  assert.equal(mesesAntes(new Date('2026-11-23T10:00:00Z'), 12), '2025-11-23T10:00:00Z');
  assert.equal(mesesAntes(new Date('2026-11-23T10:00:00Z'), 7), '2026-04-23T10:00:00Z');
});

// D1 de verdade o bastante: SQLite do Node, com batch numa transação (como o D1).
function sqlite() {
  const db = new DatabaseSync(':memory:');
  const prepare = (sql) => {
    let args = [];
    const st = {
      bind: (...a) => ((args = a), st),
      run: async () => db.prepare(sql).run(...args),
      first: async () => db.prepare(sql).get(...args) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...args) }),
      _exec: () => (/^\s*(SELECT|WITH)/i.test(sql) ? { results: db.prepare(sql).all(...args) } : (db.prepare(sql).run(...args), { results: [] })),
    };
    return st;
  };
  const batch = async (l) => {
    db.exec('BEGIN');
    try {
      const r = l.map((s) => s._exec());
      db.exec('COMMIT');
      return r;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  };
  return { db, prepare, batch };
}

test('retenção: tira IP aos 7 meses, soma e apaga aos 12, sem contar em dobro', async () => {
  const DB = sqlite();
  await DB.batch(ESQUEMA.map((s) => DB.prepare(s)));
  const ins = DB.db.prepare('INSERT INTO visitas (visitante, com_login, caminho, origem, ip, pais, regiao, cidade, user_agent, navegador, sistema, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const linha = (quando, v = 'a', login = 0) => ins.run(v, login, '/mapa', null, '1.2.3.4', 'BR', 'São Paulo', 'Campinas', 'UA', 'Chrome 142', 'Windows 10', quando);
  linha('2025-10-01T10:00:00Z', 'a');
  linha('2025-10-01T11:00:00Z', 'b');
  linha('2025-10-01T12:00:00Z', 'c', 1);
  linha('2026-03-01T10:00:00Z'); // 8 meses: perde IP
  linha('2026-11-01T10:00:00Z'); // recente: intacta
  const agora = new Date('2026-11-23T10:00:00Z');
  await aposentar({ DB }, agora);
  await aposentar({ DB }, agora); // de novo: idempotente
  const restantes = DB.db.prepare('SELECT criado_em, ip, user_agent, navegador, cidade FROM visitas ORDER BY criado_em').all();
  assert.equal(restantes.length, 2);
  assert.deepEqual({ ...restantes[0] }, { criado_em: '2026-03-01T10:00:00Z', ip: null, user_agent: null, navegador: 'Chrome 142', cidade: 'Campinas' });
  assert.equal(restantes[1].ip, '1.2.3.4');
  const stats = DB.db.prepare('SELECT * FROM visitas_estatistica ORDER BY com_login').all().map((r) => ({ ...r }));
  assert.deepEqual(stats, [
    { dia: '2025-10-01', caminho: '/mapa', pais: 'BR', regiao: 'São Paulo', cidade: 'Campinas', navegador: 'Chrome 142', sistema: 'Windows 10', origem: '', com_login: 0, visitas: 2 },
    { dia: '2025-10-01', caminho: '/mapa', pais: 'BR', regiao: 'São Paulo', cidade: 'Campinas', navegador: 'Chrome 142', sistema: 'Windows 10', origem: '', com_login: 1, visitas: 1 },
  ]);
  // Mais visitas do mesmo dia somam na mesma linha.
  linha('2025-10-01T13:00:00Z', 'd');
  await aposentar({ DB }, agora);
  assert.equal(DB.db.prepare('SELECT visitas FROM visitas_estatistica WHERE com_login = 0').get().visitas, 3);
});

test('admins: só e-mails da lista, verificados', () => {
  const env = { ADMIN_EMAILS: 'admin1@exemplo.com, admin2@exemplo.com,admin3@exemplo.org' };
  assert.equal(listaAdmins(env.ADMIN_EMAILS).length, 3);
  assert.ok(ehAdmin({ email: 'Admin1@Exemplo.com', email_verified: true }, env));
  assert.ok(ehAdmin({ email: 'admin3@exemplo.org', email_verified: true }, env));
  assert.ok(!ehAdmin({ email: 'admin1@exemplo.com', email_verified: false }, env));
  assert.ok(!ehAdmin({ email: 'outra@exemplo.com', email_verified: true }, env));
});

// Token assinado por uma chave nossa, servida como se fosse o JWKS do Google.
async function tokenDeTeste(dados) {
  const par = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  const jwk = { ...(await crypto.subtle.exportKey('jwk', par.publicKey)), kid: `k${Math.random()}`, alg: 'RS256' };
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const corpo = `${b64({ alg: 'RS256', kid: jwk.kid })}.${b64(dados)}`;
  const sig = Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', par.privateKey, new TextEncoder().encode(corpo))).toString('base64url');
  return { token: `${corpo}.${sig}`, buscar: async () => new Response(JSON.stringify({ keys: [jwk] })) };
}

test('ID token do Firebase: assinatura, projeto e validade', async () => {
  const s = Math.floor(Date.now() / 1000);
  const base = { iss: 'https://securetoken.google.com/p1', aud: 'p1', sub: 'u1', iat: s, exp: s + 3600, email: 'a@exemplo.com', email_verified: true };
  const { token, buscar } = await tokenDeTeste(base);
  assert.equal((await verificarToken(token, 'p1', { buscar }))?.sub, 'u1');
  assert.equal(await verificarToken(token, 'outro', { buscar }), null);
  assert.equal(await verificarToken(token.slice(0, -4) + 'AAAA', 'p1', { buscar }), null);
  const vencido = await tokenDeTeste({ ...base, exp: s - 10 });
  assert.equal(await verificarToken(vencido.token, 'p1', { buscar: vencido.buscar }), null);
});

// D1 de mentira: guarda o que foi gravado.
function d1() {
  const gravados = [];
  const stmt = (sql) => ({
    sql,
    args: [],
    bind(...a) {
      this.args = a;
      return this;
    },
    async run() {
      if (sql.startsWith('INSERT INTO visitas')) gravados.push(this.args);
      return {};
    },
    async first() {
      return sql.includes("'sal'") ? { valor: 'sal' } : null;
    },
  });
  return { gravados, prepare: stmt, batch: async (l) => l.map(() => ({ results: [] })) };
}

test('POST /visita grava caminho limpo e local da Cloudflare, sem query', async () => {
  const DB = d1();
  const req = new Request('https://w/visita', {
    method: 'POST',
    headers: { origin: 'https://www.tanaurna.com.br', 'cf-connecting-ip': '200.1.2.3', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36', 'content-type': 'application/json' },
    body: JSON.stringify({ caminho: '/candidato/1?cpf=x', origem: 'https://t.co/abc?x=1' }),
  });
  Object.defineProperty(req, 'cf', { value: { country: 'BR', region: 'São Paulo', city: 'Campinas' } });
  const r = await worker.fetch(req, { DB, FIREBASE_PROJECT: 'p1', ADMIN_EMAILS: '' });
  assert.equal(r.status, 200);
  const [visitante, comLogin, caminho, origem, ip, pais, regiao, cidade, ua, navegador, sistema] = DB.gravados[0];
  assert.equal(visitante.length, 16);
  assert.deepEqual([comLogin, caminho, origem, ip, pais, regiao, cidade], [0, '/candidato/1', 'https://t.co', '200.1.2.3', 'BR', 'São Paulo', 'Campinas']);
  assert.ok(ua.startsWith('Mozilla/5.0 (Windows'));
  assert.deepEqual([navegador, sistema], ['Chrome 142', 'Windows 10']);
});

test('POST /visita de outra origem é recusado; admin exige login', async () => {
  const DB = d1();
  const env = { DB, FIREBASE_PROJECT: 'p1', ADMIN_EMAILS: 'a@exemplo.com' };
  const fora = await worker.fetch(new Request('https://w/visita', { method: 'POST', headers: { origin: 'https://mal.com' }, body: '{"caminho":"/"}' }), env);
  assert.equal(fora.status, 403);
  assert.equal(DB.gravados.length, 0);
  assert.equal((await worker.fetch(new Request('https://w/admin/visitas'), env)).status, 401);
});
