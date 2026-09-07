import { z } from 'zod';
import { SOCIAL_CATEGORIES, AREA_TYPES, PURPOSES } from '../../domain/types';

const paise = z.number().int().min(0).max(10_000_000_00); // up to ₹10 crore
const nullablePaise = paise.nullable();

export const updateProfileSchema = z
  .object({
    fullName: z.string().min(2).max(120).trim().optional(),
    age: z.number().int().min(16).max(100).nullable().optional(),
    annualIncomePaise: nullablePaise.optional(),
    category: z.enum(SOCIAL_CATEGORIES).nullable().optional(),
    state: z.string().min(1).max(80).trim().nullable().optional(),
    district: z.string().min(1).max(80).trim().nullable().optional(),
    areaType: z.enum(AREA_TYPES).nullable().optional(),
    location: z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .nullable()
      .optional(),
    purpose: z.enum(PURPOSES).nullable().optional(),
    businessDetails: z
      .object({
        activity: z.string().max(160).trim().optional(),
        stage: z.enum(['idea', 'existing', 'expansion', '']).optional(),
        yearsRunning: z.number().min(0).max(100).nullable().optional(),
      })
      .optional(),
    educationDetails: z
      .object({
        level: z.string().max(80).trim().optional(),
        course: z.string().max(120).trim().optional(),
        institution: z.string().max(160).trim().optional(),
      })
      .optional(),
    hasBusinessPlan: z.boolean().nullable().optional(),
    projectCostPaise: nullablePaise.optional(),
    ownContributionPaise: nullablePaise.optional(),
    requestedLoanPaise: nullablePaise.optional(),
  })
  .strict();

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
