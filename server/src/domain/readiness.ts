/**
 * Document readiness — computed on the server from the SELECTED SCHEME's required
 * document list against the applicant's current documents.
 *
 * Rules:
 *  - Only the *current* (latest, non-superseded) version of each document type counts.
 *  - Optional documents never affect required-document completeness percentages.
 *  - "Submitted" and "verified" are reported separately.
 *  - Upload alone is never "verified" — that status only comes from a reviewer.
 */
import type { RequiredDocumentSpec } from './types';

export type DocReviewStatus = 'uploaded' | 'under_review' | 'verified' | 'changes_requested';

export interface CurrentDoc {
  type: string;
  reviewStatus: DocReviewStatus;
}

export interface ReadinessLine {
  type: string;
  label: string;
  optional: boolean;
  state: 'missing' | 'uploaded' | 'under_review' | 'verified' | 'changes_requested';
}

export interface ReadinessResult {
  requiredTotal: number;
  requiredSubmitted: number;
  requiredVerified: number;
  optionalSubmitted: number;
  optionalVerified: number;
  submittedPct: number; // required only
  verifiedPct: number; // required only
  changesRequested: number;
  complete: boolean; // every required doc verified
  lines: ReadinessLine[];
}

const pct = (n: number, d: number) => (d === 0 ? 100 : Math.round((n / d) * 100));

export function computeReadiness(required: RequiredDocumentSpec[], current: CurrentDoc[]): ReadinessResult {
  const byType = new Map(current.map((d) => [d.type, d]));

  const lines: ReadinessLine[] = required.map((spec) => {
    const doc = byType.get(spec.type);
    const state: ReadinessLine['state'] = !doc ? 'missing' : doc.reviewStatus;
    return { type: spec.type, label: spec.label, optional: !!spec.optional, state };
  });

  const req = lines.filter((l) => !l.optional);
  const opt = lines.filter((l) => l.optional);
  const isSubmitted = (s: ReadinessLine['state']) => s !== 'missing';
  const isVerified = (s: ReadinessLine['state']) => s === 'verified';

  const requiredSubmitted = req.filter((l) => isSubmitted(l.state)).length;
  const requiredVerified = req.filter((l) => isVerified(l.state)).length;

  return {
    requiredTotal: req.length,
    requiredSubmitted,
    requiredVerified,
    optionalSubmitted: opt.filter((l) => isSubmitted(l.state)).length,
    optionalVerified: opt.filter((l) => isVerified(l.state)).length,
    submittedPct: pct(requiredSubmitted, req.length),
    verifiedPct: pct(requiredVerified, req.length),
    changesRequested: lines.filter((l) => l.state === 'changes_requested').length,
    complete: req.length > 0 && requiredVerified === req.length,
    lines,
  };
}
