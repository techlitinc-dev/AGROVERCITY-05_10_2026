import { api } from './client';

/**
 * Government-schemes ("SchemeFinder") wrappers — phase-05 WS-05.
 * Verified against backend/app/routers/schemes.py (prefix `/schemes`).
 *
 * Backend quirks:
 * - The discovery list (`GET /schemes`) is already server-ordered
 *   matched-to-profile first (eligible, then fewer missing docs, then name) —
 *   the client renders the returned order and never re-sorts (rule 1).
 * - The eligibility checklist (`GET /schemes/{id}`) is computed server-side by
 *   `services/eligibility.py`; the client only renders `met` per criterion.
 * - The AI match endpoint (`GET /schemes/matches`, brief M21) returns
 *   rules-decided `eligible`/`missing` plus the model's `fit` + localized
 *   `explanation` — render the explanation verbatim.
 * - Money fields on schemes are display strings (benefit amounts), not paisa.
 * - `Idempotency-Key` is attached by `client.ts` on every non-GET request.
 */

export interface SchemeListItem {
  id: string;
  name: string;
  category: string;
  eligible: boolean;
  benefitAmount: string;
  documentsRequired: string[];
  status: string;
  nextDeadline: string;
  description: string;
}

export interface SchemeCriterion {
  /** Stable rule key — the UI maps it to an en/hi label. */
  key: string;
  met: boolean;
  params: Record<string, string | number | string[]>;
}

export interface SchemeDocument {
  name: string;
  present: boolean;
}

export interface SchemeDetail {
  id: string;
  name: string;
  category: string;
  eligible: boolean;
  benefitAmount: string;
  status: string;
  nextDeadline: string;
  description: string;
  eligibility: SchemeCriterion[];
  documents: SchemeDocument[];
  documentsRequired: string[];
  portalUrl: string | null;
}

export interface SchemeMatch {
  schemeId: string;
  name: string;
  category: string;
  eligible: boolean;
  missing: string[];
  fit: number;
  checklist: SchemeCriterion[];
  /** Localized "why eligible / what to do" line — render verbatim. */
  explanation: string;
}

export interface SchemeListPage {
  data: SchemeListItem[];
  page: number;
  pageSize: number;
  total: number;
  /** Opaque cursor for the next page — `null` on the last page (rule 7). */
  nextCursor: string | null;
}

export interface PortalEntry {
  schemeId: string;
  portalUrl: string;
}

export interface ApplyResult {
  applicationId: string;
  status: string;
}

export async function listSchemes(
  params: { category?: string; eligibleOnly?: boolean; cursor?: string | null; pageSize?: number } = {}
): Promise<SchemeListPage> {
  const { data } = await api.get<SchemeListPage>('/schemes', {
    params: {
      ...(params.category ? { category: params.category } : {}),
      ...(params.eligibleOnly ? { eligibleOnly: true } : {}),
      ...(params.cursor ? { cursor: params.cursor } : {}),
      ...(params.pageSize ? { pageSize: params.pageSize } : {}),
    },
  });
  return data;
}

export async function getScheme(schemeId: string): Promise<SchemeDetail> {
  const { data } = await api.get<SchemeDetail>(`/schemes/${schemeId}`);
  return data;
}

/** AI scheme matching (M21). `emitTasks` lets the backend emit missing-doc tasks. */
export async function listSchemeMatches(
  params: { lang?: 'en' | 'hi'; emitTasks?: boolean } = {}
): Promise<SchemeMatch[]> {
  const { data } = await api.get<{ data: SchemeMatch[] }>('/schemes/matches', {
    params: {
      ...(params.lang ? { lang: params.lang } : {}),
      ...(params.emitTasks === undefined ? {} : { emitTasks: params.emitTasks }),
    },
  });
  return data.data;
}

export async function listSchemePortals(): Promise<PortalEntry[]> {
  const { data } = await api.get<{ data: PortalEntry[] }>('/schemes/portals');
  return data.data;
}

/** In-app tracked application. */
export async function applyScheme(schemeId: string, documentIds: string[] = []): Promise<ApplyResult> {
  const { data } = await api.post<ApplyResult>(`/schemes/${schemeId}/apply`, { documentIds });
  return data;
}

/** Emit deadline-reminder tasks (dedupe-safe server-side). */
export async function emitDeadlineReminders(): Promise<string[]> {
  const { data } = await api.post<{ data: { emitted: string[] } }>('/schemes/deadline-reminders', {});
  return data.data.emitted;
}

/* --------------------------------------------------------------- document vault -- */

export type VaultDocType = 'aadhaar' | '712' | 'bankPassbook' | 'soilHealthCard' | 'other';

/** Map a scheme's human document label to the vault's doc-type enum. */
export function vaultDocTypeFor(label: string): VaultDocType {
  const value = label.toLowerCase();
  if (value.includes('aadhaar') || value.includes('आधार')) return 'aadhaar';
  if (value.includes('7/12') || value.includes('7-12') || value.includes('खसरा')) return '712';
  if (value.includes('passbook') || value.includes('bank') || value.includes('पासबुक')) {
    return 'bankPassbook';
  }
  if (value.includes('soil') || value.includes('मिट्टी')) return 'soilHealthCard';
  return 'other';
}

/**
 * Upload a required document to the document vault (`POST /vault/documents`,
 * multipart). The schemes apply path validates these vault doc ids.
 */
export async function uploadVaultDocument(
  file: File,
  docType: VaultDocType
): Promise<{ id: string; docType: string }> {
  const form = new FormData();
  form.append('file', file);
  form.append('docType', docType);
  const { data } = await api.post<{ id: string; docType: string }>('/vault/documents', form);
  return data;
}
