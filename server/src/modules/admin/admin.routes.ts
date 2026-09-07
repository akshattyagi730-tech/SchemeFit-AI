import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';

import * as schemes from '../schemes/schemes.controller';
import { schemeBodySchema, listSchemesQuery } from '../schemes/schemes.schemas';
import * as apps from '../applications/applications.controller';
import { assignBodySchema, reassignBodySchema } from '../applications/applications.schemas';
import * as partnersAdmin from './partners-admin.controller';
import { partnerBodySchema, partnerPatchSchema, provisionUserSchema, auditQuery, adminApplicationsQuery } from './admin.schemas';
import { adminKpis } from './analytics.controller';
import { listAudit, applicationHistory } from './audit.controller';
import { pageQuery } from '../../lib/query';

export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('ADMIN'));

// --- Schemes ---
adminRouter.get('/schemes', validate({ query: listSchemesQuery }), asyncHandler(schemes.list));
adminRouter.post('/schemes', validate({ body: schemeBodySchema }), asyncHandler(schemes.createScheme));
adminRouter.get('/schemes/:id', asyncHandler(schemes.detail));
adminRouter.put('/schemes/:id', validate({ body: schemeBodySchema }), asyncHandler(schemes.replaceScheme));
adminRouter.post('/schemes/:id/archive', asyncHandler(schemes.setSchemeStatus('archived')));
adminRouter.post('/schemes/:id/activate', asyncHandler(schemes.setSchemeStatus('active')));

// --- Partner organisations & user provisioning ---
adminRouter.get('/partners', validate({ query: pageQuery(['createdAt', 'name'] as const, 'name') }), asyncHandler(partnersAdmin.listPartners));
adminRouter.post('/partners', validate({ body: partnerBodySchema }), asyncHandler(partnersAdmin.createPartner));
adminRouter.get('/partners/:id', asyncHandler(partnersAdmin.getPartner));
adminRouter.patch('/partners/:id', validate({ body: partnerPatchSchema }), asyncHandler(partnersAdmin.updatePartner));
adminRouter.post('/users', validate({ body: provisionUserSchema }), asyncHandler(partnersAdmin.provisionUser));

// --- Applications: filters, assignment, reassignment, review history ---
adminRouter.get('/applications', validate({ query: adminApplicationsQuery }), asyncHandler(apps.list));
adminRouter.get('/applications/:id', asyncHandler(apps.detail));
adminRouter.get('/applications/:id/history', asyncHandler(applicationHistory));
adminRouter.post('/applications/:id/assign', validate({ body: assignBodySchema }), asyncHandler(apps.assign));
adminRouter.post('/applications/:id/reassign', validate({ body: reassignBodySchema }), asyncHandler(apps.reassign));
adminRouter.post('/applications/:id/start-review', asyncHandler(apps.reviewerTransition('start_review')));
adminRouter.post('/applications/:id/approve', asyncHandler(apps.reviewerTransition('approve')));
adminRouter.post('/applications/:id/reject', validate({ body: reassignBodySchema.pick({ reason: true }) }), asyncHandler(apps.reviewerTransition('reject')));

// --- Analytics & audit ---
adminRouter.get('/kpis', asyncHandler(adminKpis));
adminRouter.get('/audit', validate({ query: auditQuery }), asyncHandler(listAudit));
