import { Notification, type NotificationDoc } from '../../models/Notification';
import { logger } from '../../lib/logger';

type Event = NotificationDoc['event'];

export interface NotifyInput {
  recipientUserId: string;
  event: Event;
  title: string;
  message: string;
  link?: string;
  applicationId?: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  try {
    await Notification.create({
      recipientUserId: input.recipientUserId,
      event: input.event,
      title: input.title,
      message: input.message,
      link: input.link ?? '',
      applicationId: input.applicationId ?? null,
    });
  } catch (err) {
    logger.error({ err, event: input.event }, 'failed to create notification');
  }
}

export async function listNotifications(userId: string, opts: { unreadOnly?: boolean; limit: number; page: number }) {
  const filter: Record<string, unknown> = { recipientUserId: userId };
  if (opts.unreadOnly) filter.readAt = null;
  const [items, total, unread] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((opts.page - 1) * opts.limit)
      .limit(opts.limit)
      .lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipientUserId: userId, readAt: null }),
  ]);
  return { items, total, unread };
}

export async function markRead(userId: string, ids: string[] | 'all'): Promise<number> {
  const filter: Record<string, unknown> = { recipientUserId: userId, readAt: null };
  if (ids !== 'all') filter._id = { $in: ids };
  const res = await Notification.updateMany(filter, { $set: { readAt: new Date() } });
  return res.modifiedCount;
}
