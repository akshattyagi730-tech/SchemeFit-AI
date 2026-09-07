import type { ApplicationDoc } from '../../models/Application';
import type { SchemeDoc } from '../../models/Scheme';
import type { PartnerAssignmentDoc } from '../../models/PartnerAssignment';
import type { ReadinessResult } from '../../domain/readiness';

export function serializeApplication(
  app: ApplicationDoc,
  extra?: {
    scheme?: Pick<SchemeDoc, 'code' | 'name' | 'provider' | 'program' | 'displayCategory'> | null;
    assignment?: PartnerAssignmentDoc | null;
    partnerName?: string | null;
    readiness?: ReadinessResult | null;
  },
) {
  const o = app.toObject();
  return {
    id: String(o._id),
    reference: o.reference,
    status: o.status,
    schemeCode: o.schemeCode,
    schemeVersion: o.schemeVersion,
    scheme: extra?.scheme
      ? {
          code: extra.scheme.code,
          name: extra.scheme.name,
          provider: extra.scheme.provider,
          program: extra.scheme.program,
          displayCategory: extra.scheme.displayCategory,
        }
      : null,
    financing: o.financing,
    financingSnapshot: o.financingSnapshot ?? null,
    profileSnapshot: o.profileSnapshot ?? null,
    eligibilitySnapshot: o.eligibilitySnapshot ?? null,
    financePlanSnapshot: o.financePlanSnapshot ?? null,
    assignedPartnerId: o.assignedPartnerId ? String(o.assignedPartnerId) : null,
    assignedPartnerName: extra?.partnerName ?? null,
    assignment: extra?.assignment
      ? {
          id: String(extra.assignment._id),
          partnerId: String(extra.assignment.partnerId),
          assignmentType: extra.assignment.assignmentType,
          routingScore: extra.assignment.routingScore,
          routingFactors: extra.assignment.routingFactors,
          routingReason: extra.assignment.routingReason,
          distanceKm: extra.assignment.distanceKm,
          distanceBasis: extra.assignment.distanceBasis,
          metricsSimulated: extra.assignment.metricsSimulated,
          reason: extra.assignment.reason,
          assignedAt: extra.assignment.createdAt,
        }
      : null,
    readiness: extra?.readiness ?? null,
    submittedAt: o.submittedAt ?? null,
    decidedAt: o.decidedAt ?? null,
    lastReviewNote: o.lastReviewNote ?? '',
    timeline: (o.timeline ?? []).map((t) => ({
      action: t.action,
      fromStatus: t.fromStatus,
      toStatus: t.toStatus,
      actorRole: t.actorRole,
      reason: t.reason,
      at: t.at,
    })),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    workflowNote:
      'APPROVED / REJECTED are prototype workflow outcomes recorded in this system. They are not a government sanction, guarantee or disbursement.',
  };
}
