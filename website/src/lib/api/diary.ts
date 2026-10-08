import { api } from './client';
import type { Paged } from './trade';

/**
 * Cashbook (farm diary) — full cash management & accounting per user.
 * Contracts verified against backend/app/routers/diary.py. Open to ALL
 * personas (product decision 2026-10). Money rules: only income/expense
 * entries with amount != 0 move money; farmActivity is log-only.
 */

export type DiaryEntryType = 'income' | 'expense' | 'farmActivity';

export interface DiaryEntry {
  id: string;
  title: string;
  category: string;
  type: DiaryEntryType;
  amount: number;
  date: string;
  cropName?: string | null;
  notes?: string | null;
  photos: string[];
  quantity?: number | null;
  unit?: string | null;
  party?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiaryEntryPayload {
  title: string;
  category: string;
  type: DiaryEntryType;
  amount: number;
  date: string;
  cropName?: string;
  notes?: string;
  photos?: string[];
  quantity?: number;
  unit?: string;
  party?: string;
}

export interface DiaryTotals {
  income: number;
  expense: number;
  net: number;
  entryCount: number;
  incomeCount: number;
  expenseCount: number;
  activityCount: number;
}

export interface DiaryCategoryRow {
  category: string;
  type: string;
  amount: number;
  count: number;
}

export interface DiaryCropRow {
  cropName: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface DiaryMonthRow {
  month: string;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export interface DiaryDayRow {
  date: string;
  income: number;
  expense: number;
  count: number;
}

export interface DiaryAnalytics {
  from?: string | null;
  to?: string | null;
  totals: DiaryTotals;
  byCategory: DiaryCategoryRow[];
  byCrop: DiaryCropRow[];
  byMonth: DiaryMonthRow[];
  byDay: DiaryDayRow[];
}

export interface DiaryEntryCreated {
  entry: DiaryEntry;
  agriCoinsEarned: number;
}

export async function listDiaryEntries(params?: {
  type?: DiaryEntryType;
  category?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}): Promise<Paged<DiaryEntry>> {
  const { data } = await api.get<Paged<DiaryEntry>>('/diary/entries', {
    params: {
      ...(params?.type ? { type: params.type } : {}),
      ...(params?.category ? { category: params.category } : {}),
      ...(params?.from ? { from: params.from } : {}),
      ...(params?.to ? { to: params.to } : {}),
      page: params?.page ?? 1,
      pageSize: params?.pageSize ?? 100,
    },
  });
  return data;
}

export async function createDiaryEntry(payload: DiaryEntryPayload): Promise<DiaryEntryCreated> {
  const { data } = await api.post<DiaryEntryCreated>('/diary/entries', payload);
  return data;
}

export async function updateDiaryEntry(entryId: string, payload: DiaryEntryPayload): Promise<DiaryEntry> {
  const { data } = await api.put<{ entry: DiaryEntry }>(`/diary/entries/${entryId}`, payload);
  return data.entry;
}

export async function deleteDiaryEntry(entryId: string): Promise<void> {
  await api.delete(`/diary/entries/${entryId}`);
}

export async function diaryAnalytics(params?: { from?: string; to?: string }): Promise<DiaryAnalytics> {
  const { data } = await api.get<DiaryAnalytics>('/diary/analytics/summary', {
    params: { ...(params?.from ? { from: params.from } : {}), ...(params?.to ? { to: params.to } : {}) },
  });
  return data;
}

/** Monthly PDF report (backend builds + uploads; returns a download URL). */
export async function diaryReport(params?: { from?: string; to?: string }): Promise<{ reportUrl: string }> {
  const { data } = await api.get<{ reportUrl: string }>('/diary/report', {
    params: { ...(params?.from ? { from: params.from } : {}), ...(params?.to ? { to: params.to } : {}) },
  });
  return data;
}

/** M28 (phase-08 WS-01) — receipt / weigh-slip vision prefill (confirm-only). */
export interface ReceiptScanPrefill {
  amount_paisa: number;
  category: string;
  party: string;
  date: string;
  entry_type: 'expense' | 'income';
  confidence: number;
}

export interface ReceiptScanResponse {
  available: boolean;
  prefill: ReceiptScanPrefill | null;
}

/**
 * POST /v1/diary/receipt-scan — extracts fields from an already-uploaded receipt
 * photo. CONFIRM-ONLY: nothing is written until the user saves the prefilled form.
 * Never invents a numeric fallback — `prefill` is null when unavailable.
 */
export async function scanDiaryReceipt(storagePath: string): Promise<ReceiptScanResponse> {
  const { data } = await api.post<ReceiptScanResponse>('/diary/receipt-scan', { storagePath });
  return data;
}
