import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env';
import { logger } from './lib/logger';
import { requestContext } from './middleware/request-context';
import { csrf } from './middleware/csrf';
import { loadSession } from './middleware/auth';
import { apiLimiter } from './middleware/rate-limit';
import { errorHandler, notFoundHandler } from './middleware/error-handler';
import { apiRouter } from './api';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false, // API only; the SPA sets its own CSP
      // When the SPA is on a different site (SameSite=None), authenticated
      // document downloads via fetch need a cross-origin resource policy.
      crossOriginResourcePolicy: { policy: env.crossSite ? 'cross-origin' : 'same-site' },
    }),
  );

  // Exact-origin CORS for the cookie-based SPA. CLIENT_ORIGIN may be a single
  // origin or a comma-separated allow-list (prod + preview deployments).
  const allowList = new Set(env.clientOrigins);
  app.use(
    cors({
      origin(origin, cb) {
        // Same-origin / server-to-server / curl requests have no Origin header.
        if (!origin || allowList.has(origin.replace(/\/$/, ''))) return cb(null, true);
        // Disallowed origin: respond WITHOUT CORS headers (the browser blocks it)
        // rather than throwing — no 500, no stack trace.
        return cb(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );

  app.use(requestContext);
  if (!env.isTest) {
    app.use(
      pinoHttp({
        logger,
        genReqId: (req) => (req as { requestId?: string }).requestId ?? 'unknown',
        autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
      }),
    );
  }

  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());

  app.use('/api/v1', apiLimiter, loadSession, csrf, apiRouter);

  app.get('/', (_req, res) => res.json({ name: 'SchemeFit AI API', docs: '/api/v1/docs', health: '/api/v1/health' }));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
