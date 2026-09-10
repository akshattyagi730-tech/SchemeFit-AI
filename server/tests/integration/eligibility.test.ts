import { describe, expect, it } from 'vitest';
import { useTestDb } from '../helpers/db';
import { citizenWithProfile } from '../helpers/scenario';
import { installDemoReferenceData } from '../helpers/fixtures';

useTestDb();

describe('POST /eligibility/check — broad, non-loan eligibility', () => {
  it('matches pension / income-support / insurance schemes for a rural BPL senior', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('elig-1@example.com');

    const res = await c
      .post('/api/v1/eligibility/check')
      .send({ age: 64, gender: 'female', category: 'SC', areaType: 'rural', occupation: 'farmer', landHoldingHectares: 1, rationCardType: 'BPL' })
      .expect(200);

    const codes = res.body.data.eligible.map((m: { scheme: { code: string } }) => m.scheme.code);
    expect(codes).toEqual(expect.arrayContaining(['IGNOAPS', 'PM-KISAN', 'PMSBY', 'PMUY']));
    // A women-only widow pension is age-eligible here too.
    expect(codes).toContain('IGNWPS');
    // Loan schemes need a purpose + amounts → "needs information", never a false positive.
    expect(codes).not.toContain('PMMY-KISHOR');
    // Every eligible match carries an official apply link.
    for (const m of res.body.data.eligible) expect(m.scheme.officialUrl).toMatch(/^https:\/\//);
  });

  it('a male applicant is not eligible for women-only schemes', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('elig-2@example.com');

    const res = await c
      .post('/api/v1/eligibility/check')
      .send({ age: 30, gender: 'male', occupation: 'daily_wager', rationCardType: 'BPL' })
      .expect(200);

    const eligible = res.body.data.eligible.map((m: { scheme: { code: string } }) => m.scheme.code);
    const ineligible = res.body.data.ineligible.map((m: { scheme: { code: string } }) => m.scheme.code);
    expect(eligible).not.toContain('PMMVY');
    expect([...eligible, ...ineligible]).toContain('PMMVY');
  });

  it('an unanswered questionnaire returns everything as needs_information (no confident claim)', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('elig-3@example.com');
    const res = await c.post('/api/v1/eligibility/check').send({}).expect(200);
    expect(res.body.data.counts.eligible).toBe(0);
    expect(res.body.data.counts.needsInformation).toBeGreaterThan(0);
  });
});
