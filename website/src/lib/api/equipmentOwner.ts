import { api } from './client';

/** Owner fleet row from GET /equipment/owner/fleet. */
export interface EquipmentItem {
  equipmentId: string;
  name: string;
  bookedHoursThisWeek: number;
  weeklyIncome: number;
  status: string;
  docStatus?: string;
  rejectionReason?: string | null;
  insuranceExpiry?: string;
  rcExpiry?: string;
}

/** Farmer-facing machine card from GET /equipment (verified machines only). */
export interface EquipmentListItem {
  id: string;
  name: string;
  type: string;
  ownerType: string;
  hourlyRate: number;
  perAcreRate?: number | null;
  distanceKm: number;
  ratingAvg?: number | null;
  ratingCount?: number;
  docStatus?: string;
}

export interface EquipmentSlot {
  id: string;
  equipmentId: string;
  date: string;
  slotName: string;
  duration: string;
  status: string;
  bookedByName?: string | null;
  priceRupees: number;
  recommendedTask: string;
}

export interface EquipmentQuote {
  equipmentId: string;
  mode: string;
  quantity: number;
  unitPriceRupees: number;
  unitLabel: string;
  totalRupees: number;
  totalPaisa: number;
  currency: string;
}

export interface CheckInPin {
  lat: number;
  lng: number;
  label: string;
  event: string;
  at: string;
  by: string;
}

export interface EquipmentBooking {
  id?: string;
  /** Pending-inbox rows key the booking id as `bookingId`. */
  bookingId?: string;
  equipmentId: string;
  equipmentName?: string;
  farmerName?: string;
  userId?: string;
  date?: string;
  slotName?: string;
  priceRupees?: number;
  status?: string;
  ownerType?: string;
  counterRateRupees?: number;
  counterRateType?: string;
  counterReason?: string;
  hoursLogged?: number;
  createdAt?: string;
}

export interface JobExecution {
  bookingId: string;
  equipmentId: string;
  jobStatus: 'assigned' | 'en_route' | 'on_site' | 'work_started' | 'work_completed' | 'verified';
  checklist: {
    mobilizationPhotos: boolean;
    preWorkConditionChecked: boolean;
    operatorDispatched: boolean;
    workCompletedProof: boolean;
    farmerSignOff: boolean;
  };
  statusTimeline: Array<{ status: string; timestamp: string; notes?: string }>;
  notes: string;
  hoursLogged: number;
  acresCovered: number;
  evidencePhotoUrl?: string;
  checkInPins?: CheckInPin[];
}

export interface DamageClaim {
  id: string;
  ownerId: string;
  equipmentId: string;
  equipmentName: string;
  bookingId: string;
  incidentDate: string;
  description: string;
  estimatedRepairCostRupees: number;
  photoEvidenceUrls: string[];
  status: string;
  createdAt: string;
}

export interface EquipmentOwnerAnalytics {
  fleetSize: number;
  activeFleet: number;
  utilizationRatePercent: number;
  pendingRequestsCount: number;
  totalCompletedJobs: number;
  totalRevenueRupees: number;
  totalHoursLogged: number;
  repeatHireRatePercent: number;
  averageRating: number;
  categoryBreakdown: Array<{ category: string; revenue: number }>;
  utilizationTrend: Array<{ day: string; hours: number; revenue: number }>;
}

export async function fetchOwnerAnalytics(): Promise<EquipmentOwnerAnalytics> {
  const res = await api.get<EquipmentOwnerAnalytics>('/equipment/owner/analytics');
  return res.data;
}

export async function fetchMyEquipment(): Promise<EquipmentItem[]> {
  const res = await api.get<{ data: EquipmentItem[] }>('/equipment/owner/fleet');
  return res.data.data;
}

export async function createEquipment(data: {
  name: string;
  type: string;
  hourlyRate: number;
  perAcreRate?: number;
  slotTemplate?: any[];
  rcDocUrl?: string;
  insuranceDocUrl?: string;
}): Promise<EquipmentItem> {
  const res = await api.post<EquipmentItem>('/equipment', data);
  return res.data;
}

export async function fetchPendingBookings(): Promise<EquipmentBooking[]> {
  const res = await api.get<{ data: EquipmentBooking[] }>('/equipment/bookings/pending');
  return res.data.data;
}

export async function counterBookingQuote(
  bookingId: string,
  data: { revisedRateRupees: number; rateType?: string; reason?: string; validityHours?: number }
): Promise<EquipmentBooking> {
  const res = await api.post<EquipmentBooking>(`/equipment/bookings/${bookingId}/counter`, data);
  return res.data;
}

export async function approveBooking(bookingId: string): Promise<EquipmentBooking> {
  const res = await api.post<EquipmentBooking>(`/equipment/bookings/${bookingId}/approve`);
  return res.data;
}

export async function rejectBooking(bookingId: string, reason: string): Promise<{ ok: boolean }> {
  const res = await api.post<{ ok: boolean }>(`/equipment/bookings/${bookingId}/reject`, { reason });
  return res.data;
}

export async function fetchJobExecution(bookingId: string): Promise<JobExecution> {
  const res = await api.get<JobExecution>(`/equipment/bookings/${bookingId}/execution`);
  return res.data;
}

export async function updateJobExecution(
  bookingId: string,
  data: {
    jobStatus: string;
    notes?: string;
    evidencePhotoUrl?: string;
    hoursLogged?: number;
    acresCovered?: number;
  }
): Promise<JobExecution> {
  const res = await api.post<JobExecution>(`/equipment/bookings/${bookingId}/execution`, data);
  return res.data;
}

export async function fetchDamageClaims(): Promise<DamageClaim[]> {
  const res = await api.get<{ data: DamageClaim[] }>('/equipment/owner/damage-claims');
  return res.data.data;
}

export async function createDamageClaim(data: {
  bookingId: string;
  equipmentId: string;
  incidentDate: string;
  description: string;
  estimatedRepairCostRupees: number;
  photoEvidenceUrls?: string[];
}): Promise<DamageClaim> {
  const res = await api.post<DamageClaim>('/equipment/owner/damage-claims', data);
  return res.data;
}

// ---- Farmer face (backend/app/routers/equipment.py) ----

export async function fetchEquipmentList(type?: string): Promise<EquipmentListItem[]> {
  const res = await api.get<{ data: EquipmentListItem[] }>('/equipment', { params: type ? { type } : {} });
  return res.data.data;
}

export async function fetchEquipmentSlots(equipmentId: string, date?: string): Promise<EquipmentSlot[]> {
  const res = await api.get<{ data: EquipmentSlot[] }>(`/equipment/${equipmentId}/slots`, {
    params: date ? { date } : {},
  });
  return res.data.data;
}

export async function quoteEquipment(
  equipmentId: string,
  data: { mode: 'hourly' | 'perAcre' | 'package'; hours?: number; acres?: number; packageName?: string }
): Promise<EquipmentQuote> {
  const res = await api.post<EquipmentQuote>(`/equipment/${equipmentId}/quote`, data);
  return res.data;
}

export async function bookEquipmentSlot(
  slotId: string,
  farmerName: string
): Promise<{ booking: EquipmentBooking; status: string; agriCoinsEarned: number }> {
  const res = await api.post<{ booking: EquipmentBooking; status: string; agriCoinsEarned: number }>(
    `/equipment/slots/${slotId}/book`,
    { farmerName }
  );
  return res.data;
}

export async function joinEquipmentWaitlist(slotId: string): Promise<{ ok: boolean }> {
  const res = await api.post<{ ok: boolean }>(`/equipment/slots/${slotId}/waitlist`);
  return res.data;
}

export async function cancelEquipmentBooking(bookingId: string): Promise<{ ok: boolean }> {
  const res = await api.delete<{ ok: boolean }>(`/equipment/bookings/${bookingId}`);
  return res.data;
}

// ---- Dispatch check-in pins (E4-lite) ----

export async function postCheckInPin(
  bookingId: string,
  data: { lat: number; lng: number; label?: string; event: string }
): Promise<CheckInPin> {
  const res = await api.post<CheckInPin>(`/equipment/bookings/${bookingId}/check-in`, data);
  return res.data;
}

export async function fetchCheckInPins(bookingId: string): Promise<CheckInPin[]> {
  const res = await api.get<{ bookingId: string; data: CheckInPin[] }>(
    `/equipment/bookings/${bookingId}/check-in`
  );
  return res.data.data;
}
