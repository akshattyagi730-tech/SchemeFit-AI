/**
 * Typed API client for the SchemeFit AI backend.
 *
 *  - Cookie session auth: every request sends credentials.
 *  - CSRF: a token is fetched once and attached to mutating requests; on a CSRF
 *    rejection it is refreshed and the request retried once.
 *  - Errors are normalised to `ApiError` ({ status, code, message, fieldErrors }).
 *  - No auth token or password is ever stored in localStorage.
 *
 * Base URL:
 *  - dev / same-origin deploy: leave VITE_API_BASE_URL unset → uses '/api/v1'
 *    (Vite proxies it in dev; a reverse proxy handles it in prod).
 *  - split deploy (e.g. web on Vercel, API on Render): set
 *    VITE_API_BASE_URL=https://your-api.onrender.com at build time.
 */
const API_ORIGIN = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
export const API_BASE = `${API_ORIGIN}/api/v1`;

export interface FieldError {
  path: string;
  message: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors: FieldError[];
  readonly requestId?: string;

  constructor(status: number, code: string, message: string, fieldErrors: FieldError[] = [], requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
    this.requestId = requestId;
  }

  get isAuth() {
    return this.status === 401;
  }
  get isForbidden() {
    return this.status === 403;
  }
}

let csrfToken: string | null = null;

async function fetchCsrf(): Promise<string> {
  const res = await fetch(`${API_BASE}/auth/csrf`, { credentials: 'include' });
  const body = await res.json().catch(() => ({}));
  csrfToken = body?.data?.csrfToken ?? null;
  return csrfToken ?? '';
}

export async function ensureCsrf(): Promise<void> {
  if (!csrfToken) await fetchCsrf();
}

type Method = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: Method;
  body?: unknown;
  formData?: FormData;
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') params.set(k, String(v));
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function doFetch<T>(path: string, opts: RequestOptions, isRetry = false): Promise<T> {
  const method = opts.method ?? 'GET';
  const mutating = method !== 'GET';
  const headers: Record<string, string> = {};

  if (mutating) {
    if (!csrfToken) await fetchCsrf();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  let payload: BodyInit | undefined;
  if (opts.formData) {
    payload = opts.formData; // browser sets multipart boundary
  } else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(opts.body);
  }

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    credentials: 'include',
    headers,
    body: payload,
    signal: opts.signal,
  });

  if (res.status === 204) return undefined as T;

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const parsed = isJson ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    const err = parsed?.error ?? {};
    // One automatic retry when the CSRF token has gone stale.
    if (res.status === 403 && err.code === 'FORBIDDEN' && /csrf/i.test(err.message ?? '') && !isRetry) {
      await fetchCsrf();
      return doFetch<T>(path, opts, true);
    }
    throw new ApiError(res.status, err.code ?? 'ERROR', err.message ?? res.statusText, err.fieldErrors ?? [], err.requestId);
  }

  return parsed as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query'], signal?: AbortSignal) =>
    doFetch<T>(path, { method: 'GET', query, signal }),
  post: <T>(path: string, body?: unknown) => doFetch<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => doFetch<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => doFetch<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => doFetch<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => doFetch<T>(path, { method: 'POST', formData }),
};

/** Direct download of a private document (streamed, authenticated). Returns a blob URL. */
export async function downloadDocument(id: string): Promise<{ url: string; filename: string }> {
  const res = await fetch(`${API_BASE}/documents/${id}/download`, { credentials: 'include' });
  if (!res.ok) throw new ApiError(res.status, 'DOWNLOAD_FAILED', 'Could not download this document');
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition') ?? '';
  const match = /filename="?([^"]+)"?/.exec(disposition);
  return { url: URL.createObjectURL(blob), filename: match?.[1] ? decodeURIComponent(match[1]) : id };
}
