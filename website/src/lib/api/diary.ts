import { del, download, post, put, readList, readOne } from './http';
import { MOCK_FARM_DIARY } from './mocks';
import type { FarmDiaryEntry } from '../../types';

/** Diary write payload — the typed core plus the loose backend extras
 * (tradeType buy|sell, photos, unit, party, cropName…) that POST/PUT accept. */
export type DiaryEntryPayload = Partial<FarmDiaryEntry> & Record<string, unknown>;

/** Farm diary namespace — /diary. */
export const diary = {
  /** GET /diary/entries — supports type/category/q/from/to params. */
  entries: (params?: Record<string, unknown>): Promise<FarmDiaryEntry[]> =>
    readList<FarmDiaryEntry>('/diary/entries', { params, mock: MOCK_FARM_DIARY }),

  /** POST /diary/entries */
  create: (entry: DiaryEntryPayload): Promise<FarmDiaryEntry> =>
    post<FarmDiaryEntry>('/diary/entries', entry),

  /** PUT /diary/entries/{id} */
  update: (entryId: string, updates: DiaryEntryPayload): Promise<FarmDiaryEntry> =>
    put<FarmDiaryEntry>(`/diary/entries/${entryId}`, updates),

  /** DELETE /diary/entries/{id} */
  remove: (entryId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/diary/entries/${entryId}`),

  /** POST /diary/entries/{id}/photos */
  addPhotos: (entryId: string, body: Record<string, unknown>): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(`/diary/entries/${entryId}/photos`, body),

  /** GET /diary/analytics/summary */
  summary: (params?: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/diary/analytics/summary', { params }),

  /** GET /diary/report */
  report: (params?: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/diary/report', { params }),

  /** GET /diary/report.csv?from=&to= — CSV export (text/csv attachment) as a Blob. */
  reportCsv: (params?: Record<string, unknown>): Promise<Blob> => download('/diary/report.csv', params),

  /** POST /diary/receipt-scan */
  receiptScan: (body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/diary/receipt-scan', body),
};
