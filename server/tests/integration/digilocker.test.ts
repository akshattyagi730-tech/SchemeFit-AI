import { describe, expect, it } from 'vitest';
import { useTestDb } from '../helpers/db';
import { assignedApplication } from '../helpers/scenario';
import { tinyPdf } from '../../src/seed/documents';
import { makeDigiLockerPdf } from '../helpers/signed-pdf';

useTestDb();

/** Walk the mock DigiLocker OAuth flow and return the connected citizen client. */
async function connectDigiLocker(citizen: Awaited<ReturnType<typeof assignedApplication>>['citizen']) {
  const start = await citizen.post('/api/v1/digilocker/connect').expect(200);
  const authorizeUrl: string = start.body.data.authorizeUrl;
  const url = new URL(authorizeUrl);
  const path = url.pathname + url.search;
  const cb = await citizen.get(path);
  expect(cb.status).toBe(302);
  expect(cb.headers.location).toMatch(/digilocker=connected/);
}

describe('document authenticity: PDF signatures + DigiLocker', () => {
  it('a plain PDF upload is accepted but flagged unsigned (still needs a reviewer)', async () => {
    const { citizen, appId } = await assignedApplication({ citizenEmail: 'dl1@example.com' });
    const res = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'project_report')
      .attach('file', tinyPdf('plain report'), 'report.pdf')
      .expect(201);
    expect(res.body.data.document.reviewStatus).toBe('uploaded');
    expect(res.body.data.document.authenticity.trustLevel).toBe('unsigned');
    expect(res.body.data.document.authenticity.systemVerified).toBe(false);
  });

  it('an issuer-signed PDF upload is verified automatically', async () => {
    const { citizen, appId } = await assignedApplication({ citizenEmail: 'dl2@example.com' });
    const signed = await makeDigiLockerPdf();
    const res = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'identity_proof')
      .attach('file', signed, 'aadhaar.pdf')
      .expect(201);
    const doc = res.body.data.document;
    expect(doc.authenticity.trustLevel).toBe('issuer_verified');
    expect(doc.authenticity.systemVerified).toBe(true);
    expect(doc.reviewStatus).toBe('verified');
    expect(res.body.data.readiness.requiredVerified).toBeGreaterThan(0);
  });

  it('connects DigiLocker (mock) and imports an issued document as verified', async () => {
    const { citizen, appId } = await assignedApplication({ citizenEmail: 'dl3@example.com' });

    const before = await citizen.get('/api/v1/digilocker/status').expect(200);
    expect(before.body.data.connected).toBe(false);
    expect(before.body.data.provider).toBe('mock');

    await connectDigiLocker(citizen);

    const status = await citizen.get('/api/v1/digilocker/status').expect(200);
    expect(status.body.data.connected).toBe(true);

    const issued = await citizen.get('/api/v1/digilocker/issued').expect(200);
    const aadhaar = issued.body.data.documents.find((d: { mapsTo: string }) => d.mapsTo === 'identity_proof');
    expect(aadhaar).toBeTruthy();

    const imported = await citizen
      .post('/api/v1/digilocker/import')
      .send({ applicationId: appId, uri: aadhaar.uri, docType: 'identity_proof' })
      .expect(201);
    const doc = imported.body.data.document;
    expect(doc.source).toBe('digilocker');
    expect(doc.reviewStatus).toBe('verified');
    expect(doc.authenticity.trustLevel).toBe('issuer_verified');
    expect(doc.issuedBy).toMatch(/UIDAI/i);
  });

  it('import requires an active DigiLocker connection', async () => {
    const { citizen, appId } = await assignedApplication({ citizenEmail: 'dl4@example.com' });
    const res = await citizen
      .post('/api/v1/digilocker/import')
      .send({ applicationId: appId, uri: 'in.gov.uidai-ADHAR-demo0001', docType: 'identity_proof' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/not connected/i);
  });

  it('rejects a callback whose state does not match', async () => {
    const { citizen } = await assignedApplication({ citizenEmail: 'dl5@example.com' });
    await citizen.post('/api/v1/digilocker/connect').expect(200);
    const cb = await citizen.get('/api/v1/digilocker/callback?code=mock-auth-code&state=forged');
    expect(cb.status).toBe(302);
    expect(cb.headers.location).toMatch(/digilocker=error/);
  });
});
