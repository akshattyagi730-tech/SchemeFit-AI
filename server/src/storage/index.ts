/**
 * Private file storage abstraction.
 *
 * Documents are NEVER served from a public directory and never get a permanent
 * public URL. Downloads always go through an authenticated, authorised endpoint
 * that streams bytes from this interface.
 */
export interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoredObject {
  stream: NodeJS.ReadableStream;
  contentType: string;
  contentLength: number;
}

export interface FileStorage {
  readonly driver: 'local' | 's3';
  put(input: PutObjectInput): Promise<void>;
  get(key: string): Promise<StoredObject>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

export class StorageObjectNotFound extends Error {
  constructor(key: string) {
    super(`Storage object not found: ${key}`);
    this.name = 'StorageObjectNotFound';
  }
}

import { env } from '../config/env';
import { LocalFileStorage } from './local';

let instance: FileStorage | null = null;

export function getStorage(): FileStorage {
  if (instance) return instance;
  if (env.STORAGE_DRIVER === 's3') {
    // Lazy require so local/dev installs don't need the AWS SDK.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { S3FileStorage } = require('./s3') as typeof import('./s3');
    instance = new S3FileStorage();
  } else {
    instance = new LocalFileStorage(env.STORAGE_LOCAL_DIR);
  }
  return instance;
}

/** Test helper — reset the singleton (e.g. after changing env). */
export function __resetStorage(): void {
  instance = null;
}
