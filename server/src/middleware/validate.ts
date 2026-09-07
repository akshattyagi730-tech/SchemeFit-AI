import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z, ZodError, type ZodTypeAny } from 'zod';
import { unprocessable } from '../lib/errors';

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

function toFieldErrors(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path.join('.') || '(root)', message: i.message }));
}

/**
 * Validate + coerce request parts against Zod schemas. On success the parsed
 * values replace the raw ones so handlers get typed, trusted input.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (schemas.params) req.params = schemas.params.parse(req.params) as Request['params'];
      if (schemas.query) {
        const parsed = schemas.query.parse(req.query);
        Object.defineProperty(req, 'query', { value: parsed, configurable: true, writable: true });
      }
      if (schemas.body) req.body = schemas.body.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        next(unprocessable('Request validation failed', toFieldErrors(err)));
      } else {
        next(err);
      }
    }
  };
}

export type Infer<T extends ZodTypeAny> = z.infer<T>;
