import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

const json429 = (_req: unknown, res: { status: (n: number) => { json: (b: unknown) => void } }) =>
  res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down and try again shortly.' } });

/** Strict limiter for authentication attempts (login / register). */
export const authLimiter = rateLimit({
  windowMs: env.loginRateWindowMs,
  limit: env.LOGIN_RATE_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: json429,
  // Rate-limit per source IP + submitted email so one IP can't lock every account.
  keyGenerator: (req) => `${req.ip}:${(req.body?.email ?? '').toString().toLowerCase()}`,
});

/** Broad safety limiter for the whole API. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: env.isTest ? 100_000 : 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: json429,
});
