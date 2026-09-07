import supertest from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import { hashPassword } from '../../src/lib/password';
import { User } from '../../src/models/User';
import { CitizenProfile } from '../../src/models/CitizenProfile';
import { PartnerOrganization } from '../../src/models/PartnerOrganization';

export const app: Express = createApp();

/**
 * A cookie-persisting client that fetches a CSRF token and attaches it to every
 * mutating request — i.e. a realistic browser session.
 */
export class Client {
  readonly agent: supertest.Agent;
  private csrf = '';

  constructor() {
    this.agent = supertest.agent(app);
  }

  async init(): Promise<this> {
    const res = await this.agent.get('/api/v1/auth/csrf');
    this.csrf = res.body.data.csrfToken;
    return this;
  }

  get(url: string) {
    return this.agent.get(url);
  }
  post(url: string) {
    return this.agent.post(url).set('x-csrf-token', this.csrf);
  }
  patch(url: string) {
    return this.agent.patch(url).set('x-csrf-token', this.csrf);
  }
  put(url: string) {
    return this.agent.put(url).set('x-csrf-token', this.csrf);
  }
  del(url: string) {
    return this.agent.delete(url).set('x-csrf-token', this.csrf);
  }

  async registerCitizen(email: string, password = 'CitizenPass!2026', fullName = 'Test Citizen') {
    await this.init();
    const res = await this.post('/api/v1/auth/register').send({ email, password, fullName });
    return res;
  }

  async login(email: string, password: string) {
    await this.init();
    return this.post('/api/v1/auth/login').send({ email, password });
  }
}

export async function makeClient(): Promise<Client> {
  return new Client().init();
}

/** Create a user directly (bypassing self-registration) for PARTNER/ADMIN. */
export async function createUser(opts: {
  email: string;
  password?: string;
  role: 'CITIZEN' | 'PARTNER' | 'ADMIN';
  displayName?: string;
  partnerOrganizationId?: string;
}) {
  const user = await User.create({
    email: opts.email,
    passwordHash: await hashPassword(opts.password ?? 'Password!2026'),
    role: opts.role,
    displayName: opts.displayName ?? opts.email,
    partnerOrganizationId: opts.partnerOrganizationId ?? null,
  });
  if (opts.role === 'CITIZEN') {
    await CitizenProfile.create({ userId: user._id, fullName: opts.displayName ?? 'Test Citizen' });
  }
  return user;
}

export async function loggedIn(opts: {
  email: string;
  password?: string;
  role: 'CITIZEN' | 'PARTNER' | 'ADMIN';
  partnerOrganizationId?: string;
}): Promise<Client> {
  const password = opts.password ?? 'Password!2026';
  await createUser({ ...opts, password });
  const c = new Client();
  await c.login(opts.email, password);
  return c;
}

export async function makePartnerOrg(overrides: Record<string, unknown> = {}) {
  return PartnerOrganization.create({
    name: `Partner ${Math.random().toString(36).slice(2, 8)}`,
    type: 'public_sector_bank',
    serviceAreas: { national: true, states: [], districts: [] },
    location: { lat: 28.6, lng: 77.4, address: 'Test' },
    supportedSchemeCodes: [],
    focusSchemeCodes: [],
    authorization: 'authorized',
    status: 'active',
    acceptingApplications: true,
    capacity: 25,
    activeAssignments: 0,
    operationalMetricsSimulated: true,
    metricsAsOf: new Date(),
    ...overrides,
  });
}
