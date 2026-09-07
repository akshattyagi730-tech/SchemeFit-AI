import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import * as ctrl from './notifications.controller';

export const notificationsRouter = Router();
notificationsRouter.use(requireAuth);
notificationsRouter.get('/', validate({ query: ctrl.listQuery }), asyncHandler(ctrl.list));
notificationsRouter.post('/read', validate({ body: ctrl.markReadBody }), asyncHandler(ctrl.markReadHandler));
