import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './client';

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('api client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // reset the module-level csrf cache
    vi.resetModules();
  });
  afterEach(() => vi.restoreAllMocks());

  it('attaches the CSRF token to mutating requests', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/csrf')) return jsonResponse(200, { data: { csrfToken: 'tok-123' } });
      expect((init?.headers as Record<string, string>)['X-CSRF-Token']).toBe('tok-123');
      expect(init?.credentials).toBe('include');
      return jsonResponse(200, { data: { ok: true } });
    });
    vi.stubGlobal('fetch', fetchMock);

    const { api: freshApi } = await import('./client');
    await freshApi.post('/profile', { a: 1 });
    expect(fetchMock).toHaveBeenCalled();
  });

  it('normalises error envelopes into ApiError with field errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/auth/csrf')) return jsonResponse(200, { data: { csrfToken: 't' } });
        return jsonResponse(422, {
          error: { code: 'UNPROCESSABLE_ENTITY', message: 'bad', fieldErrors: [{ path: 'email', message: 'invalid' }] },
        });
      }),
    );
    const { api: freshApi, ApiError: FreshApiError } = await import('./client');
    await expect(freshApi.post('/x', {})).rejects.toMatchObject({
      status: 422,
      code: 'UNPROCESSABLE_ENTITY',
      fieldErrors: [{ path: 'email', message: 'invalid' }],
    });
    await freshApi.post('/x', {}).catch((e) => {
      expect(e).toBeInstanceOf(FreshApiError);
    });
  });

  it('retries once when the CSRF token is stale', async () => {
    let csrfHits = 0;
    let postHits = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.endsWith('/auth/csrf')) {
          csrfHits += 1;
          return jsonResponse(200, { data: { csrfToken: `tok-${csrfHits}` } });
        }
        postHits += 1;
        if (postHits === 1) return jsonResponse(403, { error: { code: 'FORBIDDEN', message: 'Invalid CSRF token' } });
        return jsonResponse(200, { data: { ok: true } });
      }),
    );
    const { api: freshApi } = await import('./client');
    await freshApi.post('/thing', {});
    expect(csrfHits).toBe(2);
    expect(postHits).toBe(2);
  });

  it('returns null-ish for 204', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 204 })));
    const { api: freshApi } = await import('./client');
    await expect(freshApi.get('/nothing')).resolves.toBeUndefined();
  });
});
