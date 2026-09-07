import { z } from 'zod';
import { pageQuery } from '../../lib/query';
import { APPLICATION_STATUSES } from '../../domain/application-status';

export const createApplicationSchema = z.object({
  schemeCode: z.string().min(2).max(40),
});

const paise = z.number().int().min(0).max(10_000_000_00);

export const patchFinancingSchema = z
  .object({
    projectCostPaise: paise.nullable().optional(),
    ownContributionPaise: paise.nullable().optional(),
    requestedLoanPaise: paise.nullable().optional(),
    interestRateBps: z.number().int().min(0).max(10_000).optional(),
    tenureMonths: z.number().int().min(1).max(600).optional(),
    moratoriumMonths: z.number().int().min(0).max(120).optional(),
  })
  .strict();

export const reasonBodySchema = z.object({
  reason: z.string().min(3).max(1000).trim(),
});

export const optionalReasonBodySchema = z.object({
  reason: z.string().min(3).max(1000).trim().optional(),
});

export const assignBodySchema = z.object({
  partnerId: z.string().length(24).optional(),
  reason: z.string().min(3).max(1000).trim().optional(),
});

export const reassignBodySchema = z.object({
  partnerId: z.string().length(24).optional(),
  reason: z.string().min(3).max(1000).trim(),
});

export const listApplicationsQuery = pageQuery(['createdAt', 'updatedAt', 'submittedAt', 'reference'] as const, 'updatedAt').extend({
  status: z.enum(APPLICATION_STATUSES).optional(),
  schemeCode: z.string().min(2).max(40).optional(),
  readiness: z.enum(['complete', 'incomplete']).optional(),
  q: z.string().max(80).optional(),
});
