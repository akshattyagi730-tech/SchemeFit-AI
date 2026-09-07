import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import {
  createApplicationSchema,
  listApplicationsQuery,
  patchFinancingSchema,
} from './applications.schemas';
import * as ctrl from './applications.controller';
import { applicationDocumentsRouter } from '../documents/documents.routes';

export const applicationsRouter = Router();
applicationsRouter.use(requireAuth);

// Nested document routes: /applications/:appId/documents
applicationsRouter.use('/:appId/documents', applicationDocumentsRouter);

// List is role-aware (citizen: own; partner: assigned; admin: all).
applicationsRouter.get('/', validate({ query: listApplicationsQuery }), asyncHandler(ctrl.list));
applicationsRouter.get('/:id', asyncHandler(ctrl.detail));

// Citizen-only create + edit + lifecycle actions.
applicationsRouter.post('/', requireRole('CITIZEN'), validate({ body: createApplicationSchema }), asyncHandler(ctrl.create));
applicationsRouter.patch('/:id/financing', requireRole('CITIZEN'), validate({ body: patchFinancingSchema }), asyncHandler(ctrl.patchFinancing));
applicationsRouter.post('/:id/submit', requireRole('CITIZEN'), asyncHandler(ctrl.citizenTransition('submit')));
applicationsRouter.post('/:id/resubmit', requireRole('CITIZEN'), asyncHandler(ctrl.citizenTransition('resubmit')));
