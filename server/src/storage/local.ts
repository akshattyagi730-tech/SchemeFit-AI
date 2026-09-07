import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile, access } from 'node:fs/promises';
import path from 'node:path';
import { logger } from '../lib/logger';
import type { FileStorage, PutObjectInput, StoredObject } from './index';
import { StorageObjectNotFound } from './index';

/**
 * Local development storage. Files live in a persistent directory OUTSIDE any web
 * root. Keys are opaque, generated server-side; we still defend against traversal.
 */
export class LocalFileStorage implements FileStorage {
  readonly driver = 'local' as const;
  private readonly root: string;
  private readonly meta = new Map<string, string>(); // key -> contentType (best-effort cache)

  constructor(dir: string) {
    this.root = path.resolve(process.cwd(), dir);
  }

  private resolve(key: string): string {
    const clean = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    const full = path.resolve(this.root, clean);
    if (!full.startsWith(this.root + path.sep) && full !== this.root) {
      throw new Error('Illegal storage key');
    }
    return full;
  }

  async put({ key, body, contentType }: PutObjectInput): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body, { mode: 0o600 });
    await writeFile(`${full}.type`, contentType, { mode: 0o600 });
    this.meta.set(key, contentType);
    logger.debug({ key, bytes: body.length }, 'stored object (local)');
  }

  async get(key: string): Promise<StoredObject> {
    const full = this.resolve(key);
    let size: number;
    try {
      size = (await stat(full)).size;
    } catch {
      throw new StorageObjectNotFound(key);
    }
    let contentType = this.meta.get(key) ?? 'application/octet-stream';
    try {
      const { readFile } = await import('node:fs/promises');
      contentType = (await readFile(`${full}.type`, 'utf8')).trim() || contentType;
    } catch {
      /* no sidecar — fall back */
    }
    return { stream: createReadStream(full), contentType, contentLength: size };
  }

  async delete(key: string): Promise<void> {
    const full = this.resolve(key);
    await rm(full, { force: true });
    await rm(`${full}.type`, { force: true });
    this.meta.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
