import { describe, expect, it } from 'vitest';
import { checkTransition } from '../../src/domain/application-status';

describe('application status machine', () => {
  it('allows the happy path', () => {
    expect(checkTransition('submit', 'DRAFT', 'CITIZEN').ok).toBe(true);
    expect(checkTransition('assign', 'SUBMITTED', 'ADMIN').ok).toBe(true);
    expect(checkTransition('start_review', 'ASSIGNED', 'PARTNER').ok).toBe(true);
    expect(checkTransition('approve', 'UNDER_REVIEW', 'PARTNER').ok).toBe(true);
  });

  it('rejects invalid source states', () => {
    const r = checkTransition('approve', 'DRAFT', 'PARTNER');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('INVALID_TRANSITION');
  });

  it('rejects transitions by the wrong role', () => {
    const r = checkTransition('assign', 'SUBMITTED', 'CITIZEN');
    expect(r.ok).toBe(false);
    expect(r.code).toBe('FORBIDDEN_TRANSITION');
  });

  it('requires a reason for request_changes, reject and reassign', () => {
    expect(checkTransition('request_changes', 'UNDER_REVIEW', 'PARTNER').code).toBe('REASON_REQUIRED');
    expect(checkTransition('reject', 'UNDER_REVIEW', 'PARTNER').code).toBe('REASON_REQUIRED');
    expect(checkTransition('reassign', 'ASSIGNED', 'ADMIN').code).toBe('REASON_REQUIRED');
    expect(checkTransition('reject', 'UNDER_REVIEW', 'PARTNER', 'incomplete documents').ok).toBe(true);
  });

  it('supports the resubmit loop CHANGES_REQUESTED -> UNDER_REVIEW', () => {
    expect(checkTransition('resubmit', 'CHANGES_REQUESTED', 'CITIZEN').ok).toBe(true);
    expect(checkTransition('resubmit', 'CHANGES_REQUESTED', 'PARTNER').code).toBe('FORBIDDEN_TRANSITION');
  });

  it('does not allow leaving a terminal state', () => {
    for (const action of ['submit', 'assign', 'start_review', 'approve', 'reject', 'resubmit'] as const) {
      expect(checkTransition(action, 'APPROVED', 'ADMIN').ok).toBe(false);
      expect(checkTransition(action, 'REJECTED', 'ADMIN').ok).toBe(false);
    }
  });
});
