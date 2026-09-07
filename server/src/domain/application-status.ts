/**
 * Application status machine.
 *
 *   DRAFT ──submit──▶ SUBMITTED ──assign──▶ ASSIGNED ──start_review──▶ UNDER_REVIEW
 *                                                                         │
 *                       ┌─────────────────────────────────────────────────┤
 *                       ▼                       ▼                          ▼
 *               CHANGES_REQUESTED           APPROVED                   REJECTED
 *                       │
 *                       └──resubmit──▶ UNDER_REVIEW
 *
 * Every transition is its own named action with its own authorisation and
 * prerequisites — there is no generic "set status" operation.
 *
 * APPROVED / REJECTED here are prototype workflow outcomes. They do NOT represent
 * an actual government sanction or a disbursement.
 */

export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ASSIGNED',
  'UNDER_REVIEW',
  'CHANGES_REQUESTED',
  'APPROVED',
  'REJECTED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export type TransitionAction =
  | 'submit'
  | 'assign'
  | 'reassign'
  | 'start_review'
  | 'request_changes'
  | 'resubmit'
  | 'approve'
  | 'reject';

export type ActorRole = 'CITIZEN' | 'PARTNER' | 'ADMIN';

interface TransitionSpec {
  from: ApplicationStatus[];
  to: ApplicationStatus;
  roles: ActorRole[];
  reasonRequired: boolean;
}

export const TRANSITIONS: Record<TransitionAction, TransitionSpec> = {
  submit: { from: ['DRAFT'], to: 'SUBMITTED', roles: ['CITIZEN'], reasonRequired: false },
  assign: { from: ['SUBMITTED'], to: 'ASSIGNED', roles: ['ADMIN'], reasonRequired: false },
  reassign: { from: ['ASSIGNED', 'UNDER_REVIEW', 'CHANGES_REQUESTED'], to: 'ASSIGNED', roles: ['ADMIN'], reasonRequired: true },
  start_review: { from: ['ASSIGNED', 'CHANGES_REQUESTED'], to: 'UNDER_REVIEW', roles: ['PARTNER', 'ADMIN'], reasonRequired: false },
  request_changes: { from: ['UNDER_REVIEW'], to: 'CHANGES_REQUESTED', roles: ['PARTNER', 'ADMIN'], reasonRequired: true },
  resubmit: { from: ['CHANGES_REQUESTED'], to: 'UNDER_REVIEW', roles: ['CITIZEN'], reasonRequired: false },
  approve: { from: ['UNDER_REVIEW'], to: 'APPROVED', roles: ['PARTNER', 'ADMIN'], reasonRequired: false },
  reject: { from: ['UNDER_REVIEW'], to: 'REJECTED', roles: ['PARTNER', 'ADMIN'], reasonRequired: true },
};

export interface TransitionCheck {
  ok: boolean;
  code?: 'INVALID_TRANSITION' | 'FORBIDDEN_TRANSITION' | 'REASON_REQUIRED';
  message?: string;
  to?: ApplicationStatus;
}

export function checkTransition(
  action: TransitionAction,
  current: ApplicationStatus,
  role: ActorRole,
  reason?: string | null,
): TransitionCheck {
  const spec = TRANSITIONS[action];
  if (!spec) return { ok: false, code: 'INVALID_TRANSITION', message: `Unknown action "${action}".` };
  if (!spec.from.includes(current)) {
    return { ok: false, code: 'INVALID_TRANSITION', message: `Cannot ${action} an application in status ${current}.` };
  }
  if (!spec.roles.includes(role)) {
    return { ok: false, code: 'FORBIDDEN_TRANSITION', message: `Role ${role} may not perform "${action}".` };
  }
  if (spec.reasonRequired && (!reason || reason.trim().length < 3)) {
    return { ok: false, code: 'REASON_REQUIRED', message: `A reason (min 3 characters) is required to ${action}.` };
  }
  return { ok: true, to: spec.to };
}

export const TERMINAL_STATUSES: ApplicationStatus[] = ['APPROVED', 'REJECTED'];
