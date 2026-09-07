import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { listApplicationsQuery, reasonBodySchema } from '../applications/applications.schemas';
import * as apps from '../applications/applications.controller';
import { partnerSummary } from './partner-portal.controller';

/**
 * Partner workspace. Every route is PARTNER-only and every application access is
 * additionally checked to be assigned to the caller's organisation.
 */
export const partnerPortalRouter = Router();
partnerPortalRouter.use(requireAuth, requireRole('PARTNER'));

partnerPortalRouter.get('/summary', asyncHandler(partnerSummary));
partnerPortalRouter.get('/applications', validate({ query: listApplicationsQuery }), asyncHandler(apps.list));
partnerPortalRouter.get('/applications/:id', asyncHandler(apps.detail));

partnerPortalRouter.post('/applications/:id/start-review', asyncHandler(apps.reviewerTransition('start_review')));
partnerPortalRouter.post('/applications/:id/request-changes', validate({ body: reasonBodySchema }), asyncHandler(apps.reviewerTransition('request_changes')));
partnerPortalRouter.post('/applications/:id/approve', asyncHandler(apps.reviewerTransition('approve')));
partnerPortalRouter.post('/applications/:id/reject', validate({ body: reasonBodySchema }), asyncHandler(apps.reviewerTransition('reject')));
