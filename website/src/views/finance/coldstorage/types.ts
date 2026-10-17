/**
 * Shared row helpers for the cold-storage provider console.
 * Live provider payloads are loosely shaped, so views read through accessors.
 */

export type Row = Record<string, unknown>;

export function str(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

export function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return fallback;
}

export function arr(v: unknown): Row[] {
  return Array.isArray(v) ? (v as Row[]) : [];
}

export const fromPaisa = (paisa: number): number => paisa / 100;

export interface BookingRow extends Row {
  id?: string;
  farmerName?: string;
  farmerPhone?: string;
  cropName?: string;
  variety?: string;
  quantityQuintals?: number;
  bagsCount?: number;
  facilityId?: string;
  facilityName?: string;
  status?: string;
  bookedAt?: string;
  expectedDate?: string;
  receiptNumber?: string;
  lotNumber?: string;
  gatePassNumber?: string;
  inwardNetQuintals?: number;
  outwardReleasedQuintals?: number;
  remainingQuintals?: number;
  valuationRupees?: number;
  totalEstimatedRent?: number;
  rentPaid?: number;
  paymentStatus?: string;
  timeline?: Row[];
}

export interface FacilityRow extends Row {
  id?: string;
  name?: string;
  district?: string;
  state?: string;
  facilityType?: string;
  totalCapacityMT?: number;
  availableMT?: number;
  bookedQuintals?: number;
  ratePerQuintalMonth?: number;
  tempRange?: string;
  wdraRegistered?: boolean;
  wdraRegNo?: string;
  managerName?: string;
  contactPhone?: string;
  supportedCrops?: unknown;
  chambers?: unknown;
}

export const bookingId = (b: BookingRow): string => str(b.id);

export const BOOKING_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'inwarded', label: 'Inwarded' },
  { value: 'release_requested', label: 'Release Requested' },
  { value: 'partially_released', label: 'Partially Released' },
  { value: 'released', label: 'Released' },
  { value: 'rejected', label: 'Rejected' },
];
