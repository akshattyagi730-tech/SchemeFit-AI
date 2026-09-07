import type { Request, Response } from 'express';
import { ok, created, paginated } from '../../lib/http';
import { conflict } from '../../lib/errors';
import { paginationMeta } from '../../lib/query';
import { Scheme } from '../../models/Scheme';
import { serializeScheme } from './schemes.serialize';
import { findSchemeByIdOrCode, listSchemes } from './schemes.service';
import { recordAudit } from '../audit/audit.service';
import type { SchemeBodyInput } from './schemes.schemas';

export async function list(req: Request, res: Response): Promise<void> {
  const q = req.query as unknown as {
    page: number; pageSize: number; sort: string; order: 'asc' | 'desc';
    purpose?: string; status: 'active' | 'archived' | 'all';
  };
  const { items, total } = await listSchemes(q);
  paginated(res, {
    items: items.map(serializeScheme),
    ...paginationMeta(total, q.page, q.pageSize),
  });
}

export async function detail(req: Request, res: Response): Promise<void> {
  const scheme = await findSchemeByIdOrCode(req.params.id!);
  ok(res, { scheme: serializeScheme(scheme) });
}

export async function createScheme(req: Request, res: Response): Promise<void> {
  const body = req.body as SchemeBodyInput;
  const existing = await Scheme.findOne({ code: body.code }).lean();
  if (existing) throw conflict(`Scheme code ${body.code} already exists`, 'SCHEME_CODE_IN_USE');
  const scheme = await Scheme.create(body);
  await recordAudit(req, { action: 'scheme.create', resourceType: 'Scheme', resourceId: String(scheme._id) });
  created(res, { scheme: serializeScheme(scheme) });
}

export async function replaceScheme(req: Request, res: Response): Promise<void> {
  const scheme = await findSchemeByIdOrCode(req.params.id!);
  const body = req.body as SchemeBodyInput;
  if (body.code !== scheme.code) {
    const clash = await Scheme.findOne({ code: body.code }).lean();
    if (clash) throw conflict(`Scheme code ${body.code} already exists`, 'SCHEME_CODE_IN_USE');
  }
  scheme.set(body);
  await scheme.save();
  await recordAudit(req, { action: 'scheme.update', resourceType: 'Scheme', resourceId: String(scheme._id) });
  ok(res, { scheme: serializeScheme(scheme) });
}

export function setSchemeStatus(status: 'active' | 'archived') {
  return async (req: Request, res: Response): Promise<void> => {
    const scheme = await findSchemeByIdOrCode(req.params.id!);
    const from = scheme.status;
    scheme.status = status;
    await scheme.save();
    await recordAudit(req, {
      action: `scheme.${status === 'archived' ? 'archive' : 'activate'}`,
      resourceType: 'Scheme',
      resourceId: String(scheme._id),
      changes: { status: { from, to: status } },
    });
    ok(res, { scheme: serializeScheme(scheme) });
  };
}
