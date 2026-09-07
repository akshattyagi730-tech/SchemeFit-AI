import { describe, expect, it } from 'vitest';
import { calculateFinancePlan, emiPaise, FinanceInputError, type FinanceInput } from '../../src/domain/finance';
import vectors from './finance.vectors.json';

const baseScheme: FinanceInput['scheme'] = {
  maxAmountPaise: 3_00_00_000,
  maxProjectCostSharePct: 90,
  minOwnContributionPct: 5,
  minInterestRateBps: 0,
  maxInterestRateBps: 2000,
  minTenureMonths: 6,
  maxTenureMonths: 120,
  moratoriumAllowed: true,
  moratoriumMaxMonths: 12,
};

const base: FinanceInput = {
  projectCostPaise: 60_00_000,
  ownContributionPaise: 6_00_000,
  requestedLoanPaise: 54_00_000,
  annualRateBps: 700,
  tenureMonths: 60,
  moratoriumMonths: 0,
  moratoriumInterestHandling: 'serviced',
  tenureIncludesMoratorium: false,
  scheme: baseScheme,
};

describe('finance golden vectors (shared calculation contract)', () => {
  for (const v of vectors) {
    it(v.name, () => {
      const plan = calculateFinancePlan(v.input as FinanceInput);
      expect(plan.monthlyInstalmentPaise).toBe(v.expected.monthlyInstalmentPaise);
      expect(plan.finalInstalmentPaise).toBe(v.expected.finalInstalmentPaise);
      expect(plan.totalInterestPaise).toBe(v.expected.totalInterestPaise);
      expect(plan.totalRepaymentPaise).toBe(v.expected.totalRepaymentPaise);
      expect(plan.moratoriumInterestPaise).toBe(v.expected.moratoriumInterestPaise);
      expect(plan.repaymentMonths).toBe(v.expected.repaymentMonths);
      expect(plan.schemeFinancingCapPaise).toBe(v.expected.schemeFinancingCapPaise);
      expect(plan.amortizationSchedule.length).toBe(v.expected.scheduleLength);
      expect(plan.amortizationSchedule.at(-1)?.closingBalancePaise).toBe(0);
    });
  }
});

describe('amortisation invariants', () => {
  it('schedule always closes at exactly zero (rounding drift absorbed by final instalment)', () => {
    for (let rate = 0; rate <= 1800; rate += 137) {
      for (const months of [6, 7, 13, 24, 37, 59]) {
        const plan = calculateFinancePlan({ ...base, annualRateBps: rate, tenureMonths: months });
        expect(plan.amortizationSchedule.at(-1)!.closingBalancePaise).toBe(0);
        const principalPaid = plan.amortizationSchedule.reduce((s, r) => s + r.principalPaise, 0);
        expect(principalPaid).toBe(plan.principalPaise);
      }
    }
  });

  it('total repayment equals principal + total interest', () => {
    const plan = calculateFinancePlan({ ...base, annualRateBps: 950, tenureMonths: 48 });
    expect(plan.totalRepaymentPaise).toBe(plan.principalPaise + plan.totalInterestPaise);
  });

  it('zero-interest: every instalment is pure principal and interest is zero', () => {
    const plan = calculateFinancePlan({ ...base, annualRateBps: 0, tenureMonths: 20 });
    expect(plan.totalInterestPaise).toBe(0);
    expect(plan.amortizationSchedule.every((r) => r.interestPaise === 0)).toBe(true);
    expect(plan.monthlyInstalmentPaise).toBe(Math.round(plan.principalPaise / 20));
  });

  it('moratorium: serviced does not grow principal; capitalised does', () => {
    const serviced = calculateFinancePlan({ ...base, moratoriumMonths: 6, moratoriumInterestHandling: 'serviced' });
    const capitalised = calculateFinancePlan({ ...base, moratoriumMonths: 6, moratoriumInterestHandling: 'capitalised' });
    expect(serviced.principalPaise).toBe(base.requestedLoanPaise);
    expect(serviced.moratoriumInterestPaise).toBeGreaterThan(0);
    expect(serviced.moratoriumSchedule).toHaveLength(6);
    expect(capitalised.principalPaise).toBeGreaterThan(base.requestedLoanPaise);
  });

  it('tenureIncludesMoratorium controls the repayment month count', () => {
    const included = calculateFinancePlan({ ...base, tenureMonths: 60, moratoriumMonths: 12, tenureIncludesMoratorium: true });
    const additional = calculateFinancePlan({ ...base, tenureMonths: 60, moratoriumMonths: 12, tenureIncludesMoratorium: false });
    expect(included.repaymentMonths).toBe(48);
    expect(additional.repaymentMonths).toBe(60);
  });

  it('rejects non-positive and out-of-policy inputs', () => {
    expect(() => calculateFinancePlan({ ...base, requestedLoanPaise: 0 })).toThrow(FinanceInputError);
    expect(() => calculateFinancePlan({ ...base, tenureMonths: 0 })).toThrow(FinanceInputError);
    expect(() => calculateFinancePlan({ ...base, ownContributionPaise: base.projectCostPaise + 1 })).toThrow(FinanceInputError);
    expect(() =>
      calculateFinancePlan({ ...base, moratoriumMonths: 6, scheme: { ...baseScheme, moratoriumAllowed: false } }),
    ).toThrow(FinanceInputError);
  });

  it('flags a requested loan above the scheme financing cap without throwing', () => {
    const plan = calculateFinancePlan({
      ...base,
      requestedLoanPaise: 58_00_000,
      projectCostPaise: 60_00_000,
      scheme: { ...baseScheme, maxProjectCostSharePct: 80 },
    });
    expect(plan.validationMessages.join(' ')).toMatch(/exceeds the scheme financing cap/i);
  });
});

describe('emiPaise', () => {
  it('matches the closed-form EMI formula and handles zero rate', () => {
    expect(emiPaise(120000, 0, 12)).toBe(10000);
    // ₹1,00,000 at 1% monthly for 12 months ≈ 8884.88 -> paise
    expect(emiPaise(10_000_000, 0.01, 12)).toBe(888488);
  });
});
