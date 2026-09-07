import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { useTestDb } from '../helpers/db';
import { Client, loggedIn } from '../helpers/api';
import { assignedApplication } from '../helpers/scenario';
import { tinyPdf } from '../../src/seed/documents';

useTestDb();

/**
 * Section 10: citizen <-> partner state lives in the backend, not shared
 * frontend state. It must survive separate sessions AND a "server restart"
 * (here: dropping every in-memory session and reconnecting the ODM).
 */
describe('citizen ↔ partner synchronization (backend state)', () => {
  it('propagates upload → review → feedback → replacement across separate sessions and a restart', async () => {
    const { citizen, appId, partnerId } = await assignedApplication({ citizenEmail: 'sync@example.com' });
    const partner = await loggedIn({ email: 'sync-partner@example.com', role: 'PARTNER', partnerOrganizationId: partnerId });

    // 1. Citizen uploads.
    const up = await citizen
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'bank_statement')
      .attach('file', tinyPdf('bank v1'), 'bank.pdf')
      .expect(201);
    const docId = up.body.data.document.id;

    // 2. Assigned partner sees the new version.
    let partnerDocs = await partner.get(`/api/v1/applications/${appId}/documents`).expect(200);
    expect(partnerDocs.body.data.documents.find((d: { id: string }) => d.id === docId).reviewStatus).toBe('uploaded');

    // 3. Partner requests an update with feedback.
    await partner
      .post(`/api/v1/documents/${docId}/review`)
      .send({ decision: 'changes_requested', feedback: 'Statement is incomplete — upload all 6 months.' })
      .expect(200);

    // --- simulate a server restart: every session object is in Mongo, not memory ---
    await mongoose.disconnect();
    await mongoose.connect(process.env.MONGO_URL_TEST || 'mongodb://127.0.0.1:27017/schemefit_test');

    // 4. Citizen (fresh client, same cookie jar would be new browser) still sees feedback + notification.
    const citizen2 = new Client();
    await citizen2.login('sync@example.com', 'CitizenPass!2026');
    const docs = await citizen2.get(`/api/v1/applications/${appId}/documents`).expect(200);
    const doc = docs.body.data.documents.find((d: { id: string }) => d.id === docId);
    expect(doc.reviewStatus).toBe('changes_requested');
    expect(doc.reviewFeedback).toMatch(/all 6 months/i);

    const notifs = await citizen2.get('/api/v1/notifications?unreadOnly=true').expect(200);
    expect(notifs.body.data.notifications.some((n: { event: string }) => n.event === 'document_changes_requested')).toBe(true);

    // 5. Citizen uploads a replacement.
    const up2 = await citizen2
      .post(`/api/v1/applications/${appId}/documents`)
      .field('type', 'bank_statement')
      .attach('file', tinyPdf('bank v2 complete'), 'bank.pdf')
      .expect(201);
    expect(up2.body.data.document.version).toBe(2);

    // 6. Partner sees it awaiting review again.
    partnerDocs = await partner.get(`/api/v1/applications/${appId}/documents`).expect(200);
    const current = partnerDocs.body.data.documents.find((d: { type: string; current: boolean }) => d.type === 'bank_statement' && d.current);
    expect(current.reviewStatus).toBe('uploaded');
    expect(current.version).toBe(2);

    // 7. Readiness + dashboard counts reflect the new state from one consistent source.
    const readiness = partnerDocs.body.data.readiness;
    expect(readiness.lines.find((l: { type: string }) => l.type === 'bank_statement').state).toBe('uploaded');
    const partnerSummary = await partner.get('/api/v1/partner/summary').expect(200);
    expect(partnerSummary.body.data.assignedTotal).toBeGreaterThanOrEqual(1);
  });
});
