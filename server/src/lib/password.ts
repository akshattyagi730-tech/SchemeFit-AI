import { hash, verify, Algorithm } from '@node-rs/argon2';

// OWASP-aligned Argon2id parameters.
const OPTS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
};

export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, OPTS);
}

export async function verifyPassword(storedHash: string, plain: string): Promise<boolean> {
  try {
    // Parameters are encoded in the PHC string; no options needed to verify.
    return await verify(storedHash, plain);
  } catch {
    return false;
  }
}
