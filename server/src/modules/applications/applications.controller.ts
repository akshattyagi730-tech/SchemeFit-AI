import type { Request, Response } from 'express';
import { ok, created, paginated } from '../../lib/http';
import { badRequest, forbidden } from '../../lib/errors';
import { paginationMeta } from '../../lib/query';
import { recordAudit } from '../audit/audit.service';
import {
  assertCanAccess,
  createDraft,
  findApplicationOr404,
  listApplicationsFor,
  loadContext,
  performTransition,
} from './applications.service';
import { serializeApplication } from './applications.serialize';
import { readinessForApplication } from './readiness.service';
import type { TransitionAction } from '../../domain/application-status';

async function respondWithApplication(res: Response, req: Request, appId: string, status = 200): Promise<void> {
  const app = await findApplicationOr404(appId);
  const { scheme, assignment, partnerName } = await loadContext(app);
  const readiness = scheme ? await readinessForApplication(String(app._id), scheme) : null;
  const body = serializeApplication(app, { scheme, assignment, partnerName, readiness });
  res.status(status).json({ data: { application: body } });
}

export async function create(req: Request, res: Response): Promise<void> {
  const app = await createDraft(req, (req.body as { schemeCode: string }).schemeCode);
  await respondWithApplication(res, req, String(app._id), 201);
}

export async function list(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as {
    page: number; pageSize: number; sort: string; order: 'asc' | 'desc';
    status?: string; schemeCode?: string;
  };
  const { items, total } = await listApplicationsFor(req, {
    page: q.page, pageSize: q.pageSize, sort: q.sort, order: q.order,
    filter: { status: q.status, schemeCode: q.schemeCode },
  });

  const serialized = await Promise.all(
    items.map(async (app) => {
      const { scheme, assignment, partnerName } = await loadContext(app);
      const readiness = scheme ? await readinessForApplication(String(app._id), scheme) : null;
      return serializeApplication(app, { scheme, assignment, partnerName, readiness });
    }),
  );

  paginated(res, { items: serialized, ...paginationMeta(total, q.page, q.pageSize) });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const app = await findApplicationOr404(req.params.id!);
  await assertCanAccess(app, req);
  await respondWithApplication(res, req, String(app._id));
}

export async function patchFinancing(req: Request, res: Response): Promise<void> {
  const app = await findApplicationOr404(req.params.id!);
  await assertCanAccess(app, req);
  if (req.auth!.role !== 'CITIZEN') throw forbidden('Only the applicant can edit financing.');
  if (app.status !== 'DRAFT') throw badRequest('Financing can only be edited while the application is a DRAFT.');

  app.set({ financing: { ...app.financing, ...(req.body as object) } });
  await app.save();
  await recordAudit(req, { action: 'application.edit_financing', resourceType: 'Application', resourceId: String(app._id) });
  await respondWithApplication(res, req, String(app._id));
}

/** Factory for the citizen-side transitions (submit, resubmit). */
export function citizenTransition(action: Extract<TransitionAction, 'submit' | 'resubmit'>) {
  return async (req: Request, res: Response): Promise<void> => {
    const app = await findApplicationOr404(req.params.id!);
    await assertCanAccess(app, req);
    if (String(app.ownerUserId) !== req.auth!.userId) throw forbidden();
    await performTransition({ req, app, action });
    await respondWithApplication(res, req, String(app._id));
  };
}

/** Factory for reviewer transitions (partner assigned to the app, or admin). */
export function reviewerTransition(action: Extract<TransitionAction, 'start_review' | 'request_changes' | 'approve' | 'reject'>) {
  return async (req: Request, res: Response): Promise<void> => {
    const app = await findApplicationOr404(req.params.id!);
    await assertCanAccess(app, req); // partner must be the assigned org; admin always ok
    const reason = (req.body as { reason?: string } | undefined)?.reason;
    await performTransition({ req, app, action, reason });
    await respondWithApplication(res, req, String(app._id));
  };
}

/** Admin: assign a submitted application (optionally to a specific partner). */
export async function assign(req: Request, res: Response): Promise<void> {
  const app = await findApplicationOr404(req.params.id!);
  const body = req.body as { partnerId?: string; reason?: string };
  await performTransition({ req, app, action: 'assign', partnerId: body.partnerId, reason: body.reason });
  await respondWithApplication(res, req, String(app._id));
}

/** Admin: reassign to a different partner (reason required). */
export async function reassign(req: Request, res: Response): Promise<void> {
  const app = await findApplicationOr404(req.params.id!);
  const body = req.body as { partnerId?: string; reason: string };
  await performTransition({ req, app, action: 'reassign', partnerId: body.partnerId, reason: body.reason });
  await respondWithApplication(res, req, String(app._id));
}
