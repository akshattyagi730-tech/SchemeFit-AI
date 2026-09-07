import { Schema, type HydratedDocument, type Model } from 'mongoose';
import { defineModel } from './registry';
import { SOCIAL_CATEGORIES, AREA_TYPES, PURPOSES, MORATORIUM_INTEREST_HANDLING } from '../domain/types';
import type {
  SchemeEligibilityRules,
  SchemeFinancingRules,
  SchemeTerms,
  RequiredDocumentSpec,
  Purpose,
} from '../domain/types';

/**
 * A financing scheme and its machine-readable rule set. The rule engine reads
 * ONLY these stored rules — nothing is inferred by a language model.
 *
 * `source.demoData: true` marks an UNVERIFIED demonstration rule set. Seeded
 * schemes in this prototype are demonstration data and must be labelled as such
 * in the UI. They are not a statement of official government policy.
 */
export interface SchemeSource {
  url: string;
  verificationDate: Date | null;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  version: string;
  demoData: boolean;
}

export interface SchemeAttrs {
  code: string;
  name: string;
  provider: string;
  program: string;
  displayCategory: string;
  description: string;
  supportedPurposes: Purpose[];
  eligibility: SchemeEligibilityRules;
  financing: SchemeFinancingRules;
  terms: SchemeTerms;
  requiredDocuments: RequiredDocumentSpec[];
  source: SchemeSource;
  status: 'active' | 'archived';
  createdAt: Date;
  updatedAt: Date;
}

const requiredDocSchema = new Schema<RequiredDocumentSpec>(
  {
    type: { type: String, required: true },
    label: { type: String, required: true },
    optional: { type: Boolean, default: false },
  },
  { _id: false },
);

const schemeSchema = new Schema<SchemeAttrs>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    name: { type: String, required: true, trim: true },
    provider: { type: String, required: true, trim: true },
    program: { type: String, required: true, trim: true },
    displayCategory: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    supportedPurposes: { type: [{ type: String, enum: PURPOSES }], default: [] },

    eligibility: {
      categories: { type: [{ type: String, enum: SOCIAL_CATEGORIES }], default: undefined },
      minAge: { type: Number, default: undefined },
      maxAge: { type: Number, default: undefined },
      minAnnualIncomePaise: { type: Number, default: undefined },
      maxAnnualIncomePaise: { type: Number, default: undefined },
      location: {
        states: { type: [String], default: undefined },
        districts: { type: [String], default: undefined },
        areaTypes: { type: [{ type: String, enum: AREA_TYPES }], default: undefined },
      },
      requiresBusinessPlan: { type: Boolean, default: false },
    },

    financing: {
      minAmountPaise: { type: Number, required: true, min: 0 },
      maxAmountPaise: { type: Number, required: true, min: 1 },
      maxProjectCostSharePct: { type: Number, required: true, min: 1, max: 100 },
      minOwnContributionPct: { type: Number, required: true, min: 0, max: 100 },
    },

    terms: {
      minInterestRateBps: { type: Number, required: true, min: 0 },
      maxInterestRateBps: { type: Number, required: true, min: 0 },
      minTenureMonths: { type: Number, required: true, min: 1 },
      maxTenureMonths: { type: Number, required: true, min: 1 },
      moratorium: {
        allowed: { type: Boolean, default: false },
        maxMonths: { type: Number, default: 0 },
        interestHandling: { type: String, enum: MORATORIUM_INTEREST_HANDLING, default: 'serviced' },
        tenureIncludesMoratorium: { type: Boolean, default: true },
      },
    },

    requiredDocuments: { type: [requiredDocSchema], default: [] },

    source: {
      url: { type: String, default: '' },
      verificationDate: { type: Date, default: null },
      effectiveFrom: { type: Date, default: null },
      effectiveTo: { type: Date, default: null },
      version: { type: String, required: true, default: 'demo-1' },
      demoData: { type: Boolean, required: true, default: true },
    },

    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
  },
  { timestamps: true },
);

schemeSchema.index({ status: 1, supportedPurposes: 1 });

export type SchemeDoc = HydratedDocument<SchemeAttrs>;
export const Scheme: Model<SchemeAttrs> = defineModel<SchemeAttrs>('Scheme', schemeSchema);
