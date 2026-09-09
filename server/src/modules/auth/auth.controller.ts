import type { Request, Response } from 'express';
import { hashPassword, verifyPassword } from '../../lib/password';
import { badRequest, conflict, unauthorized } from '../../lib/errors';
import { ok, created } from '../../lib/http';
import { User, type UserDoc } from '../../models/User';
import { CitizenProfile } from '../../models/CitizenProfile';
import { recordAudit } from '../audit/audit.service';
import { notify } from '../notifications/notifications.service';
import {
  clearSessionCookie,
  createSession,
  revokeAllForUser,
  revokeSession,
} from './session.service';
import { CSRF_COOKIE } from '../../middleware/csrf';
import type { RegisterInput, LoginInput } from './auth.schemas';

// A precomputed Argon2id hash of a random string — used to equalise timing when
// the email is unknown so we don't leak account existence.
let decoyHash = '';
async function getDecoyHash(): Promise<string> {
  if (!decoyHash) decoyHash = await hashPassword('decoy-' + Math.random());
  return decoyHash;
}

function publicUser(u: UserDoc) {
  return {
    id: String(u._id),
    email: u.email,
    role: u.role,
    displayName: u.displayName,
    partnerOrganizationId: u.partnerOrganizationId ? String(u.partnerOrganizationId) : null,
    accountStatus: u.accountStatus,
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { email, password, fullName } = req.body as RegisterInput;

  const existing = await User.findOne({ email }).lean();
  if (existing) throw conflict('An account with this email already exists', 'EMAIL_IN_USE');

  const passwordHash = await hashPassword(password);
  // Self-registration ALWAYS creates a CITIZEN. Role can never be chosen by the client.
  const user = await User.create({ email, passwordHash, role: 'CITIZEN', displayName: fullName });
  await CitizenProfile.create({ userId: user._id, fullName });

  await createSession(String(user._id), req, res);
  await recordAudit(req, { action: 'auth.register', resourceType: 'User', resourceId: String(user._id) });
  await notify({
    recipientUserId: String(user._id),
    event: 'account_welcome',
    title: 'Welcome to SchemeFit AI',
    message: 'Open “Get Started” to answer a few questions — we’ll match every scheme you’re eligible for and list the documents you need.',
    link: '/start',
  });

  created(res, { user: publicUser(user) });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as LoginInput;

  const user = await User.findOne({ email }).select('+passwordHash');
  const hash = user?.passwordHash ?? (await getDecoyHash());
  const passwordOk = await verifyPassword(hash, password);

  if (!user || !passwordOk) {
    await recordAudit(req, { action: 'auth.login', resourceType: 'User', resourceId: user ? String(user._id) : null, outcome: 'failure' });
    // Generic message regardless of which check failed.
    throw unauthorized('Invalid email or password');
  }
  if (user.accountStatus !== 'active') {
    await recordAudit(req, { action: 'auth.login', resourceType: 'User', resourceId: String(user._id), outcome: 'failure', reason: 'account_suspended' });
    throw unauthorized('Invalid email or password');
  }

  user.lastLoginAt = new Date();
  await user.save();
  await createSession(String(user._id), req, res);
  await recordAudit(req, { action: 'auth.login', resourceType: 'User', resourceId: String(user._id) });

  ok(res, { user: publicUser(user) });
}

export async function logout(req: Request, res: Response): Promise<void> {
  if (req.auth) {
    await revokeSession(req.auth.session);
    await recordAudit(req, { action: 'auth.logout', resourceType: 'Session', resourceId: String(req.auth.session._id) });
  }
  clearSessionCookie(res);
  ok(res, { loggedOut: true });
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw unauthorized();
  await revokeAllForUser(req.auth.userId);
  clearSessionCookie(res);
  await recordAudit(req, { action: 'auth.logout_all', resourceType: 'User', resourceId: req.auth.userId });
  ok(res, { loggedOut: true });
}

export async function me(req: Request, res: Response): Promise<void> {
  if (!req.auth) throw unauthorized();
  const { user } = req.auth;
  let profileComplete = false;
  if (user.role === 'CITIZEN') {
    const profile = await CitizenProfile.findOne({ userId: user._id }).lean();
    profileComplete = !!(
      profile &&
      profile.age != null &&
      profile.annualIncomePaise != null &&
      profile.category &&
      profile.state &&
      profile.district &&
      profile.areaType &&
      profile.purpose
    );
  }
  ok(res, {
    user: publicUser(user),
    session: { expiresAt: req.auth.session.expiresAt, issuedAt: req.auth.session.createdAt },
    profileComplete,
  });
}

export function csrf(req: Request, res: Response): void {
  // The csrf middleware set res.locals.csrfToken (the cookie is only visible on
  // the *next* request).
  ok(res, { csrfToken: (res.locals.csrfToken as string) ?? (req.cookies?.[CSRF_COOKIE] as string) ?? null });
}
