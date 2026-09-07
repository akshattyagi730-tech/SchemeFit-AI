/**
 * Suitability scoring for ELIGIBLE schemes only.
 *
 * The score is a transparent, deterministic ranking number in [0, 100]. It is NOT
 * an approval probability and NOT a disbursement guarantee. Eligibility,
 * suitability and document readiness are three separate concepts.
 */
import type {
  ApplicantFacts,
  FinancingInputs,
  RankingFactor,
  SchemeTerms,
  SuitabilityResult,
  RequiredDocumentSpec,
} from './types';

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

export interface RankableScheme {
  financing: { minAmountPaise: number; maxAmountPaise: number };
  terms: SchemeTerms;
  requiredDocuments: RequiredDocumentSpec[];
  eligibility: { categories?: string[] };
}

const WEIGHTS = {
  financing_fit: 0.35,
  cost_of_credit: 0.25,
  tenure_flexibility: 0.15,
  documentation_load: 0.1,
  moratorium_support: 0.1,
  category_priority: 0.05,
} as const;

const NEW_VENTURE_PURPOSES = new Set(['business_new', 'education', 'skilling']);

export function scoreScheme(
  scheme: RankableScheme,
  facts: ApplicantFacts,
  financing: FinancingInputs,
): SuitabilityResult {
  const factors: RankingFactor[] = [];

  // 1. Financing fit — how comfortably the scheme covers the requested loan.
  {
    const { requestedLoanPaise } = financing;
    const { minAmountPaise, maxAmountPaise } = scheme.financing;
    let raw: number;
    let why: string;
    if (requestedLoanPaise < minAmountPaise) {
      raw = 30;
      why = 'Requested loan is below this scheme’s usual floor — a smaller-ticket product may fit better.';
    } else if (requestedLoanPaise > maxAmountPaise) {
      raw = 5;
      why = 'Requested loan is above this scheme’s ceiling.';
    } else {
      const utilisation = requestedLoanPaise / maxAmountPaise; // 0..1
      // Best fit around 40–80% utilisation; penalise both extremes gently.
      raw = 100 - Math.abs(0.6 - utilisation) * 120;
      why = `Requested loan uses ${Math.round(utilisation * 100)}% of the scheme ceiling — comfortably within range.`;
    }
    raw = clamp(raw);
    factors.push({ key: 'financing_fit', label: 'Financing fit', weight: WEIGHTS.financing_fit, rawScore: r1(raw), weightedScore: r1(raw * WEIGHTS.financing_fit), explanation: why });
  }

  // 2. Cost of credit — lower minimum rate is better. 0% -> 100, 18% -> 0.
  {
    const minRatePct = scheme.terms.minInterestRateBps / 100;
    const raw = clamp(100 - (minRatePct / 18) * 100);
    factors.push({
      key: 'cost_of_credit',
      label: 'Cost of credit',
      weight: WEIGHTS.cost_of_credit,
      rawScore: r1(raw),
      weightedScore: r1(raw * WEIGHTS.cost_of_credit),
      explanation: minRatePct === 0 ? 'Zero-interest facility.' : `Interest starts at ${minRatePct}% p.a.`,
    });
  }

  // 3. Tenure flexibility — wider permitted band scores higher.
  {
    const span = scheme.terms.maxTenureMonths - scheme.terms.minTenureMonths;
    const raw = clamp((span / 84) * 100); // 7 years span -> full marks
    factors.push({
      key: 'tenure_flexibility',
      label: 'Tenure flexibility',
      weight: WEIGHTS.tenure_flexibility,
      rawScore: r1(raw),
      weightedScore: r1(raw * WEIGHTS.tenure_flexibility),
      explanation: `Repayment can be set between ${scheme.terms.minTenureMonths} and ${scheme.terms.maxTenureMonths} months.`,
    });
  }

  // 4. Documentation load — fewer required documents is better.
  {
    const required = scheme.requiredDocuments.filter((d) => !d.optional).length;
    const raw = clamp(100 - Math.max(0, required - 3) * 12);
    factors.push({
      key: 'documentation_load',
      label: 'Documentation load',
      weight: WEIGHTS.documentation_load,
      rawScore: r1(raw),
      weightedScore: r1(raw * WEIGHTS.documentation_load),
      explanation: `${required} mandatory document${required === 1 ? '' : 's'} required.`,
    });
  }

  // 5. Moratorium support — valuable when the purpose has a ramp-up period.
  {
    const wantsMoratorium = facts.purpose != null && NEW_VENTURE_PURPOSES.has(facts.purpose);
    let raw: number;
    let why: string;
    if (!scheme.terms.moratorium.allowed) {
      raw = wantsMoratorium ? 25 : 65;
      why = wantsMoratorium ? 'No moratorium, though your purpose typically benefits from a ramp-up period.' : 'No moratorium offered (not usually needed for this purpose).';
    } else {
      raw = wantsMoratorium ? 100 : 80;
      why = `Moratorium of up to ${scheme.terms.moratorium.maxMonths} months available.`;
    }
    factors.push({ key: 'moratorium_support', label: 'Moratorium support', weight: WEIGHTS.moratorium_support, rawScore: r1(raw), weightedScore: r1(raw * WEIGHTS.moratorium_support), explanation: why });
  }

  // 6. Category priority — scheme explicitly targets the applicant's category.
  {
    const targeted = facts.category != null && (scheme.eligibility.categories?.includes(facts.category) ?? false) && (scheme.eligibility.categories?.length ?? 0) < 6;
    const raw = targeted ? 100 : 55;
    factors.push({
      key: 'category_priority',
      label: 'Category priority',
      weight: WEIGHTS.category_priority,
      rawScore: r1(raw),
      weightedScore: r1(raw * WEIGHTS.category_priority),
      explanation: targeted ? `This scheme specifically prioritises the ${facts.category} category.` : 'This is a general-purpose scheme (not category-targeted).',
    });
  }

  const score = r1(factors.reduce((s, f) => s + f.weightedScore, 0));

  return {
    score,
    factors,
    disclaimer:
      'This is a transparent ranking score based on how well the scheme’s terms fit your inputs. It is not a loan-approval probability, not a sanction, and not a disbursement guarantee. Eligibility and document readiness are shown separately.',
  };
}
