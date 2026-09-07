import type { Request, Response } from 'express';
import { ok } from '../../lib/http';
import { forbidden } from '../../lib/errors';
import { Application } from '../../models/Application';
import { PartnerOrganization } from '../../models/PartnerOrganization';

/** Dashboard summary for the signed-in partner user's organisation. */
export async function partnerSummary(req: Request, res: Response): Promise<void> {
  const orgId = req.auth!.user.partnerOrganizationId;
  if (!orgId) throw forbidden('Your partner account is not linked to an organisation.');

  const org = await PartnerOrganization.findById(orgId).lean();
  const byStatus = await Application.aggregate<{ _id: string; count: number }>([
    { $match: { assignedPartnerId: orgId } },
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);
  const statusCounts = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
  const total = byStatus.reduce((s, x) => s + x.count, 0);
  const actionNeeded = (statusCounts.ASSIGNED ?? 0) + (statusCounts.UNDER_REVIEW ?? 0);

  ok(res, {
    organisation: org
      ? {
          id: String(org._id),
          name: org.name,
          type: org.type,
          capacity: org.capacity,
          activeAssignments: org.activeAssignments,
          freeSlots: Math.max(0, org.capacity - org.activeAssignments),
          acceptingApplications: org.acceptingApplications,
          authorization: org.authorization,
          operationalMetricsSimulated: org.operationalMetricsSimulated,
        }
      : null,
    assignedTotal: total,
    statusCounts,
    actionNeeded,
    note: 'Only applications routed to your organisation are visible. Review actions are limited to applications currently assigned to you.',
  });
}
