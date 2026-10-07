/**
 * Monitor de disponibilidade do Tá na Urna (Cloudflare Worker "tanaurna-monitor", cron a cada 5 min).
 *
 * Confere a página inicial, os dados (api/meta.json) e uma página por rota no endereço público.
 * Na 2ª falha seguida manda um e-mail (Email Routing da Cloudflare, binding AVISO → endereço de
 * destino verificado) e outro quando o site voltar. Estado guardado em KV (binding ESTADO).
 */
import { EmailMessage } from 'cloudflare:email';

const SITE = 'https://www.tanaurna.com.br';
const CHECAGENS = [
  { nome: 'página inicial', url: `${SITE}/`, tem: '<div id="root">' },
  { nome: 'dados', url: `${SITE}/api/meta.json`, tem: '"fontes"' },
  { nome: 'página do plenário', url: `${SITE}/plenario`, tem: '<title>' },
];
const DE = 'monitor@tanaurna.com.br';

async function checar() {
  const falhas = [];
  for (const c of CHECAGENS) {
    try {
      const r = await fetch(`${c.url}${c.url.includes('?') ? '&' : '?'}monitor=${Date.now()}`, { headers: { 'user-agent': 'tanaurna-monitor/1.0' }, cf: { cacheTtl: 0 } });
      const corpo = await r.text();
      if (!r.ok || !corpo.includes(c.tem)) falhas.push(`${c.nome}: HTTP ${r.status}`);
    } catch (e) {
      falhas.push(`${c.nome}: ${e}`);
    }
  }
  return falhas;
}

/** Cabeçalho com acentos/emoji (RFC 2047). */
const cab = (t) => `=?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(t)))}?=`;

async function email(env, assunto, texto) {
  const corpo = [
    `From: ${cab('Monitor do Tá na Urna')} <${DE}>`,
    `To: ${env.PARA}`,
    `Subject: ${cab(assunto)}`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: <${crypto.randomUUID()}@tanaurna.com.br>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    texto,
  ].join('\r\n');
  await env.AVISO.send(new EmailMessage(DE, env.PARA, corpo));
}

export default {
  async scheduled(evento, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const falhas = await checar();
        const antes = Number((await env.ESTADO.get('falhas')) || 0);
        const fora = (await env.ESTADO.get('fora')) === '1';
        if (falhas.length) {
          await env.ESTADO.put('falhas', String(antes + 1));
          if (antes + 1 >= 2 && !fora) {
            await env.ESTADO.put('fora', '1');
            await email(env, '⚠️ Tá na Urna fora do ar', `O monitor encontrou problema em ${new Date().toISOString()}:\n\n${falhas.join('\n')}\n\n${SITE}`);
          }
        } else {
          await env.ESTADO.put('falhas', '0');
          if (fora) {
            await env.ESTADO.put('fora', '0');
            await email(env, '✅ Tá na Urna de volta', `O site voltou a responder normalmente em ${new Date().toISOString()}.\n\n${SITE}`);
          }
        }
        console.log(`monitor: ${falhas.length ? falhas.join('; ') : 'ok'}`);
      })(),
    );
  },
  async fetch() {
    return new Response(JSON.stringify({ falhas: await checar() }), { headers: { 'content-type': 'application/json' } });
  },
};
