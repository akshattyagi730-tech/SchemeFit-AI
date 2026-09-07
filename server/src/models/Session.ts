import { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { defineModel } from './registry';

/**
 * Server-side persistent session. The cookie carries only an opaque token; we
 * store its SHA-256 hash so a database leak does not expose live sessions.
 * Sessions expire (`expiresAt`) and can be revoked (`revokedAt`).
 */
export interface SessionAttrs {
  userId: Types.ObjectId;
  tokenHash: string;
  userAgent: string;
  ip: string;
  createdAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}

const sessionSchema = new Schema<SessionAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    userAgent: { type: String, default: '' },
    ip: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
  },
  { versionKey: false },
);

// TTL cleanup of long-expired rows; auth still checks expiresAt/revokedAt explicitly.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 });

export type SessionDoc = HydratedDocument<SessionAttrs>;
export const Session: Model<SessionAttrs> = defineModel<SessionAttrs>('Session', sessionSchema);
