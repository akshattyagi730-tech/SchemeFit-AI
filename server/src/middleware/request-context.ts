import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

/** Assign a request id and echo it back so clients/logs can correlate. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header('x-request-id');
  req.requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
  res.setHeader('x-request-id', req.requestId);
  next();
}
