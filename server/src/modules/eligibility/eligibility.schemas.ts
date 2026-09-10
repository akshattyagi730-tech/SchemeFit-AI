import { z } from 'zod';
import {
  SOCIAL_CATEGORIES,
  AREA_TYPES,
  GENDERS,
  EDUCATION_LEVELS,
  OCCUPATIONS,
  RATION_CARD_TYPES,
} from '../../domain/types';

const paise = z.number().int().min(0).max(10_000_000_00);

/** One-shot eligibility questionnaire. Everything is optional — an unanswered
 *  question yields "needs information" for rules that depend on it. */
export const eligibilityCheckSchema = z
  .object({
    age: z.number().int().min(0).max(120).nullable().optional(),
    gender: z.enum(GENDERS).nullable().optional(),
    category: z.enum(SOCIAL_CATEGORIES).nullable().optional(),
    obcCreamyLayer: z.boolean().nullable().optional(),
    annualIncomePaise: paise.nullable().optional(),
    state: z.string().trim().min(1).max(80).nullable().optional(),
    areaType: z.enum(AREA_TYPES).nullable().optional(),
    educationLevel: z.enum(EDUCATION_LEVELS).nullable().optional(),
    occupation: z.enum(OCCUPATIONS).nullable().optional(),
    isStudent: z.boolean().nullable().optional(),
    landHoldingHectares: z.number().min(0).max(1000).nullable().optional(),
    rationCardType: z.enum(RATION_CARD_TYPES).nullable().optional(),
    disabilityPct: z.number().int().min(0).max(100).nullable().optional(),
  })
  .strict();

export type EligibilityCheckInput = z.infer<typeof eligibilityCheckSchema>;
