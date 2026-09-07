import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { requireAuth, requireRole } from '../../middleware/auth';
import { getRecommendations } from './recommendations.controller';

export const recommendationsRouter = Router();
recommendationsRouter.use(requireAuth, requireRole('CITIZEN'));
recommendationsRouter.get('/', asyncHandler(getRecommendations));
