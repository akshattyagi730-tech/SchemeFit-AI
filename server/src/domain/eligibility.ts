/**
 * Deterministic scheme-eligibility rule engine.
 *
 * IMPORTANT: no language model is involved here. Eligibility is decided purely by
 * the coded rules below against the scheme's stored rule set. Missing applicant
 * information yields `needs_information` (never a confident eligibility claim).
 */
import { paiseToRupees } from '../lib/money';
import { EDUCATION_LEVELS } from './types';
import type {
  ApplicantFacts,
  ConditionResult,
  EducationLevel,
  EligibilityResult,
  FinancingInputs,
  Occupation,
  SchemeEligibilityRules,
  SchemeFinancingRules,
  SchemeKind,
} from './types';

const EDU_INDEX = (l: EducationLevel) => EDUCATION_LEVELS.indexOf(l);
const EDU_LABEL: Record<EducationLevel, string> = {
  none: 'no formal schooling',
  below_primary: 'below primary',
  primary: 'primary',
  class_8: 'Class 8',
  class_10: 'Class 10',
  class_12: 'Class 12',
  iti_diploma: 'ITI / diploma',
  graduate: 'graduate',
  postgraduate: 'postgraduate',
};
const OCC_LABEL: Record<Occupation, string> = {
  student: 'student',
  farmer: 'farmer',
  agri_labourer: 'agricultural labourer',
  daily_wager: 'daily-wage worker',
  artisan: 'artisan / craftsperson',
  street_vendor: 'street vendor',
  domestic_worker: 'domestic worker',
  shg_member: 'SHG member',
  self_employed: 'self-employed',
  private_salaried: 'private-sector employee',
  govt_salaried: 'government employee',
  unemployed: 'unemployed',
  homemaker: 'homemaker',
  other: 'other',
};

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
  agriculture: 'agriculture or an allied activity',
  housing: 'building, buying or improving a home',
  vehicle: 'a vehicle used for livelihood',
  personal: 'a personal / consumption need',
};

export interface SchemeRuleSet {
  kind?: SchemeKind;
  supportedPurposes: string[];
  eligibility: SchemeEligibilityRules;
  financing?: SchemeFinancingRules;
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
    } else if (!e.categories.includes(facts.category)) {
      c.push({ key: 'social_category', label: 'Social category', outcome: 'failed', detail: `This scheme is limited to ${e.categories.join(', ')}. Your profile records ${facts.category}.` });
    } else if (facts.category === 'OBC' && e.categories.includes('OBC')) {
      // Concessional OBC schemes (NBCFDC etc.) are limited to the Non-Creamy Layer.
      if (facts.obcCreamyLayer == null) {
        c.push({ key: 'social_category', label: 'Social category', outcome: 'unknown', detail: 'This OBC scheme is limited to the Non-Creamy Layer. Confirm your OBC creamy-layer status in your profile.' });
      } else if (facts.obcCreamyLayer) {
        c.push({ key: 'social_category', label: 'Social category', outcome: 'failed', detail: 'This scheme is limited to the OBC Non-Creamy Layer. Your profile records OBC Creamy Layer (treated as General for these schemes).' });
      } else {
        c.push({ key: 'social_category', label: 'Social category', outcome: 'passed', detail: 'This scheme is open to the OBC Non-Creamy Layer.' });
      }
    } else {
      c.push({ key: 'social_category', label: 'Social category', outcome: 'passed', detail: `This scheme is open to the ${facts.category} category.` });
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

  // 4. Purpose — only for schemes that declare supported financing purposes.
  if (scheme.supportedPurposes.length > 0) {
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

  // 5b. Gender
  if (e.genders && e.genders.length > 0) {
    if (facts.gender == null) {
      c.push({ key: 'gender', label: 'Gender', outcome: 'unknown', detail: 'Add your gender so this rule can be checked.' });
    } else if (e.genders.includes(facts.gender)) {
      c.push({ key: 'gender', label: 'Gender', outcome: 'passed', detail: `This scheme is open to ${e.genders.join(' / ')} applicants.` });
    } else {
      c.push({ key: 'gender', label: 'Gender', outcome: 'failed', detail: `This scheme is limited to ${e.genders.join(' / ')} applicants.` });
    }
  }

  // 5c. Education level (min / max, compared ordinally)
  if (e.minEducationLevel != null || e.maxEducationLevel != null) {
    if (facts.educationLevel == null) {
      c.push({ key: 'education', label: 'Education level', outcome: 'unknown', detail: 'Add your highest education level so this rule can be checked.' });
    } else {
      const idx = EDU_INDEX(facts.educationLevel);
      const lowOk = e.minEducationLevel == null || idx >= EDU_INDEX(e.minEducationLevel);
      const highOk = e.maxEducationLevel == null || idx <= EDU_INDEX(e.maxEducationLevel);
      if (lowOk && highOk) {
        c.push({ key: 'education', label: 'Education level', outcome: 'passed', detail: `Your education level (${EDU_LABEL[facts.educationLevel]}) meets this scheme's requirement.` });
      } else if (!lowOk) {
        c.push({ key: 'education', label: 'Education level', outcome: 'failed', detail: `This scheme needs at least ${EDU_LABEL[e.minEducationLevel!]}; you recorded ${EDU_LABEL[facts.educationLevel]}.` });
      } else {
        c.push({ key: 'education', label: 'Education level', outcome: 'failed', detail: `This scheme is for students up to ${EDU_LABEL[e.maxEducationLevel!]}; you recorded ${EDU_LABEL[facts.educationLevel]}.` });
      }
    }
  }

  // 5d. Occupation
  if (e.occupations && e.occupations.length > 0) {
    if (facts.occupation == null) {
      c.push({ key: 'occupation', label: 'Occupation', outcome: 'unknown', detail: 'Add your occupation so this rule can be checked.' });
    } else if (e.occupations.includes(facts.occupation)) {
      c.push({ key: 'occupation', label: 'Occupation', outcome: 'passed', detail: `This scheme covers ${OCC_LABEL[facts.occupation]}s.` });
    } else {
      c.push({ key: 'occupation', label: 'Occupation', outcome: 'failed', detail: `This scheme is for ${e.occupations.map((o) => OCC_LABEL[o]).join(', ')}. You recorded ${OCC_LABEL[facts.occupation]}.` });
    }
  }

  // 5e. Land holding ceiling (small / marginal farmer schemes)
  if (e.maxLandHoldingHectares != null) {
    if (facts.landHoldingHectares == null) {
      c.push({ key: 'land_holding', label: 'Land holding', outcome: 'unknown', detail: 'Add your land holding (in hectares) so this rule can be checked.' });
    } else if (facts.landHoldingHectares <= e.maxLandHoldingHectares) {
      c.push({ key: 'land_holding', label: 'Land holding', outcome: 'passed', detail: `Your land holding is within the ${e.maxLandHoldingHectares} ha ceiling.` });
    } else {
      c.push({ key: 'land_holding', label: 'Land holding', outcome: 'failed', detail: `This scheme is for holdings up to ${e.maxLandHoldingHectares} ha; you recorded ${facts.landHoldingHectares} ha.` });
    }
  }

  // 5f. Ration card / BPL
  if (e.rationCardTypes && e.rationCardTypes.length > 0) {
    if (facts.rationCardType == null) {
      c.push({ key: 'ration_card', label: 'Ration card', outcome: 'unknown', detail: 'Add your ration card type so this rule can be checked.' });
    } else if (e.rationCardTypes.includes(facts.rationCardType)) {
      c.push({ key: 'ration_card', label: 'Ration card', outcome: 'passed', detail: `This scheme covers ${e.rationCardTypes.join(' / ')} card holders.` });
    } else {
      c.push({ key: 'ration_card', label: 'Ration card', outcome: 'failed', detail: `This scheme is limited to ${e.rationCardTypes.join(' / ')} card holders.` });
    }
  }

  // 5g. Disability
  if (e.minDisabilityPct != null) {
    if (facts.disabilityPct == null) {
      c.push({ key: 'disability', label: 'Disability', outcome: 'unknown', detail: 'Add your certified disability percentage so this rule can be checked.' });
    } else if (facts.disabilityPct >= e.minDisabilityPct) {
      c.push({ key: 'disability', label: 'Disability', outcome: 'passed', detail: `Your certified disability (${facts.disabilityPct}%) meets the ${e.minDisabilityPct}% threshold.` });
    } else {
      c.push({ key: 'disability', label: 'Disability', outcome: 'failed', detail: `This scheme needs a certified disability of at least ${e.minDisabilityPct}%.` });
    }
  }

  // 5h. Student status
  if (e.studentRequired) {
    if (facts.isStudent == null) {
      c.push({ key: 'student', label: 'Student status', outcome: 'unknown', detail: 'Indicate whether you are currently a student.' });
    } else if (facts.isStudent) {
      c.push({ key: 'student', label: 'Student status', outcome: 'passed', detail: 'You are currently enrolled as a student.' });
    } else {
      c.push({ key: 'student', label: 'Student status', outcome: 'failed', detail: 'This scheme is for currently enrolled students.' });
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

  // 7. Financing rules — only for loan schemes, and only when the applicant has
  // supplied all three amounts.
  const f = financing;
  const haveFinancing =
    f != null &&
    typeof f.projectCostPaise === 'number' &&
    typeof f.ownContributionPaise === 'number' &&
    typeof f.requestedLoanPaise === 'number';

  const kind = scheme.kind ?? 'financing';
  if (kind !== 'financing' || !scheme.financing) {
    // Non-loan scheme: nothing more to check.
  } else if (!haveFinancing) {
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
