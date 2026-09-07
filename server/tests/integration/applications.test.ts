import { describe, expect, it } from 'vitest';
import { useTestDb } from '../helpers/db';
import { loggedIn } from '../helpers/api';
import { installDemoReferenceData } from '../helpers/fixtures';
import { citizenWithProfile, assignedApplication, RAVI_PROFILE } from '../helpers/scenario';

useTestDb();

describe('applications & status machine', () => {
  it('creates a DRAFT and prevents a duplicate open application for the same scheme', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('dup@example.com');
    const first = await c.post('/api/v1/applications').send({ schemeCode: 'NSFDC-TL' });
    expect(first.status).toBe(201);
    const second = await c.post('/api/v1/applications').send({ schemeCode: 'NSFDC-TL' });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('APPLICATION_EXISTS');
  });

  it('freezes profile / financing / eligibility snapshots on submit', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('snap@example.com');
    const { body } = await c.post('/api/v1/applications').send({ schemeCode: 'NSFDC-TL' }).expect(201);
    const appId = body.data.application.id;
    await c.post(`/api/v1/applications/${appId}/submit`).expect(200);

    // Mutate the profile AFTER submission.
    await c.put('/api/v1/profile').send({ annualIncomePaise: 99_00_00_000 }).expect(200);

    const after = await c.get(`/api/v1/applications/${appId}`).expect(200);
    expect(after.body.data.application.profileSnapshot.annualIncomePaise).toBe(RAVI_PROFILE.annualIncomePaise);
    expect(after.body.data.application.eligibilitySnapshot.status).toBe('eligible');
    expect(after.body.data.application.status).toBe('SUBMITTED');
  });

  it('rejects submitting an ineligible application', async () => {
    await installDemoReferenceData();
    // GENERAL category cannot use NSFDC-TL.
    const c = await citizenWithProfile('inelig@example.com', { ...RAVI_PROFILE, category: 'GENERAL' });
    const { body } = await c.post('/api/v1/applications').send({ schemeCode: 'NSFDC-TL' }).expect(201);
    const res = await c.post(`/api/v1/applications/${body.data.application.id}/submit`);
    expect(res.status).toBe(422);
  });

  it('rejects invalid transitions and unrestricted status mutation', async () => {
    const { citizen, appId } = await assignedApplication({ citizenEmail: 'trans@example.com' });
    // citizen cannot approve
    const approve = await citizen.post(`/api/v1/applications/${appId}/approve`);
    expect([403, 404]).toContain(approve.status); // route not exposed to citizen
    // citizen cannot resubmit from ASSIGNED
    const resubmit = await citizen.post(`/api/v1/applications/${appId}/resubmit`);
    expect(resubmit.status).toBe(409);
    expect(resubmit.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('runs the full review loop: assign → review → changes → resubmit → approve', async () => {
    const { citizen, adminClient, appId, partnerId } = await assignedApplication({ citizenEmail: 'loop@example.com' });
    const partner = await loggedIn({ email: 'ploop@example.com', role: 'PARTNER', partnerOrganizationId: partnerId });

    await partner.post(`/api/v1/partner/applications/${appId}/start-review`).expect(200);

    const noReason = await partner.post(`/api/v1/partner/applications/${appId}/request-changes`).send({});
    expect(noReason.status).toBe(422); // reason required

    await partner.post(`/api/v1/partner/applications/${appId}/request-changes`).send({ reason: 'Please attach the full project report.' }).expect(200);

    let detail = await citizen.get(`/api/v1/applications/${appId}`).expect(200);
    expect(detail.body.data.application.status).toBe('CHANGES_REQUESTED');
    expect(detail.body.data.application.lastReviewNote).toMatch(/project report/i);

    await citizen.post(`/api/v1/applications/${appId}/resubmit`).expect(200);
    detail = await citizen.get(`/api/v1/applications/${appId}`).expect(200);
    expect(detail.body.data.application.status).toBe('UNDER_REVIEW');

    const approved = await partner.post(`/api/v1/partner/applications/${appId}/approve`).expect(200);
    expect(approved.body.data.application.status).toBe('APPROVED');
    expect(approved.body.data.application.workflowNote).toMatch(/not a government sanction/i);

    // Terminal — no further transitions.
    const reReview = await partner.post(`/api/v1/partner/applications/${appId}/start-review`);
    expect(reReview.status).toBe(409);

    // audit trail exists
    const history = await adminClient.get(`/api/v1/admin/applications/${appId}/history`).expect(200);
    const actions = history.body.data.auditTrail.map((e: { action: string }) => e.action);
    expect(actions).toEqual(expect.arrayContaining(['application.submit', 'application.assign', 'application.approve']));
  });

  it('records actor, timestamps, previous and new state in the timeline', async () => {
    const { citizen, appId } = await assignedApplication({ citizenEmail: 'timeline@example.com' });
    const detail = await citizen.get(`/api/v1/applications/${appId}`).expect(200);
    const t = detail.body.data.application.timeline;
    const assign = t.find((x: { action: string }) => x.action === 'assign');
    expect(assign).toMatchObject({ fromStatus: 'SUBMITTED', toStatus: 'ASSIGNED', actorRole: 'ADMIN' });
    expect(assign.at).toBeTruthy();
  });
});
