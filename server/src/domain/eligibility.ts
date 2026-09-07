/**
 * Deterministic scheme-eligibility rule engine.
 *
 * IMPORTANT: no language model is involved here. Eligibility is decided purely by
 * the coded rules below against the scheme's stored rule set. Missing applicant
 * information yields `needs_information` (never a confident eligibility claim).
 */
import { paiseToRupees } from '../lib/money';
import type {
  ApplicantFacts,
  ConditionResult,
  EligibilityResult,
  FinancingInputs,
  SchemeEligibilityRules,
  SchemeFinancingRules,
} from './types';

const inr = (paise: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    paiseToRupees(paise),
  );

const PURPOSE_LABELS: Record<string, string> = {
  business_new: 'start a new business',
  business_expansion: 'expand an existing business',
  equipment_purchase: 'purchase equipment',
  working_capital: 'working capital',
  education: 'formal education',
  skilling: 'a certified skilling course',
};

export interface SchemeRuleSet {
  supportedPurposes: string[];
  eligibility: SchemeEligibilityRules;
  financing: SchemeFinancingRules;
}

// Keys that are informational only — reported to the user but never change the
// eligibility verdict.
const ADVISORY_KEYS = new Set(['financing_gap']);

function classify(conditions: ConditionResult[]): EligibilityResult {
  const blocking = conditions.filter((c) => !ADVISORY_KEYS.has(c.key));
  const passed = blocking.filter((c) => c.outcome === 'passed');
  const failed = blocking.filter((c) => c.outcome === 'failed');
  const unknown = blocking.filter((c) => c.outcome === 'unknown');
  const advisories = conditions.filter((c) => ADVISORY_KEYS.has(c.key));
  const status: EligibilityResult['status'] =
    failed.length > 0 ? 'ineligible' : unknown.length > 0 ? 'needs_information' : 'eligible';
  return { status, conditions, passed, failed, unknown, advisories };
}

export function evaluateEligibility(
  scheme: SchemeRuleSet,
  facts: ApplicantFacts,
  financing?: Partial<FinancingInputs>,
): EligibilityResult {
  const c: ConditionResult[] = [];
  const e = scheme.eligibility;

  // 1. Social category
  if (e.categories && e.categories.length > 0) {
    if (facts.category == null) {
      c.push({ key: 'social_category', label: 'Social category', outcome: 'unknown', detail: 'Add your social category to your profile so this rule can be checked.' });
    } else if (e.categories.includes(facts.category)) {
      c.push({ key: 'social_category', label: 'Social category', outcome: 'passed', detail: `This scheme is open to the ${facts.category} category.` });
    } else {
      c.push({ key: 'social_category', label: 'Social category', outcome: 'failed', detail: `This scheme is limited to ${e.categories.join(', ')}. Your profile records ${facts.category}.` });
    }
  }

  // 2. Age band
  if (e.minAge != null || e.maxAge != null) {
    if (facts.age == null) {
      c.push({ key: 'age', label: 'Age', outcome: 'unknown', detail: 'Add your age to your profile.' });
    } else {
      const lowOk = e.minAge == null || facts.age >= e.minAge;
      const highOk = e.maxAge == null || facts.age <= e.maxAge;
      const range = `${e.minAge ?? 'any'}–${e.maxAge ?? 'any'} years`;
      c.push(
        lowOk && highOk
          ? { key: 'age', label: 'Age', outcome: 'passed', detail: `Your age (${facts.age}) is within the permitted range (${range}).` }
          : { key: 'age', label: 'Age', outcome: 'failed', detail: `This scheme requires an age of ${range}; your profile records ${facts.age}.` },
      );
    }
  }

  // 3. Annual household income
  if (e.minAnnualIncomePaise != null || e.maxAnnualIncomePaise != null) {
    if (facts.annualIncomePaise == null) {
      c.push({ key: 'annual_income', label: 'Annual household income', outcome: 'unknown', detail: 'Add your annual household income to your profile.' });
    } else {
      const lowOk = e.minAnnualIncomePaise == null || facts.annualIncomePaise >= e.minAnnualIncomePaise;
      const highOk = e.maxAnnualIncomePaise == null || facts.annualIncomePaise <= e.maxAnnualIncomePaise;
      if (lowOk && highOk) {
        c.push({ key: 'annual_income', label: 'Annual household income', outcome: 'passed', detail: `Your income is within the scheme limits.` });
      } else if (!highOk) {
        c.push({ key: 'annual_income', label: 'Annual household income', outcome: 'failed', detail: `Household income must not exceed ${inr(e.maxAnnualIncomePaise!)}. Your profile records ${inr(facts.annualIncomePaise)}.` });
      } else {
        c.push({ key: 'annual_income', label: 'Annual household income', outcome: 'failed', detail: `Household income must be at least ${inr(e.minAnnualIncomePaise!)}.` });
      }
    }
  }

  // 4. Purpose
  {
    if (facts.purpose == null) {
      c.push({ key: 'purpose', label: 'Financing purpose', outcome: 'unknown', detail: 'Select the purpose of financing in your profile.' });
    } else if (scheme.supportedPurposes.includes(facts.purpose)) {
      c.push({ key: 'purpose', label: 'Financing purpose', outcome: 'passed', detail: `This scheme supports financing to ${PURPOSE_LABELS[facts.purpose] ?? facts.purpose}.` });
    } else {
      c.push({ key: 'purpose', label: 'Financing purpose', outcome: 'failed', detail: `This scheme does not fund ${PURPOSE_LABELS[facts.purpose] ?? facts.purpose}.` });
    }
  }

  // 5. Location
  if (e.location && (e.location.states?.length || e.location.districts?.length || e.location.areaTypes?.length)) {
    const loc = e.location;
    const missing = !facts.state && !facts.district && !facts.areaType;
    if (missing) {
      c.push({ key: 'location', label: 'Location', outcome: 'unknown', detail: 'Add your state, district and area type to your profile.' });
    } else {
      const stateOk = !loc.states?.length || (facts.state != null && loc.states.includes(facts.state));
      const districtOk = !loc.districts?.length || (facts.district != null && loc.districts.includes(facts.district));
      const areaOk = !loc.areaTypes?.length || (facts.areaType != null && loc.areaTypes.includes(facts.areaType));
      // If a dimension is restricted but the applicant has not provided it, treat as unknown.
      const cannotTell =
        (loc.states?.length && facts.state == null) ||
        (loc.districts?.length && facts.district == null) ||
        (loc.areaTypes?.length && facts.areaType == null);
      if (stateOk && districtOk && areaOk) {
        c.push({ key: 'location', label: 'Location', outcome: 'passed', detail: 'Your location is within the scheme service area.' });
      } else if (cannotTell) {
        c.push({ key: 'location', label: 'Location', outcome: 'unknown', detail: 'Complete your location details so this rule can be checked.' });
      } else {
        const parts = [
          loc.states?.length ? `states: ${loc.states.join(', ')}` : '',
          loc.districts?.length ? `districts: ${loc.districts.join(', ')}` : '',
          loc.areaTypes?.length ? `area: ${loc.areaTypes.join(', ')}` : '',
        ].filter(Boolean);
        c.push({ key: 'location', label: 'Location', outcome: 'failed', detail: `This scheme serves ${parts.join('; ')}.` });
      }
    }
  }

  // 6. Business plan requirement
  if (e.requiresBusinessPlan) {
    if (facts.hasBusinessPlan == null) {
      c.push({ key: 'business_plan', label: 'Business plan', outcome: 'unknown', detail: 'Indicate whether you have a business plan / project report.' });
    } else if (facts.hasBusinessPlan) {
      c.push({ key: 'business_plan', label: 'Business plan', outcome: 'passed', detail: 'You have indicated a business plan / project report is available.' });
    } else {
      c.push({ key: 'business_plan', label: 'Business plan', outcome: 'failed', detail: 'This scheme requires a business plan / project report.' });
    }
  }

  // 7. Financing rules — only when the applicant has supplied all three amounts.
  const f = financing;
  const haveFinancing =
    f != null &&
    typeof f.projectCostPaise === 'number' &&
    typeof f.ownContributionPaise === 'number' &&
    typeof f.requestedLoanPaise === 'number';

  if (!haveFinancing) {
    c.push({ key: 'financing_rules', label: 'Financing limits', outcome: 'unknown', detail: 'Provide project cost, own contribution and requested loan so financing rules can be checked.' });
  } else {
    const projectCost = f.projectCostPaise!;
    const ownContribution = f.ownContributionPaise!;
    const requestedLoan = f.requestedLoanPaise!;
    const fin = scheme.financing;
    const subFailures: string[] = [];

    if (requestedLoan < fin.minAmountPaise) subFailures.push(`Requested loan ${inr(requestedLoan)} is below the scheme minimum of ${inr(fin.minAmountPaise)}.`);
    if (requestedLoan > fin.maxAmountPaise) subFailures.push(`Requested loan ${inr(requestedLoan)} exceeds the scheme maximum of ${inr(fin.maxAmountPaise)}.`);

    const shareCap = Math.floor((projectCost * fin.maxProjectCostSharePct) / 100);
    if (requestedLoan > shareCap) subFailures.push(`This scheme funds at most ${fin.maxProjectCostSharePct}% of project cost — ${inr(shareCap)} for your ${inr(projectCost)} project. (The percentage applies to project cost, not to your requested loan.)`);

    const minContribution = Math.ceil((projectCost * fin.minOwnContributionPct) / 100);
    if (ownContribution < minContribution) subFailures.push(`Your own contribution ${inr(ownContribution)} is below the scheme minimum of ${fin.minOwnContributionPct}% (${inr(minContribution)}).`);

    if (ownContribution + requestedLoan > projectCost) {
      subFailures.push(`Own contribution plus requested loan (${inr(ownContribution + requestedLoan)}) exceeds the project cost (${inr(projectCost)}).`);
    }

    if (subFailures.length > 0) {
      c.push({ key: 'financing_rules', label: 'Financing limits', outcome: 'failed', detail: subFailures.join(' ') });
    } else {
      c.push({ key: 'financing_rules', label: 'Financing limits', outcome: 'passed', detail: `Requested loan ${inr(requestedLoan)} fits the scheme's financing limits and contribution rules.` });
    }

    const gap = projectCost - ownContribution - requestedLoan;
    if (gap > 0) {
      c.push({ key: 'financing_gap', label: 'Unplanned funding gap', outcome: 'unknown', detail: `A funding gap of ${inr(gap)} is not covered by your contribution or the requested loan. Decide how it will be met.` });
    }
  }

  return classify(c);
}
