import { createHash, randomBytes } from 'node:crypto';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import { config } from './config.ts';

const secret = new TextEncoder().encode(config.jwtSecret);
const ISSUER = 'faisca-api';
const AUDIENCE = 'faisca-web';

/** Short-lived access token (JWT, HS256). Sent by the front-end as a Bearer token. */
export function signAccessToken(user: { id: string; email: string }) {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${config.accessTokenTtlSeconds}s`)
    .sign(secret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret, { issuer: ISSUER, audience: AUDIENCE });
  return { userId: payload.sub!, email: payload.email as string | undefined };
}

/**
 * Firebase ID tokens are standard JWTs signed by Google. They can be verified
 * with any JWT library (no Firebase Admin SDK needed) by checking the
 * signature, issuer and audience.
 */
const firebaseKeys = createRemoteJWKSet(
  new URL(
    'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com',
  ),
);

export async function verifyFirebaseIdToken(token: string, projectId: string) {
  const { payload } = await jwtVerify(token, firebaseKeys, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });
  return { userId: payload.sub!, email: payload.email as string | undefined };
}

/**
 * Opaque refresh tokens, stored hashed and rotated on every use.
 * In production keep them in your database (or Redis) instead of memory.
 */
interface RefreshEntry {
  userId: string;
  expiresAt: number;
  signInMethod: 'google' | 'password';
}
const refreshTokens = new Map<string, RefreshEntry>();
const hash = (token: string) => createHash('sha256').update(token).digest('base64url');

export function issueRefreshToken(userId: string, signInMethod: RefreshEntry['signInMethod']) {
  const token = randomBytes(32).toString('base64url');
  refreshTokens.set(hash(token), {
    userId,
    signInMethod,
    expiresAt: Date.now() + config.refreshTokenTtlSeconds * 1000,
  });
  return token;
}

/** Validates and revokes the token (rotation). Returns its entry or null. */
export function consumeRefreshToken(token: string | undefined): RefreshEntry | null {
  if (!token) return null;
  const key = hash(token);
  const entry = refreshTokens.get(key);
  refreshTokens.delete(key);
  if (!entry || entry.expiresAt < Date.now()) return null;
  return entry;
}

export function revokeRefreshToken(token: string | undefined) {
  if (token) refreshTokens.delete(hash(token));
}
