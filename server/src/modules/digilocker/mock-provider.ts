import { randomToken } from '../../lib/ids';
import { buildSamplePdf } from './sample-pdf';
import type { DigiLockerProvider, DigiLockerSession, IssuedDocument } from './provider';

/**
 * Local mock of DigiLocker. It authorises instantly (the "authorize" URL points
 * straight back at our callback with a static code) and returns a fixed set of
 * issued documents. Everything downstream is identical to the live path.
 */
const ISSUED: (IssuedDocument & { body: () => Buffer })[] = [
  {
    uri: 'in.gov.uidai-ADHAR-demo0001',
    name: 'Aadhaar Card',
    docTypeCode: 'ADHAR',
    issuer: 'Unique Identification Authority of India (UIDAI)',
    mime: 'application/pdf',
    sizeBytes: 0,
    mapsTo: 'identity_proof',
    body: () => buildSamplePdf('AADHAAR — Government of India', ['Demonstration copy issued via DigiLocker mock.', 'Name / DOB / Address as per UIDAI records.']),
  },
  {
    uri: 'in.gov.pan-PANCR-demo0002',
    name: 'PAN Verification Record',
    docTypeCode: 'PANCR',
    issuer: 'Income Tax Department',
    mime: 'application/pdf',
    sizeBytes: 0,
    mapsTo: 'pan_card',
    body: () => buildSamplePdf('PERMANENT ACCOUNT NUMBER', ['Demonstration copy issued via DigiLocker mock.', 'Issued by the Income Tax Department.']),
  },
  {
    uri: 'in.gov.transport-DL-demo0003',
    name: 'Driving Licence',
    docTypeCode: 'DRVLC',
    issuer: 'Transport Department',
    mime: 'application/pdf',
    sizeBytes: 0,
    mapsTo: 'driving_licence',
    body: () => buildSamplePdf('DRIVING LICENCE', ['Demonstration copy issued via DigiLocker mock.', 'Issued by the State Transport Department.']),
  },
  {
    uri: 'in.gov.revenue-INCCERT-demo0004',
    name: 'Income Certificate',
    docTypeCode: 'INCM',
    issuer: 'Revenue Department, State Government',
    mime: 'application/pdf',
    sizeBytes: 0,
    mapsTo: 'income_certificate',
    body: () => buildSamplePdf('INCOME CERTIFICATE', ['Demonstration copy issued via DigiLocker mock.', 'Issued by the Revenue Department (Tehsildar).']),
  },
  {
    uri: 'in.gov.revenue-CASTE-demo0005',
    name: 'Caste / OBC Certificate',
    docTypeCode: 'CASTE',
    issuer: 'Revenue Department, State Government',
    mime: 'application/pdf',
    sizeBytes: 0,
    mapsTo: 'caste_certificate',
    body: () => buildSamplePdf('CASTE CERTIFICATE', ['Demonstration copy issued via DigiLocker mock.', 'Issued by the Revenue Department (SDM).']),
  },
];

export class MockDigiLockerProvider implements DigiLockerProvider {
  readonly mode = 'mock' as const;

  authorizeUrl({ state, redirectUri }: { state: string; codeChallenge: string; redirectUri: string }): string {
    const u = new URL(redirectUri);
    u.searchParams.set('code', 'mock-auth-code');
    u.searchParams.set('state', state);
    return u.toString();
  }

  async exchangeCode(): Promise<DigiLockerSession> {
    return {
      digilockerId: `mock-${randomToken(6)}`,
      name: 'DigiLocker User (demo)',
      maskedAadhaar: 'XXXX XXXX 1234',
      accessToken: `mock-${randomToken(16)}`,
      refreshToken: null,
      expiresAt: new Date(Date.now() + 3600_000),
    };
  }

  async listIssuedDocuments(): Promise<IssuedDocument[]> {
    return ISSUED.map(({ body, ...rest }) => ({ ...rest, sizeBytes: body().length }));
  }

  async fetchDocument(_session: { accessToken: string }, uri: string) {
    const found = ISSUED.find((d) => d.uri === uri);
    if (!found) throw new Error(`Unknown DigiLocker document URI: ${uri}`);
    return { buffer: found.body(), mime: 'application/pdf' as const, issuer: found.issuer, name: found.name };
  }
}
