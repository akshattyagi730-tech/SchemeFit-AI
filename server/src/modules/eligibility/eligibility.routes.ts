import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { eligibilityCheckSchema } from './eligibility.schemas';
import { checkEligibility } from './eligibility.controller';

export const eligibilityRouter = Router();
eligibilityRouter.use(requireAuth);
eligibilityRouter.post('/check', validate({ body: eligibilityCheckSchema }), asyncHandler(checkEligibility));
