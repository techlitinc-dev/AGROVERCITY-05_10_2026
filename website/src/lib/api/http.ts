import { apiClient } from './client';
import { handleApiError } from './errors';

/**
 * Shared HTTP helpers. Every domain method in this directory goes through
 * these, which is what uniformly enforces the platform convention:
 *
 *   1. try { real call } catch (e) { handleApiError(e) }
 *   2. Reads (readOne/readList/readPaged) may fall back to MOCK constants
 *      ONLY when `import.meta.env.DEV` is true.
 *   3. Writes (post/put/patch/del/mutate) ALWAYS throw on failure —
 *      never fake success on a mutation.
 *   4. List endpoints return the envelope { data, page, pageSize, total };
 *      readList unwraps to the array, readPaged keeps the pagination.
 */

export const DEV: boolean = !!import.meta.env.DEV;

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export type Params = Record<string, unknown>;

/** Legacy-compatible list unwrap: `payload.data` when present, else payload. */
export function unwrapList<T>(payload: unknown): T[] {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    return (payload as { data: T[] }).data;
  }
  return payload as T[];
}

export function unwrapPaged<T>(payload: unknown): Paged<T> {
  if (
    payload !== null &&
    typeof payload === 'object' &&
    !Array.isArray(payload) &&
    Array.isArray((payload as { data?: unknown }).data)
  ) {
    const p = payload as Partial<Paged<T>> & { data: T[] };
    return {
      data: p.data,
      page: p.page ?? 1,
      pageSize: p.pageSize ?? p.data.length,
      total: p.total ?? p.data.length,
    };
  }
  const data = Array.isArray(payload) ? (payload as T[]) : [];
  return { data, page: 1, pageSize: data.length, total: data.length };
}

interface ReadOpts<M> {
  params?: Params;
  mock?: M | (() => M);
}

// ---------------------------------------------
// READS — dev-only mock fallback
// ---------------------------------------------

export async function readOne<T>(url: string, opts: ReadOpts<T> = {}): Promise<T> {
  try {
    const res = await apiClient.get(url, { params: opts.params });
    return (res.data?.data ?? res.data) as T;
  } catch (e) {
    if (DEV && opts.mock !== undefined) {
      return typeof opts.mock === 'function' ? (opts.mock as () => T)() : opts.mock;
    }
    handleApiError(e);
  }
}

export async function readList<T>(url: string, opts: ReadOpts<T[]> = {}): Promise<T[]> {
  try {
    const res = await apiClient.get(url, { params: opts.params });
    return unwrapList<T>(res.data);
  } catch (e) {
    if (DEV && opts.mock !== undefined) {
      return typeof opts.mock === 'function' ? (opts.mock as () => T[])() : opts.mock;
    }
    handleApiError(e);
  }
}

export async function readPaged<T>(url: string, opts: ReadOpts<T[]> = {}): Promise<Paged<T>> {
  try {
    const res = await apiClient.get(url, { params: opts.params });
    return unwrapPaged<T>(res.data);
  } catch (e) {
    if (DEV && opts.mock !== undefined) {
      const data = typeof opts.mock === 'function' ? (opts.mock as () => T[])() : opts.mock;
      return { data, page: 1, pageSize: data.length, total: data.length };
    }
    handleApiError(e);
  }
}

// ---------------------------------------------
// WRITES — always throw on error, never mock
// ---------------------------------------------

export interface MutateOpts {
  params?: Params;
  headers?: Record<string, string>;
}

export async function mutate<T>(
  method: 'post' | 'put' | 'patch' | 'delete',
  url: string,
  body?: unknown,
  opts: MutateOpts = {}
): Promise<T> {
  try {
    const res = await apiClient.request({
      method,
      url,
      data: body,
      params: opts.params,
      headers: opts.headers,
    });
    return (res.data?.data ?? res.data) as T;
  } catch (e) {
    handleApiError(e);
  }
}

export const post = <T>(url: string, body?: unknown, opts?: MutateOpts): Promise<T> =>
  mutate<T>('post', url, body, opts);
export const put = <T>(url: string, body?: unknown, opts?: MutateOpts): Promise<T> =>
  mutate<T>('put', url, body, opts);
export const patch = <T>(url: string, body?: unknown, opts?: MutateOpts): Promise<T> =>
  mutate<T>('patch', url, body, opts);
export const del = <T>(url: string, opts?: MutateOpts): Promise<T> => mutate<T>('delete', url, undefined, opts);

/** File download (PDF invoices/receipts/certificates) as a Blob. */
export async function download(url: string, params?: Params): Promise<Blob> {
  try {
    const res = await apiClient.get(url, { params, responseType: 'blob' });
    return res.data as Blob;
  } catch (e) {
    handleApiError(e);
  }
}
