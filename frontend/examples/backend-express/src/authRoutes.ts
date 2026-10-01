import { Router, type Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from './config.ts';
import { rateLimit } from './middleware.ts';
import {
  consumeRefreshToken,
  issueRefreshToken,
  revokeRefreshToken,
  signAccessToken,
} from './tokens.ts';
import { hashPassword, toPublicUser, users, verifyPassword, type UserRecord } from './users.ts';

const REFRESH_COOKIE = 'faisca_rt';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 'postmessage' is the redirect URI used by the GIS popup code flow.
const google = new OAuth2Client(config.googleClientId, config.googleClientSecret, 'postmessage');

export const authRoutes = Router();
authRoutes.use(rateLimit({ windowMs: 60_000, max: 30 }));

/** Starts a session: refresh token in an httpOnly cookie, access token in the body. */
async function startSession(res: Response, user: UserRecord, method: 'google' | 'password') {
  const refreshToken = issueRefreshToken(user.id, method);
  res.cookie(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: config.isProduction,
    // Use 'none' (+ secure) if front-end and API live on different sites.
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: config.refreshTokenTtlSeconds * 1000,
  });
  res.json({
    user: toPublicUser(user, method),
    accessToken: await signAccessToken(user),
    expiresIn: config.accessTokenTtlSeconds,
  });
}

/** POST /api/auth/google { code }: exchange the GIS authorization code. */
authRoutes.post('/google', async (req, res) => {
  const code = typeof req.body?.code === 'string' ? req.body.code : null;
  if (!code) {
    res.status(400).json({ code: 'unknown', message: 'Missing authorization code.' });
    return;
  }

  let payload;
  try {
    const { tokens } = await google.getToken(code);
    const ticket = await google.verifyIdToken({
      idToken: tokens.id_token!,
      audience: config.googleClientId,
    });
    payload = ticket.getPayload();
  } catch (error) {
    console.warn('Google code exchange failed:', error);
    res.status(401).json({ code: 'invalid-credentials', message: 'Google sign-in failed.' });
    return;
  }

  if (!payload?.email || !payload.email_verified) {
    res
      .status(403)
      .json({ code: 'user-disabled', message: 'Google account e-mail is not verified.' });
    return;
  }

  const profile = {
    name: payload.name ?? null,
    photoUrl: payload.picture ?? null,
    emailVerified: true,
    googleSub: payload.sub,
  };
  const existing = users.findByEmail(payload.email);
  const user = existing
    ? users.update(existing, profile) // links Google to an existing password account
    : users.create({ email: payload.email, ...profile });

  await startSession(res, user, 'google');
});

/** POST /api/auth/login { email, password } */
authRoutes.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const user = typeof email === 'string' ? users.findByEmail(email) : null;
  if (
    !user ||
    typeof password !== 'string' ||
    !(await verifyPassword(password, user.passwordHash))
  ) {
    res.status(401).json({ code: 'invalid-credentials', message: 'Invalid e-mail or password.' });
    return;
  }
  await startSession(res, user, 'password');
});

/** POST /api/auth/register { name, email, password } */
authRoutes.post('/register', async (req, res) => {
  const { name, email, password } = req.body ?? {};
  if (typeof email !== 'string' || !EMAIL_RE.test(email)) {
    res.status(400).json({ code: 'invalid-email', message: 'Invalid e-mail.' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ code: 'weak-password', message: 'Password too short.' });
    return;
  }
  if (users.findByEmail(email)) {
    res.status(409).json({ code: 'email-in-use', message: 'E-mail already registered.' });
    return;
  }
  const user = users.create({
    email,
    name: typeof name === 'string' && name.trim() ? name.trim() : null,
    photoUrl: null,
    emailVerified: false,
    passwordHash: await hashPassword(password),
  });
  await startSession(res, user, 'password');
});

/** POST /api/auth/password-reset { email }: always 204 to avoid account enumeration. */
authRoutes.post('/password-reset', (req, res) => {
  const email = req.body?.email;
  if (typeof email === 'string' && users.findByEmail(email)) {
    // Send the e-mail with your provider (Resend, SES, SendGrid...) here.
    console.info(`[password-reset] would send a reset link to ${email}`);
  }
  res.status(204).end();
});

/** POST /api/auth/refresh: rotates the refresh cookie and returns a new access token. */
authRoutes.post('/refresh', async (req, res) => {
  const entry = consumeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  const user = entry ? users.findById(entry.userId) : null;
  if (!entry || !user) {
    res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
    res.status(401).json({ code: 'invalid-credentials', message: 'No active session.' });
    return;
  }
  await startSession(res, user, entry.signInMethod);
});

/** POST /api/auth/logout */
authRoutes.post('/logout', (req, res) => {
  revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
  res.clearCookie(REFRESH_COOKIE, { path: '/api/auth' });
  res.status(204).end();
});
