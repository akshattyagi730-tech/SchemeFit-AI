import { describe, expect, it } from 'vitest';
import supertest from 'supertest';
import { app } from '../helpers/api';

/**
 * The test env sets CLIENT_ORIGIN=http://localhost:5173 (see helpers/setup.ts).
 * These assert the exact-origin allow-list behaviour used in production.
 */
describe('CORS exact-origin allow-list', () => {
  it('reflects the configured origin with credentials', async () => {
    const res = await supertest(app).get('/api/v1/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('omits CORS headers for a disallowed origin (no 500, no stack trace)', async () => {
    const res = await supertest(app).get('/api/v1/health').set('Origin', 'https://evil.example.com');
    expect(res.status).toBe(200); // request still served; browser blocks it client-side
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('serves same-origin / no-Origin requests normally', async () => {
    const res = await supertest(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });
});
