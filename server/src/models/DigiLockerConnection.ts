import { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { defineModel } from './registry';

/**
 * A citizen's DigiLocker link. One per user. Access tokens are stored so the
 * Issued Documents API can be called while the link is active; in a production
 * deployment these should be encrypted at rest (KMS / libsodium sealed box).
 * They are short-lived and can be revoked by deleting this record.
 */
export interface DigiLockerConnectionAttrs {
  userId: Types.ObjectId;
  provider: 'mock' | 'live';
  digilockerId: string;
  name: string;
  maskedAadhaar: string | null;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
  connectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<DigiLockerConnectionAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    provider: { type: String, enum: ['mock', 'live'], required: true },
    digilockerId: { type: String, required: true },
    name: { type: String, default: '' },
    maskedAadhaar: { type: String, default: null },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

export type DigiLockerConnectionDoc = HydratedDocument<DigiLockerConnectionAttrs>;
export const DigiLockerConnection: Model<DigiLockerConnectionAttrs> = defineModel<DigiLockerConnectionAttrs>(
  'DigiLockerConnection',
  schema,
);
