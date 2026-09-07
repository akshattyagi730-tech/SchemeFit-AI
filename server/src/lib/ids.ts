import { createHash, randomBytes, randomUUID } from 'node:crypto';

export const uuid = (): string => randomUUID();

/** URL-safe opaque token (used for session tokens, storage keys). */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

/** Human-facing reference like SF-2026-0007. */
export function applicationReference(seq: number, now = new Date()): string {
  return `SF-${now.getUTCFullYear()}-${String(seq).padStart(4, '0')}`;
}
