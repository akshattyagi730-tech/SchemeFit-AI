import { env } from '../../config/env';
import type { DigiLockerProvider } from './provider';
import { MockDigiLockerProvider } from './mock-provider';
import { LiveDigiLockerProvider } from './live-provider';

let provider: DigiLockerProvider | null = null;

export function getDigiLocker(): DigiLockerProvider {
  if (!provider) {
    provider = env.digilockerLive ? new LiveDigiLockerProvider() : new MockDigiLockerProvider();
  }
  return provider;
}

export type { DigiLockerProvider, IssuedDocument } from './provider';
