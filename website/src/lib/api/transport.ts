import { api } from './client';

/**
 * Transport domain — farmer ↔ transporter booking platform.
 * Contracts verified against backend/app/routers/transport.py.
 * HARD RULE: never render farmerPhone / transporterPhone / driverPhone
 * (spec T15/F17) — these types omit phone fields on purpose.
 */

// ---------- Vehicle catalog & fleet ----------

export interface VehicleType {
  type: string;
  baseFare: number;
  perKmRate: number;
  capacityTonnes: number;
}

export type VehicleDocStatus = 'pending' | 'verified';

export interface OwnerVehicle {
  id: string;
  ownerId: string;
  vehicleType: string;
  registrationNo: string;
  capacityTonnes: number;
  permitType?: string;
  pucExpiry?: string | null;
  fitnessExpiry?: string | null;
  insuranceExpiry?: string | null;
  driverName?: string | null;
  active: boolean;
  docStatus: VehicleDocStatus;
  docReview?: string;
  availableDates?: string[];
  createdAt?: string;
}

export interface VehiclePayload {
  vehicleType: string;
  registrationNo: string;
  capacityTonnes: number;
  permitType?: string;
  pucExpiry?: string;
  fitnessExpiry?: string;
  insuranceExpiry?: string;
  driverName?: string;
}

export async function vehicleCatalog(extended = false): Promise<VehicleType[]> {
  const { data } = await api.get<{ data: VehicleType[] }>('/transport/vehicles', {
    params: extended ? { extended: true } : {},
  });
  return data.data;
}

export async function myVehicles(): Promise<OwnerVehicle[]> {
  const { data } = await api.get<{ data: OwnerVehicle[] }>('/transport/vehicles/my');
  return data.data;
}

export async function createVehicle(payload: VehiclePayload): Promise<OwnerVehicle> {
  const { data } = await api.post<OwnerVehicle>('/transport/vehicles', payload);
  return data;
}

export async function updateVehicle(vehicleId: string, payload: VehiclePayload): Promise<OwnerVehicle> {
  const { data } = await api.put<OwnerVehicle>(`/transport/vehicles/${vehicleId}`, payload);
  return data;
}

export async function deleteVehicle(vehicleId: string): Promise<OwnerVehicle> {
  const { data } = await api.delete<OwnerVehicle>(`/transport/vehicles/${vehicleId}`);
  return data;
}

export async function setAvailability(vehicleId: string, availableDates: string[]): Promise<OwnerVehicle> {
  const { data } = await api.put<OwnerVehicle>(`/transport/vehicles/${vehicleId}/availability`, {
    availableDates,
  });
  return data;
}

export interface VehicleCalendarItem {
  bookingId: string;
  date: string;
  status: string;
  pickup: string;
  drop: string;
}

export async function vehicleCalendar(vehicleId: string): Promise<{ data: VehicleCalendarItem[] }> {
  const { data } = await api.get(`/transport/vehicles/${vehicleId}/calendar`);
  return data;
}

// ---------- Transporter profile ----------

export interface TransporterProfile {
  businessName?: string;
  transporterType?: string;
  operatingRoutes?: string[];
  operatingStates?: string[];
  specializations?: string[];
  fleetSize?: number;
  experienceYears?: number;
  stats?: {
    totalVehicles?: number;
    totalTrips?: number;
    activeTrips?: number;
    lifetimeEarnings?: number;
    rating?: number;
    onTimeRate?: number;
    verified?: boolean;
  };
  [key: string]: unknown;
}

export async function transporterProfile(): Promise<TransporterProfile> {
  const { data } = await api.get<TransporterProfile>('/transport/profile');
  return data;
}

export async function updateTransporterProfile(payload: Partial<TransporterProfile>): Promise<TransporterProfile> {
  const { data } = await api.put<TransporterProfile>('/transport/profile', payload);
  return data;
}

// ---------- Fares & bookings ----------

export interface FareEstimate {
  baseFare: number;
  distanceFare: number;
  totalFare: number;
  loadingLabor: number;
  perishableSurcharge: number;
  tollEstimate: number;
  returnDiscount: number;
  breakdown?: Record<string, unknown> | null;
}

export async function fareEstimate(vehicleType: string, distanceKm: number): Promise<FareEstimate> {
  const { data } = await api.post<FareEstimate>('/transport/fare-estimate', {
    vehicleType,
    distanceKm,
  });
  return data;
}

export type TransportBookingStatus =
  | 'requested'
  | 'accepted'
  | 'enRoute'
  | 'delivered'
  | 'cancelled';

export interface Waypoint {
  waypoint: string;
  label: string;
  time: string;
  lat?: number;
  lng?: number;
}

export interface TransportBooking {
  id: string;
  userId: string;
  transporterId?: string | null;
  vehicleType: string;
  distanceKm: number;
  pickup: string;
  drop: string;
  date: string;
  lotId?: string | null;
  commodity?: string | null;
  weightQuintals?: number | null;
  packaging?: string | null;
  notes?: string | null;
  fare: number;
  status: TransportBookingStatus;
  vehicleId?: string | null;
  vehicleNo?: string | null;
  driverName?: string | null;
  pod?: {
    photos: string[];
    receiverName: string;
    receiverPhone?: string | null;
    damageNotes?: string | null;
    deliveredAt: string;
  } | null;
  weighbridgeSlip?: Record<string, unknown> | null;
  lastLocation?: Record<string, unknown> | null;
  waypointsLog?: Waypoint[];
  cancellationReason?: string | null;
  cancelledBy?: string | null;
  lot?: { crop: string; quantityQuintals: number; expectedRate: number } | null;
  createdAt: string;
}

export interface BookingPayload {
  vehicleType: string;
  distanceKm: number;
  pickup: string;
  drop: string;
  date: string;
  commodity?: string;
  weightQuintals?: number;
  packaging?: string;
  notes?: string;
}

export async function createBooking(payload: BookingPayload): Promise<TransportBooking> {
  const { data } = await api.post<TransportBooking>('/transport/bookings', payload);
  return data;
}

export interface Paged<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

export async function transportBookings(status?: TransportBookingStatus): Promise<Paged<TransportBooking>> {
  const { data } = await api.get<Paged<TransportBooking>>('/transport/bookings', {
    params: status ? { status } : {},
  });
  return data;
}

export async function getTransportBooking(bookingId: string): Promise<TransportBooking> {
  const { data } = await api.get<TransportBooking>(`/transport/bookings/${bookingId}`);
  return data;
}

export async function updateBookingStatus(
  bookingId: string,
  payload: {
    status: string;
    vehicleId?: string;
    vehicleNo?: string;
    podPhotos?: string[];
    receiverName?: string;
    damageNotes?: string;
  }
): Promise<TransportBooking> {
  const { data } = await api.patch<TransportBooking>(`/transport/bookings/${bookingId}`, payload);
  return data;
}

export async function acceptBooking(
  bookingId: string,
  payload: { vehicleId?: string; vehicleNo?: string; driverName?: string }
): Promise<TransportBooking> {
  const { data } = await api.post<TransportBooking>(`/transport/bookings/${bookingId}/accept`, payload);
  return data;
}

export async function rejectBooking(bookingId: string, reason: string): Promise<TransportBooking> {
  const { data } = await api.post<TransportBooking>(`/transport/bookings/${bookingId}/reject`, {
    reason,
  });
  return data;
}

export async function cancelBookingByFarmer(bookingId: string, reason: string): Promise<TransportBooking> {
  const { data } = await api.post<TransportBooking>(`/transport/bookings/${bookingId}/cancel`, {
    reason,
  });
  return data;
}

// ---------- Farmer trip list (viewer-gated) ----------

export interface MyBookingsResponse {
  transport: Array<{
    id: string;
    vehicleType: string;
    pickup: string;
    drop: string;
    date: string;
    fare: number;
    status: string;
    kind: string;
  }>;
  [key: string]: unknown;
}

export async function myBookings(status?: string): Promise<MyBookingsResponse> {
  const { data } = await api.get<MyBookingsResponse>('/users/me/bookings', {
    params: status ? { status } : {},
  });
  return data;
}

// ---------- Load board / auction ----------

export interface OpenLoad {
  id: string;
  userId: string;
  pickupLocation: string;
  dropLocation: string;
  crop: string;
  quantityQuintals: number;
  packaging: string;
  perishable?: boolean;
  preferredVehicleType: string;
  pickupDate: string;
  targetFare: number;
  notes?: string | null;
  status: 'open' | 'booked';
  bidsCount?: number;
  distanceKm?: number;
  createdAt?: string;
  /** Present on my own loads. */
  acceptedBidId?: string | null;
}

export interface LoadPayload {
  pickupLocation: string;
  dropLocation: string;
  crop: string;
  quantityQuintals: number;
  packaging?: string;
  perishable?: boolean;
  preferredVehicleType: string;
  pickupDate: string;
  targetFare: number;
  notes?: string;
}

export async function openLoads(params?: { crop?: string; pickup?: string; drop?: string }): Promise<{ data: OpenLoad[] }> {
  const { data } = await api.get<{ data: OpenLoad[] }>('/transport/loads', { params });
  return data;
}

export async function createLoad(payload: LoadPayload): Promise<OpenLoad> {
  const { data } = await api.post<OpenLoad>('/transport/loads', payload);
  return data;
}

export interface LoadBid {
  id: string;
  loadId: string;
  transporterId: string;
  transporterName: string;
  quotedFare: number;
  vehicleId?: string | null;
  vehicleNo?: string | null;
  estimatedPickupTime?: string | null;
  notes?: string | null;
  status: 'pending' | 'accepted';
  createdAt: string;
}

export async function loadBids(loadId: string): Promise<{ data: LoadBid[] }> {
  const { data } = await api.get<{ data: LoadBid[] }>(`/transport/loads/${loadId}/bids`);
  return data;
}

export async function placeBid(
  loadId: string,
  payload: { quotedFare: number; vehicleId?: string; estimatedPickupTime?: string; notes?: string }
): Promise<LoadBid> {
  const { data } = await api.post<LoadBid>(`/transport/loads/${loadId}/bid`, payload);
  return data;
}

export async function acceptLoadBid(loadId: string, bidId: string): Promise<{ booking: TransportBooking }> {
  const { data } = await api.post(`/transport/loads/${loadId}/accept-bid`, null, {
    params: { bidId },
  });
  return data;
}

// ---------- Trip location, weighbridge, expenses ----------

export async function pingLocation(
  bookingId: string,
  payload: { lat: number; lng: number; waypoint?: string; waypointLabel?: string; notes?: string }
): Promise<unknown> {
  const { data } = await api.post(`/transport/bookings/${bookingId}/location`, payload);
  return data;
}

export interface TripLocation {
  bookingId: string;
  status: string;
  route: string;
  vehicleNo: string;
  driverName: string;
  currentLocation: { lat: number; lng: number; waypointLabel?: string; updatedAt?: string } | null;
  waypoints: Waypoint[];
  estimatedMinutesLeft: number;
}

export async function tripLocation(bookingId: string): Promise<TripLocation> {
  const { data } = await api.get<TripLocation>(`/transport/bookings/${bookingId}/location`);
  return data;
}

export interface WeighbridgePayload {
  slipNo: string;
  weighbridgeName: string;
  tareWeightKg: number;
  grossWeightKg: number;
  netWeightKg?: number;
  slipPhotoUrl?: string;
  notes?: string;
}

export async function recordWeighbridge(bookingId: string, payload: WeighbridgePayload): Promise<TransportBooking> {
  const { data } = await api.post<TransportBooking>(`/transport/bookings/${bookingId}/weighbridge`, payload);
  return data;
}

export type ExpenseCategory =
  | 'diesel'
  | 'toll'
  | 'driver_bata'
  | 'loading_labor'
  | 'mandi_cess'
  | 'maintenance'
  | 'other';

export interface TripExpense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  notes?: string | null;
  receiptPhotoUrl?: string | null;
  createdAt?: string;
}

export interface TripExpenses {
  grossFare: number;
  totalExpenses: number;
  platformCommission: number;
  netProfit: number;
  expenses: TripExpense[];
}

export async function addExpense(
  bookingId: string,
  payload: { category: ExpenseCategory; amount: number; notes?: string; receiptPhotoUrl?: string }
): Promise<TripExpense> {
  const { data } = await api.post<TripExpense>(`/transport/bookings/${bookingId}/expenses`, payload);
  return data;
}

export async function tripExpenses(bookingId: string): Promise<TripExpenses> {
  const { data } = await api.get<TripExpenses>(`/transport/bookings/${bookingId}/expenses`);
  return data;
}

// ---------- Bilty / settlements / analytics ----------

export interface BiltyDoc {
  lrNumber?: string;
  bookingId?: string;
  date?: string;
  consignor?: { name?: string; origin?: string; destination?: string };
  consignee?: { name?: string; destination?: string };
  vehicleDetails?: { vehicleType?: string; vehicleNo?: string; driverName?: string };
  goods?: { commodity?: string; weightQuintals?: number; packaging?: string; declaredValue?: number };
  freightCharges?: { grossFare?: number; loadingLabor?: number; advancePaid?: number; balancePayable?: number };
  qrVerificationCode?: string;
  terms?: string;
  [key: string]: unknown;
}

export async function getBilty(bookingId: string): Promise<BiltyDoc> {
  const { data } = await api.get<BiltyDoc>(`/transport/bookings/${bookingId}/bilty`);
  return data;
}

export interface SettlementDoc {
  id: string;
  role: string;
  entityId: string;
  periodStart: string;
  periodEnd: string;
  grossRupees: number;
  commissionRupees: number;
  netRupees: number;
  status: string;
  sourceIds?: string[];
}

export async function transportSettlements(): Promise<{ data: SettlementDoc[] }> {
  const { data } = await api.get<{ data: SettlementDoc[] }>('/transport/settlements');
  return data;
}

export interface TransportAnalytics {
  totalVehicles?: number;
  totalTripsCompleted?: number;
  activeTripsCount?: number;
  totalGrossRevenue?: number;
  totalDistanceKm?: number;
  estimatedDieselExpense?: number;
  estimatedNetProfit?: number;
  fleetUtilizationRate?: number;
  onTimeDeliveryPct?: number;
  averageRating?: number;
  [key: string]: unknown;
}

export async function transportAnalytics(): Promise<TransportAnalytics> {
  const { data } = await api.get<TransportAnalytics>('/transport/analytics');
  return data;
}
