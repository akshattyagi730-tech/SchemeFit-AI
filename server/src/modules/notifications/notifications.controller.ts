import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/http';
import { listNotifications, markRead } from './notifications.service';

export const listQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  unreadOnly: z.enum(['true', 'false']).default('false'),
});

export const markReadBody = z.object({
  ids: z.union([z.array(z.string().length(24)).max(200), z.literal('all')]),
});

export async function list(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as z.infer<typeof listQuery>;
  const { items, total, unread } = await listNotifications(req.auth!.userId, {
    unreadOnly: q.unreadOnly === 'true',
    limit: q.pageSize,
    page: q.page,
  });
  ok(res, {
    notifications: items.map((n) => ({
      id: String(n._id),
      event: n.event,
      title: n.title,
      message: n.message,
      link: n.link,
      applicationId: n.applicationId ? String(n.applicationId) : null,
      read: n.readAt != null,
      createdAt: n.createdAt,
    })),
    meta: { total, unread, page: q.page, pageSize: q.pageSize },
  });
}

export async function markReadHandler(req: Request, res: Response): Promise<void> {
  const { ids } = req.body as z.infer<typeof markReadBody>;
  const modified = await markRead(req.auth!.userId, ids);
  ok(res, { updated: modified });
}
