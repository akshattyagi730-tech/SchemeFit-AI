import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { listSchemesQuery } from './schemes.schemas';
import * as ctrl from './schemes.controller';

// Read-only scheme catalogue (any authenticated user).
export const schemesRouter = Router();
schemesRouter.use(requireAuth);
schemesRouter.get('/', validate({ query: listSchemesQuery }), asyncHandler(ctrl.list));
schemesRouter.get('/:id', asyncHandler(ctrl.detail));
