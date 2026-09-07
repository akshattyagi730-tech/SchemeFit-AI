/* Regenerate: npx tsx tests/helpers/gen-finance-vectors.ts > tests/unit/finance.vectors.json
 * These golden vectors are asserted by BOTH the backend (tests/unit/finance.test.ts)
 * and the frontend (src/lib/finance.test.ts) to guarantee the "same calculation
 * contract". All amounts are integer paise. */
import { calculateFinancePlan, type FinanceInput } from '../../src/domain/finance';

const L = (rupees: number) => Math.round(rupees * 100); // ₹ -> paise

const scheme = (over: Partial<FinanceInput['scheme']> = {}): FinanceInput['scheme'] => ({
  maxAmountPaise: L(3_000_000),
  maxProjectCostSharePct: 90,
  minOwnContributionPct: 5,
  minInterestRateBps: 0,
  maxInterestRateBps: 2000,
  minTenureMonths: 6,
  maxTenureMonths: 120,
  moratoriumAllowed: true,
  moratoriumMaxMonths: 12,
  ...over,
});

const cases: { name: string; input: FinanceInput }[] = [
  {
    name: 'plain_amortising_540000_at_7pct_60m',
    input: {
      projectCostPaise: L(600_000), ownContributionPaise: L(60_000), requestedLoanPaise: L(540_000),
      annualRateBps: 700, tenureMonths: 60, moratoriumMonths: 0,
      moratoriumInterestHandling: 'serviced', tenureIncludesMoratorium: false, scheme: scheme(),
    },
  },
  {
    name: 'zero_interest_120000_over_24m',
    input: {
      projectCostPaise: L(150_000), ownContributionPaise: L(30_000), requestedLoanPaise: L(120_000),
      annualRateBps: 0, tenureMonths: 24, moratoriumMonths: 0,
      moratoriumInterestHandling: 'serviced', tenureIncludesMoratorium: false, scheme: scheme(),
    },
  },
  {
    name: 'moratorium_serviced_additional_tenure',
    input: {
      projectCostPaise: L(1_000_000), ownContributionPaise: L(100_000), requestedLoanPaise: L(900_000),
      annualRateBps: 800, tenureMonths: 36, moratoriumMonths: 6,
      moratoriumInterestHandling: 'serviced', tenureIncludesMoratorium: false, scheme: scheme(),
    },
  },
  {
    name: 'moratorium_capitalised_tenure_includes',
    input: {
      projectCostPaise: L(500_000), ownContributionPaise: 0, requestedLoanPaise: L(500_000),
      annualRateBps: 1000, tenureMonths: 48, moratoriumMonths: 12,
      moratoriumInterestHandling: 'capitalised', tenureIncludesMoratorium: true, scheme: scheme(),
    },
  },
  {
    name: 'odd_amount_rate_rounding',
    input: {
      projectCostPaise: L(333_333), ownContributionPaise: L(33_333), requestedLoanPaise: L(300_000),
      annualRateBps: 1150, tenureMonths: 17, moratoriumMonths: 0,
      moratoriumInterestHandling: 'serviced', tenureIncludesMoratorium: false, scheme: scheme(),
    },
  },
];

const out = cases.map((c) => {
  const plan = calculateFinancePlan(c.input);
  return {
    name: c.name,
    input: c.input,
    expected: {
      principalPaise: plan.principalPaise,
      repaymentMonths: plan.repaymentMonths,
      monthlyInstalmentPaise: plan.monthlyInstalmentPaise,
      finalInstalmentPaise: plan.finalInstalmentPaise,
      totalInterestPaise: plan.totalInterestPaise,
      totalRepaymentPaise: plan.totalRepaymentPaise,
      moratoriumInterestPaise: plan.moratoriumInterestPaise,
      schemeFinancingCapPaise: plan.schemeFinancingCapPaise,
      financingGapPaise: plan.financingGapPaise,
      scheduleLength: plan.amortizationSchedule.length,
      lastClosingBalancePaise: plan.amortizationSchedule.at(-1)?.closingBalancePaise ?? null,
    },
  };
});

process.stdout.write(JSON.stringify(out, null, 2) + '\n');
