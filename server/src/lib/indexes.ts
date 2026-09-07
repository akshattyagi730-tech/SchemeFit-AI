import { logger } from './logger';
import {
  User,
  Session,
  CitizenProfile,
  Scheme,
  PartnerOrganization,
  Application,
  DocumentModel,
  PartnerAssignment,
  Notification,
  AuditEvent,
} from '../models';

/**
 * Explicitly build all model indexes at startup (idempotent). This replaces
 * migrations for a Mongo/Mongoose stack — schema + indexes are code.
 */
export async function ensureIndexes(): Promise<void> {
  const models = [
    User, Session, CitizenProfile, Scheme, PartnerOrganization,
    Application, DocumentModel, PartnerAssignment, Notification, AuditEvent,
  ];
  await Promise.all(models.map((m) => m.createIndexes()));
  logger.info('model indexes ensured');
}
