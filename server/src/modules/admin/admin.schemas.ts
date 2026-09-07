import { z } from 'zod';
import { PARTNER_TYPES } from '../../models/PartnerOrganization';
import { pageQuery } from '../../lib/query';
import { passwordSchema } from '../auth/auth.schemas';

export const partnerBodySchema = z.object({
  name: z.string().min(2).max(160),
  type: z.enum(PARTNER_TYPES),
  serviceAreas: z.object({
    national: z.boolean().default(false),
    states: z.array(z.string().min(1).max(80)).default([]),
    districts: z.array(z.string().min(1).max(80)).default([]),
  }),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    address: z.string().max(240).optional().default(''),
  }),
  supportedSchemeCodes: z.array(z.string().min(2).max(40)).default([]),
  focusSchemeCodes: z.array(z.string().min(2).max(40)).default([]),
  authorization: z.enum(['authorized', 'pending', 'revoked']).default('pending'),
  status: z.enum(['active', 'suspended', 'inactive']).default('active'),
  acceptingApplications: z.boolean().default(true),
  capacity: z.number().int().min(0).max(100000).default(25),
  operationalMetricsSimulated: z.boolean().default(true),
  contactEmail: z.string().email().optional().or(z.literal('')).default(''),
});

export const partnerPatchSchema = partnerBodySchema.partial();

export const provisionUserSchema = z
  .object({
    email: z.string().email().max(254).toLowerCase(),
    password: passwordSchema,
    displayName: z.string().min(2).max(120),
    role: z.enum(['PARTNER', 'ADMIN']),
    partnerOrganizationId: z.string().length(24).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.role === 'PARTNER' && !v.partnerOrganizationId) {
      ctx.addIssue({ code: 'custom', path: ['partnerOrganizationId'], message: 'Required for PARTNER users' });
    }
  });

export const auditQuery = pageQuery(['at'] as const, 'at').extend({
  action: z.string().max(60).optional(),
  resourceType: z.string().max(60).optional(),
  resourceId: z.string().max(64).optional(),
  actorUserId: z.string().length(24).optional(),
});

export const adminApplicationsQuery = pageQuery(
  ['createdAt', 'updatedAt', 'submittedAt', 'reference'] as const,
  'updatedAt',
).extend({
  status: z.string().max(30).optional(),
  schemeCode: z.string().max(40).optional(),
  partnerId: z.string().length(24).optional(),
  q: z.string().max(80).optional(),
});
