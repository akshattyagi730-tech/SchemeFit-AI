import { Schema, type HydratedDocument, type Model, type Types } from 'mongoose';
import { defineModel } from './registry';

export const USER_ROLES = ['CITIZEN', 'PARTNER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ACCOUNT_STATUSES = ['active', 'suspended'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface UserAttrs {
  email: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  partnerOrganizationId: Types.ObjectId | null;
  accountStatus: AccountStatus;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserAttrs>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: USER_ROLES, required: true, default: 'CITIZEN', index: true },
    displayName: { type: String, required: true, trim: true },
    partnerOrganizationId: { type: Schema.Types.ObjectId, ref: 'PartnerOrganization', default: null, index: true },
    accountStatus: { type: String, enum: ACCOUNT_STATUSES, default: 'active', index: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    const r = ret as unknown as Record<string, unknown>;
    delete r.passwordHash;
    delete r.__v;
    return r;
  },
});

export type UserDoc = HydratedDocument<UserAttrs>;
export const User: Model<UserAttrs> = defineModel<UserAttrs>('User', userSchema);
