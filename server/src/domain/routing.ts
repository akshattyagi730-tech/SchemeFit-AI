/**
 * Smart channel-partner routing.
 *
 * Step 1 — MANDATORY filters. A partner failing any of these is removed from the
 * pool entirely. Proximity can never compensate for an unsupported scheme or an
 * inactive authorisation.
 * Step 2 — rank the survivors on configurable soft factors.
 *
 * The returned distance is Haversine straight-line distance, explicitly labelled
 * as such. It is not road distance and not travel time. A routing recommendation
 * does not imply the partner has accepted the case or that a loan is approved.
 */
import { haversineKm, roundKm, type LatLng } from '../lib/geo';

export interface RoutablePartner {
  id: string;
  name: string;
  type: string;
  status: 'active' | 'suspended' | 'inactive';
  authorization: 'authorized' | 'pending' | 'revoked';
  acceptingApplications: boolean;
  supportedSchemeCodes: string[];
  focusSchemeCodes: string[];
  serviceAreas: { national?: boolean; states?: string[]; districts?: string[] };
  location: LatLng;
  capacity: number;
  activeAssignments: number;
  operationalMetricsSimulated: boolean;
  metricsAsOf: Date;
}

export interface RoutingContext {
  schemeCode: string;
  applicant: { location?: LatLng | null; state?: string | null; district?: string | null };
}

export interface RoutingFactor {
  key: string;
  label: string;
  weight: number;
  rawScore: number;
  weightedScore: number;
  detail: string;
}

export interface PartnerRouteResult {
  partnerId: string;
  name: string;
  type: string;
  score: number;
  factors: RoutingFactor[];
  distanceKm: number | null;
  distanceBasis: 'haversine_straight_line';
  metricsSimulated: boolean;
  metricsAsOf: string;
  reason: string;
}

export interface RoutingOutcome {
  matched: boolean;
  schemeCode: string;
  recommended: PartnerRouteResult | null;
  candidates: PartnerRouteResult[];
  excluded: { partnerId: string; name: string; reasons: string[] }[];
  reason: string;
}

const WEIGHTS = { distance: 0.3, workload: 0.35, capacity_headroom: 0.2, scheme_focus: 0.15 } as const;
const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const r1 = (n: number) => Math.round(n * 10) / 10;

function servesArea(p: RoutablePartner, ctx: RoutingContext): boolean {
  const a = p.serviceAreas;
  if (a.national) return true;
  const stateOk = !!ctx.applicant.state && (a.states?.includes(ctx.applicant.state) ?? false);
  const districtOk = !!ctx.applicant.district && (a.districts?.includes(ctx.applicant.district) ?? false);
  if ((a.states?.length ?? 0) === 0 && (a.districts?.length ?? 0) === 0) return false;
  // District match is sufficient; otherwise state match is required.
  return districtOk || stateOk;
}

function mandatoryFailureReasons(p: RoutablePartner, ctx: RoutingContext): string[] {
  const reasons: string[] = [];
  if (p.status !== 'active') reasons.push(`Partner status is "${p.status}"`);
  if (p.authorization !== 'authorized') reasons.push(`Authorisation is "${p.authorization}"`);
  if (!p.acceptingApplications) reasons.push('Partner is not accepting new applications');
  if (!p.supportedSchemeCodes.includes(ctx.schemeCode)) reasons.push(`Does not support scheme ${ctx.schemeCode}`);
  if (!servesArea(p, ctx)) reasons.push('Applicant location is outside the partner service area');
  return reasons;
}

export function routePartners(partners: RoutablePartner[], ctx: RoutingContext): RoutingOutcome {
  const excluded: RoutingOutcome['excluded'] = [];
  const eligible: RoutablePartner[] = [];

  for (const p of partners) {
    const reasons = mandatoryFailureReasons(p, ctx);
    if (reasons.length) excluded.push({ partnerId: p.id, name: p.name, reasons });
    else eligible.push(p);
  }

  if (eligible.length === 0) {
    return {
      matched: false,
      schemeCode: ctx.schemeCode,
      recommended: null,
      candidates: [],
      excluded,
      reason:
        'No partner currently satisfies the mandatory filters (active + authorised + supports this scheme + serves this area + accepting applications). An administrator can review this and assign or reassign manually.',
    };
  }

  const hasApplicantLocation = !!ctx.applicant.location;

  const candidates: PartnerRouteResult[] = eligible
    .map((p) => {
      const km = hasApplicantLocation ? roundKm(haversineKm(ctx.applicant.location!, p.location)) : null;

      // distance factor
      const distanceRaw = km == null ? 55 : clamp(100 - ((km - 5) / 55) * 100);
      const distanceDetail =
        km == null
          ? 'Applicant coordinates unavailable; distance not scored.'
          : `${km} km straight-line (Haversine) from the applicant. Not road distance or travel time.`;

      // workload factor
      const ratio = p.capacity > 0 ? p.activeAssignments / p.capacity : 1;
      const workloadRaw = clamp(100 * (1 - ratio));
      const workloadDetail = `${p.activeAssignments} of ${p.capacity} active-case slots in use (${Math.round(ratio * 100)}%).`;

      // capacity headroom factor
      const free = Math.max(0, p.capacity - p.activeAssignments);
      const headroomRaw = clamp((free / 25) * 100);
      const headroomDetail = `${free} free case slot${free === 1 ? '' : 's'}.`;

      // scheme focus factor
      const focus = p.focusSchemeCodes.includes(ctx.schemeCode);
      const focusRaw = focus ? 100 : 60;
      const focusDetail = focus ? 'This scheme is a declared focus area for the partner.' : 'Partner supports but does not specialise in this scheme.';

      const factors: RoutingFactor[] = [
        { key: 'distance', label: 'Proximity (straight-line)', weight: WEIGHTS.distance, rawScore: r1(distanceRaw), weightedScore: r1(distanceRaw * WEIGHTS.distance), detail: distanceDetail },
        { key: 'workload', label: 'Current workload', weight: WEIGHTS.workload, rawScore: r1(workloadRaw), weightedScore: r1(workloadRaw * WEIGHTS.workload), detail: workloadDetail },
        { key: 'capacity_headroom', label: 'Capacity headroom', weight: WEIGHTS.capacity_headroom, rawScore: r1(headroomRaw), weightedScore: r1(headroomRaw * WEIGHTS.capacity_headroom), detail: headroomDetail },
        { key: 'scheme_focus', label: 'Scheme focus', weight: WEIGHTS.scheme_focus, rawScore: r1(focusRaw), weightedScore: r1(focusRaw * WEIGHTS.scheme_focus), detail: focusDetail },
      ];

      const score = r1(factors.reduce((s, f) => s + f.weightedScore, 0));

      return {
        partnerId: p.id,
        name: p.name,
        type: p.type,
        score,
        factors,
        distanceKm: km,
        distanceBasis: 'haversine_straight_line' as const,
        metricsSimulated: p.operationalMetricsSimulated,
        metricsAsOf: p.metricsAsOf.toISOString(),
        reason:
          `Ranked #_ on workload (${Math.round((1 - ratio) * 100)}% free), ` +
          `${km == null ? 'unknown distance' : `${km} km away`}, ` +
          `${free} open slot${free === 1 ? '' : 's'}${focus ? ', scheme focus match' : ''}. ` +
          'This is a routing suggestion only — it does not mean the partner has accepted the case or that a loan is approved.',
      };
    })
    .sort((a, b) => b.score - a.score || (a.distanceKm ?? 1e9) - (b.distanceKm ?? 1e9))
    .map((c, i) => ({ ...c, reason: c.reason.replace('#_', String(i + 1)) }));

  return {
    matched: true,
    schemeCode: ctx.schemeCode,
    recommended: candidates[0] ?? null,
    candidates,
    excluded,
    reason: `${candidates.length} partner(s) passed the mandatory filters and were ranked.`,
  };
}
