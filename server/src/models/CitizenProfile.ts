import { Schema, type HydratedDocument, type Model } from 'mongoose';
import type { Types } from 'mongoose';
import { defineModel } from './registry';
import { SOCIAL_CATEGORIES, AREA_TYPES, PURPOSES, type SocialCategory, type AreaType, type Purpose } from '../domain/types';

/**
 * One profile per citizen user. Monetary values are integer paise.
 * A submitted Application keeps its own immutable snapshot of these fields, so
 * editing the profile never mutates history.
 */
export interface CitizenProfileAttrs {
  userId: Types.ObjectId;
  fullName: string;
  age: number | null;
  annualIncomePaise: number | null;
  category: SocialCategory | null;
  obcCreamyLayer: boolean | null;
  state: string | null;
  district: string | null;
  areaType: AreaType | null;
  location: { lat: number | null; lng: number | null };
  purpose: Purpose | null;
  businessDetails: { activity: string; stage: 'idea' | 'existing' | 'expansion' | ''; yearsRunning: number | null };
  educationDetails: { level: string; course: string; institution: string };
  hasBusinessPlan: boolean | null;
  projectCostPaise: number | null;
  ownContributionPaise: number | null;
  requestedLoanPaise: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const citizenProfileSchema = new Schema<CitizenProfileAttrs>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    fullName: { type: String, required: true, trim: true },
    age: { type: Number, min: 16, max: 100, default: null },
    annualIncomePaise: { type: Number, min: 0, default: null },
    category: { type: String, enum: [...SOCIAL_CATEGORIES, null], default: null },
    obcCreamyLayer: { type: Boolean, default: null },
    state: { type: String, trim: true, default: null },
    district: { type: String, trim: true, default: null },
    areaType: { type: String, enum: [...AREA_TYPES, null], default: null },
    location: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    purpose: { type: String, enum: [...PURPOSES, null], default: null },
    businessDetails: {
      activity: { type: String, trim: true, default: '' },
      stage: { type: String, enum: ['idea', 'existing', 'expansion', ''], default: '' },
      yearsRunning: { type: Number, min: 0, default: null },
    },
    educationDetails: {
      level: { type: String, trim: true, default: '' },
      course: { type: String, trim: true, default: '' },
      institution: { type: String, trim: true, default: '' },
    },
    hasBusinessPlan: { type: Boolean, default: null },
    projectCostPaise: { type: Number, min: 0, default: null },
    ownContributionPaise: { type: Number, min: 0, default: null },
    requestedLoanPaise: { type: Number, min: 0, default: null },
  },
  { timestamps: true },
);

export type CitizenProfileDoc = HydratedDocument<CitizenProfileAttrs>;
export const CitizenProfile: Model<CitizenProfileAttrs> = defineModel<CitizenProfileAttrs>('CitizenProfile', citizenProfileSchema);
