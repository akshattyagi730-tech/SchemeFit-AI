import { describe, expect, it } from 'vitest';
import { evaluateEligibility, type SchemeRuleSet } from '../../src/domain/eligibility';
import type { ApplicantFacts } from '../../src/domain/types';

const L = (r: number) => r * 100;

const nsfdc: SchemeRuleSet = {
  supportedPurposes: ['business_new', 'business_expansion', 'equipment_purchase'],
  eligibility: { categories: ['SC'], minAge: 18, maxAge: 60, maxAnnualIncomePaise: L(300_000), requiresBusinessPlan: true },
  financing: { minAmountPaise: L(100_000), maxAmountPaise: L(3_000_000), maxProjectCostSharePct: 90, minOwnContributionPct: 5 },
};

const pmmy: SchemeRuleSet = {
  supportedPurposes: ['business_new', 'business_expansion', 'working_capital'],
  eligibility: { minAge: 18, maxAge: 65 },
  financing: { minAmountPaise: L(50_000), maxAmountPaise: L(500_000), maxProjectCostSharePct: 85, minOwnContributionPct: 10 },
};

const scFacts: ApplicantFacts = {
  age: 30,
  annualIncomePaise: L(240_000),
  category: 'SC',
  state: 'Bihar',
  district: 'Sitamarhi',
  areaType: 'rural',
  purpose: 'business_expansion',
  hasBusinessPlan: true,
};

const financing = { projectCostPaise: L(600_000), ownContributionPaise: L(60_000), requestedLoanPaise: L(400_000) };

describe('eligibility rule engine', () => {
  it('returns eligible when all mandatory conditions pass', () => {
    const r = evaluateEligibility(nsfdc, scFacts, { ...financing, requestedLoanPaise: L(400_000) });
    expect(r.status).toBe('eligible');
    expect(r.failed).toHaveLength(0);
    expect(r.passed.map((c) => c.key)).toEqual(expect.arrayContaining(['social_category', 'age', 'annual_income', 'purpose', 'financing_rules']));
  });

  it('is ineligible for a non-SC applicant on a category-restricted scheme', () => {
    const r = evaluateEligibility(nsfdc, { ...scFacts, category: 'GENERAL' }, financing);
    expect(r.status).toBe('ineligible');
    expect(r.failed.map((c) => c.key)).toContain('social_category');
  });

  it('is ineligible when income exceeds the ceiling', () => {
    const r = evaluateEligibility(nsfdc, { ...scFacts, annualIncomePaise: L(500_000) }, financing);
    expect(r.status).toBe('ineligible');
    expect(r.failed.map((c) => c.key)).toContain('annual_income');
  });

  it('needs_information when a mandatory fact is missing (never a confident claim)', () => {
    const r = evaluateEligibility(nsfdc, { ...scFacts, category: null }, financing);
    expect(r.status).toBe('needs_information');
    expect(r.unknown.map((c) => c.key)).toContain('social_category');
  });

  it('needs_information when financing amounts are absent', () => {
    const r = evaluateEligibility(nsfdc, scFacts);
    expect(r.status).toBe('needs_information');
    expect(r.unknown.map((c) => c.key)).toContain('financing_rules');
  });

  it('applies the project-cost percentage to project cost, NOT to the requested loan', () => {
    // 85% of ₹6,00,000 = ₹5,10,000 cap; requesting ₹5,40,000 must fail on PMMY.
    const r = evaluateEligibility(pmmy, { ...scFacts }, { projectCostPaise: L(600_000), ownContributionPaise: L(60_000), requestedLoanPaise: L(540_000) });
    expect(r.status).toBe('ineligible');
    const detail = r.failed.find((c) => c.key === 'financing_rules')!.detail;
    expect(detail).toMatch(/project cost, not to your requested loan/i);
  });

  it('distinguishes NSFDC Term Loan from PMMY (different limits & eligibility)', () => {
    const facts = { ...scFacts, category: 'GENERAL' as const };
    const nsfdcResult = evaluateEligibility(nsfdc, facts, financing);
    const pmmyResult = evaluateEligibility(pmmy, facts, financing);
    expect(nsfdcResult.status).toBe('ineligible'); // category-gated
    expect(pmmyResult.status).toBe('eligible'); // not category-gated
  });

  it('flags an unplanned funding gap as a non-blocking advisory, not a failure', () => {
    const r = evaluateEligibility(pmmy, scFacts, { projectCostPaise: L(600_000), ownContributionPaise: L(60_000), requestedLoanPaise: L(400_000) });
    // gap = 600000 - 60000 - 400000 = 140000
    expect(r.advisories.map((c) => c.key)).toContain('financing_gap');
    expect(r.status).toBe('eligible');
  });
});
