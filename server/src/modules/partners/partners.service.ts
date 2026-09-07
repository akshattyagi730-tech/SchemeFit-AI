import mongoose from 'mongoose';
import { PartnerOrganization, type PartnerOrganizationDoc } from '../../models/PartnerOrganization';
import { PartnerAssignment } from '../../models/PartnerAssignment';
import { Application, type ApplicationDoc } from '../../models/Application';
import { routePartners, type RoutablePartner, type RoutingOutcome } from '../../domain/routing';
import { conflict, notFound } from '../../lib/errors';

export function toRoutable(p: PartnerOrganizationDoc): RoutablePartner {
  return {
    id: String(p._id),
    name: p.name,
    type: p.type,
    status: p.status as RoutablePartner['status'],
    authorization: p.authorization as RoutablePartner['authorization'],
    acceptingApplications: p.acceptingApplications,
    supportedSchemeCodes: p.supportedSchemeCodes ?? [],
    focusSchemeCodes: p.focusSchemeCodes ?? [],
    serviceAreas: {
      national: p.serviceAreas?.national,
      states: p.serviceAreas?.states ?? [],
      districts: p.serviceAreas?.districts ?? [],
    },
    location: { lat: p.location.lat, lng: p.location.lng },
    capacity: p.capacity,
    activeAssignments: p.activeAssignments,
    operationalMetricsSimulated: p.operationalMetricsSimulated,
    metricsAsOf: p.metricsAsOf ?? new Date(),
  };
}

export interface ApplicantRoutingInput {
  schemeCode: string;
  location?: { lat: number; lng: number } | null;
  state?: string | null;
  district?: string | null;
}

export async function routeForApplicant(input: ApplicantRoutingInput): Promise<RoutingOutcome> {
  const partners = await PartnerOrganization.find({});
  return routePartners(partners.map(toRoutable), {
    schemeCode: input.schemeCode,
    applicant: { location: input.location ?? null, state: input.state ?? null, district: input.district ?? null },
  });
}

/**
 * Atomically attach a partner to an application:
 *  - increments the partner's activeAssignments only while capacity allows
 *    (guards against races / over-allocation),
 *  - closes any existing active assignment,
 *  - creates the new PartnerAssignment (unique partial index prevents a second
 *    active assignment for the same application).
 */
export async function attachAssignment(opts: {
  application: ApplicationDoc;
  partnerId: string;
  assignedByUserId: string;
  assignmentType: 'auto_routed' | 'manual' | 'reassignment';
  reason?: string;
  routing?: {
    score: number | null;
    factors: unknown[];
    reason: string;
    distanceKm: number | null;
    metricsSimulated: boolean;
    metricsAsOf: Date | null;
  };
}): Promise<{ assignmentId: string; partner: PartnerOrganizationDoc }> {
  const { application } = opts;

  const partner = await PartnerOrganization.findById(opts.partnerId);
  if (!partner) throw notFound('Partner organisation not found');

  // Capacity-guarded increment. If it fails, capacity is full.
  const claimed = await PartnerOrganization.findOneAndUpdate(
    { _id: partner._id, $expr: { $lt: ['$activeAssignments', '$capacity'] } },
    { $inc: { activeAssignments: 1 } },
    { new: true },
  );
  if (!claimed) throw conflict(`Partner "${partner.name}" is at full case capacity`, 'PARTNER_AT_CAPACITY');

  try {
    const prev = await PartnerAssignment.findOne({ applicationId: application._id, active: true });
    if (prev) {
      prev.active = false;
      prev.closedAt = new Date();
      await prev.save();
      // Release the previous partner's slot.
      await PartnerOrganization.updateOne(
        { _id: prev.partnerId, activeAssignments: { $gt: 0 } },
        { $inc: { activeAssignments: -1 } },
      );
    }

    const assignment = await PartnerAssignment.create({
      applicationId: application._id,
      partnerId: partner._id,
      active: true,
      assignedByUserId: opts.assignedByUserId,
      assignmentType: opts.assignmentType,
      reason: opts.reason ?? '',
      supersedesAssignmentId: prev?._id ?? null,
      routingScore: opts.routing?.score ?? null,
      routingFactors: opts.routing?.factors ?? [],
      routingReason: opts.routing?.reason ?? '',
      distanceKm: opts.routing?.distanceKm ?? null,
      metricsSimulated: opts.routing?.metricsSimulated ?? true,
      metricsAsOf: opts.routing?.metricsAsOf ?? null,
    });

    application.assignedPartnerId = partner._id;
    application.currentAssignmentId = assignment._id;

    return { assignmentId: String(assignment._id), partner: claimed };
  } catch (err) {
    // Roll back the optimistic increment on any failure after it.
    await PartnerOrganization.updateOne(
      { _id: partner._id, activeAssignments: { $gt: 0 } },
      { $inc: { activeAssignments: -1 } },
    );
    if ((err as { code?: number }).code === 11000) {
      throw conflict('This application already has an active partner assignment', 'ASSIGNMENT_EXISTS');
    }
    throw err;
  }
}

export async function releaseAssignmentForClosedApplication(application: ApplicationDoc): Promise<void> {
  const active = await PartnerAssignment.findOne({ applicationId: application._id, active: true });
  if (!active) return;
  active.active = false;
  active.closedAt = new Date();
  await active.save();
  await PartnerOrganization.updateOne(
    { _id: active.partnerId, activeAssignments: { $gt: 0 } },
    { $inc: { activeAssignments: -1 } },
  );
}

export async function findPartnerOr404(id: string): Promise<PartnerOrganizationDoc> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Partner organisation not found');
  const p = await PartnerOrganization.findById(id);
  if (!p) throw notFound('Partner organisation not found');
  return p;
}

export async function recountActiveAssignments(partnerId: string): Promise<number> {
  const count = await PartnerAssignment.countDocuments({ partnerId, active: true });
  await PartnerOrganization.updateOne({ _id: partnerId }, { $set: { activeAssignments: count } });
  return count;
}
