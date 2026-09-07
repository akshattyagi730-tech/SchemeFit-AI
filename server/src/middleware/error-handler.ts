import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';
import { env } from '../config/env';

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}`, requestId: req.requestId },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  let status = 500;
  let code = 'INTERNAL';
  let message = 'Internal server error';
  let fieldErrors: { path: string; message: string }[] | undefined;

  if (err instanceof AppError) {
    status = err.status;
    code = err.code;
    message = err.expose ? err.message : 'Internal server error';
    fieldErrors = err.fieldErrors;
  } else if (err instanceof ZodError) {
    status = 422;
    code = 'UNPROCESSABLE_ENTITY';
    message = 'Request validation failed';
    fieldErrors = err.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    status = 422;
    code = 'UNPROCESSABLE_ENTITY';
    message = 'Data validation failed';
    fieldErrors = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if ((err as { code?: number }).code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'A record with these details already exists';
  } else if (err instanceof mongoose.Error.CastError) {
    status = 400;
    code = 'BAD_REQUEST';
    message = `Invalid value for ${err.path}`;
  }

  const logPayload = { err, requestId: req.requestId, method: req.method, path: req.path, status };
  if (status >= 500) logger.error(logPayload, 'request failed');
  else logger.warn({ requestId: req.requestId, status, code, path: req.path }, 'request rejected');

  const body: Record<string, unknown> = { error: { code, message, requestId: req.requestId } };
  if (fieldErrors?.length) (body.error as Record<string, unknown>).fieldErrors = fieldErrors;
  // Never leak stack traces or internals in production.
  if (!env.isProd && status >= 500 && err instanceof Error) {
    (body.error as Record<string, unknown>).debug = { name: err.name, message: err.message, stack: err.stack?.split('\n').slice(0, 4) };
  }

  res.status(status).json(body);
}
