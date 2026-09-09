import 'dotenv/config';
import { z } from 'zod';

const boolish = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.enum(['true', 'false', '1', '0', 'yes', 'no', '']))
  .transform((v) => v === 'true' || v === '1' || v === 'yes');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  // One origin, or a comma-separated allow-list (e.g. prod + Vercel preview URLs).
  CLIENT_ORIGIN: z.string().min(1).default('http://localhost:5173'),

  MONGO_URL: z.string().min(1).default('mongodb://127.0.0.1:27017/schemefit'),
  MONGO_URL_TEST: z.string().min(1).default('mongodb://127.0.0.1:27017/schemefit_test'),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().default(168),
  COOKIE_DOMAIN: z.string().optional().default(''),
  COOKIE_SECURE: boolish.optional().default('false'),
  // 'lax' for same-site (dev proxy / same domain). 'none' is REQUIRED when the
  // SPA is served from a different site than the API (e.g. Vercel + Render).
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  LOGIN_RATE_MAX: z.coerce.number().int().positive().default(5),
  LOGIN_RATE_WINDOW_MINUTES: z.coerce.number().int().positive().default(15),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_DIR: z.string().default('./var/uploads'),
  UPLOAD_MAX_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),

  S3_BUCKET: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('ap-south-1'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),
  S3_FORCE_PATH_STYLE: boolish.optional().default('true'),

  // DigiLocker (Meripehchaan) OAuth 2.0. When CLIENT_ID + CLIENT_SECRET are set
  // the live provider is used; otherwise a local mock drives the same flow so
  // the feature is demoable without partner onboarding.
  DIGILOCKER_CLIENT_ID: z.string().optional().default(''),
  DIGILOCKER_CLIENT_SECRET: z.string().optional().default(''),
  DIGILOCKER_REDIRECT_URI: z.string().optional().default(''),
  DIGILOCKER_AUTH_URL: z.string().optional().default('https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize'),
  DIGILOCKER_TOKEN_URL: z.string().optional().default('https://digilocker.meripehchaan.gov.in/public/oauth2/1/token'),
  DIGILOCKER_API_BASE: z.string().optional().default('https://digilocker.meripehchaan.gov.in/public/oauth2'),

  SEED_ADMIN_EMAIL: z.string().email().optional().default('admin@schemefit.dev'),
  SEED_ADMIN_PASSWORD: z.string().min(8).optional().default('DevAdmin!2026'),
  // When 'true', the server runs the idempotent seed on boot IF the users
  // collection is empty (used for a one-shot demo deploy where there is no shell).
  SEED_ON_BOOT: boolish.optional().default('false'),
  SEED_ALLOW_PROD: boolish.optional().default('false'),
});

// In test mode we do not require a strong external secret.
if (process.env.NODE_ENV === 'test' && !process.env.SESSION_SECRET) {
  process.env.SESSION_SECRET = 'test-session-secret-value-at-least-32-characters-long';
}

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error('❌ Invalid environment configuration:\n', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

const clientOrigins = raw.CLIENT_ORIGIN.split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);

const isProd = raw.NODE_ENV === 'production';
// SameSite=None cookies are only honoured by browsers when Secure is also set.
const cookieSameSite = raw.COOKIE_SAMESITE;
const cookieSecure = isProd || cookieSameSite === 'none' ? true : raw.COOKIE_SECURE;

export const env = {
  ...raw,
  isProd,
  isTest: raw.NODE_ENV === 'test',
  isDev: raw.NODE_ENV === 'development',
  clientOrigins,
  cookieSameSite,
  cookieSecure,
  // True when the browser will treat the SPA origin and the API origin as
  // different sites (drives CORP + cookie SameSite behaviour).
  crossSite: cookieSameSite === 'none',
  mongoUrl: raw.NODE_ENV === 'test' ? raw.MONGO_URL_TEST : raw.MONGO_URL,
  sessionTtlMs: raw.SESSION_TTL_HOURS * 60 * 60 * 1000,
  loginRateWindowMs: raw.LOGIN_RATE_WINDOW_MINUTES * 60 * 1000,
  digilockerLive: Boolean(raw.DIGILOCKER_CLIENT_ID && raw.DIGILOCKER_CLIENT_SECRET && raw.DIGILOCKER_REDIRECT_URI),
};

if (env.isProd && env.STORAGE_DRIVER === 's3' && !env.S3_BUCKET) {
  // eslint-disable-next-line no-console
  console.error('❌ STORAGE_DRIVER=s3 requires S3_BUCKET');
  process.exit(1);
}

if (env.isProd && env.crossSite && !env.clientOrigins.every((o) => o.startsWith('https://'))) {
  // eslint-disable-next-line no-console
  console.error('❌ COOKIE_SAMESITE=none requires every CLIENT_ORIGIN to be https://');
  process.exit(1);
}

export type Env = typeof env;
