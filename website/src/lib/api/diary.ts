import { del, post, put, readList, readOne } from './http';
import { MOCK_FARM_DIARY } from './mocks';
import type { FarmDiaryEntry } from '../../types';

/** Farm diary namespace — /diary. */
export const diary = {
  /** GET /diary/entries */
  entries: (params?: Record<string, unknown>): Promise<FarmDiaryEntry[]> =>
    readList<FarmDiaryEntry>('/diary/entries', { params, mock: MOCK_FARM_DIARY }),

  /** POST /diary/entries */
  create: (entry: Partial<FarmDiaryEntry>): Promise<FarmDiaryEntry> =>
    post<FarmDiaryEntry>('/diary/entries', entry),

  /** PUT /diary/entries/{id} */
  update: (entryId: string, updates: Partial<FarmDiaryEntry>): Promise<FarmDiaryEntry> =>
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

  /** POST /diary/receipt-scan */
  receiptScan: (body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/diary/receipt-scan', body),
};
