import type { Request, Response } from 'express';
import { ok } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { Scheme } from '../../models/Scheme';
import { CitizenProfile } from '../../models/CitizenProfile';
import { evaluateEligibility } from '../../domain/eligibility';
import { scoreScheme } from '../../domain/ranking';
import {
  hasCompleteFinancing,
  profileToFacts,
  profileToFinancing,
  schemeToRankable,
  schemeToRuleSet,
} from '../../domain/adapters';
import { serializeScheme } from '../schemes/schemes.serialize';

/**
 * Deterministic recommendation set for the signed-in citizen.
 * Recomputed on every request from the current profile + active schemes, so a
 * profile edit is reflected immediately — without touching submitted
 * applications (which carry their own snapshots).
 */
export async function getRecommendations(req: Request, res: Response): Promise<void> {
  const profile = await CitizenProfile.findOne({ userId: req.auth!.userId });
  if (!profile) throw notFound('Complete your profile first');

  const facts = profileToFacts(profile);
  const financing = profileToFinancing(profile);
  const financingComplete = hasCompleteFinancing(financing);

  const schemes = await Scheme.find({ status: 'active' }).sort({ name: 1 });

  const eligible: unknown[] = [];
  const needsInfo: unknown[] = [];
  const ineligible: unknown[] = [];

  for (const scheme of schemes) {
    const evaluation = evaluateEligibility(schemeToRuleSet(scheme), facts, financing);
    const base = {
      scheme: serializeScheme(scheme),
      eligibility: {
        status: evaluation.status,
        conditions: evaluation.conditions,
        passed: evaluation.passed.map((c) => c.key),
        failed: evaluation.failed.map((c) => ({ key: c.key, label: c.label, detail: c.detail })),
        unknown: evaluation.unknown.map((c) => ({ key: c.key, label: c.label, detail: c.detail })),
        advisories: evaluation.advisories.map((c) => ({ key: c.key, label: c.label, detail: c.detail })),
      },
    };

    if (evaluation.status === 'eligible' && financingComplete) {
      const suitability = scoreScheme(schemeToRankable(scheme), facts, financing);
      eligible.push({ ...base, suitability });
    } else if (evaluation.status === 'ineligible') {
      ineligible.push(base);
    } else {
      // eligible-but-missing-financing also lands here: not a confident claim.
      needsInfo.push(base);
    }
  }

  eligible.sort((a, b) => (b as { suitability: { score: number } }).suitability.score - (a as { suitability: { score: number } }).suitability.score);

  ok(res, {
    generatedAt: new Date().toISOString(),
    profileComplete: financingComplete && !!facts.category && !!facts.purpose,
    counts: { eligible: eligible.length, needsInformation: needsInfo.length, ineligible: ineligible.length },
    eligible,
    needsInformation: needsInfo,
    ineligible,
    notes: [
      'Eligibility is decided by a deterministic rule engine against each scheme’s stored rules. No language model is involved.',
      'Suitability score is a transparent ranking of how well a scheme’s terms fit your inputs — not a loan-approval probability or a sanction.',
      'Seeded schemes are demonstration data (source.demoData = true) and are not a statement of official government policy.',
    ],
  });
}
