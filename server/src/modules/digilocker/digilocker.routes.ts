import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import * as ctrl from './digilocker.controller';

export const digilockerRouter = Router();

// The OAuth callback is a top-level browser redirect: it only needs a session,
// and it must not sit behind requireRole (it redirects on every outcome).
digilockerRouter.get('/callback', requireAuth, asyncHandler(ctrl.callback));

digilockerRouter.use(requireAuth);
digilockerRouter.get('/status', asyncHandler(ctrl.status));
digilockerRouter.post('/connect', requireRole('CITIZEN'), asyncHandler(ctrl.connect));
digilockerRouter.post('/disconnect', requireRole('CITIZEN'), asyncHandler(ctrl.disconnect));
digilockerRouter.get('/issued', requireRole('CITIZEN'), asyncHandler(ctrl.issued));
digilockerRouter.post('/import', requireRole('CITIZEN'), validate({ body: ctrl.importSchema }), asyncHandler(ctrl.importDoc));
