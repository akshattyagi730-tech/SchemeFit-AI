/**
 * Shared domain vocabulary. These enums are the single source of truth used by
 * the rule engine, the models and request validation.
 */

export const SOCIAL_CATEGORIES = ['GENERAL', 'OBC', 'SC', 'ST', 'EWS', 'MINORITY'] as const;
export type SocialCategory = (typeof SOCIAL_CATEGORIES)[number];

export const AREA_TYPES = ['rural', 'urban', 'semi_urban'] as const;
export type AreaType = (typeof AREA_TYPES)[number];

export const PURPOSES = [
  'business_new',
  'business_expansion',
  'equipment_purchase',
  'working_capital',
  'education',
  'skilling',
  'agriculture',
  'housing',
  'vehicle',
  'personal',
] as const;
export type Purpose = (typeof PURPOSES)[number];

/** Purpose groups for the guided intake wizard (frontend uses the same keys). */
export const PURPOSE_GROUPS: { group: string; purposes: Purpose[] }[] = [
  { group: 'Business & self-employment', purposes: ['business_new', 'business_expansion', 'equipment_purchase', 'working_capital'] },
  { group: 'Education & skilling', purposes: ['education', 'skilling'] },
  { group: 'Agriculture & allied', purposes: ['agriculture'] },
  { group: 'Home', purposes: ['housing'] },
  { group: 'Vehicle for livelihood', purposes: ['vehicle'] },
  { group: 'Personal', purposes: ['personal'] },
];

export const MORATORIUM_INTEREST_HANDLING = ['serviced', 'capitalised'] as const;
export type MoratoriumInterestHandling = (typeof MORATORIUM_INTEREST_HANDLING)[number];

/** What sort of benefit a scheme provides. Only 'financing' schemes run the loan rules. */
export const SCHEME_KINDS = [
  'financing',
  'scholarship',
  'pension',
  'income_support',
  'housing',
  'insurance',
  'skilling',
  'health',
  'welfare',
] as const;
export type SchemeKind = (typeof SCHEME_KINDS)[number];

export const GENDERS = ['female', 'male', 'transgender'] as const;
export type Gender = (typeof GENDERS)[number];

/** Ordinal — a scheme's min/max education level is compared by index. */
export const EDUCATION_LEVELS = [
  'none',
  'below_primary',
  'primary',
  'class_8',
  'class_10',
  'class_12',
  'iti_diploma',
  'graduate',
  'postgraduate',
] as const;
export type EducationLevel = (typeof EDUCATION_LEVELS)[number];

export const OCCUPATIONS = [
  'student',
  'farmer',
  'agri_labourer',
  'daily_wager',
  'artisan',
  'street_vendor',
  'domestic_worker',
  'shg_member',
  'self_employed',
  'private_salaried',
  'govt_salaried',
  'unemployed',
  'homemaker',
  'other',
] as const;
export type Occupation = (typeof OCCUPATIONS)[number];

export const RATION_CARD_TYPES = ['none', 'APL', 'BPL', 'AAY', 'PHH'] as const;
export type RationCardType = (typeof RATION_CARD_TYPES)[number];

export type EvaluationStatus = 'eligible' | 'ineligible' | 'needs_information';
export type ConditionOutcome = 'passed' | 'failed' | 'unknown';

export interface ConditionResult {
  key: string;
  label: string;
  outcome: ConditionOutcome;
  detail: string;
}

export interface EligibilityResult {
  status: EvaluationStatus;
  conditions: ConditionResult[];
  passed: ConditionResult[];
  failed: ConditionResult[];
  unknown: ConditionResult[];
  /** Non-blocking notes (e.g. an unplanned funding gap). Do not affect `status`. */
  advisories: ConditionResult[];
}

/** Location a scheme serves. Empty arrays / undefined mean "no restriction". */
export interface LocationScope {
  states?: string[];
  districts?: string[];
  areaTypes?: AreaType[];
}

export interface SchemeEligibilityRules {
  categories?: SocialCategory[];
  minAge?: number;
  maxAge?: number;
  minAnnualIncomePaise?: number;
  maxAnnualIncomePaise?: number;
  location?: LocationScope;
  requiresBusinessPlan?: boolean;
  // Broader criteria for non-loan schemes. Each rule only fires when set.
  genders?: Gender[];
  minEducationLevel?: EducationLevel;
  maxEducationLevel?: EducationLevel;
  occupations?: Occupation[];
  maxLandHoldingHectares?: number;
  rationCardTypes?: RationCardType[];
  minDisabilityPct?: number;
  studentRequired?: boolean;
}

export interface SchemeFinancingRules {
  minAmountPaise: number;
  maxAmountPaise: number;
  /** Scheme funds at most this % of the total project cost. */
  maxProjectCostSharePct: number;
  /** Borrower must contribute at least this % of the total project cost. */
  minOwnContributionPct: number;
}

export interface SchemeMoratoriumPolicy {
  allowed: boolean;
  maxMonths: number;
  interestHandling: MoratoriumInterestHandling;
  /** Whether the quoted tenure already includes the moratorium months. */
  tenureIncludesMoratorium: boolean;
}

export interface SchemeTerms {
  minInterestRateBps: number; // 0 allowed (zero-interest schemes)
  maxInterestRateBps: number;
  minTenureMonths: number;
  maxTenureMonths: number;
  moratorium: SchemeMoratoriumPolicy;
}

export interface RequiredDocumentSpec {
  type: string;
  label: string;
  optional?: boolean;
}

/** The applicant facts the rule engine consumes. */
export interface ApplicantFacts {
  age?: number | null;
  annualIncomePaise?: number | null;
  category?: SocialCategory | null;
  /** Only meaningful when category === 'OBC'. true = Creamy Layer (treated as General). */
  obcCreamyLayer?: boolean | null;
  state?: string | null;
  district?: string | null;
  areaType?: AreaType | null;
  purpose?: Purpose | null;
  hasBusinessPlan?: boolean | null;
  gender?: Gender | null;
  educationLevel?: EducationLevel | null;
  occupation?: Occupation | null;
  landHoldingHectares?: number | null;
  rationCardType?: RationCardType | null;
  disabilityPct?: number | null;
  isStudent?: boolean | null;
}

export interface FinancingInputs {
  projectCostPaise: number;
  ownContributionPaise: number;
  requestedLoanPaise: number;
}

export interface RankingFactor {
  key: string;
  label: string;
  weight: number; // 0..1 share of the 100-point total
  rawScore: number; // 0..100 for this factor
  weightedScore: number; // rawScore * weight, rounded to 1dp
  explanation: string;
}

export interface SuitabilityResult {
  score: number; // 0..100 transparent ranking score (NOT an approval probability)
  factors: RankingFactor[];
  disclaimer: string;
}
