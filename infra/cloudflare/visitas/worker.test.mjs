// Testes do Worker de visitas: node --test infra/cloudflare/visitas
import assert from 'node:assert/strict';
import { test } from 'node:test';
import worker, { codigoVisitante, ehAdmin, limiteRetencao, limparCaminho, listaAdmins, origemDe, RETENCAO_MESES, verificarToken } from './worker.js';

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

test('retenção de 12 meses', () => {
  assert.equal(RETENCAO_MESES, 12);
  assert.equal(limiteRetencao(new Date('2026-11-23T10:00:00Z')).toISOString(), '2025-11-23T10:00:00.000Z');
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
    headers: { origin: 'https://www.tanaurna.com.br', 'cf-connecting-ip': '200.1.2.3', 'user-agent': 'Mozilla/5.0', 'content-type': 'application/json' },
    body: JSON.stringify({ caminho: '/candidato/1?cpf=x', origem: 'https://t.co/abc?x=1' }),
  });
  Object.defineProperty(req, 'cf', { value: { country: 'BR', region: 'São Paulo', city: 'Campinas' } });
  const r = await worker.fetch(req, { DB, FIREBASE_PROJECT: 'p1', ADMIN_EMAILS: '' });
  assert.equal(r.status, 200);
  const [visitante, comLogin, caminho, origem, ip, pais, regiao, cidade] = DB.gravados[0];
  assert.equal(visitante.length, 16);
  assert.deepEqual([comLogin, caminho, origem, ip, pais, regiao, cidade], [0, '/candidato/1', 'https://t.co', '200.1.2.3', 'BR', 'São Paulo', 'Campinas']);
});

test('POST /visita de outra origem é recusado; admin exige login', async () => {
  const DB = d1();
  const env = { DB, FIREBASE_PROJECT: 'p1', ADMIN_EMAILS: 'a@exemplo.com' };
  const fora = await worker.fetch(new Request('https://w/visita', { method: 'POST', headers: { origin: 'https://mal.com' }, body: '{"caminho":"/"}' }), env);
  assert.equal(fora.status, 403);
  assert.equal(DB.gravados.length, 0);
  assert.equal((await worker.fetch(new Request('https://w/admin/visitas'), env)).status, 401);
});
