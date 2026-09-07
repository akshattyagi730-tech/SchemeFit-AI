import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { useTestDb } from '../helpers/db';
import { app, Client, makeClient } from '../helpers/api';
import { User } from '../../src/models/User';
import { CitizenProfile } from '../../src/models/CitizenProfile';

useTestDb();

describe('auth', () => {
  it('registers a citizen, creates a profile, and starts a session', async () => {
    const c = new Client();
    const res = await c.registerCitizen('alice@example.com');
    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('CITIZEN');

    const me = await c.get('/api/v1/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.data.user.email).toBe('alice@example.com');

    expect(await CitizenProfile.countDocuments({})).toBe(1);
  });

  it('never lets the client choose its role at registration', async () => {
    const c = await makeClient();
    const res = await c.post('/api/v1/auth/register').send({
      email: 'sneaky@example.com',
      password: 'Password!2026',
      fullName: 'Sneaky',
      role: 'ADMIN',
      partnerOrganizationId: '000000000000000000000000',
    });
    expect(res.status).toBe(201);
    const user = await User.findOne({ email: 'sneaky@example.com' });
    expect(user?.role).toBe('CITIZEN');
    expect(user?.partnerOrganizationId).toBeNull();
  });

  it('rejects mutating requests without a CSRF token', async () => {
    const res = await supertest(app)
      .post('/api/v1/auth/register')
      .send({ email: 'x@example.com', password: 'Password!2026', fullName: 'X' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns a generic error for both unknown email and wrong password', async () => {
    await (await makeClient()).registerCitizen('real@example.com', 'CorrectHorse!2026');

    const c1 = await makeClient();
    const wrongPw = await c1.post('/api/v1/auth/login').send({ email: 'real@example.com', password: 'nope-wrong-1' });
    const c2 = await makeClient();
    const unknown = await c2.post('/api/v1/auth/login').send({ email: 'ghost@example.com', password: 'nope-wrong-1' });

    expect(wrongPw.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrongPw.body.error.message).toBe(unknown.body.error.message);
    expect(wrongPw.body.error.message).toBe('Invalid email or password');
  });

  it('rate-limits repeated failed logins for the same identity', async () => {
    await (await makeClient()).registerCitizen('victim@example.com', 'CorrectHorse!2026');
    const c = await makeClient();
    let sawLimit = false;
    for (let i = 0; i < 8; i += 1) {
      const r = await c.post('/api/v1/auth/login').send({ email: 'victim@example.com', password: `bad-${i}` });
      if (r.status === 429) sawLimit = true;
    }
    expect(sawLimit).toBe(true);
  });

  it('logout revokes the session', async () => {
    const c = new Client();
    await c.registerCitizen('bob@example.com');
    await c.post('/api/v1/auth/logout');
    const me = await c.get('/api/v1/auth/me');
    expect(me.status).toBe(401);
  });

  it('requires authentication for protected routes', async () => {
    const c = await makeClient();
    const res = await c.get('/api/v1/profile');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
