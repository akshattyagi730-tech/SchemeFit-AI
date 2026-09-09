import mongoose from 'mongoose';
import type { Request } from 'express';
import { Application, type ApplicationDoc } from '../../models/Application';
import { Scheme, type SchemeDoc } from '../../models/Scheme';
import { CitizenProfile } from '../../models/CitizenProfile';
import { PartnerAssignment } from '../../models/PartnerAssignment';
import { PartnerOrganization } from '../../models/PartnerOrganization';
import { User } from '../../models/User';
import { nextSequence } from '../../models/Counter';
import { applicationReference } from '../../lib/ids';
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../../lib/errors';
import {
  checkTransition,
  type ActorRole,
  type ApplicationStatus,
  type TransitionAction,
} from '../../domain/application-status';
import { evaluateEligibility } from '../../domain/eligibility';
import {
  hasCompleteFinancing,
  profileToFacts,
  schemeToRuleSet,
} from '../../domain/adapters';
import { runCalculation } from '../finance/finance.service';
import { attachAssignment, releaseAssignmentForClosedApplication, routeForApplicant } from '../partners/partners.service';
import { recordAudit } from '../audit/audit.service';
import { notify } from '../notifications/notifications.service';

export async function findApplicationOr404(id: string): Promise<ApplicationDoc> {
  if (!mongoose.isValidObjectId(id)) throw notFound('Application not found');
  const app = await Application.findById(id);
  if (!app) throw notFound('Application not found');
  return app;
}

/** Object-level authorisation: can this actor see/act on this application? */
export async function assertCanAccess(app: ApplicationDoc, req: Request): Promise<void> {
  const auth = req.auth!;
  if (auth.role === 'ADMIN') return;
  if (auth.role === 'CITIZEN') {
    if (String(app.ownerUserId) !== auth.userId) throw forbidden('This application belongs to another citizen.');
    return;
  }
  if (auth.role === 'PARTNER') {
    const orgId = auth.user.partnerOrganizationId ? String(auth.user.partnerOrganizationId) : null;
    if (!orgId || !app.assignedPartnerId || String(app.assignedPartnerId) !== orgId) {
      throw forbidden('This application is not assigned to your partner organisation.');
    }
    return;
  }
  throw forbidden();
}

export async function createDraft(req: Request, schemeCode: string): Promise<ApplicationDoc> {
  const scheme = await Scheme.findOne({ code: schemeCode.toUpperCase(), status: 'active' });
  if (!scheme) throw notFound('Active scheme not found for that code');

  const existing = await Application.findOne({
    ownerUserId: req.auth!.userId,
    schemeId: scheme._id,
    status: { $nin: ['APPROVED', 'REJECTED'] },
  }).lean();
  if (existing) throw conflict('You already have an open application for this scheme', 'APPLICATION_EXISTS');

  const profile = await CitizenProfile.findOne({ userId: req.auth!.userId });
  const seq = await nextSequence('application');

  let app: ApplicationDoc;
  try {
    app = await Application.create({
      reference: applicationReference(seq),
      ownerUserId: req.auth!.userId,
      schemeId: scheme._id,
      schemeCode: scheme.code,
      schemeVersion: scheme.source?.version ?? 'demo-1',
      status: 'DRAFT',
      financing: {
        projectCostPaise: profile?.projectCostPaise ?? null,
        ownContributionPaise: profile?.ownContributionPaise ?? null,
        requestedLoanPaise: profile?.requestedLoanPaise ?? null,
        interestRateBps: scheme.terms.minInterestRateBps,
        tenureMonths: scheme.terms.minTenureMonths,
        moratoriumMonths: 0,
      },
      timeline: [{ action: 'create', toStatus: 'DRAFT', actorUserId: req.auth!.userId, actorRole: 'CITIZEN', at: new Date() }],
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) throw conflict('You already have an open application for this scheme', 'APPLICATION_EXISTS');
    throw err;
  }

  await recordAudit(req, { action: 'application.create', resourceType: 'Application', resourceId: String(app._id) });
  await notify({
    recipientUserId: req.auth!.userId,
    event: 'application_created',
    title: 'Draft application started',
    message: `${app.reference} for ${scheme.name} is saved as a draft. Set the loan terms, add documents, then submit.`,
    link: '/applications',
    applicationId: String(app._id),
  });
  return app;
}

async function adminUserIds(): Promise<string[]> {
  const admins = await User.find({ role: 'ADMIN', accountStatus: 'active' }).select('_id').lean();
  return admins.map((a) => String(a._id));
}

async function partnerUserIds(partnerOrgId: mongoose.Types.ObjectId | string): Promise<string[]> {
  const users = await User.find({ role: 'PARTNER', partnerOrganizationId: partnerOrgId, accountStatus: 'active' })
    .select('_id')
    .lean();
  return users.map((u) => String(u._id));
}

interface TransitionContext {
  req: Request;
  app: ApplicationDoc;
  action: TransitionAction;
  reason?: string | null;
  partnerId?: string; // for assign / reassign
}

/**
 * Single choke-point for every status change. Validates the machine transition,
 * checks prerequisites, performs side effects, appends the timeline entry,
 * writes audit + notifications.
 */
export async function performTransition(ctx: TransitionContext): Promise<ApplicationDoc> {
  const { req, app, action } = ctx;
  const role = req.auth!.role as ActorRole;
  const from = app.status as ApplicationStatus;

  const check = checkTransition(action, from, role, ctx.reason);
  if (!check.ok) {
    if (check.code === 'REASON_REQUIRED') throw unprocessable(check.message!);
    if (check.code === 'FORBIDDEN_TRANSITION') throw forbidden(check.message!);
    throw conflict(check.message!, 'INVALID_TRANSITION');
  }
  const to = check.to!;

  const scheme = await Scheme.findById(app.schemeId);
  if (!scheme) throw notFound('Scheme not found');

  // ---- prerequisites + side effects per action ----
  if (action === 'submit') {
    await freezeSnapshots(req, app, scheme);
    if (app.eligibilitySnapshot?.status === 'ineligible') {
      throw unprocessable('This application is ineligible for the selected scheme and cannot be submitted. Review the failed conditions.');
    }
    app.submittedAt = new Date();
  }

  if (action === 'assign' || action === 'reassign') {
    let partnerId = ctx.partnerId;
    let routingInfo:
      | Parameters<typeof attachAssignment>[0]['routing']
      | undefined;
    if (!partnerId) {
      // fall back to the top routing recommendation
      const profile = app.profileSnapshot as { state?: string; district?: string; location?: { lat: number; lng: number } | null } | null;
      const outcome = await routeForApplicant({
        schemeCode: app.schemeCode,
        location: profile?.location ?? null,
        state: profile?.state ?? null,
        district: profile?.district ?? null,
      });
      if (!outcome.matched || !outcome.recommended) {
        throw conflict('No partner satisfies the mandatory routing filters for this application. Assign one manually or review.', 'NO_PARTNER_MATCH');
      }
      partnerId = outcome.recommended.partnerId;
      routingInfo = {
        score: outcome.recommended.score,
        factors: outcome.recommended.factors,
        reason: outcome.recommended.reason,
        distanceKm: outcome.recommended.distanceKm,
        metricsSimulated: outcome.recommended.metricsSimulated,
        metricsAsOf: new Date(outcome.recommended.metricsAsOf),
      };
    }
    const { partner } = await attachAssignment({
      application: app,
      partnerId,
      assignedByUserId: req.auth!.userId,
      assignmentType: action === 'reassign' ? 'reassignment' : ctx.partnerId ? 'manual' : 'auto_routed',
      reason: ctx.reason ?? '',
      routing: routingInfo,
    });
    for (const uid of await partnerUserIds(partner._id)) {
      await notify({ recipientUserId: uid, event: action === 'reassign' ? 'application_reassigned' : 'application_assigned', title: 'New assigned application', message: `${app.reference} (${app.schemeCode}) has been ${action === 'reassign' ? 're' : ''}assigned to your organisation.`, link: `/partner/applications/${app._id}`, applicationId: String(app._id) });
    }
  }

  if (action === 'request_changes') {
    app.lastReviewNote = ctx.reason ?? '';
  }

  if (action === 'approve' || action === 'reject') {
    app.decidedAt = new Date();
    if (ctx.reason) app.lastReviewNote = ctx.reason;
    await releaseAssignmentForClosedApplication(app);
  }

  // ---- commit status + timeline ----
  app.status = to;
  app.timeline.push({
    action,
    fromStatus: from,
    toStatus: to,
    actorUserId: new mongoose.Types.ObjectId(req.auth!.userId),
    actorRole: role,
    reason: ctx.reason ?? '',
    at: new Date(),
  });
  await app.save();

  await recordAudit(req, {
    action: `application.${action}`,
    resourceType: 'Application',
    resourceId: String(app._id),
    changes: { status: { from, to } },
    reason: ctx.reason ?? null,
  });

  // ---- notifications ----
  const ownerId = String(app.ownerUserId);
  const link = `/applications/${app._id}`;
  if (action === 'submit') {
    for (const uid of await adminUserIds()) {
      await notify({ recipientUserId: uid, event: 'application_submitted', title: 'Application submitted', message: `${app.reference} was submitted and awaits assignment.`, link: `/admin/applications`, applicationId: String(app._id) });
    }
  } else if (action === 'assign' || action === 'reassign') {
    await notify({ recipientUserId: ownerId, event: action === 'reassign' ? 'application_reassigned' : 'application_assigned', title: 'Partner assigned', message: `Your application ${app.reference} has been ${action === 'reassign' ? 're' : ''}assigned to a partner${ctx.reason ? ` (${ctx.reason})` : ''}.`, link, applicationId: String(app._id) });
  } else if (action === 'start_review') {
    await notify({ recipientUserId: ownerId, event: 'application_under_review', title: 'Review started', message: `Your application ${app.reference} is now under review.`, link, applicationId: String(app._id) });
  } else if (action === 'request_changes') {
    await notify({ recipientUserId: ownerId, event: 'application_changes_requested', title: 'Changes requested', message: `The reviewer requested changes on ${app.reference}: ${ctx.reason}`, link, applicationId: String(app._id) });
  } else if (action === 'resubmit') {
    if (app.assignedPartnerId) {
      for (const uid of await partnerUserIds(app.assignedPartnerId)) {
        await notify({ recipientUserId: uid, event: 'application_under_review', title: 'Application resubmitted', message: `${app.reference} was updated by the applicant and is back for review.`, link: `/partner/applications/${app._id}`, applicationId: String(app._id) });
      }
    }
  } else if (action === 'approve') {
    await notify({ recipientUserId: ownerId, event: 'application_approved', title: 'Application approved (demo workflow)', message: `${app.reference} was marked APPROVED in this demonstration workflow. This is not a government sanction or disbursement.`, link, applicationId: String(app._id) });
  } else if (action === 'reject') {
    await notify({ recipientUserId: ownerId, event: 'application_rejected', title: 'Application rejected (demo workflow)', message: `${app.reference} was marked REJECTED in this demonstration workflow. Reason: ${ctx.reason}`, link, applicationId: String(app._id) });
  }

  return app;
}

/** Freeze immutable snapshots on submit. Best-effort finance plan. */
async function freezeSnapshots(req: Request, app: ApplicationDoc, scheme: SchemeDoc): Promise<void> {
  const profile = await CitizenProfile.findOne({ userId: app.ownerUserId });
  if (!profile) throw badRequest('Profile is required to submit an application');

  const financing = {
    projectCostPaise: app.financing.projectCostPaise,
    ownContributionPaise: app.financing.ownContributionPaise,
    requestedLoanPaise: app.financing.requestedLoanPaise,
  };
  if (!hasCompleteFinancing(financing)) {
    throw unprocessable('Project cost, own contribution and requested loan are all required before submitting.', [
      { path: 'financing', message: 'Provide all three financing amounts' },
    ]);
  }

  const facts = profileToFacts(profile);
  const evaluation = evaluateEligibility(schemeToRuleSet(scheme), facts, financing);

  app.profileSnapshot = {
    fullName: profile.fullName,
    age: profile.age,
    annualIncomePaise: profile.annualIncomePaise,
    category: profile.category,
    state: profile.state,
    district: profile.district,
    areaType: profile.areaType,
    location: profile.location?.lat != null ? { lat: profile.location.lat, lng: profile.location.lng } : null,
    purpose: profile.purpose,
    businessDetails: profile.businessDetails,
    educationDetails: profile.educationDetails,
    hasBusinessPlan: profile.hasBusinessPlan,
  };
  app.financingSnapshot = { ...app.financing };
  app.eligibilitySnapshot = {
    status: evaluation.status,
    conditions: evaluation.conditions,
    evaluatedAt: new Date(),
  };

  try {
    const plan = runCalculation(scheme, {
      projectCostPaise: financing.projectCostPaise,
      ownContributionPaise: financing.ownContributionPaise,
      requestedLoanPaise: financing.requestedLoanPaise,
      interestRateBps: app.financing.interestRateBps ?? scheme.terms.minInterestRateBps,
      tenureMonths: app.financing.tenureMonths ?? scheme.terms.minTenureMonths,
      moratoriumMonths: app.financing.moratoriumMonths ?? 0,
    });
    app.financePlanSnapshot = plan as unknown as Record<string, unknown>;
  } catch {
    app.financePlanSnapshot = null;
  }
}

export interface ListFilter {
  status?: string;
  schemeCode?: string;
}

export async function listApplicationsFor(req: Request, opts: {
  page: number; pageSize: number; sort: string; order: 'asc' | 'desc'; filter: ListFilter;
}) {
  const auth = req.auth!;
  const query: Record<string, unknown> = {};
  if (auth.role === 'CITIZEN') query.ownerUserId = auth.userId;
  else if (auth.role === 'PARTNER') {
    if (!auth.user.partnerOrganizationId) throw forbidden('Your partner account is not linked to an organisation.');
    query.assignedPartnerId = auth.user.partnerOrganizationId;
  }
  if (opts.filter.status) query.status = opts.filter.status;
  if (opts.filter.schemeCode) query.schemeCode = opts.filter.schemeCode.toUpperCase();

  const [items, total] = await Promise.all([
    Application.find(query)
      .sort({ [opts.sort]: opts.order === 'asc' ? 1 : -1 })
      .skip((opts.page - 1) * opts.pageSize)
      .limit(opts.pageSize),
    Application.countDocuments(query),
  ]);
  return { items, total };
}

export async function loadContext(app: ApplicationDoc) {
  const [scheme, assignment] = await Promise.all([
    Scheme.findById(app.schemeId),
    app.currentAssignmentId ? PartnerAssignment.findById(app.currentAssignmentId) : Promise.resolve(null),
  ]);
  const partner = app.assignedPartnerId ? await PartnerOrganization.findById(app.assignedPartnerId).lean() : null;
  return { scheme, assignment, partnerName: partner?.name ?? null };
}
