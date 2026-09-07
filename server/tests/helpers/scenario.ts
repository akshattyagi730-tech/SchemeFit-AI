import { Client, makeClient } from './api';
import { installDemoReferenceData } from './fixtures';

const L = (rupees: number) => rupees * 100;

export const RAVI_PROFILE = {
  age: 30,
  annualIncomePaise: L(240_000),
  category: 'SC' as const,
  state: 'Bihar',
  district: 'Sitamarhi',
  areaType: 'rural' as const,
  location: { lat: 26.59, lng: 85.49 },
  purpose: 'business_expansion' as const,
  hasBusinessPlan: true,
  projectCostPaise: L(600_000),
  ownContributionPaise: L(60_000),
  requestedLoanPaise: L(400_000),
};

/** A logged-in citizen with a complete, NSFDC-eligible profile. */
export async function citizenWithProfile(email: string, profile: Record<string, unknown> = RAVI_PROFILE) {
  const c = new Client();
  await c.registerCitizen(email);
  await c.put('/api/v1/profile').send(profile).expect(200);
  return c;
}

/** Full pipeline: citizen submits an NSFDC-TL application, admin assigns Bihar SCA. */
export async function assignedApplication(opts?: { citizenEmail?: string; adminEmail?: string }) {
  await installDemoReferenceData();

  const citizen = await citizenWithProfile(opts?.citizenEmail ?? 'ravi@example.com');
  const createRes = await citizen.post('/api/v1/applications').send({ schemeCode: 'NSFDC-TL' }).expect(201);
  const appId: string = createRes.body.data.application.id;

  await citizen.patch(`/api/v1/applications/${appId}/financing`).send({
    interestRateBps: 700,
    tenureMonths: 60,
    moratoriumMonths: 6,
  }).expect(200);
  await citizen.post(`/api/v1/applications/${appId}/submit`).expect(200);

  const { adminClient } = await adminLogin(opts?.adminEmail ?? 'admin@example.com');
  const assignRes = await adminClient.post(`/api/v1/admin/applications/${appId}/assign`).send({}).expect(200);
  const partnerId: string = assignRes.body.data.application.assignedPartnerId;

  return { citizen, adminClient, appId, partnerId };
}

export async function adminLogin(email = 'admin@example.com') {
  const { loggedIn } = await import('./api');
  const adminClient = await loggedIn({ email, role: 'ADMIN' });
  return { adminClient };
}

export async function partnerLoginForOrg(email: string, partnerOrganizationId: string): Promise<Client> {
  const { loggedIn } = await import('./api');
  return loggedIn({ email, role: 'PARTNER', partnerOrganizationId });
}

export { makeClient };
