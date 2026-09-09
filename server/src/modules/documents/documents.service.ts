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
import { verifyPdfSignature, isAutoVerifiable } from './pdf-signature';
import type { DocumentAuthenticity } from '../../models/Document';
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

function resolveDocSpec(scheme: { code: string; requiredDocuments?: { type: string; label: string }[] }, type: string) {
  const spec = (scheme.requiredDocuments ?? []).find((d) => d.type === type);
  if (!spec) {
    throw unprocessable(`"${type}" is not a document type for scheme ${scheme.code}.`, [
      { path: 'type', message: `Allowed: ${(scheme.requiredDocuments ?? []).map((d) => d.type).join(', ')}` },
    ]);
  }
  return spec;
}

/** Turn the PDF-signature result into the stored authenticity record. */
function pdfAuthenticity(buffer: Buffer, mime: AllowedMime): DocumentAuthenticity {
  if (mime !== 'application/pdf') {
    return {
      method: 'none',
      trustLevel: 'not_applicable',
      authority: null,
      signerName: null,
      issuerName: null,
      signedAt: null,
      coversWholeDocument: false,
      systemVerified: false,
      summary: 'Image files carry no document signature — a reviewer must confirm this one.',
      checkedAt: new Date(),
    };
  }
  const r = verifyPdfSignature(buffer);
  return {
    method: 'pdf_signature',
    trustLevel: r.trustLevel,
    authority: r.authority,
    signerName: r.signerCommonName,
    issuerName: r.issuerCommonName,
    signedAt: r.signedAt ? new Date(r.signedAt) : null,
    coversWholeDocument: r.coversWholeDocument,
    systemVerified: isAutoVerifiable(r),
    summary: r.reason,
    checkedAt: new Date(),
  };
}

interface VersionInput {
  req: Request;
  application: ApplicationDoc;
  type: string;
  spec: { type: string; label: string };
  buffer: Buffer;
  mime: AllowedMime;
  originalName: string;
  source: 'manual' | 'digilocker';
  issuedBy?: string | null;
  authenticity: DocumentAuthenticity;
}

/** Store bytes + create the next document version. Shared by upload and DigiLocker import. */
async function createDocumentVersion({
  req,
  application,
  type,
  spec,
  buffer,
  mime,
  originalName,
  source,
  issuedBy,
  authenticity,
}: VersionInput): Promise<DocumentDoc> {
  const sha256 = createHash('sha256').update(buffer).digest('hex');
  const storageKey = `applications/${application._id}/${type}/${uuid()}.${EXTENSION_BY_MIME[mime]}`;

  try {
    await getStorage().put({ key: storageKey, body: buffer, contentType: mime });
  } catch {
    throw serverError('Failed to store the file. Nothing was saved — please retry.');
  }

  const previous = await DocumentModel.findOne({ applicationId: application._id, type, supersededAt: null });
  const version = previous ? previous.version + 1 : 1;
  if (previous) {
    previous.supersededAt = new Date();
    await previous.save();
  }

  const autoVerified = authenticity.systemVerified;
  const now = new Date();
  const history: DocumentDoc['reviewHistory'] = [{ status: 'uploaded', reviewerUserId: null, feedback: '', system: source === 'digilocker', at: now }];
  if (autoVerified) {
    history.push({ status: 'verified', reviewerUserId: null, feedback: authenticity.summary, system: true, at: now });
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
      originalFilename: originalName.slice(0, 200),
      contentType: mime,
      byteSize: buffer.length,
      sha256,
      source,
      issuedBy: issuedBy ?? null,
      authenticity,
      reviewStatus: autoVerified ? 'verified' : 'uploaded',
      reviewedAt: autoVerified ? now : null,
      reviewHistory: history,
    });
  } catch (err) {
    await getStorage().delete(storageKey).catch(() => undefined);
    throw err;
  }

  await recordAudit(req, {
    action: previous ? 'document.replace' : source === 'digilocker' ? 'document.import' : 'document.upload',
    resourceType: 'Document',
    resourceId: String(doc._id),
    changes: {
      version: { from: previous?.version ?? null, to: version },
      ...(autoVerified ? { reviewStatus: { from: null, to: 'verified (system)' } } : {}),
    },
  });

  if (autoVerified) {
    await notify({
      recipientUserId: String(application.ownerUserId),
      event: 'document_verified',
      title: 'Document verified automatically',
      message: `"${spec.label}" on ${application.reference} was verified from its ${
        source === 'digilocker' ? 'DigiLocker issuer record' : 'digital signature'
      }.`,
      link: `/applications/${application._id}`,
      applicationId: String(application._id),
    });
  }

  if (application.assignedPartnerId && !autoVerified) {
    const partnerUsers = await User.find({
      role: 'PARTNER',
      partnerOrganizationId: application.assignedPartnerId,
      accountStatus: 'active',
    })
      .select('_id')
      .lean();
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

export async function uploadDocument({ req, application, type, file }: UploadInput): Promise<DocumentDoc> {
  if (String(application.ownerUserId) !== req.auth!.userId) throw forbidden('Only the applicant can upload documents.');
  if (['APPROVED', 'REJECTED'].includes(application.status)) {
    throw badRequest('Documents cannot be changed after the application is closed.');
  }

  const scheme = await Scheme.findById(application.schemeId);
  if (!scheme) throw notFound('Scheme not found');
  const spec = resolveDocSpec(scheme, type);

  // Magic-byte validation — the bytes must actually be a PDF/JPEG/PNG AND agree
  // with the declared type. This is separate from authenticity below.
  const sig = verifyFileSignature(file.buffer, file.mimetype);
  if (!sig.ok || !sig.detected) throw unprocessable(sig.reason ?? 'Unsupported file type.');
  const mime = sig.detected as AllowedMime;

  // Origin check: a real DigiLocker / e-signed PDF is recognised and can be
  // auto-verified; a plain export is accepted but flagged for a reviewer.
  const authenticity = pdfAuthenticity(file.buffer, mime);

  return createDocumentVersion({
    req,
    application,
    type,
    spec,
    buffer: file.buffer,
    mime,
    originalName: file.originalname,
    source: 'manual',
    authenticity,
  });
}

interface DigiLockerImportInput {
  req: Request;
  application: ApplicationDoc;
  type: string;
  buffer: Buffer;
  mime: AllowedMime;
  originalName: string;
  issuer: string;
}

/** Import a document pulled from DigiLocker's Issued Documents API. */
export async function importDigiLockerDocument({
  req,
  application,
  type,
  buffer,
  mime,
  originalName,
  issuer,
}: DigiLockerImportInput): Promise<DocumentDoc> {
  if (String(application.ownerUserId) !== req.auth!.userId) throw forbidden('Only the applicant can add documents.');
  if (['APPROVED', 'REJECTED'].includes(application.status)) {
    throw badRequest('Documents cannot be changed after the application is closed.');
  }
  const scheme = await Scheme.findById(application.schemeId);
  if (!scheme) throw notFound('Scheme not found');
  const spec = resolveDocSpec(scheme, type);

  // The Issued Documents API is the trust anchor: DigiLocker authenticated the
  // citizen and asserts the issuer, so the file is issuer-verified by origin.
  const authenticity: DocumentAuthenticity = {
    method: 'digilocker_api',
    trustLevel: 'issuer_verified',
    authority: issuer,
    signerName: null,
    issuerName: issuer,
    signedAt: null,
    coversWholeDocument: true,
    systemVerified: true,
    summary: `Pulled directly from DigiLocker — issued by ${issuer}.`,
    checkedAt: new Date(),
  };

  return createDocumentVersion({
    req,
    application,
    type,
    spec,
    buffer,
    mime,
    originalName,
    source: 'digilocker',
    issuedBy: issuer,
    authenticity,
  });
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
