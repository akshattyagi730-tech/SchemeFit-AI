import { z } from 'zod';

export const calcSchema = z.object({
  schemeCode: z.string().min(2).max(40),
  projectCostPaise: z.number().int().positive().max(10_000_000_00),
  ownContributionPaise: z.number().int().min(0).max(10_000_000_00),
  requestedLoanPaise: z.number().int().positive().max(10_000_000_00),
  interestRateBps: z.number().int().min(0).max(10_000),
  tenureMonths: z.number().int().min(1).max(600),
  moratoriumMonths: z.number().int().min(0).max(120).default(0),
});

export type CalcInput = z.infer<typeof calcSchema>;
