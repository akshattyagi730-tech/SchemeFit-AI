import type { Request, Response } from 'express';
import { ok } from '../../lib/http';
import { forbidden, notFound } from '../../lib/errors';
import { CitizenProfile, type CitizenProfileDoc } from '../../models/CitizenProfile';
import { Application } from '../../models/Application';
import { recordAudit } from '../audit/audit.service';
import type { UpdateProfileInput } from './users.schemas';

function serializeProfile(p: CitizenProfileDoc) {
  const o = p.toObject();
  return {
    id: String(o._id),
    fullName: o.fullName,
    age: o.age,
    annualIncomePaise: o.annualIncomePaise,
    category: o.category,
    state: o.state,
    district: o.district,
    areaType: o.areaType,
    location: o.location?.lat != null ? o.location : null,
    purpose: o.purpose,
    businessDetails: o.businessDetails,
    educationDetails: o.educationDetails,
    hasBusinessPlan: o.hasBusinessPlan,
    projectCostPaise: o.projectCostPaise,
    ownContributionPaise: o.ownContributionPaise,
    requestedLoanPaise: o.requestedLoanPaise,
    updatedAt: o.updatedAt,
  };
}

function completeness(p: ReturnType<typeof serializeProfile>): { percent: number; missing: string[] } {
  const checks: [string, boolean][] = [
    ['age', p.age != null],
    ['annualIncomePaise', p.annualIncomePaise != null],
    ['category', !!p.category],
    ['state', !!p.state],
    ['district', !!p.district],
    ['areaType', !!p.areaType],
    ['purpose', !!p.purpose],
    ['projectCostPaise', p.projectCostPaise != null],
    ['ownContributionPaise', p.ownContributionPaise != null],
    ['requestedLoanPaise', p.requestedLoanPaise != null],
  ];
  const done = checks.filter(([, v]) => v).length;
  return { percent: Math.round((done / checks.length) * 100), missing: checks.filter(([, v]) => !v).map(([k]) => k) };
}

async function loadOwnProfile(userId: string) {
  const profile = await CitizenProfile.findOne({ userId });
  if (!profile) throw notFound('Profile not found');
  return profile;
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  if (req.auth!.role !== 'CITIZEN') throw forbidden('Only citizen accounts have a profile');
  const profile = await loadOwnProfile(req.auth!.userId);
  const serialized = serializeProfile(profile);
  ok(res, { profile: serialized, completeness: completeness(serialized) });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  if (req.auth!.role !== 'CITIZEN') throw forbidden('Only citizen accounts have a profile');
  const profile = await loadOwnProfile(req.auth!.userId);
  const patch = req.body as UpdateProfileInput;

  const before = serializeProfile(profile);
  profile.set(patch);
  await profile.save();
  const after = serializeProfile(profile);

  // Submitted applications keep their own snapshots — confirm none were touched.
  const openApps = await Application.countDocuments({
    ownerUserId: req.auth!.userId,
    status: { $nin: ['DRAFT'] },
  });

  await recordAudit(req, {
    action: 'profile.update',
    resourceType: 'CitizenProfile',
    resourceId: String(profile._id),
    changes: Object.fromEntries(
      Object.keys(patch).map((k) => [k, { from: (before as Record<string, unknown>)[k], to: (after as Record<string, unknown>)[k] }]),
    ),
  });

  ok(res, {
    profile: after,
    completeness: completeness(after),
    recommendationsStale: true,
    submittedApplicationsUnaffected: openApps,
  });
}
