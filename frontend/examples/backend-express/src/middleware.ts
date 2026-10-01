import type { NextFunction, Request, Response } from 'express';
import { config } from './config.ts';
import { verifyAccessToken, verifyFirebaseIdToken } from './tokens.ts';

export interface AuthInfo {
  userId: string;
  email?: string;
  provider: 'faisca' | 'firebase';
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthInfo;
  }
}

/**
 * Protects a route. Accepts:
 * 1. access tokens issued by this API (backend adapter);
 * 2. Firebase ID tokens, when FIREBASE_PROJECT_ID is set (firebase adapter).
 */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ code: 'unauthorized', message: 'Missing bearer token.' });
    return;
  }

  try {
    req.auth = { ...(await verifyAccessToken(token)), provider: 'faisca' };
    return next();
  } catch {
    // Not one of ours; maybe a Firebase token.
  }

  if (config.firebaseProjectId) {
    try {
      req.auth = {
        ...(await verifyFirebaseIdToken(token, config.firebaseProjectId)),
        provider: 'firebase',
      };
      return next();
    } catch {
      // fall through
    }
  }

  res.status(401).json({ code: 'unauthorized', message: 'Invalid or expired token.' });
}

/** Tiny fixed-window rate limiter for auth endpoints. Use a shared store in production. */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    entry.count++;
    if (entry.count > max) {
      res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
      res.status(429).json({ code: 'too-many-requests', message: 'Too many attempts.' });
      return;
    }
    next();
  };
}
