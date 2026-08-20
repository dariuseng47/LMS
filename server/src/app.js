import express from 'express';
import cookieParser from 'cookie-parser';

import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { corsMiddleware, globalRateLimiter, helmetMiddleware } from './middleware/security.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmetMiddleware);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use(globalRateLimiter);

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use('/api/v1', routes);

  app.use((req, res) => res.status(404).json({ error: 'NOT_FOUND' }));
  app.use(errorHandler);

  return app;
}
