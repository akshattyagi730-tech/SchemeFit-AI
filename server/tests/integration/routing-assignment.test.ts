import { describe, expect, it } from 'vitest';
import { useTestDb } from '../helpers/db';
import { loggedIn } from '../helpers/api';
import { installDemoReferenceData } from '../helpers/fixtures';
import { citizenWithProfile, RAVI_PROFILE } from '../helpers/scenario';
import { Application } from '../../src/models/Application';
import { PartnerOrganization } from '../../src/models/PartnerOrganization';
import { PartnerAssignment } from '../../src/models/PartnerAssignment';
import { attachAssignment } from '../../src/modules/partners/partners.service';

useTestDb();

async function submittedApp(email: string, schemeCode = 'NSFDC-TL', profile = RAVI_PROFILE) {
  const c = await citizenWithProfile(email, profile);
  const { body } = await c.post('/api/v1/applications').send({ schemeCode }).expect(201);
  await c.post(`/api/v1/applications/${body.data.application.id}/submit`).expect(200);
  return { c, appId: body.data.application.id as string };
}

describe('routing & assignment', () => {
  it('routing preview excludes unauthorised and unsupported partners', async () => {
    await installDemoReferenceData();
    const c = await citizenWithProfile('route1@example.com');
    const res = await c.get('/api/v1/partners/routing?schemeCode=NSFDC-TL').expect(200);
    const { routing } = res.body.data;
    expect(routing.matched).toBe(true);
    expect(routing.candidates.map((x: { name: string }) => x.name)).toEqual(['Bihar SCA (demo)']);
    const excludedNames = routing.excluded.map((e: { name: string }) => e.name);
    expect(excludedNames).toContain('Pending NBFC (demo, not yet authorised)');
  });

  it('assigns to the top routing match and increments partner load', async () => {
    await installDemoReferenceData();
    const { appId } = await submittedApp('route2@example.com');
    const admin = await loggedIn({ email: 'admin-r2@example.com', role: 'ADMIN' });
    const res = await admin.post(`/api/v1/admin/applications/${appId}/assign`).send({}).expect(200);
    const partnerId = res.body.data.application.assignedPartnerId;

    const org = await PartnerOrganization.findById(partnerId);
    expect(org?.name).toBe('Bihar SCA (demo)');
    expect(org?.activeAssignments).toBe(1);
  });

  it('returns a clear no-match + supports manual assignment when nobody qualifies', async () => {
    await installDemoReferenceData();
    // Suspend every partner so routing fails.
    await PartnerOrganization.updateMany({}, { $set: { authorization: 'revoked' } });

    const { appId } = await submittedApp('route3@example.com');
    const admin = await loggedIn({ email: 'admin-r3@example.com', role: 'ADMIN' });
    const auto = await admin.post(`/api/v1/admin/applications/${appId}/assign`).send({});
    expect(auto.status).toBe(409);
    expect(auto.body.error.code).toBe('NO_PARTNER_MATCH');

    // Admin re-authorises one and assigns manually.
    const org = await PartnerOrganization.findOne({ name: 'Bihar SCA (demo)' });
    await admin.patch(`/api/v1/admin/partners/${org!._id}`).send({ authorization: 'authorized' }).expect(200);
    const manual = await admin.post(`/api/v1/admin/applications/${appId}/assign`).send({ partnerId: String(org!._id), reason: 'manual review' }).expect(200);
    expect(manual.body.data.application.assignedPartnerId).toBe(String(org!._id));
  });

  it('reassignment requires a reason, moves load, and keeps assignment history', async () => {
    await installDemoReferenceData();
    const { appId } = await submittedApp('route4@example.com');
    const admin = await loggedIn({ email: 'admin-r4@example.com', role: 'ADMIN' });
    await admin.post(`/api/v1/admin/applications/${appId}/assign`).send({}).expect(200);

    const bankA = await PartnerOrganization.findOne({ name: 'Bank A — Public Sector (demo)' });
    await admin.patch(`/api/v1/admin/partners/${bankA!._id}`).send({ supportedSchemeCodes: ['NSFDC-TL', 'PMMY-KISHOR', 'MICRO-CREDIT', 'EDU-SKILL'], serviceAreas: { national: true, states: [], districts: [] } }).expect(200);

    const noReason = await admin.post(`/api/v1/admin/applications/${appId}/reassign`).send({ partnerId: String(bankA!._id) });
    expect(noReason.status).toBe(422);

    await admin.post(`/api/v1/admin/applications/${appId}/reassign`).send({ partnerId: String(bankA!._id), reason: 'Load balancing' }).expect(200);

    const assignments = await PartnerAssignment.find({ applicationId: appId }).sort({ createdAt: 1 });
    expect(assignments).toHaveLength(2);
    expect(assignments[0]!.active).toBe(false);
    expect(assignments[1]!.active).toBe(true);
    expect(assignments[1]!.reason).toBe('Load balancing');

    const bihar = await PartnerOrganization.findOne({ name: 'Bihar SCA (demo)' });
    expect(bihar!.activeAssignments).toBe(0);
    expect((await PartnerOrganization.findById(bankA!._id))!.activeAssignments).toBe(1);
  });

  it('prevents a second active assignment and never over-allocates capacity under concurrency', async () => {
    await installDemoReferenceData();
    const org = await PartnerOrganization.findOne({ name: 'Bihar SCA (demo)' });
    await PartnerOrganization.updateOne({ _id: org!._id }, { $set: { capacity: 3, activeAssignments: 0 } });

    // 6 distinct submitted applications competing for 3 slots.
    const apps = await Promise.all(
      Array.from({ length: 6 }, (_, i) => submittedApp(`conc${i}@example.com`).then((r) => r.appId)),
    );
    const appDocs = await Application.find({ _id: { $in: apps } });

    const results = await Promise.allSettled(
      appDocs.map((app) =>
        attachAssignment({
          application: app,
          partnerId: String(org!._id),
          assignedByUserId: String(app.ownerUserId),
          assignmentType: 'manual',
        }).then(() => app.save()),
      ),
    );

    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const fresh = await PartnerOrganization.findById(org!._id);
    expect(fresh!.activeAssignments).toBeLessThanOrEqual(3);
    expect(ok).toBe(fresh!.activeAssignments);
    expect(ok).toBeGreaterThan(0);

    // No application has more than one active assignment.
    const active = await PartnerAssignment.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$applicationId', n: { $sum: 1 } } },
      { $match: { n: { $gt: 1 } } },
    ]);
    expect(active).toHaveLength(0);
  });
});
