import { api } from './client';

export interface EquipmentItem {
  id: string;
  name: string;
  type: string;
  ownerType: string;
  ownerId?: string;
  hourlyRate: number;
  perAcreRate?: number;
  distanceKm?: number;
  active?: boolean;
  docStatus?: string;
  rcDocUrl?: string;
  insuranceDocUrl?: string;
  slotTemplate?: Array<{ slotName: string; duration: string; priceRupees: number; recommendedTask: string }>;
  ratingAvg?: number;
  ratingCount?: number;
  createdAt?: string;
}

export interface EquipmentBooking {
  id: string;
  equipmentId: string;
  equipmentName?: string;
  farmerName?: string;
  userId?: string;
  date?: string;
  slotName?: string;
  priceRupees?: number;
  status: 'pending' | 'booked' | 'in_progress' | 'completed' | 'rejected' | 'countered';
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
  const res = await api.get<{ data: EquipmentItem[] }>('/equipment/my');
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
