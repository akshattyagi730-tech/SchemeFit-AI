import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { ok, created } from '../../lib/http';
import { badRequest, unprocessable } from '../../lib/errors';
import { env } from '../../config/env';
import { DigiLockerConnection } from '../../models/DigiLockerConnection';
import { Scheme } from '../../models/Scheme';
import { findApplicationOr404, assertCanAccess } from '../applications/applications.service';
import { importDigiLockerDocument } from '../documents/documents.service';
import { serializeDocument } from '../documents/documents.serialize';
import { readinessForApplication } from '../applications/readiness.service';
import { recordAudit } from '../audit/audit.service';
import { getDigiLocker } from './index';

const OAUTH_COOKIE = 'sf_dl_oauth';
const b64url = (b: Buffer) => b.toString('base64url');

/**
 * The origin the browser is actually on. The SPA proxies /api to this API, so
 * the whole OAuth round-trip must stay on that origin (otherwise the callback
 * lands on a different host and the session + state cookies are not sent).
 * Falls back to the configured client origin.
 */
function frontendOrigin(req: Request): string {
  const candidates = [req.get('origin'), req.get('referer')].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      const o = new URL(c).origin;
      if (env.clientOrigins.includes(o)) return o;
    } catch {
      /* ignore */
    }
  }
  return env.clientOrigins[0] ?? `${req.protocol}://${req.get('host')}`;
}

function callbackUrl(front: string): string {
  return env.DIGILOCKER_REDIRECT_URI || `${front}/api/v1/digilocker/callback`;
}

function oauthCookieOptions() {
  return {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/api/v1/digilocker',
    maxAge: 10 * 60 * 1000,
  };
}

export async function status(req: Request, res: Response): Promise<void> {
  const conn = await DigiLockerConnection.findOne({ userId: req.auth!.userId });
  const provider = getDigiLocker();
  ok(res, {
    connected: !!conn && conn.expiresAt.getTime() > Date.now(),
    provider: provider.mode,
    name: conn?.name ?? null,
    maskedAadhaar: conn?.maskedAadhaar ?? null,
    connectedAt: conn?.connectedAt ?? null,
  });
}

export async function connect(req: Request, res: Response): Promise<void> {
  const provider = getDigiLocker();
  const state = b64url(randomBytes(16));
  const verifier = b64url(randomBytes(32));
  const challenge = b64url(createHash('sha256').update(verifier).digest());
  const front = frontendOrigin(req);

  res.cookie(OAUTH_COOKIE, JSON.stringify({ state, verifier, front }), oauthCookieOptions());
  const authorizeUrl = provider.authorizeUrl({ state, codeChallenge: challenge, redirectUri: callbackUrl(front) });
  ok(res, { authorizeUrl, provider: provider.mode });
}

export async function callback(req: Request, res: Response): Promise<void> {
  const raw = req.cookies?.[OAUTH_COOKIE] as string | undefined;
  res.clearCookie(OAUTH_COOKIE, { ...oauthCookieOptions(), maxAge: undefined });

  let parsed: { state: string; verifier: string; front?: string } | null = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const spa = (parsed?.front && env.clientOrigins.includes(parsed.front) ? parsed.front : env.clientOrigins[0]) ?? 'http://localhost:5173';
  const fail = (reason: string) => res.redirect(`${spa}/documents?digilocker=error&reason=${encodeURIComponent(reason)}`);

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';

  if (!code || !parsed) return void fail('missing_code');
  if (!parsed.state || parsed.state !== state) return void fail('state_mismatch');
  if (!req.auth) return void fail('not_signed_in');

  try {
    const provider = getDigiLocker();
    const session = await provider.exchangeCode({ code, codeVerifier: parsed.verifier, redirectUri: callbackUrl(parsed.front ?? spa) });
    await DigiLockerConnection.findOneAndUpdate(
      { userId: req.auth.userId },
      {
        userId: req.auth.userId,
        provider: provider.mode,
        digilockerId: session.digilockerId,
        name: session.name,
        maskedAadhaar: session.maskedAadhaar ?? null,
        accessToken: session.accessToken,
        refreshToken: session.refreshToken,
        expiresAt: session.expiresAt,
        connectedAt: new Date(),
      },
      { upsert: true, new: true },
    );
    await recordAudit(req, { action: 'digilocker.connect', resourceType: 'DigiLockerConnection', resourceId: req.auth.userId });
    res.redirect(`${spa}/documents?digilocker=connected`);
  } catch {
    fail('exchange_failed');
  }
}

export async function disconnect(req: Request, res: Response): Promise<void> {
  await DigiLockerConnection.deleteOne({ userId: req.auth!.userId });
  await recordAudit(req, { action: 'digilocker.disconnect', resourceType: 'DigiLockerConnection', resourceId: req.auth!.userId });
  ok(res, { connected: false });
}

async function activeConnection(userId: string) {
  const conn = await DigiLockerConnection.findOne({ userId });
  if (!conn || conn.expiresAt.getTime() <= Date.now()) {
    throw badRequest('DigiLocker is not connected. Connect it first.');
  }
  return conn;
}

export async function issued(req: Request, res: Response): Promise<void> {
  const conn = await activeConnection(req.auth!.userId);
  const provider = getDigiLocker();
  const docs = await provider.listIssuedDocuments({ accessToken: conn.accessToken });
  ok(res, { documents: docs, provider: provider.mode });
}

export const importSchema = z.object({
  applicationId: z.string().min(1),
  uri: z.string().min(1).max(400),
  docType: z.string().min(2).max(60),
});

export async function importDoc(req: Request, res: Response): Promise<void> {
  const { applicationId, uri, docType } = req.body as z.infer<typeof importSchema>;
  const conn = await activeConnection(req.auth!.userId);
  const app = await findApplicationOr404(applicationId);
  await assertCanAccess(app, req);

  const provider = getDigiLocker();
  let file: { buffer: Buffer; mime: 'application/pdf'; issuer: string; name: string };
  try {
    file = await provider.fetchDocument({ accessToken: conn.accessToken }, uri);
  } catch {
    throw unprocessable('Could not fetch that document from DigiLocker. Try again.');
  }

  const doc = await importDigiLockerDocument({
    req,
    application: app,
    type: docType,
    buffer: file.buffer,
    mime: file.mime,
    originalName: `${file.name}.pdf`,
    issuer: file.issuer,
  });

  const scheme = await Scheme.findById(app.schemeId);
  const readiness = scheme ? await readinessForApplication(String(app._id), scheme) : null;
  created(res, { document: serializeDocument(doc), readiness });
}
