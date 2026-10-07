import { api } from './client';

/**
 * Water module wrappers — mirror `backend/app/routers/water.py` one-to-one.
 *
 * Backend quirks (verified):
 * - Every route requires the `farmer` role (403 `FORBIDDEN_ROLE` otherwise).
 * - Errors use the standard envelope `{ error: { code, message, fieldErrors } }`
 *   surfaced by `client.ts` as `ApiError`.
 * - `/water/schedule` also emits one irrigation task per plot per day through the
 *   phase-01 task engine (`/dashboard/p/water`); when a rain forecast meets the
 *   threshold the emitted task carries a skip-today suggestion and each item's
 *   `skipToday` is true. Without `lat`/`lng` (and no profile location) no rain
 *   data is invented and `rainExpected` stays false.
 * - `/water/groundwater` requires `district` (400 `MISSING_DISTRICT`) and reads
 *   the CGWB-style gauge for that district.
 * - `/water/pmksy-calculator` accepts either `acres` (PMKSY benchmark per-acre
 *   cost) or an explicit total `costPaisa`; the authoritative `*Paisa` fields are
 *   integer paisa (the legacy rupee fields are kept for older clients).
 */

export interface WaterScheduleItem {
  plotName: string;
  moisturePercent: number;
  recommendedMinutes: number;
  method: string;
  /** Rain forecast met for today (server decision). */
  rainExpected: boolean;
  /** The irrigation task for today carries the skip-today suggestion. */
  skipToday: boolean;
}

export interface WaterSchedulePage {
  data: WaterScheduleItem[];
  page: number;
  pageSize: number;
  total: number;
}

export async function getWaterSchedule(params?: {
  lat?: number;
  lng?: number;
}): Promise<WaterSchedulePage> {
  const { data } = await api.get<WaterSchedulePage>('/water/schedule', { params: params ?? {} });
  return data;
}

export interface GroundwaterGauge {
  district: string;
  depthMeters: number;
  zone: string;
  measuredAt: string;
}

export async function getGroundwater(district: string): Promise<GroundwaterGauge> {
  const { data } = await api.get<GroundwaterGauge>('/water/groundwater', {
    params: { district },
  });
  return data;
}

export interface CanalSlot {
  canalName: string;
  nextDate: string;
  slotTime: string;
}

export interface CanalRotationPage {
  data: CanalSlot[];
  page: number;
  pageSize: number;
  total: number;
}

export async function getCanalRotation(canal?: string): Promise<CanalRotationPage> {
  const { data } = await api.get<CanalRotationPage>('/water/canal-rotation', {
    params: canal ? { canal } : {},
  });
  return data;
}

export interface PmksyInput {
  /** Estimated total micro-irrigation cost in integer paisa (preferred input). */
  costPaisa?: number;
  /** Alternative: acres, which falls back to the PMKSY benchmark per-acre cost. */
  acres?: number;
}

export interface PmksyResult {
  totalCost: number;
  subsidyPercent: number;
  subsidyAmount: number;
  farmerShare: number;
  totalCostPaisa: number;
  subsidyAmountPaisa: number;
  farmerSharePaisa: number;
}

export async function pmksyCalculator(input: PmksyInput): Promise<PmksyResult> {
  const { data } = await api.post<PmksyResult>('/water/pmksy-calculator', input);
  return data;
}

/** Integer paisa → ₹ display (the money convention for this module). */
export function formatPaisa(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
