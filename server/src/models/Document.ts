import { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { defineModel } from './registry';

export const DOC_REVIEW_STATUSES = ['uploaded', 'under_review', 'verified', 'changes_requested'] as const;
export type DocReviewStatus = (typeof DOC_REVIEW_STATUSES)[number];

// New documents are always 'manual'. 'digilocker' is retained only so rows
// created before the DigiLocker import flow was removed still validate.
export const DOC_SOURCES = ['manual', 'digilocker'] as const;
export type DocSource = (typeof DOC_SOURCES)[number];

export const DOC_TRUST_LEVELS = [
  'issuer_verified',
  'e_signed',
  'signed_untrusted',
  'self_signed',
  'invalid',
  'unsigned',
  'not_applicable',
] as const;
export type DocTrustLevel = (typeof DOC_TRUST_LEVELS)[number];

/**
 * What we could establish about the file's origin at upload/import time.
 * `method` = how it was checked; `trustLevel` = the outcome. This is advisory
 * metadata shown to the reviewer — only `issuer_verified` results let the system
 * mark a document verified without an officer.
 */
export interface DocumentAuthenticity {
  method: 'none' | 'pdf_signature' | 'digilocker_api';
  trustLevel: DocTrustLevel;
  authority: string | null;
  signerName: string | null;
  issuerName: string | null;
  signedAt: Date | null;
  coversWholeDocument: boolean;
  systemVerified: boolean;
  summary: string;
  checkedAt: Date;
}

/**
 * An uploaded document version. Uploading NEVER sets `verified` — only an
 * authorised reviewer can. Replacing a document creates a new version
 * (`version` + 1) and marks the previous one `supersededAt`; the new version
 * starts at `uploaded`, invalidating the prior review for readiness purposes.
 * Review history is preserved (old versions are kept).
 */
export interface DocumentReviewEvent {
  status: string;
  reviewerUserId: Types.ObjectId | null;
  feedback: string;
  system?: boolean;
  at: Date;
}

export interface DocumentAttrs {
  ownerUserId: Types.ObjectId;
  applicationId: Types.ObjectId;
  type: string;
  label: string;
  version: number;
  supersededAt: Date | null;
  storageKey: string;
  originalFilename: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  reviewStatus: DocReviewStatus;
  reviewerUserId: Types.ObjectId | null;
  reviewFeedback: string;
  reviewedAt: Date | null;
  reviewHistory: DocumentReviewEvent[];
  source: DocSource;
  issuedBy: string | null;
  authenticity: DocumentAuthenticity | null;
  createdAt: Date;
  updatedAt: Date;
}

const reviewEventSchema = new Schema<DocumentReviewEvent>(
  {
    status: { type: String, required: true },
    reviewerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    feedback: { type: String, default: '' },
    system: { type: Boolean, default: false },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const authenticitySchema = new Schema<DocumentAuthenticity>(
  {
    method: { type: String, enum: ['none', 'pdf_signature', 'digilocker_api'], default: 'none' },
    trustLevel: { type: String, enum: DOC_TRUST_LEVELS, default: 'unsigned' },
    authority: { type: String, default: null },
    signerName: { type: String, default: null },
    issuerName: { type: String, default: null },
    signedAt: { type: Date, default: null },
    coversWholeDocument: { type: Boolean, default: false },
    systemVerified: { type: Boolean, default: false },
    summary: { type: String, default: '' },
    checkedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const documentSchema = new Schema<DocumentAttrs>(
  {
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    type: { type: String, required: true, index: true },
    label: { type: String, required: true },

    version: { type: Number, required: true, default: 1 },
    supersededAt: { type: Date, default: null, index: true },

    storageKey: { type: String, required: true },
    originalFilename: { type: String, default: '' },
    contentType: { type: String, required: true },
    byteSize: { type: Number, required: true },
    sha256: { type: String, required: true },

    reviewStatus: { type: String, enum: DOC_REVIEW_STATUSES, default: 'uploaded', index: true },
    reviewerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewFeedback: { type: String, default: '' },
    reviewedAt: { type: Date, default: null },
    reviewHistory: { type: [reviewEventSchema], default: [] },

    source: { type: String, enum: DOC_SOURCES, default: 'manual', index: true },
    issuedBy: { type: String, default: null },
    authenticity: { type: authenticitySchema, default: null },
  },
  { timestamps: true },
);

documentSchema.index({ applicationId: 1, type: 1, supersededAt: 1 });

export type DocumentDoc = HydratedDocument<DocumentAttrs>;
export const DocumentModel: Model<DocumentAttrs> = defineModel<DocumentAttrs>('Document', documentSchema);
