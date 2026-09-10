import { describe, expect, it } from 'vitest';
import { useTestDb } from '../helpers/db';
import { loggedIn } from '../helpers/api';
import { installDemoReferenceData } from '../helpers/fixtures';
import { assignedApplication, citizenWithProfile, RAVI_PROFILE } from '../helpers/scenario';
import { Application } from '../../src/models/Application';

useTestDb();

describe('admin operations & analytics', () => {
  it('provisions PARTNER / ADMIN users (only admin-driven path to a non-citizen account)', async () => {
    await installDemoReferenceData();
    const admin = await loggedIn({ email: 'admin-prov@example.com', role: 'ADMIN' });
    const partners = await admin.get('/api/v1/admin/partners').expect(200);
    const orgId = partners.body.data[0].id;

    const created = await admin.post('/api/v1/admin/users').send({
      email: 'newpartner@example.com',
      password: 'PartnerPass!2026',
      displayName: 'New Partner Officer',
      role: 'PARTNER',
      partnerOrganizationId: orgId,
    });
    expect(created.status).toBe(201);
    expect(created.body.data.user.role).toBe('PARTNER');

    // PARTNER role without an org is rejected.
    const bad = await admin.post('/api/v1/admin/users').send({
      email: 'bad@example.com', password: 'PartnerPass!2026', displayName: 'x', role: 'PARTNER',
    });
    expect(bad.status).toBe(422);
  });

  it('creates and archives a scheme; archived schemes drop out of recommendations', async () => {
    await installDemoReferenceData();
    const admin = await loggedIn({ email: 'admin-sch@example.com', role: 'ADMIN' });
    const list = await admin.get('/api/v1/admin/schemes?pageSize=100').expect(200);
    const nsfdc = list.body.data.find((s: { code: string }) => s.code === 'NSFDC-TL');

    await admin.post(`/api/v1/admin/schemes/${nsfdc.id}/archive`).expect(200);

    const citizen = await citizenWithProfile('sch-citizen@example.com', RAVI_PROFILE);
    const rec = await citizen.get('/api/v1/recommendations').expect(200);
    const codes = [...rec.body.data.eligible, ...rec.body.data.ineligible, ...rec.body.data.needsInformation].map(
      (e: { scheme: { code: string } }) => e.scheme.code,
    );
    expect(codes).not.toContain('NSFDC-TL');
  });

  it('KPIs are derived from the database; drafts excluded from submitted totals', async () => {
    // Two submitted+assigned applications, plus one draft.
    await assignedApplication({ citizenEmail: 'kpi-a@example.com', adminEmail: 'admin-kpi-a@example.com' });
    await assignedApplication({ citizenEmail: 'kpi-b@example.com', adminEmail: 'admin-kpi-b@example.com' });

    const draftCitizen = await citizenWithProfile('kpi-draft@example.com', RAVI_PROFILE);
    await draftCitizen.post('/api/v1/applications').send({ schemeCode: 'PMMY-KISHOR' }).expect(201);

    const admin = await loggedIn({ email: 'admin-kpi2@example.com', role: 'ADMIN' });
    const kpi = await admin.get('/api/v1/admin/kpis').expect(200);
    const d = kpi.body.data;

    const dbTotal = await Application.countDocuments({});
    const dbSubmitted = await Application.countDocuments({ status: { $ne: 'DRAFT' } });
    expect(d.applications.total).toBe(dbTotal);
    expect(d.applications.submitted).toBe(dbSubmitted);
    expect(d.applications.drafts).toBe(1);
    expect(d.applications.submitted).toBe(2);
    expect(d.dataClassification).toBe('derived-from-database');

    // Requested funding = SUM of requested loan amounts, not scheme ceilings.
    const expectedFunding = (
      await Application.aggregate<{ t: number }>([
        { $match: { status: { $ne: 'DRAFT' } } },
        { $group: { _id: null, t: { $sum: { $ifNull: ['$financingSnapshot.requestedLoanPaise', '$financing.requestedLoanPaise'] } } } },
      ])
    )[0]?.t;
    expect(d.funding.requestedTotalPaise).toBe(expectedFunding);
  });

  it('exposes the audit log to admins only', async () => {
    await installDemoReferenceData();
    const admin = await loggedIn({ email: 'admin-audit@example.com', role: 'ADMIN' });
    const audit = await admin.get('/api/v1/admin/audit').expect(200);
    expect(Array.isArray(audit.body.data)).toBe(true);

    const citizen = await citizenWithProfile('audit-c@example.com');
    expect((await citizen.get('/api/v1/admin/audit')).status).toBe(403);
  });
});
