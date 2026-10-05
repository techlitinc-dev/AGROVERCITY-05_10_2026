import { api } from './client';

// Verified against backend/app/routers/post_harvest.py (prefix `/post-harvest`)
// and backend/app/models/cold_storage.py.
//
// QUIRK (do not "fix"): the cold-storage domain stores money in RUPEES (floats),
// not integer paisa — `ratePerQuintalMonth`, `valuationRupees`,
// `totalEstimatedRent`, `totalAccruedRent` are all rupee amounts. Every helper
// here renders ₹ directly from the rupee value; do NOT divide by 100.
//
// Another quirk: the inward handler takes a JSON body (not multipart). A photo
// is accepted as an optional data-URL string on the extended request model.

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

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
  ownerUid?: string | null;
  distanceKm: number;
  tempRange: string;
  availableMT: number;
  ratePerQuintalMonth: number;
  facilityType: string;
  managerName?: string | null;
  contactPhone?: string | null;
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

export interface ChamberInput {
  name: string;
  chamberType?: string;
  capacityMT: number;
  tempRange?: string;
  status?: string;
}

export interface FacilityInput {
  name: string;
  facilityType?: string;
  capacityMT: number;
  ratePerQuintalMonth?: number;
  address?: string;
  district?: string;
  state?: string;
  managerName?: string;
  contactPhone?: string;
  tempRange?: string;
  wdraRegistered?: boolean;
  wdraRegNo?: string | null;
  distanceKm?: number;
  supportedCrops?: string[];
  chambers?: ChamberInput[];
}

export interface ColdStorageBookInput {
  quantityQuintals: number;
  fromDate: string;
  months: number;
}

export interface ColdStorageApplyInput {
  cropName?: string;
  variety?: string;
  quantityQuintals: number;
  fromDate: string;
  months?: number;
  packagingType?: string;
  bagsCount?: number;
  notes?: string;
  estimatedValueRupees?: number;
  requestedChamberType?: string;
}

export interface TimelineEntry {
  status: string;
  title: string;
  description: string;
  timestamp: string;
}

export interface ReleaseRequest {
  requestedQuintals: number;
  pickupDate: string;
  vehicleNumber?: string | null;
  notes?: string | null;
  requestedAt: string;
}

export interface ColdStorageBooking {
  id: string;
  facilityId: string;
  facilityName: string;
  farmerUid: string;
  farmerName: string;
  farmerPhone?: string;
  cropName: string;
  variety?: string | null;
  quantityQuintals: number;
  fromDate: string;
  months: number;
  ratePerQuintalMonth: number;
  estimatedMonthlyRent: number;
  totalEstimatedRent: number;
  status: string;
  bookedAt: string;
  timeline?: TimelineEntry[];
  reviewedAt?: string;
  reviewedBy?: string;
  allocatedChamberId?: string | null;
  allocatedChamberName?: string;
  providerNotes?: string | null;
  rejectionReason?: string | null;
  chamberId?: string;
  lotNumber?: string;
  inwardGrossWeightKg?: number;
  inwardTareWeightKg?: number;
  inwardNetQuintals?: number;
  inwardBags?: number;
  inwardDate?: string;
  moisturePercent?: number | null;
  qcGrade?: string;
  receiptNumber?: string;
  valuationRupees?: number;
  inwardPhoto?: string | null;
  outwardReleasedQuintals?: number;
  remainingQuintals?: number;
  gatePassNumber?: string;
  outwardDate?: string;
  rentPaid?: number;
  paymentStatus?: string;
  releaseRequest?: ReleaseRequest;
}

/** Shaped row returned by `GET /users/me/bookings` under `coldStorage`. */
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
  depositorPhone: string;
  cropName: string;
  variety?: string | null;
  netQuintals: number;
  bagsCount: number;
  qcGrade: string;
  moisturePercent?: number | null;
  chamberName: string;
  lotNumber: string;
  valuationRupees: number;
  issueDate: string;
  pledgeFinancingEligible: boolean;
  status: string;
}

export interface ProviderStats {
  totalCapacityMT: number;
  occupiedMT: number;
  availableMT: number;
  occupancyPercent: number;
  pendingBookingsCount: number;
  activeStoredLotsCount: number;
  totalFarmersCount: number;
  totalAccruedRent: number;
  totalValuationStored: number;
}

export interface ReviewInput {
  action: 'approve' | 'reject';
  notes?: string;
  rejectionReason?: string;
  allocatedChamberId?: string;
}

export interface GateInwardInput {
  chamberId?: string;
  lotNumber?: string;
  grossWeightKg: number;
  tareWeightKg?: number;
  netQuintals: number;
  actualBags: number;
  moisturePercent?: number;
  qcGrade?: string;
  valuationRupees?: number;
  /** Optional photo as a data-URL string (the JSON handler has no multipart). */
  photo?: string;
}

export interface GateReleaseInput {
  releaseQuintals: number;
  vehicleNumber?: string;
  driverName?: string;
  gatePassRemarks?: string;
  amountPaid?: number;
}

export interface InwardResult {
  booking: ColdStorageBooking;
  receipt: WarehouseReceipt;
}

export interface ReleaseResult {
  booking: ColdStorageBooking;
  gatePassNumber: string;
  releasedQuintals: number;
  remainingQuintals: number;
}

export interface ChamberResult {
  chamber: ColdStorageChamber;
  facility: ColdStorageFacility;
}

/** ₹ with 2 decimals — cold-storage amounts are rupees, not paisa. */
export function fmtINR(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Quintal/Metric-ton numbers with up to 1 decimal. */
export function fmtQty(value: number): string {
  return value.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// ---- Farmer & public ----

export async function listColdStorage(): Promise<Paged<ColdStorageFacility>> {
  const { data } = await api.get<Paged<ColdStorageFacility>>('/post-harvest/cold-storage');
  return data;
}

export async function getColdStorage(facilityId: string): Promise<ColdStorageFacility> {
  const { data } = await api.get<ColdStorageFacility>(`/post-harvest/cold-storage/${facilityId}`);
  return data;
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

export async function applyColdStorage(
  facilityId: string,
  payload: ColdStorageApplyInput
): Promise<ColdStorageBooking> {
  const { data } = await api.post<ColdStorageBooking>(
    `/post-harvest/cold-storage/${facilityId}/apply`,
    payload
  );
  return data;
}

export async function getBooking(bookingId: string): Promise<ColdStorageBooking> {
  const { data } = await api.get<ColdStorageBooking>(`/post-harvest/bookings/${bookingId}`);
  return data;
}

/** Shaped rows for the caller (ids only) — enrich with {@link getBooking}. */
export async function listMyColdStorageBookings(): Promise<MyColdStorageBooking[]> {
  const { data } = await api.get<{ coldStorage?: MyColdStorageBooking[] }>('/users/me/bookings');
  return data.coldStorage ?? [];
}

export async function requestBookingRelease(
  bookingId: string,
  payload: { requestedQuintals: number; pickupDate: string; vehicleNumber?: string; notes?: string }
): Promise<ColdStorageBooking> {
  const { data } = await api.post<ColdStorageBooking>(
    `/post-harvest/bookings/${bookingId}/request-release`,
    payload
  );
  return data;
}

export async function getReceipt(receiptNumber: string): Promise<WarehouseReceipt> {
  const { data } = await api.get<WarehouseReceipt>(`/post-harvest/receipts/${receiptNumber}`);
  return data;
}

// ---- Provider console ----

export async function getProviderStats(): Promise<ProviderStats> {
  const { data } = await api.get<ProviderStats>('/post-harvest/provider/stats');
  return data;
}

export async function listProviderBookings(
  params: { status?: string; q?: string; facilityId?: string; page?: number; pageSize?: number } = {}
): Promise<Paged<ColdStorageBooking>> {
  const query: Record<string, string | number> = {};
  if (params.status && params.status !== 'all') query.status = params.status;
  if (params.q) query.q = params.q;
  if (params.facilityId) query.facilityId = params.facilityId;
  if (params.page) query.page = params.page;
  if (params.pageSize) query.pageSize = params.pageSize;
  const { data } = await api.get<Paged<ColdStorageBooking>>('/post-harvest/provider/bookings', {
    params: query,
  });
  return data;
}

export async function getProviderBooking(bookingId: string): Promise<ColdStorageBooking> {
  const { data } = await api.get<ColdStorageBooking>(`/post-harvest/provider/bookings/${bookingId}`);
  return data;
}

export async function reviewProviderBooking(
  bookingId: string,
  payload: ReviewInput
): Promise<ColdStorageBooking> {
  const { data } = await api.post<ColdStorageBooking>(
    `/post-harvest/provider/bookings/${bookingId}/review`,
    payload
  );
  return data;
}

export async function inwardProviderBooking(
  bookingId: string,
  payload: GateInwardInput
): Promise<InwardResult> {
  const { data } = await api.post<InwardResult>(
    `/post-harvest/provider/bookings/${bookingId}/inward`,
    payload
  );
  return data;
}

export async function releaseProviderBooking(
  bookingId: string,
  payload: GateReleaseInput
): Promise<ReleaseResult> {
  const { data } = await api.post<ReleaseResult>(
    `/post-harvest/provider/bookings/${bookingId}/release`,
    payload
  );
  return data;
}

export async function listProviderFacilities(mineOnly = false): Promise<ColdStorageFacility[]> {
  const { data } = await api.get<{ data: ColdStorageFacility[] }>('/post-harvest/provider/facilities', {
    params: mineOnly ? { mine_only: true } : {},
  });
  return data.data;
}

export async function createFacility(payload: FacilityInput): Promise<ColdStorageFacility> {
  const { data } = await api.post<ColdStorageFacility>('/post-harvest/provider/facilities', payload);
  return data;
}

export async function updateFacility(
  facilityId: string,
  payload: Partial<FacilityInput>
): Promise<ColdStorageFacility> {
  const { data } = await api.put<ColdStorageFacility>(
    `/post-harvest/provider/facilities/${facilityId}`,
    payload
  );
  return data;
}

export async function addChamber(
  facilityId: string,
  payload: ChamberInput
): Promise<ChamberResult> {
  const { data } = await api.post<ChamberResult>(
    `/post-harvest/provider/facilities/${facilityId}/chambers`,
    payload
  );
  return data;
}
