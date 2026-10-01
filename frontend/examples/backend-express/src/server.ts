import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { apiRoutes } from './apiRoutes.ts';
import { authRoutes } from './authRoutes.ts';
import { config } from './config.ts';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(cors({ origin: config.frontendOrigins, credentials: true }));
app.use(express.json({ limit: '100kb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ code: 'unknown', message: 'Internal server error.' });
});

app.listen(config.port, () => {
  console.log(`✔ Faísca API on http://localhost:${config.port}/api`);
  console.log(`  CORS origins: ${config.frontendOrigins.join(', ')}`);
  if (config.firebaseProjectId)
    console.log(`  Accepting Firebase ID tokens for ${config.firebaseProjectId}`);
});
