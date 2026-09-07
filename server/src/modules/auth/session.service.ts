import type { Request, Response } from 'express';
import { env } from '../../config/env';
import { randomToken, sha256 } from '../../lib/ids';
import { Session, type SessionDoc } from '../../models/Session';
import { User, type UserDoc } from '../../models/User';

export const SESSION_COOKIE = 'sf_session';

export function sessionCookieOptions(maxAgeMs: number = env.sessionTtlMs) {
  return {
    httpOnly: true,
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: maxAgeMs,
  };
}

export async function createSession(userId: string, req: Request, res: Response): Promise<SessionDoc> {
  const token = randomToken(32);
  const session = await Session.create({
    userId,
    tokenHash: sha256(token),
    userAgent: (req.header('user-agent') ?? '').slice(0, 300),
    ip: req.ip ?? '',
    expiresAt: new Date(Date.now() + env.sessionTtlMs),
  });
  res.cookie(SESSION_COOKIE, token, sessionCookieOptions());
  return session;
}

export interface ResolvedSession {
  session: SessionDoc;
  user: UserDoc;
}

export async function resolveSession(token: string): Promise<ResolvedSession | null> {
  if (!token) return null;
  const session = await Session.findOne({ tokenHash: sha256(token) });
  if (!session) return null;
  if (session.revokedAt) return null;
  if (session.expiresAt.getTime() <= Date.now()) return null;

  const user = await User.findById(session.userId).select('+passwordHash');
  if (!user || user.accountStatus !== 'active') return null;

  // Touch lastUsedAt at most once a minute to avoid a write per request.
  if (Date.now() - session.lastUsedAt.getTime() > 60_000) {
    session.lastUsedAt = new Date();
    await session.save();
  }
  return { session, user };
}

export async function revokeSession(session: SessionDoc): Promise<void> {
  session.revokedAt = new Date();
  await session.save();
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await Session.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { ...sessionCookieOptions(0), maxAge: undefined });
}
