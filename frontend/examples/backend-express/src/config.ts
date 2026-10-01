function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    console.error(`✖ Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  console.error('✖ JWT_SECRET must be at least 32 characters long.');
  process.exit(1);
}

export const config = {
  port: Number(process.env.PORT ?? 3333),
  isProduction: process.env.NODE_ENV === 'production',
  frontendOrigins: (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  googleClientId: required('GOOGLE_CLIENT_ID'),
  googleClientSecret: required('GOOGLE_CLIENT_SECRET'),
  jwtSecret,
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID?.trim() || null,
  accessTokenTtlSeconds: 15 * 60,
  refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
};
