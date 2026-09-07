import { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { defineModel } from './registry';

/**
 * The routing decision that put an application with a partner. At most one
 * `active` assignment exists per application (enforced by a partial unique
 * index). Reassignment closes the current one (`active: false`) and opens a new
 * one with a required reason; the history chain is preserved.
 */
export interface RoutingFactorSnapshot {
  key: string;
  label: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  detail: string;
}

export interface PartnerAssignmentAttrs {
  applicationId: Types.ObjectId;
  partnerId: Types.ObjectId;
  active: boolean;
  routingScore: number | null;
  routingFactors: RoutingFactorSnapshot[];
  routingReason: string;
  distanceKm: number | null;
  distanceBasis: string;
  metricsSimulated: boolean;
  metricsAsOf: Date | null;
  assignedByUserId: Types.ObjectId | null;
  assignmentType: 'auto_routed' | 'manual' | 'reassignment';
  reason: string;
  supersedesAssignmentId: Types.ObjectId | null;
  closedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const routingFactorSchema = new Schema<RoutingFactorSnapshot>(
  {
    key: String,
    label: String,
    weight: Number,
    rawScore: Number,
    weightedScore: Number,
    detail: String,
  },
  { _id: false },
);

const partnerAssignmentSchema = new Schema<PartnerAssignmentAttrs>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    partnerId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization', required: true, index: true },
    active: { type: Boolean, default: true },

    routingScore: { type: Number, default: null },
    routingFactors: { type: [routingFactorSchema], default: [] },
    routingReason: { type: String, default: '' },
    distanceKm: { type: Number, default: null },
    distanceBasis: { type: String, default: 'haversine_straight_line' },
    metricsSimulated: { type: Boolean, default: true },
    metricsAsOf: { type: Date, default: null },

    assignedByUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    assignmentType: { type: String, enum: ['auto_routed', 'manual', 'reassignment'], default: 'auto_routed' },
    reason: { type: String, default: '' },
    supersedesAssignmentId: { type: Schema.Types.ObjectId, ref: 'PartnerAssignment', default: null },

    closedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

partnerAssignmentSchema.index(
  { applicationId: 1, active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

export type PartnerAssignmentDoc = HydratedDocument<PartnerAssignmentAttrs>;
export const PartnerAssignment: Model<PartnerAssignmentAttrs> = defineModel<PartnerAssignmentAttrs>(
  'PartnerAssignment',
  partnerAssignmentSchema,
);
