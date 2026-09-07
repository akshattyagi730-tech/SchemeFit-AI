import type { Request } from 'express';
import { AuditEvent } from '../../models/AuditEvent';
import { logger } from '../../lib/logger';

export interface AuditInput {
  action: string;
  resourceType: string;
  resourceId?: string | null;
  outcome?: 'success' | 'failure';
  changes?: Record<string, { from: unknown; to: unknown }> | null;
  reason?: string | null;
}

/** Record an audit event. Failures here must never break the request. */
export async function recordAudit(req: Request | null, input: AuditInput): Promise<void> {
  try {
    await AuditEvent.create({
      actorUserId: req?.auth?.userId ?? null,
      actorRole: req?.auth?.role ?? 'system',
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      outcome: input.outcome ?? 'success',
      changes: input.changes ?? null,
      context: {
        ip: req?.ip ?? null,
        requestId: req?.requestId ?? null,
        reason: input.reason ?? null,
      },
    });
  } catch (err) {
    logger.error({ err, action: input.action }, 'failed to write audit event');
  }
}
