/**
 * Canonical application error. Every deliberate failure path throws one of these
 * so the error handler can produce a consistent JSON envelope.
 */
export type FieldError = { path: string; message: string };

export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: FieldError[];
  readonly expose: boolean;

  constructor(status: number, code: string, message: string, opts?: { fieldErrors?: FieldError[]; expose?: boolean }) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.fieldErrors = opts?.fieldErrors;
    this.expose = opts?.expose ?? status < 500;
  }
}

export const badRequest = (msg = 'Bad request', fieldErrors?: FieldError[]) =>
  new AppError(400, 'BAD_REQUEST', msg, { fieldErrors });
export const unauthorized = (msg = 'Authentication required') => new AppError(401, 'UNAUTHENTICATED', msg);
export const forbidden = (msg = 'You do not have access to this resource') => new AppError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Resource not found') => new AppError(404, 'NOT_FOUND', msg);
export const conflict = (msg = 'Conflicting request', code = 'CONFLICT') => new AppError(409, code, msg);
export const unprocessable = (msg = 'Validation failed', fieldErrors?: FieldError[]) =>
  new AppError(422, 'UNPROCESSABLE_ENTITY', msg, { fieldErrors });
export const tooManyRequests = (msg = 'Too many requests') => new AppError(429, 'RATE_LIMITED', msg);
export const serverError = (msg = 'Internal server error') => new AppError(500, 'INTERNAL', msg, { expose: false });
