/**
 * Web Push sem bibliotecas (só WebCrypto): criptografia do conteúdo (RFC 8291, aes128gcm) e
 * identificação do servidor (VAPID, RFC 8292, JWT ES256). Usado pelo Worker tanaurna-avisos.
 */

export const b64u = {
  enc: (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
  dec: (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)), (c) => c.charCodeAt(0)),
};

const txt = (s) => new TextEncoder().encode(s);
const junta = (...partes) => {
  const out = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    out.set(p, i);
    i += p.length;
  }
  return out;
};

async function hkdf(salt, ikm, info, tamanho) {
  const chave = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, chave, tamanho * 8));
}

/**
 * Criptografa `conteudo` para a inscrição (p256dh e auth em base64url). `efemera` e `salt` só nos
 * testes (vetores da RFC 8291); em uso real são aleatórios a cada mensagem.
 */
export async function criptografar(conteudo, p256dh, auth, efemera = null, salt = null) {
  const uaPublica = b64u.dec(p256dh);
  const segredo = b64u.dec(auth);
  const par = efemera ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']));
  const asPublica = new Uint8Array(await crypto.subtle.exportKey('raw', par.publicKey));
  const uaChave = await crypto.subtle.importKey('raw', uaPublica, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartilhado = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaChave }, par.privateKey, 256));
  const ikm = await hkdf(segredo, compartilhado, junta(txt('WebPush: info\0'), uaPublica, asPublica), 32);
  const sal = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(sal, ikm, txt('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, txt('Content-Encoding: nonce\0'), 12);
  const texto = junta(typeof conteudo === 'string' ? txt(conteudo) : conteudo, new Uint8Array([2]));
  const chaveAes = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, chaveAes, texto));
  const cabecalho = new Uint8Array(21);
  cabecalho.set(sal, 0);
  new DataView(cabecalho.buffer).setUint32(16, 4096);
  cabecalho[20] = asPublica.length;
  return junta(cabecalho, asPublica, cifrado);
}

/** Cabeçalho Authorization (VAPID) para o serviço de push do endereço. */
export async function vapid(endpoint, chavePrivadaJwk, chavePublicaB64, assunto) {
  const aud = new URL(endpoint).origin;
  const cab = b64u.enc(txt(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corpo = b64u.enc(txt(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: assunto })));
  const chave = await crypto.subtle.importKey('jwk', chavePrivadaJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const assinatura = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, chave, txt(`${cab}.${corpo}`));
  return `vapid t=${cab}.${corpo}.${b64u.enc(assinatura)}, k=${chavePublicaB64}`;
}

/** Gera o par de chaves VAPID: privada em JWK, pública em base64url (65 bytes, sem compressão). */
export async function novasChavesVapid() {
  const par = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  return { privada: await crypto.subtle.exportKey('jwk', par.privateKey), publica: b64u.enc(await crypto.subtle.exportKey('raw', par.publicKey)) };
}

/** Envia uma mensagem. Devolve o status HTTP (404/410 = inscrição expirada). */
export async function enviar(inscricao, conteudo, chaves, assunto, ttl = 86400) {
  const corpo = await criptografar(conteudo, inscricao.p256dh, inscricao.auth);
  const r = await fetch(inscricao.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapid(inscricao.endpoint, chaves.privada, chaves.publica, assunto),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: 'high',
    },
    body: corpo,
  });
  return r.status;
}
