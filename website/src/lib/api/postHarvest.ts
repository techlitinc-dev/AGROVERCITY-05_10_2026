import { api } from './client';

/**
 * Post-harvest farmer-face wrappers — mirror `backend/app/routers/post_harvest.py`.
 *
 * Backend quirks (verified):
 * - Cold-storage money is stored in RUPEES (floats), not integer paisa —
 *   `ratePerQuintalMonth`, `valuationRupees`, `totalEstimatedRent` are rupees;
 *   render them with {@link formatRupees} (do NOT divide by 100).
 * - The phase-05 grading additions, by contrast, carry integer paisa
 *   (`recommendedPricePaisa`, `priceBandPaisa.*`).
 * - `POST /post-harvest/grade` is multipart (1–3 `images`, jpg/png ≤ 5 MB),
 *   accepts optional `crop` / `quantityQuintals` / `mandiModalPaisa` form fields,
 *   and answers the standard error envelope on failure. A low-confidence grade
 *   returns `status: "pending_human"` with `grade: null`.
 * - `/receipts` lists only the caller's own e-NWR documents; single receipts
 *   are owner/provider-gated server-side (foreign reads 404).
 * - Writes carry `Idempotency-Key` (added by `client.ts`).
 */

export interface ColdStorageChamber {
  id: string;
  name: string;
  chamberType: string;
  capacityMT: number;
  currentOccupancyMT: number;
  tempRange: string;
  status: string;
}

export interface ColdStorageFacility {
  id: string;
  name: string;
  distanceKm: number;
  tempRange: string;
  availableMT: number;
  ratePerQuintalMonth: number;
  facilityType: string;
  managerName?: string | null;
  address?: string | null;
  district: string;
  state: string;
  wdraRegistered: boolean;
  wdraRegNo?: string | null;
  supportedCrops: string[];
  chambers: ColdStorageChamber[];
  totalCapacityMT: number;
  bookedQuintals: number;
}

export interface ColdStorageBookInput {
  quantityQuintals: number;
  fromDate: string;
  months: number;
}

export interface ColdStorageBooking {
  id: string;
  facilityId: string;
  facilityName: string;
  farmerUid: string;
  quantityQuintals: number;
  fromDate: string;
  months: number;
  ratePerQuintalMonth: number;
  totalEstimatedRent: number;
  status: string;
  bookedAt: string;
  receiptNumber?: string;
}

export interface MyColdStorageBooking {
  id: string;
  facilityId: string;
  facilityName: string;
  quantityQuintals: number;
  fromDate: string;
  months: number;
  status: string;
  bookedAt: string;
  kind?: string;
}

export interface WarehouseReceipt {
  receiptNumber: string;
  bookingId: string;
  facilityId: string;
  facilityName: string;
  wdraRegNo?: string | null;
  depositorName: string;
  cropName: string;
  netQuintals: number;
  bagsCount: number;
  qcGrade: string;
  chamberName: string;
  lotNumber: string;
  valuationRupees: number;
  issueDate: string;
  pledgeFinancingEligible: boolean;
  status: string;
}

export async function listColdStorage(): Promise<ColdStorageFacility[]> {
  const { data } = await api.get<{ data: ColdStorageFacility[] }>('/post-harvest/cold-storage');
  return data.data;
}

export async function bookColdStorage(
  facilityId: string,
  payload: ColdStorageBookInput
): Promise<ColdStorageBooking> {
  const { data } = await api.post<ColdStorageBooking>(
    `/post-harvest/cold-storage/${facilityId}/book`,
    payload
  );
  return data;
}

/** The caller's cold-storage bookings, shaped under `/users/me/bookings`. */
export async function listMyColdStorageBookings(): Promise<MyColdStorageBooking[]> {
  const { data } = await api.get<{ coldStorage?: MyColdStorageBooking[] }>('/users/me/bookings');
  return data.coldStorage ?? [];
}

export async function listMyReceipts(): Promise<WarehouseReceipt[]> {
  const { data } = await api.get<{ data: WarehouseReceipt[] }>('/post-harvest/receipts');
  return data.data;
}

export async function getReceipt(receiptNumber: string): Promise<WarehouseReceipt> {
  const { data } = await api.get<WarehouseReceipt>(`/post-harvest/receipts/${receiptNumber}`);
  return data;
}

// ---------- AI grading (M10) ----------

export interface PriceBandPaisa {
  lowPaisa: number;
  highPaisa: number;
  recommendedPaisa: number;
  mandiModalPaisa: number | null;
  vsMandiPct: number | null;
}

export interface GradeResult {
  /** null when the grade is routed to a human grader (`pending_human`). */
  grade: string | null;
  uniformityPercent: number;
  shelfLifeDays: number;
  /** Indicative price in rupees/quintal (legacy mobile contract). */
  recommendedPrice: number;
  recommendedPricePaisa: number;
  priceBandPaisa: PriceBandPaisa;
  confidence: number;
  confidenceClass: string | null;
  source: 'ai' | 'stub';
  decisionId: string | null;
  automationLevel: string;
  /** True when the deterministic stub answered (AI off/demo). */
  demo: boolean;
  scanId: string;
  needsHuman: boolean;
  status: 'graded' | 'pending_human';
  taskId: string | null;
}

export async function gradeProduce(
  images: File[] | Blob[],
  opts: { crop?: string; quantityQuintals?: number; mandiModalPaisa?: number } = {},
  filenames: string[] = []
): Promise<GradeResult> {
  const form = new FormData();
  images.forEach((image, index) => {
    form.append('images', image, filenames[index] ?? `produce-${index + 1}.jpg`);
  });
  if (opts.crop) form.append('crop', opts.crop);
  if (opts.quantityQuintals !== undefined) form.append('quantityQuintals', String(opts.quantityQuintals));
  if (opts.mandiModalPaisa !== undefined) form.append('mandiModalPaisa', String(opts.mandiModalPaisa));
  const { data } = await api.post<GradeResult>('/post-harvest/grade', form);
  return data;
}

/** Rupees with 2 decimals — cold-storage amounts are rupees, not paisa. */
export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Integer paisa → ₹ (M10 grading band). */
export function formatPaisa(paisa: number): string {
  return `₹${(paisa / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
