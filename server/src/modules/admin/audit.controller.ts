import type { Request, Response } from 'express';
import { paginated } from '../../lib/http';
import { paginationMeta } from '../../lib/query';
import { AuditEvent } from '../../models/AuditEvent';
import { findApplicationOr404 } from '../applications/applications.service';

export async function listAudit(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as {
    page: number; pageSize: number; sort: string; order: 'asc' | 'desc';
    action?: string; resourceType?: string; resourceId?: string; actorUserId?: string;
  };
  const filter: Record<string, unknown> = {};
  if (q.action) filter.action = q.action;
  if (q.resourceType) filter.resourceType = q.resourceType;
  if (q.resourceId) filter.resourceId = q.resourceId;
  if (q.actorUserId) filter.actorUserId = q.actorUserId;

  const [items, total] = await Promise.all([
    AuditEvent.find(filter)
      .sort({ at: q.order === 'asc' ? 1 : -1 })
      .skip((q.page - 1) * q.pageSize)
      .limit(q.pageSize)
      .lean(),
    AuditEvent.countDocuments(filter),
  ]);

  paginated(res, {
    items: items.map((e) => ({
      id: String(e._id),
      actorUserId: e.actorUserId ? String(e.actorUserId) : null,
      actorRole: e.actorRole,
      action: e.action,
      resourceType: e.resourceType,
      resourceId: e.resourceId,
      outcome: e.outcome,
      changes: e.changes,
      context: e.context,
      at: e.at,
    })),
    ...paginationMeta(total, q.page, q.pageSize),
  });
}

/** Review history for one application (timeline + document review events). */
export async function applicationHistory(req: Request, res: Response): Promise<void> {
  const app = await findApplicationOr404(req.params.id!);
  const audit = await AuditEvent.find({ resourceType: 'Application', resourceId: String(app._id) })
    .sort({ at: 1 })
    .lean();
  res.json({
    data: {
      reference: app.reference,
      status: app.status,
      timeline: app.timeline,
      auditTrail: audit.map((e) => ({ action: e.action, actorRole: e.actorRole, changes: e.changes, reason: e.context?.reason ?? null, at: e.at })),
    },
  });
}
