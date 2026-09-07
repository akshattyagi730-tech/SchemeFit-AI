import { z } from 'zod';
import { SOCIAL_CATEGORIES, AREA_TYPES, PURPOSES, MORATORIUM_INTEREST_HANDLING } from '../../domain/types';
import { pageQuery } from '../../lib/query';

export const listSchemesQuery = pageQuery(['createdAt', 'name', 'code'] as const, 'name').extend({
  purpose: z.enum(PURPOSES).optional(),
  status: z.enum(['active', 'archived', 'all']).default('active'),
});

const docSpec = z.object({
  type: z.string().min(2).max(60).regex(/^[a-z0-9_]+$/, 'type must be snake_case'),
  label: z.string().min(2).max(120),
  optional: z.boolean().optional(),
});

const paise = z.number().int().min(0).max(10_000_000_00);
const bps = z.number().int().min(0).max(10_000);

export const schemeBodySchema = z
  .object({
    code: z.string().min(2).max(40).regex(/^[A-Z0-9-]+$/, 'code must be UPPER-KEBAB'),
    name: z.string().min(3).max(160),
    provider: z.string().min(2).max(160),
    program: z.string().min(2).max(160),
    displayCategory: z.string().min(2).max(80),
    description: z.string().max(2000).optional().default(''),
    supportedPurposes: z.array(z.enum(PURPOSES)).min(1),
    eligibility: z.object({
      categories: z.array(z.enum(SOCIAL_CATEGORIES)).min(1).optional(),
      minAge: z.number().int().min(16).max(100).optional(),
      maxAge: z.number().int().min(16).max(100).optional(),
      minAnnualIncomePaise: paise.optional(),
      maxAnnualIncomePaise: paise.optional(),
      location: z
        .object({
          states: z.array(z.string().min(1).max(80)).optional(),
          districts: z.array(z.string().min(1).max(80)).optional(),
          areaTypes: z.array(z.enum(AREA_TYPES)).optional(),
        })
        .optional(),
      requiresBusinessPlan: z.boolean().optional().default(false),
    }),
    financing: z.object({
      minAmountPaise: paise,
      maxAmountPaise: paise.refine((v) => v > 0, 'must be > 0'),
      maxProjectCostSharePct: z.number().min(1).max(100),
      minOwnContributionPct: z.number().min(0).max(100),
    }),
    terms: z.object({
      minInterestRateBps: bps,
      maxInterestRateBps: bps,
      minTenureMonths: z.number().int().min(1).max(600),
      maxTenureMonths: z.number().int().min(1).max(600),
      moratorium: z.object({
        allowed: z.boolean(),
        maxMonths: z.number().int().min(0).max(120),
        interestHandling: z.enum(MORATORIUM_INTEREST_HANDLING),
        tenureIncludesMoratorium: z.boolean(),
      }),
    }),
    requiredDocuments: z.array(docSpec).min(1),
    source: z.object({
      url: z.string().url().optional().or(z.literal('')),
      verificationDate: z.coerce.date().optional().nullable(),
      effectiveFrom: z.coerce.date().optional().nullable(),
      effectiveTo: z.coerce.date().optional().nullable(),
      version: z.string().min(1).max(40),
      demoData: z.boolean(),
    }),
    status: z.enum(['active', 'archived']).optional().default('active'),
  })
  .superRefine((v, ctx) => {
    if (v.financing.minAmountPaise > v.financing.maxAmountPaise)
      ctx.addIssue({ code: 'custom', path: ['financing', 'minAmountPaise'], message: 'min exceeds max' });
    if (v.terms.minInterestRateBps > v.terms.maxInterestRateBps)
      ctx.addIssue({ code: 'custom', path: ['terms', 'minInterestRateBps'], message: 'min exceeds max' });
    if (v.terms.minTenureMonths > v.terms.maxTenureMonths)
      ctx.addIssue({ code: 'custom', path: ['terms', 'minTenureMonths'], message: 'min exceeds max' });
    if (v.eligibility.minAge && v.eligibility.maxAge && v.eligibility.minAge > v.eligibility.maxAge)
      ctx.addIssue({ code: 'custom', path: ['eligibility', 'minAge'], message: 'min exceeds max' });
  });

export type SchemeBodyInput = z.infer<typeof schemeBodySchema>;
