import { describe, expect, it } from 'vitest';
import { verifyPdfSignature, isAutoVerifiable } from '../../src/modules/documents/pdf-signature';
import { MINIMAL_PDF, makeDigiLockerPdf, makeSelfSignedPdf, makeSignedPdf } from '../helpers/signed-pdf';

describe('verifyPdfSignature', () => {
  it('reports an unsigned PDF as unsigned (never rejects it)', () => {
    const r = verifyPdfSignature(MINIMAL_PDF);
    expect(r.signed).toBe(false);
    expect(r.trustLevel).toBe('unsigned');
    expect(isAutoVerifiable(r)).toBe(false);
  });

  it('treats a non-PDF buffer as unsigned', () => {
    const r = verifyPdfSignature(Buffer.from([0xff, 0xd8, 0xff, 0x00]));
    expect(r.trustLevel).toBe('unsigned');
  });

  it('verifies a DigiLocker-style issuer signature and marks it auto-verifiable', async () => {
    const pdf = await makeDigiLockerPdf();
    const r = verifyPdfSignature(pdf);
    expect(r.signed).toBe(true);
    expect(r.integrityValid).toBe(true);
    expect(r.coversWholeDocument).toBe(true);
    expect(r.trustLevel).toBe('issuer_verified');
    expect(r.authority).toBe('DigiLocker');
    expect(isAutoVerifiable(r)).toBe(true);
  });

  it('recognises a licensed CA as e-signed but not auto-verifiable', async () => {
    const pdf = await makeSignedPdf({ subjectCN: 'Ravi Kumar', issuerCN: 'eMudhra Sub CA', issuerO: 'eMudhra Limited' });
    const r = verifyPdfSignature(pdf);
    expect(r.integrityValid).toBe(true);
    expect(r.trustLevel).toBe('e_signed');
    expect(isAutoVerifiable(r)).toBe(false);
  });

  it('flags a self-signed certificate', async () => {
    const pdf = await makeSelfSignedPdf();
    const r = verifyPdfSignature(pdf);
    expect(r.signed).toBe(true);
    expect(r.integrityValid).toBe(true);
    expect(r.trustLevel).toBe('self_signed');
  });

  it('detects tampering after signing', async () => {
    const pdf = await makeDigiLockerPdf();
    // Flip a byte inside the first ByteRange segment (the signed content).
    const tampered = Buffer.from(pdf);
    tampered[20] = (tampered[20] ?? 0) ^ 0xff;
    const r = verifyPdfSignature(tampered);
    expect(r.signed).toBe(true);
    expect(r.integrityValid).toBe(false);
    expect(r.trustLevel).toBe('invalid');
  });
});
