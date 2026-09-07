/**
 * Authoritative server-side financial-plan calculation.
 *
 * All money in/out is integer paise. Rates are basis points (100 bps = 1%).
 * The frontend live preview MUST use the identical algorithm (see
 * `src/lib/finance.ts` in the web app) — parity is asserted by a shared set of
 * golden vectors in `tests/unit/finance.vectors.json`.
 *
 * Nothing here is hardcoded to match any mockup. Every output is derived from the
 * supplied inputs.
 */
import { roundPaise } from '../lib/money';
import type { MoratoriumInterestHandling } from './types';

export interface FinanceInput {
  projectCostPaise: number;
  ownContributionPaise: number;
  requestedLoanPaise: number;
  annualRateBps: number; // 0 allowed
  tenureMonths: number; // as quoted by the user/scheme
  moratoriumMonths: number; // 0 allowed
  moratoriumInterestHandling: MoratoriumInterestHandling;
  tenureIncludesMoratorium: boolean;
  scheme: {
    maxAmountPaise: number;
    maxProjectCostSharePct: number;
    minOwnContributionPct: number;
    minInterestRateBps: number;
    maxInterestRateBps: number;
    minTenureMonths: number;
    maxTenureMonths: number;
    moratoriumAllowed: boolean;
    moratoriumMaxMonths: number;
  };
}

export interface AmortRow {
  period: number;
  openingBalancePaise: number;
  paymentPaise: number;
  principalPaise: number;
  interestPaise: number;
  closingBalancePaise: number;
}

export interface FinancePlan {
  currency: 'INR-paise';
  principalPaise: number; // the amount the schedule is built on (= requestedLoan, possibly capitalised)
  schemeFinancingCapPaise: number;
  financingGapPaise: number;
  repaymentMonths: number;
  monthlyInstalmentPaise: number; // illustrative EMI (regular months)
  finalInstalmentPaise: number;
  totalInterestPaise: number;
  totalRepaymentPaise: number;
  moratoriumInterestPaise: number;
  moratoriumSchedule: { period: number; interestPaise: number; paymentPaise: number }[];
  amortizationSchedule: AmortRow[];
  assumptions: string[];
  validationMessages: string[];
}

export class FinanceInputError extends Error {
  readonly fieldErrors: { path: string; message: string }[];
  constructor(fieldErrors: { path: string; message: string }[]) {
    super('Invalid financial-plan inputs');
    this.name = 'FinanceInputError';
    this.fieldErrors = fieldErrors;
  }
}

function validate(input: FinanceInput): void {
  const errs: { path: string; message: string }[] = [];
  const pos = (v: number, path: string, label: string) => {
    if (!Number.isFinite(v) || !Number.isInteger(v) || v <= 0) errs.push({ path, message: `${label} must be a positive integer (paise)` });
  };
  const nonNeg = (v: number, path: string, label: string) => {
    if (!Number.isFinite(v) || !Number.isInteger(v) || v < 0) errs.push({ path, message: `${label} must be a non-negative integer` });
  };
  pos(input.projectCostPaise, 'projectCostPaise', 'Project cost');
  nonNeg(input.ownContributionPaise, 'ownContributionPaise', 'Own contribution');
  pos(input.requestedLoanPaise, 'requestedLoanPaise', 'Requested loan');
  nonNeg(input.annualRateBps, 'annualRateBps', 'Interest rate');
  pos(input.tenureMonths, 'tenureMonths', 'Tenure (months)');
  nonNeg(input.moratoriumMonths, 'moratoriumMonths', 'Moratorium (months)');

  if (errs.length === 0) {
    if (input.ownContributionPaise > input.projectCostPaise) errs.push({ path: 'ownContributionPaise', message: 'Own contribution cannot exceed project cost' });
    if (input.moratoriumMonths > 0 && !input.scheme.moratoriumAllowed) errs.push({ path: 'moratoriumMonths', message: 'The selected scheme does not permit a moratorium' });
    if (input.moratoriumMonths > input.scheme.moratoriumMaxMonths) errs.push({ path: 'moratoriumMonths', message: `Moratorium exceeds the scheme maximum of ${input.scheme.moratoriumMaxMonths} months` });
    const effectiveRepayment = input.tenureIncludesMoratorium ? input.tenureMonths - input.moratoriumMonths : input.tenureMonths;
    if (effectiveRepayment < 1) errs.push({ path: 'tenureMonths', message: 'Repayment period after the moratorium must be at least 1 month' });
  }
  if (errs.length) throw new FinanceInputError(errs);
}

/** Standard EMI for a fully-amortising loan. Returns paise (rounded half-up). */
export function emiPaise(principalPaise: number, monthlyRate: number, months: number): number {
  if (months <= 0) throw new Error('months must be > 0');
  if (monthlyRate === 0) return roundPaise(principalPaise / months);
  const factor = Math.pow(1 + monthlyRate, months);
  return roundPaise((principalPaise * monthlyRate * factor) / (factor - 1));
}

export function calculateFinancePlan(input: FinanceInput): FinancePlan {
  validate(input);

  const assumptions: string[] = [];
  const validationMessages: string[] = [];

  const monthlyRate = input.annualRateBps / 12 / 10_000;
  const {
    projectCostPaise,
    ownContributionPaise,
    requestedLoanPaise,
    moratoriumMonths,
    moratoriumInterestHandling,
  } = input;

  // --- Scheme financing cap & funding gap -------------------------------------
  const shareCap = Math.floor((projectCostPaise * input.scheme.maxProjectCostSharePct) / 100);
  const schemeFinancingCapPaise = Math.min(input.scheme.maxAmountPaise, shareCap);
  const financingGapPaise = Math.max(0, projectCostPaise - ownContributionPaise - requestedLoanPaise);

  if (requestedLoanPaise > schemeFinancingCapPaise) {
    validationMessages.push(
      `Requested loan exceeds the scheme financing cap of ${schemeFinancingCapPaise} paise (min of the ${input.scheme.maxProjectCostSharePct}% project-cost share and the scheme's absolute ceiling). The schedule below still illustrates the requested amount.`,
    );
  }
  const minContribution = Math.ceil((projectCostPaise * input.scheme.minOwnContributionPct) / 100);
  if (ownContributionPaise < minContribution) {
    validationMessages.push(`Own contribution is below the scheme minimum of ${input.scheme.minOwnContributionPct}% (${minContribution} paise).`);
  }
  if (financingGapPaise > 0) {
    validationMessages.push(`A funding gap of ${financingGapPaise} paise is not covered by the requested loan or your contribution.`);
  }
  if (input.annualRateBps < input.scheme.minInterestRateBps || input.annualRateBps > input.scheme.maxInterestRateBps) {
    validationMessages.push(`Interest rate ${input.annualRateBps} bps is outside the scheme's permitted band (${input.scheme.minInterestRateBps}–${input.scheme.maxInterestRateBps} bps).`);
  }
  if (input.tenureMonths < input.scheme.minTenureMonths || input.tenureMonths > input.scheme.maxTenureMonths) {
    validationMessages.push(`Tenure ${input.tenureMonths} months is outside the scheme's permitted band (${input.scheme.minTenureMonths}–${input.scheme.maxTenureMonths} months).`);
  }

  // --- Tenure / moratorium interplay ----------------------------------------
  const repaymentMonths = input.tenureIncludesMoratorium
    ? input.tenureMonths - moratoriumMonths
    : input.tenureMonths;

  if (moratoriumMonths > 0) {
    assumptions.push(
      input.tenureIncludesMoratorium
        ? `The ${input.tenureMonths}-month tenure includes the ${moratoriumMonths}-month moratorium, leaving ${repaymentMonths} months of EMI repayment.`
        : `The ${moratoriumMonths}-month moratorium is in addition to the ${input.tenureMonths}-month repayment tenure (total ${input.tenureMonths + moratoriumMonths} months).`,
    );
  }

  // --- Moratorium phase ----------------------------------------------------
  let principalForSchedule = requestedLoanPaise;
  let moratoriumInterestPaise = 0;
  const moratoriumSchedule: FinancePlan['moratoriumSchedule'] = [];

  if (moratoriumMonths > 0 && monthlyRate > 0) {
    if (moratoriumInterestHandling === 'serviced') {
      const monthly = roundPaise(requestedLoanPaise * monthlyRate);
      for (let p = 1; p <= moratoriumMonths; p += 1) {
        moratoriumSchedule.push({ period: p, interestPaise: monthly, paymentPaise: monthly });
        moratoriumInterestPaise += monthly;
      }
      assumptions.push('Interest during the moratorium is serviced monthly and is not added to the principal or the EMI.');
    } else {
      let bal = requestedLoanPaise;
      for (let p = 1; p <= moratoriumMonths; p += 1) {
        const accrued = roundPaise(bal * monthlyRate);
        bal += accrued;
        moratoriumInterestPaise += accrued;
        moratoriumSchedule.push({ period: p, interestPaise: accrued, paymentPaise: 0 });
      }
      principalForSchedule = bal;
      assumptions.push('Interest during the moratorium is capitalised (added to the principal). EMIs are computed on the higher balance.');
    }
  } else if (moratoriumMonths > 0 && monthlyRate === 0) {
    assumptions.push('This is a zero-interest facility, so no interest accrues during the moratorium.');
  }

  // --- Repayment phase ---------------------------------------------------
  const emi = emiPaise(principalForSchedule, monthlyRate, repaymentMonths);
  const schedule: AmortRow[] = [];
  let balance = principalForSchedule;
  let repaymentInterest = 0;

  for (let period = 1; period <= repaymentMonths; period += 1) {
    const opening = balance;
    const interest = monthlyRate === 0 ? 0 : roundPaise(opening * monthlyRate);
    let payment = emi;
    let principalComponent = payment - interest;
    // Final instalment: clear the remaining balance exactly, absorbing rounding drift.
    if (period === repaymentMonths || principalComponent >= opening) {
      principalComponent = opening;
      payment = opening + interest;
    }
    const closing = opening - principalComponent;
    repaymentInterest += interest;
    schedule.push({
      period,
      openingBalancePaise: opening,
      paymentPaise: payment,
      principalPaise: principalComponent,
      interestPaise: interest,
      closingBalancePaise: closing,
    });
    balance = closing;
    if (balance <= 0) break;
  }

  const finalInstalmentPaise = schedule.length ? schedule[schedule.length - 1]!.paymentPaise : 0;
  if (finalInstalmentPaise !== emi && repaymentMonths > 1) {
    assumptions.push(`The EMI is rounded to the nearest paise; the final instalment is adjusted to ${finalInstalmentPaise} paise so the balance closes at zero.`);
  }
  if (monthlyRate === 0) {
    assumptions.push('Zero-interest facility: every instalment is pure principal.');
  }

  const totalInterestPaise = repaymentInterest + moratoriumInterestPaise;
  const totalRepaymentPaise =
    schedule.reduce((s, r) => s + r.paymentPaise, 0) +
    moratoriumSchedule.reduce((s, r) => s + r.paymentPaise, 0);

  return {
    currency: 'INR-paise',
    principalPaise: principalForSchedule,
    schemeFinancingCapPaise,
    financingGapPaise,
    repaymentMonths,
    monthlyInstalmentPaise: emi,
    finalInstalmentPaise,
    totalInterestPaise,
    totalRepaymentPaise,
    moratoriumInterestPaise,
    moratoriumSchedule,
    amortizationSchedule: schedule,
    assumptions,
    validationMessages,
  };
}
