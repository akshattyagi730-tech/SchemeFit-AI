import { calculateFinancePlan, FinanceInputError, type FinanceInput, type FinancePlan } from '../../domain/finance';
import type { SchemeDoc } from '../../models/Scheme';
import { unprocessable } from '../../lib/errors';

export interface CalcParams {
  projectCostPaise: number;
  ownContributionPaise: number;
  requestedLoanPaise: number;
  interestRateBps: number;
  tenureMonths: number;
  moratoriumMonths: number;
}

export function buildFinanceInput(scheme: SchemeDoc, p: CalcParams): FinanceInput {
  const m = scheme.terms.moratorium;
  return {
    projectCostPaise: p.projectCostPaise,
    ownContributionPaise: p.ownContributionPaise,
    requestedLoanPaise: p.requestedLoanPaise,
    annualRateBps: p.interestRateBps,
    tenureMonths: p.tenureMonths,
    moratoriumMonths: p.moratoriumMonths,
    moratoriumInterestHandling: (m?.interestHandling ?? 'serviced') as 'serviced' | 'capitalised',
    tenureIncludesMoratorium: m?.tenureIncludesMoratorium ?? true,
    scheme: {
      maxAmountPaise: scheme.financing.maxAmountPaise,
      maxProjectCostSharePct: scheme.financing.maxProjectCostSharePct,
      minOwnContributionPct: scheme.financing.minOwnContributionPct,
      minInterestRateBps: scheme.terms.minInterestRateBps,
      maxInterestRateBps: scheme.terms.maxInterestRateBps,
      minTenureMonths: scheme.terms.minTenureMonths,
      maxTenureMonths: scheme.terms.maxTenureMonths,
      moratoriumAllowed: !!m?.allowed,
      moratoriumMaxMonths: m?.maxMonths ?? 0,
    },
  };
}

export function runCalculation(scheme: SchemeDoc, p: CalcParams): FinancePlan {
  try {
    return calculateFinancePlan(buildFinanceInput(scheme, p));
  } catch (err) {
    if (err instanceof FinanceInputError) throw unprocessable('Invalid financial-plan inputs', err.fieldErrors);
    throw err;
  }
}
