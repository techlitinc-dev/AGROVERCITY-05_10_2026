import { settings } from '@/config/settings';
import { EP } from './endpoints';
import { ApiError } from './errors';
import type { AuthTokens, ErrorBody } from './types';

const TOKEN_KEY = 'ks.tokens';
const LANG_KEY = 'ks.lang';

export function getTokens(): AuthTokens | null {
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  } catch {
    return null;
  }
}

export function setTokens(tokens: AuthTokens): void {
  localStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
}

function getLang(): string {
  return localStorage.getItem(LANG_KEY) ?? 'hi';
}

export interface HttpOpts {
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  skipAuthRetry?: boolean;
}

function buildUrl(path: string, query?: HttpOpts['query']): string {
  const url = new URL(settings.liveBaseUrl.replace(/\/$/, '') + path);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  try {
    const body = (await res.json()) as ErrorBody;
    if (body?.error?.code) {
      return new ApiError(res.status, body.error.code, body.error.message, body.error.fieldErrors ?? {});
    }
  } catch {
    // fall through to generic
  }
  return new ApiError(res.status, 'INTERNAL', 'कुछ गड़बड़ हो गई। कृपया फिर कोशिश करें।');
}

async function refreshTokens(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens) return false;
  const res = await fetch(buildUrl(EP.auth.refresh), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': getLang() },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
  if (!res.ok) return false;
  const next = (await res.json()) as AuthTokens;
  setTokens(next);
  return true;
}

async function request<T>(method: string, path: string, body?: unknown, opts: HttpOpts = {}): Promise<T> {
  const isWrite = method !== 'GET';
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const headers: Record<string, string> = {
    'Accept-Language': getLang(),
    ...opts.headers,
  };
  if (!isForm) headers['Content-Type'] = 'application/json';
  if (isWrite) headers['Idempotency-Key'] = crypto.randomUUID();
  const tokens = getTokens();
  if (tokens) headers['Authorization'] = `Bearer ${tokens.accessToken}`;

  const res = await fetch(buildUrl(path, opts.query), {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });

  if (res.status === 401 && !opts.skipAuthRetry && !path.startsWith('/auth/')) {
    const refreshed = await refreshTokens();
    if (refreshed) return request<T>(method, path, body, { ...opts, skipAuthRetry: true });
    clearTokens();
    window.dispatchEvent(new Event('ks:logout'));
    throw new ApiError(401, 'TOKEN_EXPIRED', 'सत्र समाप्त हो गया। कृपया फिर लॉगिन करें।');
  }

  if (res.status === 204) return undefined as T;
  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

export const http = {
  get: <T>(path: string, opts?: HttpOpts) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: HttpOpts) => request<T>('POST', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: HttpOpts) => request<T>('PUT', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: HttpOpts) => request<T>('PATCH', path, body, opts),
  del: <T>(path: string, opts?: HttpOpts) => request<T>('DELETE', path, undefined, opts),
  upload: <T>(path: string, formData: FormData, opts?: HttpOpts) => request<T>('POST', path, formData, opts),
};
