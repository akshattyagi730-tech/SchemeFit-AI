import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth, requireRole } from '../../middleware/auth';
import { updateProfileSchema } from './users.schemas';
import * as ctrl from './users.controller';

export const profileRouter = Router();

profileRouter.use(requireAuth, requireRole('CITIZEN'));
profileRouter.get('/', asyncHandler(ctrl.getProfile));
profileRouter.put('/', validate({ body: updateProfileSchema }), asyncHandler(ctrl.updateProfile));
