/**
 * Criptografia de ponta a ponta das escolhas da pessoa (acompanhados, cola, comparação...).
 *
 * A chave AES-256-GCM é derivada da "frase de sincronização" que só a pessoa conhece
 * (PBKDF2-SHA-256, 310 mil iterações, sal aleatório guardado junto do perfil). O servidor
 * recebe apenas o texto cifrado: nem o responsável pelo site consegue ler. A chave fica
 * no aparelho como CryptoKey NÃO exportável (IndexedDB), para não pedir a frase toda vez.
 */

const ITERACOES = 310_000;
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (const x of u) s += String.fromCharCode(x);
  return btoa(s);
}

export function deB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function novoSal(): string {
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}

export async function derivarChave(frase: string, sal: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(frase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: deB64(sal), iterations: ITERACOES },
    base,
    { name: 'AES-GCM', length: 256 },
    false, // não exportável
    ['encrypt', 'decrypt'],
  );
}

export async function cifrar(chave: CryptoKey, dados: unknown): Promise<{ cifra: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, chave, enc.encode(JSON.stringify(dados)));
  return { cifra: b64(c), iv: b64(iv) };
}

/** Lança erro se a chave estiver errada (o GCM confere a integridade). */
export async function decifrar<T>(chave: CryptoKey, cifra: string, iv: string): Promise<T> {
  const p = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deB64(iv) }, chave, deB64(cifra));
  return JSON.parse(dec.decode(p)) as T;
}

// ── Chave guardada no aparelho (IndexedDB), por conta ─────────────────────────

const BANCO = 'tanaurna-chaves';

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('chaves');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

async function tx<T>(modo: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const r = fn(db.transaction('chaves', modo).objectStore('chaves'));
    r.onsuccess = () => ok(r.result);
    r.onerror = () => erro(r.error);
  });
}

export async function guardarChave(uid: string, chave: CryptoKey): Promise<void> {
  try {
    await tx('readwrite', (s) => s.put(chave, uid));
  } catch {
    /* sem IndexedDB (janela privada): a frase será pedida de novo na próxima visita */
  }
}

export async function lerChave(uid: string): Promise<CryptoKey | null> {
  try {
    return ((await tx('readonly', (s) => s.get(uid))) as CryptoKey | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function esquecerChave(uid: string): Promise<void> {
  try {
    await tx('readwrite', (s) => s.delete(uid));
  } catch {
    /* nada a apagar */
  }
}
