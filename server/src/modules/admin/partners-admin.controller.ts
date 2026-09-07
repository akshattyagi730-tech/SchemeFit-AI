import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok, created, paginated } from '../../lib/http';
import { conflict, notFound } from '../../lib/errors';
import { paginationMeta } from '../../lib/query';
import { PartnerOrganization } from '../../models/PartnerOrganization';
import { User } from '../../models/User';
import { hashPassword } from '../../lib/password';
import { recordAudit } from '../audit/audit.service';
import { findPartnerOr404, recountActiveAssignments } from '../partners/partners.service';
import { serializePartnerAdmin } from '../partners/partners.serialize';
import type { partnerBodySchema, partnerPatchSchema, provisionUserSchema } from './admin.schemas';

export async function listPartners(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as { page: number; pageSize: number; sort: string; order: 'asc' | 'desc' };
  const [items, total] = await Promise.all([
    PartnerOrganization.find({})
      .sort({ [q.sort]: q.order === 'asc' ? 1 : -1 })
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize),
    PartnerOrganization.countDocuments({}),
  ]);
  paginated(res, { items: items.map(serializePartnerAdmin), ...paginationMeta(total, q.page, q.pageSize) });
}

export async function getPartner(req: Request, res: Response): Promise<void> {
  const partner = await findPartnerOr404(req.params.id!);
  await recountActiveAssignments(String(partner._id));
  const fresh = await findPartnerOr404(String(partner._id));
  ok(res, { partner: serializePartnerAdmin(fresh) });
}

export async function createPartner(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof partnerBodySchema>;
  const existing = await PartnerOrganization.findOne({ name: body.name }).lean();
  if (existing) throw conflict('A partner organisation with this name already exists', 'PARTNER_NAME_IN_USE');
  const partner = await PartnerOrganization.create({ ...body, activeAssignments: 0, metricsAsOf: new Date() });
  await recordAudit(req, { action: 'partner.create', resourceType: 'PartnerOrganization', resourceId: String(partner._id) });
  created(res, { partner: serializePartnerAdmin(partner) });
}

export async function updatePartner(req: Request, res: Response): Promise<void> {
  const partner = await findPartnerOr404(req.params.id!);
  const patch = req.body as z.infer<typeof partnerPatchSchema>;
  const before = serializePartnerAdmin(partner);
  partner.set(patch);
  await partner.save();
  const after = serializePartnerAdmin(partner);
  await recordAudit(req, {
    action: 'partner.update',
    resourceType: 'PartnerOrganization',
    resourceId: String(partner._id),
    changes: Object.fromEntries(
      Object.keys(patch).map((k) => [k, { from: (before as Record<string, unknown>)[k], to: (after as Record<string, unknown>)[k] }]),
    ),
  });
  ok(res, { partner: after });
}

/** Provision a PARTNER or ADMIN user. This is the only path to a non-citizen account. */
export async function provisionUser(req: Request, res: Response): Promise<void> {
  const body = req.body as z.infer<typeof provisionUserSchema>;
  const existing = await User.findOne({ email: body.email }).lean();
  if (existing) throw conflict('An account with this email already exists', 'EMAIL_IN_USE');

  if (body.role === 'PARTNER') {
    const org = await PartnerOrganization.findById(body.partnerOrganizationId).lean();
    if (!org) throw notFound('Partner organisation not found');
  }

  const passwordHash = await hashPassword(body.password);
  const user = await User.create({
    email: body.email,
    passwordHash,
    role: body.role,
    displayName: body.displayName,
    partnerOrganizationId: body.role === 'PARTNER' ? body.partnerOrganizationId : null,
  });
  await recordAudit(req, {
    action: 'user.provision',
    resourceType: 'User',
    resourceId: String(user._id),
    changes: { role: { from: null, to: body.role } },
  });
  created(res, {
    user: {
      id: String(user._id),
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      partnerOrganizationId: user.partnerOrganizationId ? String(user.partnerOrganizationId) : null,
    },
  });
}
