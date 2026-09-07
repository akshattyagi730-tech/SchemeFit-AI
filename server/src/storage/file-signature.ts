/**
 * Magic-byte (file signature) validation. We do NOT trust the client-supplied
 * MIME type on its own — the actual bytes must match an allow-listed type AND
 * agree with the claimed type.
 */
export type AllowedMime = 'application/pdf' | 'image/jpeg' | 'image/png';

export const ALLOWED_MIME: AllowedMime[] = ['application/pdf', 'image/jpeg', 'image/png'];

export const EXTENSION_BY_MIME: Record<AllowedMime, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

/** Detect the true type from the leading bytes, or null if unrecognised. */
export function detectMime(buf: Buffer): AllowedMime | null {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'; // %PDF-
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  return null;
}

export interface SignatureCheck {
  ok: boolean;
  detected: AllowedMime | null;
  reason?: string;
}

export function verifyFileSignature(buf: Buffer, claimedMime: string): SignatureCheck {
  const detected = detectMime(buf);
  if (!detected) return { ok: false, detected: null, reason: 'File content is not a recognised PDF, JPEG or PNG.' };
  if (!ALLOWED_MIME.includes(claimedMime as AllowedMime)) {
    return { ok: false, detected, reason: `Declared type "${claimedMime}" is not allowed.` };
  }
  // Allow jpeg/jpg aliasing but otherwise require agreement.
  if (detected !== claimedMime) {
    return { ok: false, detected, reason: `File content is ${detected} but was uploaded as ${claimedMime}.` };
  }
  return { ok: true, detected };
}
