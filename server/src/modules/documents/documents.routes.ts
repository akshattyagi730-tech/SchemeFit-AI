import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { handleUpload } from './upload';
import * as ctrl from './documents.controller';

// Nested under /applications/:appId/documents
export const applicationDocumentsRouter = Router({ mergeParams: true });
applicationDocumentsRouter.use(requireAuth);
applicationDocumentsRouter.get('/', validate({ query: ctrl.listDocsQuery }), asyncHandler(ctrl.listForApplication));
applicationDocumentsRouter.post(
  '/',
  requireRole('CITIZEN'),
  handleUpload,
  validate({ body: ctrl.uploadBodySchema }),
  asyncHandler(ctrl.upload),
);

// Top-level /documents/:id
export const documentsRouter = Router();
documentsRouter.use(requireAuth);
documentsRouter.get('/:id', asyncHandler(ctrl.metadata));
documentsRouter.get('/:id/download', asyncHandler(ctrl.download));
documentsRouter.post('/:id/review', requireRole('PARTNER', 'ADMIN'), validate({ body: ctrl.reviewBodySchema }), asyncHandler(ctrl.review));
