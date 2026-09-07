import type { Request, Response } from 'express';
import { z } from 'zod';
import { ok } from '../../lib/http';
import { notFound } from '../../lib/errors';
import { CitizenProfile } from '../../models/CitizenProfile';
import { PartnerOrganization } from '../../models/PartnerOrganization';
import { findSchemeByIdOrCode } from '../schemes/schemes.service';
import { routeForApplicant } from './partners.service';
import { serializePartnerPublic } from './partners.serialize';

export const routingQuery = z.object({ schemeCode: z.string().min(2).max(40) });

/**
 * Routing preview for the signed-in citizen for a given scheme, using their
 * profile location. This is a recommendation only — it does not assign a partner
 * and does not imply acceptance or approval.
 */
export async function routingPreview(req: Request, res: Response): Promise<void> {
  const { schemeCode } = req.query as unknown as z.infer<typeof routingQuery>;
  const scheme = await findSchemeByIdOrCode(schemeCode);

  const profile = await CitizenProfile.findOne({ userId: req.auth!.userId });
  if (!profile) throw notFound('Complete your profile first');

  const outcome = await routeForApplicant({
    schemeCode: scheme.code,
    location: profile.location?.lat != null ? { lat: profile.location.lat!, lng: profile.location.lng! } : null,
    state: profile.state ?? null,
    district: profile.district ?? null,
  });

  ok(res, {
    scheme: { code: scheme.code, name: scheme.name },
    routing: outcome,
    disclaimer:
      'Distances are straight-line (Haversine), not road distance or travel time. A routing recommendation does not mean a partner has accepted the case or that a loan is approved.',
  });
}

/** Directory of partners (public fields) — used for maps / comparison tables. */
export async function listPartners(req: Request, res: Response): Promise<void> {
  const schemeCode = typeof req.query.schemeCode === 'string' ? req.query.schemeCode.toUpperCase() : undefined;
  const filter: Record<string, unknown> = {};
  if (schemeCode) filter.supportedSchemeCodes = schemeCode;
  const partners = await PartnerOrganization.find(filter).sort({ name: 1 });
  ok(res, { partners: partners.map(serializePartnerPublic) });
}
