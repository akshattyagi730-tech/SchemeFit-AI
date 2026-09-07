import { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { defineModel } from './registry';

export const DOC_REVIEW_STATUSES = ['uploaded', 'under_review', 'verified', 'changes_requested'] as const;
export type DocReviewStatus = (typeof DOC_REVIEW_STATUSES)[number];

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
  createdAt: Date;
  updatedAt: Date;
}

const reviewEventSchema = new Schema<DocumentReviewEvent>(
  {
    status: { type: String, required: true },
    reviewerUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    feedback: { type: String, default: '' },
    at: { type: Date, default: Date.now },
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
  },
  { timestamps: true },
);

documentSchema.index({ applicationId: 1, type: 1, supersededAt: 1 });

export type DocumentDoc = HydratedDocument<DocumentAttrs>;
export const DocumentModel: Model<DocumentAttrs> = defineModel<DocumentAttrs>('Document', documentSchema);
