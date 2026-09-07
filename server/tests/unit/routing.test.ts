import { describe, expect, it } from 'vitest';
import { routePartners, type RoutablePartner, type RoutingContext } from '../../src/domain/routing';

const partner = (over: Partial<RoutablePartner>): RoutablePartner => ({
  id: Math.random().toString(36).slice(2),
  name: 'P',
  type: 'public_sector_bank',
  status: 'active',
  authorization: 'authorized',
  acceptingApplications: true,
  supportedSchemeCodes: ['PMMY-KISHOR'],
  focusSchemeCodes: [],
  serviceAreas: { national: true, states: [], districts: [] },
  location: { lat: 28.6, lng: 77.4 },
  capacity: 20,
  activeAssignments: 5,
  operationalMetricsSimulated: true,
  metricsAsOf: new Date(),
  ...over,
});

const ctx: RoutingContext = {
  schemeCode: 'PMMY-KISHOR',
  applicant: { location: { lat: 28.65, lng: 77.42 }, state: 'Uttar Pradesh', district: 'Ghaziabad' },
};

describe('partner routing', () => {
  it('excludes partners failing any mandatory filter', () => {
    const partners = [
      partner({ name: 'ok', focusSchemeCodes: ['PMMY-KISHOR'] }),
      partner({ name: 'suspended', status: 'suspended' }),
      partner({ name: 'unauthorised', authorization: 'pending' }),
      partner({ name: 'not-accepting', acceptingApplications: false }),
      partner({ name: 'wrong-scheme', supportedSchemeCodes: ['OTHER'] }),
      partner({ name: 'wrong-area', serviceAreas: { national: false, states: ['Kerala'], districts: [] } }),
    ];
    const out = routePartners(partners, ctx);
    expect(out.matched).toBe(true);
    expect(out.candidates.map((c) => c.name)).toEqual(['ok']);
    expect(out.excluded.map((e) => e.name).sort()).toEqual(
      ['not-accepting', 'suspended', 'unauthorised', 'wrong-area', 'wrong-scheme'].sort(),
    );
  });

  it('proximity does not rescue an unsupported scheme or inactive authorisation', () => {
    const near = partner({ name: 'near-but-unauthorised', authorization: 'revoked', location: { lat: 28.65, lng: 77.42 } });
    const far = partner({ name: 'far-but-valid', location: { lat: 19.07, lng: 72.87 }, supportedSchemeCodes: ['PMMY-KISHOR'] });
    const out = routePartners([near, far], ctx);
    expect(out.candidates.map((c) => c.name)).toEqual(['far-but-valid']);
  });

  it('returns a clear no-match state when nobody qualifies', () => {
    const out = routePartners([partner({ authorization: 'pending' })], ctx);
    expect(out.matched).toBe(false);
    expect(out.recommended).toBeNull();
    expect(out.reason).toMatch(/no partner/i);
  });

  it('ranks by weighted factors; lighter workload wins between equals', () => {
    const busy = partner({ name: 'busy', activeAssignments: 18, capacity: 20 });
    const free = partner({ name: 'free', activeAssignments: 2, capacity: 20 });
    const out = routePartners([busy, free], ctx);
    expect(out.recommended?.name).toBe('free');
    expect(out.recommended?.score).toBeGreaterThan(out.candidates[1]!.score);
  });

  it('labels distance as straight-line Haversine, never travel time', () => {
    const out = routePartners([partner({})], ctx);
    expect(out.candidates[0]!.distanceBasis).toBe('haversine_straight_line');
    expect(out.candidates[0]!.factors.find((f) => f.key === 'distance')!.detail).toMatch(/straight-line \(Haversine\)/i);
    expect(out.candidates[0]!.reason).toMatch(/does not mean the partner has accepted/i);
  });

  it('flags simulated operational metrics', () => {
    const out = routePartners([partner({ operationalMetricsSimulated: true })], ctx);
    expect(out.candidates[0]!.metricsSimulated).toBe(true);
  });
});
