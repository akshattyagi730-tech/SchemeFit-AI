/**
 * Idempotent seed logic. Assumes the DB connection is already open.
 *
 * `seedDatabase()` is safe to call repeatedly — reference data is upserted and
 * demo transactions are only created when absent. It is invoked by:
 *   - the CLI (`src/seed.ts`, `npm run seed`)
 *   - optionally at server boot when SEED_ON_BOOT=true and there are no users.
 */
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { hashPassword } from '../lib/password';
import {
  User,
  CitizenProfile,
  Scheme,
  PartnerOrganization,
  Application,
  DocumentModel,
  PartnerAssignment,
  Notification,
  Counter,
} from '../models';
import { applicationReference } from '../lib/ids';
import { getStorage } from '../storage';
import { EXTENSION_BY_MIME } from '../storage/file-signature';
import { evaluateEligibility } from '../domain/eligibility';
import { schemeToRuleSet, profileToFacts } from '../domain/adapters';
import { runCalculation } from '../modules/finance/finance.service';
import { schemes as loanSchemes, partners, citizens, partnerUsers } from './fixtures';
import { centralSchemes } from './central-schemes';
import { tinyPdf, tinyPng } from './documents';

const allSchemes = [...loanSchemes, ...centralSchemes];

async function upsertSchemes() {
  for (const s of allSchemes) {
    await Scheme.findOneAndUpdate({ code: s.code }, { $set: { kind: 'financing', ...s } }, { upsert: true, new: true });
  }
  logger.info(`seeded ${allSchemes.length} demo schemes`);
}

async function upsertPartners() {
  for (const p of partners) {
    await PartnerOrganization.findOneAndUpdate(
      { name: p.name },
      { $set: { ...p, metricsAsOf: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }
  logger.info(`seeded ${partners.length} demo partner organisations`);
}

async function upsertAdmin() {
  const email = env.SEED_ADMIN_EMAIL;
  const existing = await User.findOne({ email });
  if (existing) return existing;
  const user = await User.create({
    email,
    passwordHash: await hashPassword(env.SEED_ADMIN_PASSWORD),
    role: 'ADMIN',
    displayName: 'Development Admin',
  });
  logger.info(`created development admin: ${email}`);
  return user;
}

async function upsertPartnerUsers() {
  for (const pu of partnerUsers) {
    const org = await PartnerOrganization.findOne({ name: pu.partnerName });
    if (!org) continue;
    const existing = await User.findOne({ email: pu.email });
    if (existing) {
      existing.partnerOrganizationId = org._id;
      existing.role = 'PARTNER';
      await existing.save();
      continue;
    }
    await User.create({
      email: pu.email,
      passwordHash: await hashPassword(pu.password),
      role: 'PARTNER',
      displayName: pu.displayName,
      partnerOrganizationId: org._id,
    });
  }
  logger.info(`seeded ${partnerUsers.length} partner users`);
}

async function upsertCitizens() {
  const map = new Map<string, mongoose.Types.ObjectId>();
  for (const c of citizens) {
    let user = await User.findOne({ email: c.email });
    if (!user) {
      user = await User.create({
        email: c.email,
        passwordHash: await hashPassword(c.password),
        role: 'CITIZEN',
        displayName: c.fullName,
      });
    }
    await CitizenProfile.findOneAndUpdate(
      { userId: user._id },
      { $set: { userId: user._id, fullName: c.fullName, ...c.profile } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    map.set(c.email, user._id);
  }
  logger.info(`seeded ${citizens.length} citizens + profiles`);
  return map;
}

async function storeDoc(applicationId: string, type: string, kind: 'pdf' | 'png') {
  const mime = kind === 'pdf' ? 'application/pdf' : 'image/png';
  const buf = kind === 'pdf' ? tinyPdf(type) : tinyPng;
  const key = `applications/${applicationId}/${type}/seed-${type}.${EXTENSION_BY_MIME[mime as keyof typeof EXTENSION_BY_MIME]}`;
  await getStorage().put({ key, body: buf, contentType: mime });
  return { key, mime, buf };
}

interface DocPlan {
  type: string;
  label: string;
  kind: 'pdf' | 'png';
  review: 'uploaded' | 'under_review' | 'verified' | 'changes_requested';
  feedback?: string;
}

async function makeApplication(opts: {
  ownerId: mongoose.Types.ObjectId;
  schemeCode: string;
  targetStatus: 'DRAFT' | 'ASSIGNED' | 'UNDER_REVIEW' | 'APPROVED';
  partnerName?: string;
  docs?: DocPlan[];
  interestRateBps?: number;
  tenureMonths?: number;
  moratoriumMonths?: number;
}) {
  const scheme = await Scheme.findOne({ code: opts.schemeCode });
  const profile = await CitizenProfile.findOne({ userId: opts.ownerId });
  if (!scheme || !profile) throw new Error(`missing scheme/profile for ${opts.schemeCode}`);

  const existing = await Application.findOne({ ownerUserId: opts.ownerId, schemeId: scheme._id });
  if (existing) return existing;

  const seq = await Counter.findByIdAndUpdate('application', { $inc: { seq: 1 } }, { new: true, upsert: true }).lean();
  const reference = applicationReference(seq!.seq);

  const financing = {
    projectCostPaise: profile.projectCostPaise,
    ownContributionPaise: profile.ownContributionPaise,
    requestedLoanPaise: profile.requestedLoanPaise,
    interestRateBps: opts.interestRateBps ?? scheme.terms.minInterestRateBps,
    tenureMonths: opts.tenureMonths ?? scheme.terms.minTenureMonths,
    moratoriumMonths: opts.moratoriumMonths ?? 0,
  };

  const now = new Date();
  const timeline: Record<string, unknown>[] = [
    { action: 'create', fromStatus: null, toStatus: 'DRAFT', actorUserId: opts.ownerId, actorRole: 'CITIZEN', reason: '', at: new Date(now.getTime() - 86400000 * 5) },
  ];

  const app = new Application({
    reference,
    ownerUserId: opts.ownerId,
    schemeId: scheme._id,
    schemeCode: scheme.code,
    schemeVersion: scheme.source.version,
    status: 'DRAFT',
    financing,
    timeline,
  });

  if (opts.targetStatus !== 'DRAFT') {
    const facts = profileToFacts(profile);
    const evalResult = evaluateEligibility(schemeToRuleSet(scheme), facts, {
      projectCostPaise: financing.projectCostPaise ?? undefined,
      ownContributionPaise: financing.ownContributionPaise ?? undefined,
      requestedLoanPaise: financing.requestedLoanPaise ?? undefined,
    });
    app.profileSnapshot = {
      fullName: profile.fullName, age: profile.age, annualIncomePaise: profile.annualIncomePaise,
      category: profile.category, state: profile.state, district: profile.district, areaType: profile.areaType,
      location: profile.location?.lat != null ? { lat: profile.location.lat, lng: profile.location.lng } : null,
      purpose: profile.purpose, hasBusinessPlan: profile.hasBusinessPlan,
    };
    app.financingSnapshot = { ...financing };
    app.eligibilitySnapshot = { status: evalResult.status, conditions: evalResult.conditions, evaluatedAt: now };
    try {
      app.financePlanSnapshot = runCalculation(scheme, {
        projectCostPaise: financing.projectCostPaise!, ownContributionPaise: financing.ownContributionPaise!,
        requestedLoanPaise: financing.requestedLoanPaise!, interestRateBps: financing.interestRateBps,
        tenureMonths: financing.tenureMonths, moratoriumMonths: financing.moratoriumMonths,
      }) as unknown as Record<string, unknown>;
    } catch { app.financePlanSnapshot = null; }
    app.status = 'SUBMITTED';
    app.submittedAt = new Date(now.getTime() - 86400000 * 4);
    timeline.push({ action: 'submit', fromStatus: 'DRAFT', toStatus: 'SUBMITTED', actorUserId: opts.ownerId, actorRole: 'CITIZEN', reason: '', at: app.submittedAt });
  }

  let partnerDoc = null;
  if (opts.partnerName && opts.targetStatus !== 'DRAFT') {
    partnerDoc = await PartnerOrganization.findOne({ name: opts.partnerName });
    if (partnerDoc) {
      const assignment = await PartnerAssignment.create({
        applicationId: app._id,
        partnerId: partnerDoc._id,
        active: true,
        assignmentType: 'auto_routed',
        routingScore: 88,
        routingReason: 'Seed assignment (demonstration).',
        distanceBasis: 'haversine_straight_line',
        metricsSimulated: true,
        metricsAsOf: now,
      });
      app.assignedPartnerId = partnerDoc._id;
      app.currentAssignmentId = assignment._id;
      app.status = 'ASSIGNED';
      timeline.push({ action: 'assign', fromStatus: 'SUBMITTED', toStatus: 'ASSIGNED', actorUserId: null, actorRole: 'ADMIN', reason: 'seed', at: new Date(now.getTime() - 86400000 * 3) });
      await PartnerOrganization.updateOne({ _id: partnerDoc._id }, { $inc: { activeAssignments: 1 } });
    }
  }

  if (opts.targetStatus === 'UNDER_REVIEW' || opts.targetStatus === 'APPROVED') {
    app.status = 'UNDER_REVIEW';
    timeline.push({ action: 'start_review', fromStatus: 'ASSIGNED', toStatus: 'UNDER_REVIEW', actorUserId: null, actorRole: 'PARTNER', reason: '', at: new Date(now.getTime() - 86400000 * 2) });
  }
  if (opts.targetStatus === 'APPROVED') {
    app.status = 'APPROVED';
    app.decidedAt = new Date(now.getTime() - 86400000);
    timeline.push({ action: 'approve', fromStatus: 'UNDER_REVIEW', toStatus: 'APPROVED', actorUserId: null, actorRole: 'PARTNER', reason: '', at: app.decidedAt });
  }

  app.set('timeline', timeline);
  await app.save();

  // Documents
  for (const d of opts.docs ?? []) {
    const { key, mime, buf } = await storeDoc(String(app._id), d.type, d.kind);
    await DocumentModel.create({
      ownerUserId: opts.ownerId,
      applicationId: app._id,
      type: d.type,
      label: d.label,
      version: 1,
      storageKey: key,
      originalFilename: `${d.type}.${EXTENSION_BY_MIME[mime as keyof typeof EXTENSION_BY_MIME]}`,
      contentType: mime,
      byteSize: buf.length,
      sha256: createHash('sha256').update(buf).digest('hex'),
      reviewStatus: d.review,
      reviewFeedback: d.feedback ?? '',
      reviewedAt: d.review === 'uploaded' ? null : now,
      reviewHistory: [
        { status: 'uploaded', at: new Date(now.getTime() - 86400000 * 3) },
        ...(d.review !== 'uploaded' ? [{ status: d.review, feedback: d.feedback ?? '', at: now }] : []),
      ],
    });
  }

  logger.info(`seeded application ${reference} (${opts.schemeCode}) -> ${app.status}`);
  return app;
}

async function seedTransactions(citizenIds: Map<string, mongoose.Types.ObjectId>) {
  const ravi = citizenIds.get('ravi.kumar@citizens.schemefit.dev')!;
  const shabnam = citizenIds.get('shabnam.ali@citizens.schemefit.dev')!;
  const ankit = citizenIds.get('ankit.verma@citizens.schemefit.dev')!;
  const meena = citizenIds.get('meena.devi@citizens.schemefit.dev')!;

  await makeApplication({
    ownerId: ravi,
    schemeCode: 'NSFDC-TL',
    targetStatus: 'UNDER_REVIEW',
    partnerName: 'Bihar SCA (demo)',
    interestRateBps: 700,
    tenureMonths: 60,
    moratoriumMonths: 6,
    docs: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)', kind: 'png', review: 'verified' },
      { type: 'pan_card', label: 'PAN card', kind: 'png', review: 'verified' },
      { type: 'caste_certificate', label: 'Caste certificate (SC)', kind: 'pdf', review: 'verified' },
      { type: 'income_certificate', label: 'Income certificate', kind: 'pdf', review: 'under_review' },
      { type: 'bank_statement', label: 'Bank statement (last 6 months)', kind: 'pdf', review: 'changes_requested', feedback: 'The statement is only 2 months. Please upload the full 6-month statement.' },
      { type: 'project_report', label: 'Detailed project report / business plan', kind: 'pdf', review: 'uploaded' },
    ],
  });

  await makeApplication({
    ownerId: shabnam,
    schemeCode: 'MICRO-CREDIT',
    targetStatus: 'APPROVED',
    partnerName: 'Bank A — Public Sector (demo)',
    interestRateBps: 1500,
    tenureMonths: 24,
    docs: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)', kind: 'png', review: 'verified' },
      { type: 'bank_statement', label: 'Bank statement (last 3 months)', kind: 'pdf', review: 'verified' },
      { type: 'address_proof', label: 'Address proof', kind: 'pdf', review: 'verified' },
    ],
  });

  await makeApplication({
    ownerId: ankit,
    schemeCode: 'PMMY-KISHOR',
    targetStatus: 'ASSIGNED',
    partnerName: 'Bank A — Public Sector (demo)',
    interestRateBps: 1050,
    tenureMonths: 48,
    docs: [
      { type: 'identity_proof', label: 'Identity proof (Aadhaar)', kind: 'png', review: 'uploaded' },
      { type: 'pan_card', label: 'PAN card', kind: 'png', review: 'uploaded' },
    ],
  });

  await makeApplication({ ownerId: meena, schemeCode: 'EDU-SKILL', targetStatus: 'DRAFT' });
}

export interface SeedResult {
  admin: string;
  partners: { email: string; password: string }[];
  citizens: { email: string; password: string }[];
}

/**
 * Upsert ONLY reference data (schemes + partner organisations). Idempotent and
 * safe on every boot — used to keep the catalogue current on a deployment that
 * already has users, without touching accounts or transactional data.
 */
export async function syncReferenceData(): Promise<{ schemes: number; partners: number }> {
  await upsertSchemes();
  await upsertPartners();
  return { schemes: allSchemes.length, partners: partners.length };
}

export async function seedDatabase({ fresh }: { fresh: boolean }): Promise<SeedResult> {
  if (env.isProd && !env.SEED_ALLOW_PROD) {
    throw new Error('Refusing to seed a production database. Set SEED_ALLOW_PROD=true to override.');
  }

  if (fresh) {
    logger.warn('--fresh: dropping application-level collections');
    await Promise.all([
      Application.deleteMany({}),
      DocumentModel.deleteMany({}),
      PartnerAssignment.deleteMany({}),
      Notification.deleteMany({}),
      Counter.deleteMany({}),
    ]);
    await PartnerOrganization.updateMany({}, { $set: { activeAssignments: 0 } });
  }

  await upsertSchemes();
  await upsertPartners();
  await upsertAdmin();
  await upsertPartnerUsers();
  const citizenIds = await upsertCitizens();
  await seedTransactions(citizenIds);

  // recount partner load from the source of truth
  for (const p of await PartnerOrganization.find({})) {
    const count = await PartnerAssignment.countDocuments({ partnerId: p._id, active: true });
    await PartnerOrganization.updateOne({ _id: p._id }, { $set: { activeAssignments: count } });
  }

  return {
    admin: env.SEED_ADMIN_EMAIL,
    partners: partnerUsers.map((p) => ({ email: p.email, password: p.password })),
    citizens: citizens.map((c) => ({ email: c.email, password: c.password })),
  };
}
