import { describe, expect, it } from 'vitest';
import { useTestDb } from '../helpers/db';
import { loggedIn } from '../helpers/api';
import { installDemoReferenceData } from '../helpers/fixtures';
import { citizenWithProfile, assignedApplication, RAVI_PROFILE } from '../helpers/scenario';
import { PartnerOrganization } from '../../src/models/PartnerOrganization';

useTestDb();

describe('object-level authorization', () => {
  it('Citizen A cannot read Citizen B’s application or documents', async () => {
    const { appId } = await assignedApplication({ citizenEmail: 'a@example.com' });

    const b = await citizenWithProfile('b@example.com');
    const read = await b.get(`/api/v1/applications/${appId}`);
    expect(read.status).toBe(403);

    const docs = await b.get(`/api/v1/applications/${appId}/documents`);
    expect(docs.status).toBe(403);
  });

  it('Citizen B cannot see Citizen A’s application in their own list', async () => {
    await assignedApplication({ citizenEmail: 'a2@example.com' });
    const b = await citizenWithProfile('b2@example.com');
    const list = await b.get('/api/v1/applications');
    expect(list.status).toBe(200);
    expect(list.body.data).toHaveLength(0);
  });

  it('Partner A cannot review an application assigned to Partner B', async () => {
    const { appId, partnerId } = await assignedApplication({ citizenEmail: 'a3@example.com' });

    // Another, unrelated partner org + user.
    const otherOrg = await PartnerOrganization.create({
      name: 'Unrelated Partner',
      type: 'nbfc',
      serviceAreas: { national: true, states: [], districts: [] },
      location: { lat: 28, lng: 77, address: '' },
      supportedSchemeCodes: ['NSFDC-TL'],
      authorization: 'authorized',
      status: 'active',
      acceptingApplications: true,
      capacity: 10,
      activeAssignments: 0,
    });
    expect(String(otherOrg._id)).not.toBe(partnerId);

    const partnerA = await loggedIn({ email: 'partnerA@example.com', role: 'PARTNER', partnerOrganizationId: String(otherOrg._id) });
    const view = await partnerA.get(`/api/v1/partner/applications/${appId}`);
    expect(view.status).toBe(403);

    const act = await partnerA.post(`/api/v1/partner/applications/${appId}/start-review`);
    expect(act.status).toBe(403);
  });

  it('the assigned partner CAN view and act on their application', async () => {
    const { appId, partnerId } = await assignedApplication({ citizenEmail: 'a4@example.com' });
    const partner = await loggedIn({ email: 'assigned@example.com', role: 'PARTNER', partnerOrganizationId: partnerId });
    const view = await partner.get(`/api/v1/partner/applications/${appId}`);
    expect(view.status).toBe(200);
    const review = await partner.post(`/api/v1/partner/applications/${appId}/start-review`);
    expect(review.status).toBe(200);
    expect(review.body.data.application.status).toBe('UNDER_REVIEW');
  });

  it('a citizen cannot reach partner or admin endpoints (role from session, not request)', async () => {
    await installDemoReferenceData();
    const citizen = await citizenWithProfile('plain@example.com', RAVI_PROFILE);
    expect((await citizen.get('/api/v1/partner/summary')).status).toBe(403);
    expect((await citizen.get('/api/v1/admin/kpis')).status).toBe(403);
    expect((await citizen.post('/api/v1/admin/schemes').send({})).status).toBe(403);
  });

  it('workspace selection cannot elevate a citizen — there is no such endpoint and role stays CITIZEN', async () => {
    const citizen = await citizenWithProfile('c-noelev@example.com');
    const me = await citizen.get('/api/v1/auth/me');
    expect(me.body.data.user.role).toBe('CITIZEN');
    // Even posting a role field to profile update is rejected (strict schema).
    const res = await citizen.put('/api/v1/profile').send({ role: 'ADMIN' });
    expect(res.status).toBe(422);
  });
});
