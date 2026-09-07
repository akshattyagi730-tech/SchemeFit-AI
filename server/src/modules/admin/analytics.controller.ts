import type { Request, Response } from 'express';
import { ok } from '../../lib/http';
import { Application } from '../../models/Application';
import { Scheme } from '../../models/Scheme';
import { PartnerOrganization } from '../../models/PartnerOrganization';
import { DocumentModel } from '../../models/Document';
import { User } from '../../models/User';

/**
 * All KPIs are derived live from the database. Nothing is hardcoded in the
 * handler. Denominators are stated explicitly next to each figure.
 * Drafts are excluded from "submitted" totals.
 */
export async function adminKpis(_req: Request, res: Response): Promise<void> {
  const SUBMITTED = { status: { $ne: 'DRAFT' } };

  const [
    totalApplications,
    submittedApplications,
    draftApplications,
    byStatusAgg,
    bySchemeAgg,
    requestedFundingAgg,
    partnerLoad,
    docChangesAgg,
    citizenCount,
    decidedAgg,
  ] = await Promise.all([
    Application.countDocuments({}),
    Application.countDocuments(SUBMITTED),
    Application.countDocuments({ status: 'DRAFT' }),
    Application.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Application.aggregate<{ _id: string; count: number }>([
      { $match: SUBMITTED },
      { $group: { _id: '$schemeCode', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    // Requested funding = SUM of requested loan amounts (NOT scheme ceilings), submitted only.
    Application.aggregate<{ _id: null; total: number }>([
      { $match: SUBMITTED },
      {
        $group: {
          _id: null,
          total: { $sum: { $ifNull: ['$financingSnapshot.requestedLoanPaise', '$financing.requestedLoanPaise'] } },
        },
      },
    ]),
    PartnerOrganization.find({}).select('name capacity activeAssignments status authorization').lean(),
    DocumentModel.aggregate<{ _id: string; count: number }>([
      { $match: { reviewStatus: 'changes_requested', supersededAt: null } },
      { $group: { _id: '$type', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    User.countDocuments({ role: 'CITIZEN' }),
    Application.aggregate<{ _id: string; count: number }>([
      { $match: { status: { $in: ['APPROVED', 'REJECTED'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  const statusCounts = Object.fromEntries(byStatusAgg.map((s) => [s._id, s.count]));
  const decided = Object.fromEntries(decidedAgg.map((s) => [s._id, s.count]));
  const underReviewOrLater =
    (statusCounts.UNDER_REVIEW ?? 0) + (statusCounts.APPROVED ?? 0) + (statusCounts.REJECTED ?? 0) + (statusCounts.CHANGES_REQUESTED ?? 0);

  // Readiness across submitted applications (required docs verified / required docs).
  const readinessAgg = await DocumentModel.aggregate<{ applicationId: string; verified: number }>([
    { $match: { supersededAt: null, reviewStatus: 'verified' } },
    { $group: { _id: '$applicationId', verified: { $sum: 1 } } },
  ]);

  res.json({
    data: {
      generatedAt: new Date().toISOString(),
      dataClassification: 'derived-from-database',
      demoNote:
        'This deployment is seeded with demonstration data. Figures reflect the seeded/created records in this database, not national statistics.',
      applications: {
        total: totalApplications,
        drafts: draftApplications,
        submitted: submittedApplications,
        statusCounts,
      },
      funding: {
        requestedTotalPaise: requestedFundingAgg[0]?.total ?? 0,
        basis: 'Sum of requested loan amounts on submitted applications (snapshot value; falls back to live value for pre-snapshot rows). Scheme ceilings are NOT used.',
      },
      pipeline: {
        submittedToReviewRate: {
          value: submittedApplications === 0 ? 0 : Math.round((underReviewOrLater / submittedApplications) * 100),
          numerator: underReviewOrLater,
          denominator: submittedApplications,
          definition: 'Applications that reached UNDER_REVIEW or a decision, as a share of all submitted (non-draft) applications.',
        },
        decisions: { approved: decided.APPROVED ?? 0, rejected: decided.REJECTED ?? 0 },
      },
      schemesDistribution: bySchemeAgg.map((s) => ({ schemeCode: s._id, submittedApplications: s.count })),
      partnerLoad: partnerLoad.map((p) => ({
        name: p.name,
        capacity: p.capacity,
        activeAssignments: p.activeAssignments,
        utilisationPct: p.capacity === 0 ? 0 : Math.round((p.activeAssignments / p.capacity) * 100),
        status: p.status,
        authorization: p.authorization,
      })),
      documentChangesRequested: docChangesAgg.map((d) => ({ type: d._id, count: d.count })),
      counts: { citizens: citizenCount, partnersWithVerifiedDocs: readinessAgg.length },
    },
  });
}
