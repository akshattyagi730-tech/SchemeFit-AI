import { Router } from 'express';
import { asyncHandler } from '../../lib/http';
import { validate } from '../../middleware/validate';
import { authLimiter } from '../../middleware/rate-limit';
import { requireAuth } from '../../middleware/auth';
import { loginSchema, registerSchema } from './auth.schemas';
import * as ctrl from './auth.controller';

export const authRouter = Router();

authRouter.get('/csrf', ctrl.csrf);
authRouter.post('/register', authLimiter, validate({ body: registerSchema }), asyncHandler(ctrl.register));
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), asyncHandler(ctrl.login));
authRouter.post('/logout', asyncHandler(ctrl.logout));
authRouter.post('/logout-all', requireAuth, asyncHandler(ctrl.logoutAll));
authRouter.get('/me', requireAuth, asyncHandler(ctrl.me));
