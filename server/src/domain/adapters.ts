/**
 * Adapters that map persisted documents to the pure-function inputs the rule
 * engine / ranking / finance modules expect. Keeping this mapping in one place
 * makes the "no LLM, only stored rules" boundary auditable.
 */
import type { SchemeDoc } from '../models/Scheme';
import type { CitizenProfileDoc } from '../models/CitizenProfile';
import type { SchemeRuleSet } from './eligibility';
import type { RankableScheme } from './ranking';
import type { ApplicantFacts, AreaType, FinancingInputs, SocialCategory } from './types';

export function schemeToRuleSet(s: SchemeDoc): SchemeRuleSet {
  const e = s.eligibility ?? {};
  return {
    supportedPurposes: s.supportedPurposes ?? [],
    eligibility: {
      categories: e.categories?.length ? (e.categories as SocialCategory[]) : undefined,
      minAge: e.minAge ?? undefined,
      maxAge: e.maxAge ?? undefined,
      minAnnualIncomePaise: e.minAnnualIncomePaise ?? undefined,
      maxAnnualIncomePaise: e.maxAnnualIncomePaise ?? undefined,
      location: e.location
        ? {
            states: e.location.states?.length ? e.location.states : undefined,
            districts: e.location.districts?.length ? e.location.districts : undefined,
            areaTypes: e.location.areaTypes?.length ? (e.location.areaTypes as AreaType[]) : undefined,
          }
        : undefined,
      requiresBusinessPlan: e.requiresBusinessPlan ?? false,
    },
    financing: {
      minAmountPaise: s.financing.minAmountPaise,
      maxAmountPaise: s.financing.maxAmountPaise,
      maxProjectCostSharePct: s.financing.maxProjectCostSharePct,
      minOwnContributionPct: s.financing.minOwnContributionPct,
    },
  };
}

export function schemeToRankable(s: SchemeDoc): RankableScheme {
  return {
    financing: { minAmountPaise: s.financing.minAmountPaise, maxAmountPaise: s.financing.maxAmountPaise },
    terms: {
      minInterestRateBps: s.terms.minInterestRateBps,
      maxInterestRateBps: s.terms.maxInterestRateBps,
      minTenureMonths: s.terms.minTenureMonths,
      maxTenureMonths: s.terms.maxTenureMonths,
      moratorium: {
        allowed: !!s.terms.moratorium?.allowed,
        maxMonths: s.terms.moratorium?.maxMonths ?? 0,
        interestHandling: (s.terms.moratorium?.interestHandling ?? 'serviced') as 'serviced' | 'capitalised',
        tenureIncludesMoratorium: s.terms.moratorium?.tenureIncludesMoratorium ?? true,
      },
    },
    requiredDocuments: (s.requiredDocuments ?? []).map((d) => ({ type: d.type, label: d.label, optional: d.optional })),
    eligibility: { categories: s.eligibility?.categories?.length ? s.eligibility.categories : undefined },
  };
}

export function profileToFacts(p: CitizenProfileDoc): ApplicantFacts {
  return {
    age: p.age ?? null,
    annualIncomePaise: p.annualIncomePaise ?? null,
    category: (p.category as ApplicantFacts['category']) ?? null,
    state: p.state ?? null,
    district: p.district ?? null,
    areaType: (p.areaType as ApplicantFacts['areaType']) ?? null,
    purpose: (p.purpose as ApplicantFacts['purpose']) ?? null,
    hasBusinessPlan: p.hasBusinessPlan ?? null,
  };
}

export function profileToFinancing(p: CitizenProfileDoc): Partial<FinancingInputs> {
  const out: Partial<FinancingInputs> = {};
  if (p.projectCostPaise != null) out.projectCostPaise = p.projectCostPaise;
  if (p.ownContributionPaise != null) out.ownContributionPaise = p.ownContributionPaise;
  if (p.requestedLoanPaise != null) out.requestedLoanPaise = p.requestedLoanPaise;
  return out;
}

type MaybeFinancing = {
  projectCostPaise?: number | null;
  ownContributionPaise?: number | null;
  requestedLoanPaise?: number | null;
};

export function hasCompleteFinancing(f: MaybeFinancing): f is FinancingInputs {
  return (
    typeof f.projectCostPaise === 'number' &&
    typeof f.ownContributionPaise === 'number' &&
    typeof f.requestedLoanPaise === 'number'
  );
}
