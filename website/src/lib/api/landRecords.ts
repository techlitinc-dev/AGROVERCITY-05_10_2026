import { api } from './client';

/**
 * Land & Legal (7/12 / 8A) wrappers — mirror `backend/app/routers/land_records.py`.
 *
 * Backend quirks (verified against the router):
 * - Every route requires role `farmer` | `farmLandlord` (403 `FORBIDDEN_ROLE`).
 * - `type` is `712` | `8A`; a search with neither gatNumber nor village answers
 *   400 `MISSING_SEARCH_PARAM`; a < 3-char village or a non-alphanumeric
 *   gatNumber answers 422 `VALIDATION_ERROR`.
 * - There is NO `GET /land-records/{id}` detail route — the search response
 *   already carries the full record, so the detail view re-searches by the
 *   Gat number it was opened with.
 * - Records come from the mock adapter: they are SAMPLE data. The UI must
 *   always render the `landRecordSampleLabel` honesty label (no real
 *   Mahabhulekh adapter exists yet — phase-00 honesty rule).
 * - `/{id}/pdf` returns a `{ pdfUrl }` string, not a blob.
 * - `POST /{id}/import` copies the survey area into the farm profile and is
 *   idempotent per Gat number (Idempotency-Key added by `client.ts`).
 */

export type LandRecordType = '712' | '8A';

export interface LandRecord {
  id: string;
  gatNumber: string;
  village: string;
  district: string;
  ownerName: string;
  khataNumber: string;
  totalAreaHectares: number;
  totalAreaAcres: number;
  landClass: string;
  ferfarNumber: string;
  cropHistory: string;
}

export interface LandRecordSearchPage {
  data: LandRecord[];
  page: number;
  pageSize: number;
  total: number;
}

export async function searchLandRecords(params: {
  gatNumber?: string;
  village?: string;
  district?: string;
  type?: LandRecordType;
}): Promise<LandRecordSearchPage> {
  const query: Record<string, string> = {};
  if (params.gatNumber) query.gatNumber = params.gatNumber;
  if (params.village) query.village = params.village;
  if (params.district) query.district = params.district;
  if (params.type) query.type = params.type;
  const { data } = await api.get<LandRecordSearchPage>('/land-records/search', { params: query });
  return data;
}

/** Sample-data PDF link for a record (a URL string, opened in a new tab). */
export async function getLandRecordPdf(recordId: string): Promise<string | null> {
  const { data } = await api.get<{ pdfUrl: string }>(`/land-records/${recordId}/pdf`);
  return data.pdfUrl;
}

export interface LandRecordImportResult {
  imported: boolean;
  landAreaAcres: number;
}

/** One-tap import of the record's survey area into the farm profile. */
export async function importLandRecord(recordId: string): Promise<LandRecordImportResult> {
  const { data } = await api.post<LandRecordImportResult>(`/land-records/${recordId}/import`);
  return data;
}

/** Acres with up to 2 decimals. */
export function formatAcres(value: number): string {
  return `${value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ac`;
}
