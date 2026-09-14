import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { config } from './config/env.js';
import { buildRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

export const createApp = () => {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(compression());
  app.use(cors({ origin: config.clientOrigin, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  if (!config.isProd) app.use(morgan('dev'));

  app.use('/api', rateLimit({ windowMs: 60_000, limit: 600, standardHeaders: 'draft-7', legacyHeaders: false }));
  app.use('/api/auth/login', rateLimit({ windowMs: 60_000, limit: 20, message: { error: { message: 'Too many sign-in attempts. Wait a minute.' } } }));

  app.use('/api', buildRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
