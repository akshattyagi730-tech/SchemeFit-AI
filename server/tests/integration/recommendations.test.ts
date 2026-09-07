import { describe, expect, it } from 'vitest';
import { useTestDb } from '../helpers/db';
import { installDemoReferenceData } from '../helpers/fixtures';
import { citizenWithProfile, RAVI_PROFILE } from '../helpers/scenario';
import { makeClient } from '../helpers/api';

useTestDb();

describe('recommendations (deterministic eligibility + ranking)', () => {
  it('separates eligible (ranked), needs_information and ineligible', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('rec1@example.com', RAVI_PROFILE);
    const res = await c.get('/api/v1/recommendations').expect(200);
    const d = res.body.data;

    expect(d.eligible.map((e: { scheme: { code: string } }) => e.scheme.code)).toContain('NSFDC-TL');
    const nsfdc = d.eligible.find((e: { scheme: { code: string } }) => e.scheme.code === 'NSFDC-TL');
    expect(nsfdc.suitability.score).toBeGreaterThan(0);
    expect(nsfdc.suitability.score).toBeLessThanOrEqual(100);
    expect(nsfdc.suitability.factors.length).toBeGreaterThanOrEqual(5);
    expect(nsfdc.suitability.disclaimer).toMatch(/not a loan-approval probability/i);

    const inelig = d.ineligible.map((e: { scheme: { code: string } }) => e.scheme.code);
    expect(inelig).toContain('MICRO-CREDIT'); // requested loan far above the ₹1.5L ceiling
    expect(inelig).toContain('EDU-SKILL'); // purpose is business_expansion, not education/skilling
    for (const e of d.ineligible) {
      expect(e.eligibility.failed.length).toBeGreaterThan(0);
    }
  });

  it('marks a sparse profile as needs_information (never a confident claim)', async () => {
    await installDemoReferenceData();
    const c = new (await import('../helpers/api')).Client();
    await c.registerCitizen('rec2@example.com');
    await c.put('/api/v1/profile').send({ state: 'Kerala', district: 'Ernakulam' }).expect(200);

    const res = await c.get('/api/v1/recommendations').expect(200);
    expect(res.body.data.counts.eligible).toBe(0);
    expect(res.body.data.counts.needsInformation).toBeGreaterThan(0);
  });

  it('excludes an ineligible scheme with a specific reason and never ranks it', async () => {
    await installDemoReferenceData();
    // GENERAL category on NSFDC-TL -> ineligible on social_category.
    const c = await citizenWithProfile('rec3@example.com', { ...RAVI_PROFILE, category: 'GENERAL' });
    const res = await c.get('/api/v1/recommendations').expect(200);
    const nsfdc = res.body.data.ineligible.find((e: { scheme: { code: string } }) => e.scheme.code === 'NSFDC-TL');
    expect(nsfdc).toBeTruthy();
    expect(nsfdc.eligibility.failed.map((f: { key: string }) => f.key)).toContain('social_category');
    // Not present in the ranked list.
    expect(res.body.data.eligible.find((e: { scheme: { code: string } }) => e.scheme.code === 'NSFDC-TL')).toBeUndefined();
  });

  it('recomputes immediately after a profile edit without touching submitted applications', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('rec4@example.com', { ...RAVI_PROFILE, requestedLoanPaise: 100_00_00_000 });
    let res = await c.get('/api/v1/recommendations').expect(200);
    const before = res.body.data.counts.eligible;

    expect(before).toBe(0); // ₹100 crore request is above every scheme ceiling

    await c.put('/api/v1/profile').send({ requestedLoanPaise: RAVI_PROFILE.requestedLoanPaise }).expect(200);
    res = await c.get('/api/v1/recommendations').expect(200);
    expect(res.body.data.counts.eligible).toBeGreaterThanOrEqual(1);
  });

  it('financial planner: zero-interest and ordinary EMI both computed from inputs', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('rec5@example.com');

    const ordinary = await c.post('/api/v1/finance/calculate').send({
      schemeCode: 'NSFDC-TL', projectCostPaise: 6_00_000_00, ownContributionPaise: 60_000_00,
      requestedLoanPaise: 5_40_000_00, interestRateBps: 700, tenureMonths: 60, moratoriumMonths: 0,
    }).expect(200);
    expect(ordinary.body.data.plan.monthlyInstalmentPaise).toBeGreaterThan(0);
    expect(ordinary.body.data.plan.totalInterestPaise).toBeGreaterThan(0);

    const zero = await c.post('/api/v1/finance/calculate').send({
      schemeCode: 'EDU-SKILL', projectCostPaise: 1_50_000_00, ownContributionPaise: 0,
      requestedLoanPaise: 1_20_000_00, interestRateBps: 0, tenureMonths: 24, moratoriumMonths: 0,
    }).expect(200);
    expect(zero.body.data.plan.totalInterestPaise).toBe(0);
    expect(zero.body.data.plan.monthlyInstalmentPaise).toBe(Math.round(1_20_000_00 / 24));
  });

  it('finance calculate rejects nonsensical inputs with 422 + field errors', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('rec6@example.com');
    const res = await c.post('/api/v1/finance/calculate').send({
      schemeCode: 'NSFDC-TL', projectCostPaise: 1_00_000_00, ownContributionPaise: 2_00_000_00,
      requestedLoanPaise: 50_000_00, interestRateBps: 700, tenureMonths: 12,
    });
    expect(res.status).toBe(422);
    expect(res.body.error.fieldErrors.length).toBeGreaterThan(0);
  });
});
