import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export interface UserRecord {
  id: string;
  email: string;
  name: string | null;
  photoUrl: string | null;
  emailVerified: boolean;
  googleSub?: string;
  passwordHash?: string;
}

/** Public shape returned to the front-end (matches AuthUser). */
export function toPublicUser(user: UserRecord, signInMethod: 'google' | 'password') {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    photoUrl: user.photoUrl,
    emailVerified: user.emailVerified,
    signInMethod,
  };
}

/**
 * In-memory user store, so the example runs without a database.
 * Replace these functions with your ORM/DB calls (Prisma, Drizzle, Mongo...).
 */
const byId = new Map<string, UserRecord>();
const byEmail = new Map<string, string>();

export const users = {
  findById: (id: string) => byId.get(id) ?? null,

  findByEmail: (email: string) => {
    const id = byEmail.get(email.toLowerCase());
    return id ? (byId.get(id) ?? null) : null;
  },

  create(data: Omit<UserRecord, 'id'>): UserRecord {
    const user = { ...data, id: randomUUID(), email: data.email.toLowerCase() };
    byId.set(user.id, user);
    byEmail.set(user.email, user.id);
    return user;
  },

  update(user: UserRecord, patch: Partial<UserRecord>): UserRecord {
    const next = { ...user, ...patch };
    byId.set(next.id, next);
    return next;
  },
};

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

export async function verifyPassword(
  password: string,
  stored: string | undefined,
): Promise<boolean> {
  if (!stored) return false;
  const [, saltB64, hashB64] = stored.split('$');
  if (!saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64url');
  const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64url'), expected.length);
  return timingSafeEqual(actual, expected);
}
