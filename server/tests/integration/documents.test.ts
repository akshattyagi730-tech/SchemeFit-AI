import { describe, expect, it } from 'vitest';
import { useTestDb } from '../helpers/db';
import { loggedIn } from '../helpers/api';
import { assignedApplication } from '../helpers/scenario';
import { tinyPdf, tinyPng } from '../../src/seed/documents';

useTestDb();

async function setup(email: string) {
  const s = await assignedApplication({ citizenEmail: email });
  const partner = await loggedIn({ email: `p-${email}`, role: 'PARTNER', partnerOrganizationId: s.partnerId });
  return { ...s, partner };
}

describe('documents: upload, signature validation, review, readiness', () => {
  it('accepts a valid PDF and leaves it UNVERIFIED (upload never implies verification)', async () => {
    const { citizen, appId } = await setup('doc1@example.com');
    const res = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'project_report')
      .attach('file', tinyPdf('project report'), 'report.pdf');
    expect(res.status).toBe(201);
    expect(res.body.data.document.reviewStatus).toBe('uploaded');
    expect(res.body.data.readiness.requiredVerified).toBe(0);
  });

  it('rejects a file whose bytes do not match an allow-listed type', async () => {
    const { citizen, appId } = await setup('doc2@example.com');
    const bogus = Buffer.from('this is not a pdf at all');
    const res = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'project_report')
      .attach('file', bogus, 'evil.pdf');
    expect(res.status).toBe(422);
    expect(res.body.error.message).toMatch(/not a recognised PDF, JPEG or PNG/i);
  });

  it('rejects a MIME/extension mismatch (PNG bytes claimed as PDF)', async () => {
    const { citizen, appId } = await setup('doc3@example.com');
    const res = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'identity_proof')
      .attach('file', tinyPng, { filename: 'id.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(422);
  });

  it('rejects an unknown document type for the scheme', async () => {
    const { citizen, appId } = await setup('doc4@example.com');
    const res = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'not_a_real_type')
      .attach('file', tinyPdf('x'), 'x.pdf');
    expect(res.status).toBe(422);
  });

  it('replacement creates a new version and resets the current review', async () => {
    const { citizen, appId, partner } = await setup('doc5@example.com');
    const up1 = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'income_certificate')
      .attach('file', tinyPdf('income v1'), 'income.pdf')
      .expect(201);
    const docId1 = up1.body.data.document.id;

    await partner.post(`/api/v1/documents/${docId1}/review`).send({ decision: 'verified' }).expect(200);

    // Applicant replaces the document.
    const up2 = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'income_certificate')
      .attach('file', tinyPdf('income v2'), 'income.pdf')
      .expect(201);
    expect(up2.body.data.document.version).toBe(2);
    expect(up2.body.data.document.reviewStatus).toBe('uploaded');
    // readiness no longer counts the (now superseded) verified version
    expect(up2.body.data.readiness.lines.find((l: { type: string }) => l.type === 'income_certificate').state).toBe('uploaded');

    const list = await citizen.get(`/api/v1/applications/${appId}/documents?history=true`).expect(200);
    const v1 = list.body.data.documents.find((d: { id: string }) => d.id === docId1);
    expect(v1.current).toBe(false);
  });

  it('partner feedback on a document reaches the citizen with a notification', async () => {
    const { citizen, appId, partner } = await setup('doc6@example.com');
    const up = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'bank_statement')
      .attach('file', tinyPdf('bank'), 'bank.pdf')
      .expect(201);
    const docId = up.body.data.document.id;

    const noFeedback = await partner.post(`/api/v1/documents/${docId}/review`).send({ decision: 'changes_requested' });
    expect(noFeedback.status).toBe(422);

    await partner
      .post(`/api/v1/documents/${docId}/review`)
      .send({ decision: 'changes_requested', feedback: 'Only 2 months provided; upload the full 6-month statement.' })
      .expect(200);

    const docs = await citizen.get(`/api/v1/applications/${appId}/documents`).expect(200);
    const doc = docs.body.data.documents.find((d: { id: string }) => d.id === docId);
    expect(doc.reviewStatus).toBe('changes_requested');
    expect(doc.reviewFeedback).toMatch(/full 6-month statement/i);

    const notifs = await citizen.get('/api/v1/notifications').expect(200);
    const n = notifs.body.data.notifications.find((x: { event: string }) => x.event === 'document_changes_requested');
    expect(n).toBeTruthy();
    expect(n.message).toMatch(/6-month statement/i);
  });

  it('a citizen cannot review their own document', async () => {
    const { citizen, appId } = await setup('doc7@example.com');
    const up = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'identity_proof')
      .attach('file', tinyPng, { filename: 'id.png', contentType: 'image/png' })
      .expect(201);
    const res = await citizen.post(`/api/v1/documents/${up.body.data.document.id}/review`).send({ decision: 'verified' });
    expect(res.status).toBe(403);
  });

  it('downloads are authenticated + authorised and never public', async () => {
    const { citizen, appId, partner } = await setup('doc8@example.com');
    const up = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'identity_proof')
      .attach('file', tinyPng, { filename: 'id.png', contentType: 'image/png' })
      .expect(201);
    const docId = up.body.data.document.id;

    const asOwner = await citizen.get(`/api/v1/documents/${docId}/download`);
    expect(asOwner.status).toBe(200);
    expect(asOwner.headers['content-disposition']).toMatch(/attachment/);
    expect(asOwner.headers['cache-control']).toMatch(/no-store/);

    const asPartner = await partner.get(`/api/v1/documents/${docId}/download`);
    expect(asPartner.status).toBe(200);

    // A different citizen is forbidden.
    const { citizenWithProfile } = await import('../helpers/scenario');
    const other = await citizenWithProfile('doc8-other@example.com');
    const forbidden = await other.get(`/api/v1/documents/${docId}/download`);
    expect(forbidden.status).toBe(403);
  });
});
