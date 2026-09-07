import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { requireAuth } from '../../middleware/auth';
import { calcSchema } from './finance.schemas';
import { calculate } from './finance.controller';

export const financeRouter = Router();
financeRouter.use(requireAuth);
financeRouter.post('/calculate', validate({ body: calcSchema }), asyncHandler(calculate));
