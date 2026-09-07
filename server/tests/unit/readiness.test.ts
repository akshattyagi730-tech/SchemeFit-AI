import { describe, expect, it } from 'vitest';
import { computeReadiness } from '../../src/domain/readiness';
import type { RequiredDocumentSpec } from '../../src/domain/types';

const required: RequiredDocumentSpec[] = [
  { type: 'identity_proof', label: 'ID' },
  { type: 'pan_card', label: 'PAN' },
  { type: 'bank_statement', label: 'Bank' },
  { type: 'extra_note', label: 'Optional note', optional: true },
];

describe('document readiness (server-computed from scheme requirements)', () => {
  it('reports submitted and verified separately for required docs only', () => {
    const r = computeReadiness(required, [
      { type: 'identity_proof', reviewStatus: 'verified' },
      { type: 'pan_card', reviewStatus: 'under_review' },
      { type: 'extra_note', reviewStatus: 'verified' },
    ]);
    expect(r.requiredTotal).toBe(3);
    expect(r.requiredSubmitted).toBe(2);
    expect(r.requiredVerified).toBe(1);
    expect(r.submittedPct).toBe(67);
    expect(r.verifiedPct).toBe(33);
    expect(r.complete).toBe(false);
  });

  it('optional documents never affect required-doc completeness', () => {
    const withOptional = computeReadiness(required, [
      { type: 'identity_proof', reviewStatus: 'verified' },
      { type: 'pan_card', reviewStatus: 'verified' },
      { type: 'bank_statement', reviewStatus: 'verified' },
      { type: 'extra_note', reviewStatus: 'uploaded' },
    ]);
    expect(withOptional.verifiedPct).toBe(100);
    expect(withOptional.complete).toBe(true);
    expect(withOptional.optionalSubmitted).toBe(1);
  });

  it('an uploaded (not reviewed) document is submitted but not verified', () => {
    const r = computeReadiness(required, [{ type: 'identity_proof', reviewStatus: 'uploaded' }]);
    const line = r.lines.find((l) => l.type === 'identity_proof')!;
    expect(line.state).toBe('uploaded');
    expect(r.requiredVerified).toBe(0);
  });

  it('counts changes_requested lines', () => {
    const r = computeReadiness(required, [{ type: 'bank_statement', reviewStatus: 'changes_requested' }]);
    expect(r.changesRequested).toBe(1);
  });
});
