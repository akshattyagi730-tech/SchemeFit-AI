import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok, created } from '../../lib/http';
import { badRequest } from '../../lib/errors';
import { DocumentModel } from '../../models/Document';
import { Scheme } from '../../models/Scheme';
import { findApplicationOr404, assertCanAccess } from '../applications/applications.service';
import { readinessForApplication } from '../applications/readiness.service';
import {
  assertDocAccess,
  findDocumentOr404,
  reviewDocument,
  streamDocument,
  uploadDocument,
} from './documents.service';
import { serializeDocument } from './documents.serialize';

export const uploadBodySchema = z.object({ type: z.string().min(2).max(60) });
export const reviewBodySchema = z.object({
  decision: z.enum(['under_review', 'verified', 'changes_requested']),
  feedback: z.string().max(2000).trim().optional(),
});
export const listDocsQuery = z.object({ history: z.enum(['true', 'false']).default('false') });

export async function upload(req: Request, res: Response): Promise<void> {
  const app = await findApplicationOr404(req.params.appId!);
  await assertCanAccess(app, req);
  if (!req.file) throw badRequest('No file provided. Send multipart/form-data with a "file" field.');
  const { type } = req.body as z.infer<typeof uploadBodySchema>;

  const doc = await uploadDocument({
    req,
    application: app,
    type,
    file: {
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
    },
  });

  const scheme = await Scheme.findById(app.schemeId);
  const readiness = scheme ? await readinessForApplication(String(app._id), scheme) : null;
  created(res, { document: serializeDocument(doc), readiness });
}

export async function listForApplication(req: Request, res: Response): Promise<void> {
  const app = await findApplicationOr404(req.params.appId!);
  await assertCanAccess(app, req);
  const includeHistory = (req.query as z.infer<typeof listDocsQuery>).history === 'true';

  const filter: Record<string, unknown> = { applicationId: app._id };
  if (!includeHistory) filter.supersededAt = null;
  const docs = await DocumentModel.find(filter).sort({ type: 1, version: -1 });

  const scheme = await Scheme.findById(app.schemeId);
  const readiness = scheme ? await readinessForApplication(String(app._id), scheme) : null;

  ok(res, {
    documents: docs.map(serializeDocument),
    requiredDocuments: scheme?.requiredDocuments ?? [],
    readiness,
  });
}

export async function metadata(req: Request, res: Response): Promise<void> {
  const doc = await findDocumentOr404(req.params.id!);
  await assertDocAccess(doc, req);
  ok(res, { document: serializeDocument(doc) });
}

export async function download(req: Request, res: Response): Promise<void> {
  const doc = await findDocumentOr404(req.params.id!);
  await assertDocAccess(doc, req);
  const object = await streamDocument(doc);

  res.setHeader('Content-Type', object.contentType);
  res.setHeader('Content-Length', String(object.contentLength || doc.byteSize));
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.originalFilename || doc.type)}"`);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  object.stream.pipe(res);
}

export async function review(req: Request, res: Response): Promise<void> {
  const doc = await findDocumentOr404(req.params.id!);
  const app = await assertDocAccess(doc, req);
  if (req.auth!.role === 'CITIZEN') throw badRequest('Applicants cannot review their own documents.');

  const body = req.body as z.infer<typeof reviewBodySchema>;
  const updated = await reviewDocument({ req, doc, application: app, decision: body.decision, feedback: body.feedback });

  const scheme = await Scheme.findById(app.schemeId);
  const readiness = scheme ? await readinessForApplication(String(app._id), scheme) : null;
  ok(res, { document: serializeDocument(updated), readiness });
}
