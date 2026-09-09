import { env } from '../../config/env';
import type { DigiLockerProvider, DigiLockerSession, IssuedDocument } from './provider';

/**
 * Live DigiLocker (Meripehchaan) provider — OAuth 2.0 (PKCE) + Issued Documents
 * API. Activated only when DIGILOCKER_CLIENT_ID / _SECRET / _REDIRECT_URI are set.
 *
 * Endpoint paths are configurable because DigiLocker has revised them over time;
 * confirm the current values against your partner onboarding pack. This code has
 * not been exercised against production credentials — treat it as the switch that
 * is flipped once onboarding completes, with the mock covering demos until then.
 */
const DOCTYPE_TO_CHECKLIST: Record<string, string> = {
  ADHAR: 'identity_proof',
  PANCR: 'pan_card',
  DRVLC: 'driving_licence',
  INCM: 'income_certificate',
  CASTE: 'caste_certificate',
  OBCCE: 'caste_certificate',
  RATON: 'address_proof',
};

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  digilockerid?: string;
  name?: string;
  reference_key?: string;
  eaadhaar?: string;
}

interface IssuedFile {
  name: string;
  type?: string;
  uri: string;
  doctype?: string;
  issuer?: string;
  issuerid?: string;
  mime?: string | string[];
  size?: string | number;
}

export class LiveDigiLockerProvider implements DigiLockerProvider {
  readonly mode = 'live' as const;

  authorizeUrl({ state, codeChallenge, redirectUri }: { state: string; codeChallenge: string; redirectUri: string }): string {
    const u = new URL(env.DIGILOCKER_AUTH_URL);
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', env.DIGILOCKER_CLIENT_ID);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('state', state);
    u.searchParams.set('code_challenge', codeChallenge);
    u.searchParams.set('code_challenge_method', 'S256');
    return u.toString();
  }

  async exchangeCode({ code, codeVerifier, redirectUri }: { code: string; codeVerifier: string; redirectUri: string }): Promise<DigiLockerSession> {
    const res = await fetch(env.DIGILOCKER_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: env.DIGILOCKER_CLIENT_ID,
        client_secret: env.DIGILOCKER_CLIENT_SECRET,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    if (!res.ok) throw new Error(`DigiLocker token exchange failed (${res.status})`);
    const body = (await res.json()) as TokenResponse;
    return {
      digilockerId: body.digilockerid ?? body.reference_key ?? 'unknown',
      name: body.name ?? 'DigiLocker user',
      maskedAadhaar: body.eaadhaar ?? null,
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresAt: new Date(Date.now() + (body.expires_in ?? 3600) * 1000),
    };
  }

  async listIssuedDocuments(session: { accessToken: string }): Promise<IssuedDocument[]> {
    const res = await fetch(`${env.DIGILOCKER_API_BASE}/2/files/issued`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) throw new Error(`DigiLocker issued-documents list failed (${res.status})`);
    const body = (await res.json()) as { items?: IssuedFile[] } | IssuedFile[];
    const items = Array.isArray(body) ? body : (body.items ?? []);
    return items
      .filter((f) => (Array.isArray(f.mime) ? f.mime.includes('application/pdf') : (f.mime ?? 'application/pdf') === 'application/pdf'))
      .map((f) => ({
        uri: f.uri,
        name: f.name,
        docTypeCode: f.doctype ?? f.type ?? 'UNKNOWN',
        issuer: f.issuer ?? 'DigiLocker issuer',
        mime: 'application/pdf' as const,
        sizeBytes: Number(f.size ?? 0) || 0,
        mapsTo: DOCTYPE_TO_CHECKLIST[(f.doctype ?? '').toUpperCase()] ?? null,
      }));
  }

  async fetchDocument(session: { accessToken: string }, uri: string) {
    const res = await fetch(`${env.DIGILOCKER_API_BASE}/1/file/${encodeURIComponent(uri)}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    if (!res.ok) throw new Error(`DigiLocker file fetch failed (${res.status})`);
    const issuer = res.headers.get('x-issuer') ?? 'DigiLocker issuer';
    const name = res.headers.get('x-name') ?? uri;
    const buffer = Buffer.from(await res.arrayBuffer());
    return { buffer, mime: 'application/pdf' as const, issuer, name };
  }
}
