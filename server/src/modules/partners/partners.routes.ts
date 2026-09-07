import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { routingPreview, routingQuery, listPartners } from './partners.controller';

export const partnersRouter = Router();
partnersRouter.use(requireAuth);
// Directory is visible to any authenticated user; routing preview is citizen-only.
partnersRouter.get('/', asyncHandler(listPartners));
partnersRouter.get('/routing', requireRole('CITIZEN'), validate({ query: routingQuery }), asyncHandler(routingPreview));
