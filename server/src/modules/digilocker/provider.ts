/**
 * DigiLocker provider contract. Two implementations satisfy it:
 *  - `mock` (default): drives the exact same UI flow with sample issued
 *    documents, so the feature is demoable without partner onboarding.
 *  - `live`: real Meripehchaan OAuth 2.0 + Issued Documents API, activated when
 *    DIGILOCKER_CLIENT_ID / _SECRET / _REDIRECT_URI are configured.
 *
 * Nothing above this interface knows which one is in use.
 */

export interface DigiLockerIdentity {
  digilockerId: string;
  name: string;
  /** Last 4 digits of the linked Aadhaar, when the provider returns it. */
  maskedAadhaar?: string | null;
}

export interface DigiLockerSession extends DigiLockerIdentity {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date;
}

export interface IssuedDocument {
  /** Opaque DigiLocker document URI. */
  uri: string;
  name: string;
  /** DigiLocker document type code (e.g. ADHAR, PANCR). */
  docTypeCode: string;
  issuer: string;
  mime: 'application/pdf';
  sizeBytes: number;
  /** Our checklist document type this issued document can satisfy, if known. */
  mapsTo: string | null;
}

export interface DigiLockerProvider {
  readonly mode: 'mock' | 'live';
  /** Build the URL the browser is sent to in order to authorise. */
  authorizeUrl(input: { state: string; codeChallenge: string; redirectUri: string }): string;
  /** Exchange the `code` from the callback for tokens + identity. */
  exchangeCode(input: { code: string; codeVerifier: string; redirectUri: string }): Promise<DigiLockerSession>;
  /** List the documents issued to the authenticated citizen. */
  listIssuedDocuments(session: { accessToken: string }): Promise<IssuedDocument[]>;
  /** Download one issued document's bytes. */
  fetchDocument(session: { accessToken: string }, uri: string): Promise<{ buffer: Buffer; mime: 'application/pdf'; issuer: string; name: string }>;
}
