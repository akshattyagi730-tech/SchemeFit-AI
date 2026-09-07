import type { NextFunction, Request, Response } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { randomToken } from '../lib/ids';
import { env } from '../config/env';
import { forbidden } from '../lib/errors';

export const CSRF_COOKIE = 'sf_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfCookieOptions() {
  return {
    httpOnly: false, // must be readable by the SPA to echo back in the header
    sameSite: env.cookieSameSite,
    secure: env.cookieSecure,
    domain: env.COOKIE_DOMAIN || undefined,
    path: '/',
    maxAge: env.sessionTtlMs,
  };
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/**
 * Double-submit-cookie CSRF protection for cookie-based sessions.
 *  - Safe methods: ensure a random CSRF token cookie exists.
 *  - Unsafe methods: require `x-csrf-token` header to equal the cookie value.
 */
export function csrf(req: Request, res: Response, next: NextFunction): void {
  let token = req.cookies?.[CSRF_COOKIE] as string | undefined;

  if (!token) {
    token = randomToken(24);
    res.cookie(CSRF_COOKIE, token, csrfCookieOptions());
  }
  // Expose the active token to handlers on this request (the cookie above is
  // only visible to the *next* request).
  res.locals.csrfToken = token;

  if (SAFE_METHODS.has(req.method)) return next();

  const header = req.header(CSRF_HEADER);
  if (!header || !token || !safeEqual(header, token)) {
    return next(forbidden('Invalid or missing CSRF token. Fetch /api/v1/auth/csrf and resend with the ' + CSRF_HEADER + ' header.'));
  }
  next();
}
