import { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { defineModel } from './registry';
import { APPLICATION_STATUSES, type ApplicationStatus } from '../domain/application-status';

/**
 * A citizen's application for one scheme. On submission we freeze immutable
 * snapshots of the profile, the financing inputs and the eligibility evaluation
 * so later edits to the profile or the scheme never rewrite this record.
 */
export interface ApplicationTimelineEntry {
  action: string;
  fromStatus: string | null;
  toStatus: string;
  actorUserId: Types.ObjectId | null;
  actorRole: string;
  reason: string;
  at: Date;
}

export interface ApplicationFinancing {
  projectCostPaise: number | null;
  ownContributionPaise: number | null;
  requestedLoanPaise: number | null;
  interestRateBps: number | null;
  tenureMonths: number | null;
  moratoriumMonths: number;
}

export interface ApplicationAttrs {
  reference: string;
  ownerUserId: Types.ObjectId;
  schemeId: Types.ObjectId;
  schemeCode: string;
  schemeVersion: string;
  status: ApplicationStatus;
  financing: ApplicationFinancing;
  profileSnapshot: Record<string, unknown> | null;
  financingSnapshot: Record<string, unknown> | null;
  eligibilitySnapshot: { status: string | null; conditions: unknown[]; evaluatedAt: Date | null };
  financePlanSnapshot: Record<string, unknown> | null;
  assignedPartnerId: Types.ObjectId | null;
  currentAssignmentId: Types.ObjectId | null;
  submittedAt: Date | null;
  decidedAt: Date | null;
  lastReviewNote: string;
  timeline: ApplicationTimelineEntry[];
  /** `${ownerUserId}:${schemeId}` while the application is open; null once terminal. */
  openKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const timelineEntrySchema = new Schema<ApplicationTimelineEntry>(
  {
    action: { type: String, required: true },
    fromStatus: { type: String, default: null },
    toStatus: { type: String, required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, required: true },
    reason: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const applicationSchema = new Schema<ApplicationAttrs>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    ownerUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    schemeId: { type: Schema.Types.ObjectId, ref: 'Scheme', required: true, index: true },
    schemeCode: { type: String, required: true },
    schemeVersion: { type: String, required: true },

    status: { type: String, enum: APPLICATION_STATUSES, default: 'DRAFT', index: true },

    financing: {
      projectCostPaise: { type: Number, default: null },
      ownContributionPaise: { type: Number, default: null },
      requestedLoanPaise: { type: Number, default: null },
      interestRateBps: { type: Number, default: null },
      tenureMonths: { type: Number, default: null },
      moratoriumMonths: { type: Number, default: 0 },
    },

    profileSnapshot: { type: Schema.Types.Mixed, default: null },
    financingSnapshot: { type: Schema.Types.Mixed, default: null },
    eligibilitySnapshot: {
      status: { type: String, default: null },
      conditions: { type: [Schema.Types.Mixed], default: [] },
      evaluatedAt: { type: Date, default: null },
    },
    financePlanSnapshot: { type: Schema.Types.Mixed, default: null },

    assignedPartnerId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization', default: null, index: true },
    currentAssignmentId: { type: Schema.Types.ObjectId, ref: 'PartnerAssignment', default: null },

    submittedAt: { type: Date, default: null },
    decidedAt: { type: Date, default: null },
    lastReviewNote: { type: String, default: '' },

    timeline: { type: [timelineEntrySchema], default: [] },
    openKey: { type: String, default: null },
  },
  { timestamps: true },
);

const TERMINAL = new Set(['APPROVED', 'REJECTED']);
applicationSchema.pre('save', function assignOpenKey(next) {
  this.openKey = TERMINAL.has(this.status) ? null : `${String(this.ownerUserId)}:${String(this.schemeId)}`;
  next();
});

// A citizen may hold at most one OPEN (non-terminal) application per scheme.
applicationSchema.index(
  { openKey: 1 },
  { unique: true, partialFilterExpression: { openKey: { $type: 'string' } } },
);

export type ApplicationDoc = HydratedDocument<ApplicationAttrs>;
export const Application: Model<ApplicationAttrs> = defineModel<ApplicationAttrs>('Application', applicationSchema);
