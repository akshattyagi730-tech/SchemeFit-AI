import type { Request, Response } from 'express';
import { ok } from '../../lib/http';
import { Scheme } from '../../models/Scheme';
import { evaluateEligibility } from '../../domain/eligibility';
import { schemeToRuleSet } from '../../domain/adapters';
import type { ApplicantFacts } from '../../domain/types';
import type { EligibilityCheckInput } from './eligibility.schemas';

type Match = {
  scheme: {
    code: string;
    name: string;
    provider: string;
    kind: string;
    displayCategory: string;
    description: string;
    officialUrl: string | null;
    demoData: boolean;
  };
  status: 'eligible' | 'needs_information' | 'ineligible';
  passed: string[];
  failed: { key: string; label: string; detail: string }[];
  unknown: { key: string; label: string; detail: string }[];
};

const factsFrom = (b: EligibilityCheckInput): ApplicantFacts => ({
  age: b.age ?? null,
  gender: b.gender ?? null,
  category: b.category ?? null,
  obcCreamyLayer: b.obcCreamyLayer ?? null,
  annualIncomePaise: b.annualIncomePaise ?? null,
  state: b.state ?? null,
  areaType: b.areaType ?? null,
  educationLevel: b.educationLevel ?? null,
  occupation: b.occupation ?? null,
  isStudent: b.isStudent ?? (b.occupation === 'student' ? true : null),
  landHoldingHectares: b.landHoldingHectares ?? null,
  rationCardType: b.rationCardType ?? null,
  disabilityPct: b.disabilityPct ?? null,
});

export async function checkEligibility(req: Request, res: Response): Promise<void> {
  const facts = factsFrom(req.body as EligibilityCheckInput);
  const schemes = await Scheme.find({ status: 'active' }).sort({ name: 1 });

  const eligible: Match[] = [];
  const needsInfo: Match[] = [];
  const ineligible: Match[] = [];

  for (const scheme of schemes) {
    const ev = evaluateEligibility(schemeToRuleSet(scheme), facts);
    const o = scheme.toObject();
    const m: Match = {
      scheme: {
        code: o.code,
        name: o.name,
        provider: o.provider,
        kind: o.kind ?? 'financing',
        displayCategory: o.displayCategory,
        description: o.description,
        officialUrl: o.source?.url && /^https:\/\//i.test(o.source.url) ? o.source.url : null,
        demoData: o.source?.demoData ?? true,
      },
      status: ev.status,
      passed: ev.passed.map((c) => c.key),
      failed: ev.failed.map((c) => ({ key: c.key, label: c.label, detail: c.detail })),
      unknown: ev.unknown.map((c) => ({ key: c.key, label: c.label, detail: c.detail })),
    };
    if (ev.status === 'eligible') eligible.push(m);
    else if (ev.status === 'needs_information') needsInfo.push(m);
    else ineligible.push(m);
  }

  // Closest near-misses first (fewest failed rules).
  ineligible.sort((a, b) => a.failed.length - b.failed.length);

  ok(res, {
    generatedAt: new Date().toISOString(),
    counts: { eligible: eligible.length, needsInformation: needsInfo.length, ineligible: ineligible.length },
    eligible,
    needsInformation: needsInfo,
    ineligible: ineligible.slice(0, 12),
    notes: [
      'Eligibility is decided by a deterministic rule engine against each scheme’s stored rules. No language model is involved.',
      'Answer more questions to move schemes out of “needs more information”.',
      'Seeded schemes are demonstration data and are not a statement of official government policy. Confirm details on the official portal before applying.',
    ],
  });
}
