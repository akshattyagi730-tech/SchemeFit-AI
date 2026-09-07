import { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { defineModel } from './registry';

/**
 * Append-only audit trail for security-relevant and review operations. Stores
 * only safe change metadata (field names + before/after for whitelisted keys),
 * never document bytes or credentials.
 */
export interface AuditEventAttrs {
  actorUserId: Types.ObjectId | null;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  outcome: 'success' | 'failure';
  changes: Record<string, unknown> | null;
  context: Record<string, unknown> | null;
  at: Date;
}

const auditEventSchema = new Schema<AuditEventAttrs>(
  {
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorRole: { type: String, default: 'system' },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, required: true, index: true },
    resourceId: { type: String, default: null, index: true },
    outcome: { type: String, enum: ['success', 'failure'], default: 'success' },
    changes: { type: Schema.Types.Mixed, default: null },
    context: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false },
);

export type AuditEventDoc = HydratedDocument<AuditEventAttrs>;
export const AuditEvent: Model<AuditEventAttrs> = defineModel<AuditEventAttrs>('AuditEvent', auditEventSchema);
