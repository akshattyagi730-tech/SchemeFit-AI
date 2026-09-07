import { Schema, type HydratedDocument, type Model } from 'mongoose';
import { defineModel } from './registry';

export const PARTNER_TYPES = [
  'state_channeling_agency',
  'public_sector_bank',
  'regional_rural_bank',
  'nbfc',
  'cooperative_bank',
] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export interface PartnerOrganizationAttrs {
  name: string;
  type: PartnerType;
  serviceAreas: { national: boolean; states: string[]; districts: string[] };
  location: { lat: number; lng: number; address: string };
  supportedSchemeCodes: string[];
  focusSchemeCodes: string[];
  authorization: 'authorized' | 'pending' | 'revoked';
  status: 'active' | 'suspended' | 'inactive';
  acceptingApplications: boolean;
  capacity: number;
  activeAssignments: number;
  operationalMetricsSimulated: boolean;
  metricsAsOf: Date;
  contactEmail: string;
  createdAt: Date;
  updatedAt: Date;
}

const partnerOrganizationSchema = new Schema<PartnerOrganizationAttrs>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    type: { type: String, enum: PARTNER_TYPES, required: true },
    serviceAreas: {
      national: { type: Boolean, default: false },
      states: { type: [String], default: [] },
      districts: { type: [String], default: [] },
    },
    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
      address: { type: String, default: '' },
    },
    supportedSchemeCodes: { type: [String], default: [], index: true },
    focusSchemeCodes: { type: [String], default: [] },

    authorization: { type: String, enum: ['authorized', 'pending', 'revoked'], default: 'pending', index: true },
    status: { type: String, enum: ['active', 'suspended', 'inactive'], default: 'active', index: true },
    acceptingApplications: { type: Boolean, default: true },

    capacity: { type: Number, required: true, min: 0, default: 25 },
    activeAssignments: { type: Number, required: true, min: 0, default: 0 },

    operationalMetricsSimulated: { type: Boolean, default: true },
    metricsAsOf: { type: Date, default: Date.now },

    contactEmail: { type: String, default: '' },
  },
  { timestamps: true },
);

export type PartnerOrganizationDoc = HydratedDocument<PartnerOrganizationAttrs>;
export const PartnerOrganization: Model<PartnerOrganizationAttrs> = defineModel<PartnerOrganizationAttrs>(
  'PartnerOrganization',
  partnerOrganizationSchema,
);
