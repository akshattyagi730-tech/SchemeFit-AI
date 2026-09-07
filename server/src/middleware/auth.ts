import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { forbidden, unauthorized } from '../lib/errors';
import { resolveSession, SESSION_COOKIE } from '../modules/auth/session.service';
import type { UserRole } from '../models/User';

/**
 * Populate `req.auth` from the session cookie when present. Does NOT reject
 * anonymous requests — that is `requireAuth`'s job. Identity and role always come
 * from the server-side session, never from a client-supplied id/role.
 */
export async function loadSession(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const token = req.cookies?.[SESSION_COOKIE] as string | undefined;
    if (token) {
      const resolved = await resolveSession(token);
      if (resolved) {
        req.auth = {
          user: resolved.user,
          session: resolved.session,
          role: resolved.user.role,
          userId: String(resolved.user._id),
        };
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.auth) return next(unauthorized());
  next();
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(unauthorized());
    if (!roles.includes(req.auth.role)) return next(forbidden(`This action requires role: ${roles.join(' or ')}.`));
    next();
  };
}
