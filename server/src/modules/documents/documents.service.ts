import mongoose from 'mongoose';
import type { Request } from 'express';
import { createHash } from 'node:crypto';
import { DocumentModel, type DocumentDoc } from '../../models/Document';
import { Application, type ApplicationDoc } from '../../models/Application';
import { Scheme } from '../../models/Scheme';
import { User } from '../../models/User';
import { getStorage } from '../../storage';
import { StorageObjectNotFound } from '../../storage';
import { verifyFileSignature, EXTENSION_BY_MIME, type AllowedMime } from '../../storage/file-signature';
import { uuid } from '../../lib/ids';
import { badRequest, forbidden, notFound, unprocessable, serverError } from '../../lib/errors';
import { recordAudit } from '../audit/audit.service';
import { notify } from '../notifications/notifications.service';

export async function findDocumentOr404(id: string): Promise<DocumentDoc> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Document not found');
  const doc = await DocumentModel.findById(id);
  if (!doc) throw notFound('Document not found');
  return doc;
}

/** Object-level authorisation for a single document. */
export async function assertDocAccess(doc: DocumentDoc, req: Request): Promise<ApplicationDoc> {
  const app = await Application.findById(doc.applicationId);
  if (!app) throw notFound('Parent application not found');
  const auth = req.auth!;
  if (auth.role === 'ADMIN') return app;
  if (auth.role === 'CITIZEN') {
    if (String(doc.ownerUserId) !== auth.userId) throw forbidden('This document belongs to another citizen.');
    return app;
  }
  if (auth.role === 'PARTNER') {
    const orgId = auth.user.partnerOrganizationId ? String(auth.user.partnerOrganizationId) : null;
    if (!orgId || !app.assignedPartnerId || String(app.assignedPartnerId) !== orgId) {
      throw forbidden('This document is not part of an application assigned to your organisation.');
    }
    return app;
  }
  throw forbidden();
}

interface UploadInput {
  req: Request;
  application: ApplicationDoc;
  type: string;
  file: { buffer: Buffer; originalname: string; mimetype: string; size: number };
}

export async function uploadDocument({ req, application, type, file }: UploadInput): Promise<DocumentDoc> {
  if (String(application.ownerUserId) !== req.auth!.userId) throw forbidden('Only the applicant can upload documents.');
  if (['APPROVED', 'REJECTED'].includes(application.status)) {
    throw badRequest('Documents cannot be changed after the application is closed.');
  }

  const scheme = await Scheme.findById(application.schemeId);
  if (!scheme) throw notFound('Scheme not found');
  const spec = (scheme.requiredDocuments ?? []).find((d) => d.type === type);
  if (!spec) {
    throw unprocessable(`"${type}" is not a document type for scheme ${scheme.code}.`, [
      { path: 'type', message: `Allowed: ${(scheme.requiredDocuments ?? []).map((d) => d.type).join(', ')}` },
    ]);
  }

  // Signature validation — the bytes must actually be a PDF/JPEG/PNG AND agree
  // with the declared type. Upload NEVER implies verification.
  const sig = verifyFileSignature(file.buffer, file.mimetype);
  if (!sig.ok || !sig.detected) throw unprocessable(sig.reason ?? 'Unsupported file type.');
  const mime = sig.detected as AllowedMime;

  const sha256 = createHash('sha256').update(file.buffer).digest('hex');
  const storageKey = `applications/${application._id}/${type}/${uuid()}.${EXTENSION_BY_MIME[mime]}`;

  try {
    await getStorage().put({ key: storageKey, body: file.buffer, contentType: mime });
  } catch (err) {
    throw serverError('Failed to store the uploaded file. Nothing was saved — please retry.');
  }

  // Supersede the current version of this type (its review no longer counts).
  const previous = await DocumentModel.findOne({ applicationId: application._id, type, supersededAt: null });
  const version = previous ? previous.version + 1 : 1;
  if (previous) {
    previous.supersededAt = new Date();
    await previous.save();
  }

  let doc: DocumentDoc;
  try {
    doc = await DocumentModel.create({
      ownerUserId: application.ownerUserId,
      applicationId: application._id,
      type,
      label: spec.label,
      version,
      storageKey,
      originalFilename: file.originalname.slice(0, 200),
      contentType: mime,
      byteSize: file.size,
      sha256,
      reviewStatus: 'uploaded',
      reviewHistory: [{ status: 'uploaded', at: new Date() }],
    });
  } catch (err) {
    // Roll back the stored object if the DB write fails.
    await getStorage().delete(storageKey).catch(() => undefined);
    throw err;
  }

  await recordAudit(req, {
    action: previous ? 'document.replace' : 'document.upload',
    resourceType: 'Document',
    resourceId: String(doc._id),
    changes: { version: { from: previous?.version ?? null, to: version } },
  });

  // Notify the assigned partner (if any) that a new version awaits review.
  if (application.assignedPartnerId) {
    const partnerUsers = await User.find({
      role: 'PARTNER',
      partnerOrganizationId: application.assignedPartnerId,
      accountStatus: 'active',
    }).select('_id').lean();
    for (const u of partnerUsers) {
      await notify({
        recipientUserId: String(u._id),
        event: previous ? 'document_resubmitted' : 'document_uploaded',
        title: previous ? 'Document replaced' : 'Document uploaded',
        message: `${application.reference}: "${spec.label}" ${previous ? `replaced (v${version})` : 'uploaded'} and is awaiting review.`,
        link: `/partner/applications/${application._id}`,
        applicationId: String(application._id),
      });
    }
  }

  return doc;
}

interface ReviewInput {
  req: Request;
  doc: DocumentDoc;
  application: ApplicationDoc;
  decision: 'under_review' | 'verified' | 'changes_requested';
  feedback?: string;
}

export async function reviewDocument({ req, doc, application, decision, feedback }: ReviewInput): Promise<DocumentDoc> {
  if (doc.supersededAt) throw badRequest('This document version has been superseded by a newer upload.');
  if (decision === 'changes_requested' && (!feedback || feedback.trim().length < 3)) {
    throw unprocessable('Feedback (min 3 characters) is required when requesting changes.', [
      { path: 'feedback', message: 'Explain what the applicant needs to change and for which document.' },
    ]);
  }

  const from = doc.reviewStatus;
  doc.reviewStatus = decision;
  doc.reviewerUserId = new mongoose.Types.ObjectId(req.auth!.userId);
  doc.reviewFeedback = decision === 'changes_requested' ? feedback!.trim() : feedback?.trim() ?? '';
  doc.reviewedAt = new Date();
  doc.reviewHistory.push({
    status: decision,
    reviewerUserId: new mongoose.Types.ObjectId(req.auth!.userId),
    feedback: doc.reviewFeedback,
    at: new Date(),
  });
  await doc.save();

  await recordAudit(req, {
    action: `document.${decision}`,
    resourceType: 'Document',
    resourceId: String(doc._id),
    changes: { reviewStatus: { from, to: decision } },
    reason: feedback ?? null,
  });

  const event =
    decision === 'verified' ? 'document_verified' : decision === 'changes_requested' ? 'document_changes_requested' : 'document_uploaded';
  if (decision !== 'under_review') {
    await notify({
      recipientUserId: String(application.ownerUserId),
      event,
      title: decision === 'verified' ? 'Document verified' : 'Document needs changes',
      message:
        decision === 'verified'
          ? `"${doc.label}" on ${application.reference} was verified.`
          : `"${doc.label}" on ${application.reference} needs changes: ${doc.reviewFeedback}`,
      link: `/applications/${application._id}`,
      applicationId: String(application._id),
    });
  }

  return doc;
}

export async function streamDocument(doc: DocumentDoc) {
  try {
    return await getStorage().get(doc.storageKey);
  } catch (err) {
    if (err instanceof StorageObjectNotFound) {
      throw notFound('The stored file for this document is missing.');
    }
    throw err;
  }
}
