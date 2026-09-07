import multer from 'multer';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../../config/env';
import { unprocessable, badRequest } from '../../lib/errors';

// Buffer the file in memory; we validate the signature and hand bytes to the
// storage adapter ourselves (no direct disk write by multer).
export const uploadSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.UPLOAD_MAX_BYTES, files: 1, fields: 10 },
}).single('file');

/** Wrap multer so its errors become our standard envelope. */
export function handleUpload(req: Request, res: Response, next: NextFunction): void {
  uploadSingle(req, res, (err: unknown) => {
    if (!err) return next();
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(unprocessable(`File exceeds the maximum size of ${Math.round(env.UPLOAD_MAX_BYTES / 1024)} KB.`));
      }
      return next(badRequest(`Upload error: ${err.message}`));
    }
    next(err);
  });
}
