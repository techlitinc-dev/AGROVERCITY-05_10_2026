import { del, patch, post, put, readList, readOne } from './http';
import { MOCK_TRANSPORT_BOOKINGS, MOCK_VEHICLES } from './mocks';
import type { TransportBooking, TransportVehicle } from '../../types';

/** Transport namespace — bookings, vehicles, loads/bids, trips, wallet & payouts. */
export const transport = {
  // --- discovery ---
  /** GET /transport/vehicles */
  vehicles: (params?: Record<string, unknown>): Promise<TransportVehicle[]> =>
    readList<TransportVehicle>('/transport/vehicles', { params, mock: MOCK_VEHICLES }),

  /** GET /transport/nearby-vehicles */
  nearbyVehicles: (params?: Record<string, unknown>): Promise<TransportVehicle[]> =>
    readList<TransportVehicle>('/transport/nearby-vehicles', { params }),

  /** POST /transport/fare-estimate */
  fareEstimate: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/transport/fare-estimate', payload),

  // --- bookings (farmer/shipper side) ---
  /** GET /transport/bookings */
  bookings: (params?: Record<string, unknown>): Promise<TransportBooking[]> =>
    readList<TransportBooking>('/transport/bookings', { params, mock: MOCK_TRANSPORT_BOOKINGS }),

  /** POST /transport/bookings */
  createBooking: (payload: Record<string, unknown>): Promise<TransportBooking> =>
    post<TransportBooking>('/transport/bookings', payload),

  /** POST /transport/instant-bookings */
  instantBooking: (payload: Record<string, unknown>): Promise<TransportBooking> =>
    post<TransportBooking>('/transport/instant-bookings', payload),

  /** GET /transport/bookings/{id} */
  booking: (bookingId: string): Promise<TransportBooking> =>
    readOne<TransportBooking>(`/transport/bookings/${bookingId}`),

  /** PATCH /transport/bookings/{id} */
  updateBooking: (bookingId: string, updates: Record<string, unknown>): Promise<TransportBooking> =>
    patch<TransportBooking>(`/transport/bookings/${bookingId}`, updates),

  /** POST /transport/bookings/{id}/cancel */
  cancelBooking: (bookingId: string, reason?: string): Promise<TransportBooking> =>
    post<TransportBooking>(`/transport/bookings/${bookingId}/cancel`, reason ? { reason } : {}),

  /** GET /transport/bookings/{id}/bilty */
  bilty: (bookingId: string): Promise<unknown> => readOne<unknown>(`/transport/bookings/${bookingId}/bilty`),

  // --- transporter ops ---
  /** POST /transport/bookings/{id}/accept */
  acceptBooking: (bookingId: string): Promise<TransportBooking> =>
    post<TransportBooking>(`/transport/bookings/${bookingId}/accept`),

  /** POST /transport/bookings/{id}/reject */
  rejectBooking: (bookingId: string, reason?: string): Promise<TransportBooking> =>
    post<TransportBooking>(`/transport/bookings/${bookingId}/reject`, reason ? { reason } : {}),

  /** POST /transport/bookings/{id}/assign-driver */
  assignDriver: (bookingId: string, driverId: string): Promise<TransportBooking> =>
    post<TransportBooking>(`/transport/bookings/${bookingId}/assign-driver`, { driverId }),

  /** POST /transport/bookings/{id}/location */
  updateLocation: (bookingId: string, lat: number, lng: number): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/location`, { lat, lng }),

  /** GET /transport/bookings/{id}/location */
  trackLocation: (bookingId: string): Promise<unknown> =>
    readOne<unknown>(`/transport/bookings/${bookingId}/location`),

  /** POST /transport/bookings/{id}/waiting */
  logWaiting: (bookingId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/waiting`, body),

  /** POST /transport/bookings/{id}/weighbridge */
  weighbridge: (bookingId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/weighbridge`, body),

  /** GET /transport/bookings/{id}/pod-otp */
  podOtp: (bookingId: string): Promise<{ otp: string }> =>
    readOne<{ otp: string }>(`/transport/bookings/${bookingId}/pod-otp`),

  /** POST /transport/bookings/{id}/verify-pod-otp */
  verifyPodOtp: (bookingId: string, otp: string): Promise<TransportBooking> =>
    post<TransportBooking>(`/transport/bookings/${bookingId}/verify-pod-otp`, { otp }),

  /** POST /transport/bookings/{id}/stops */
  addStop: (bookingId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/stops`, body),

  /** POST /transport/bookings/{id}/stops/{stopNo}/pod */
  stopPod: (bookingId: string, stopNo: number, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/stops/${stopNo}/pod`, body),

  /** POST /transport/bookings/{id}/expenses */
  addExpense: (bookingId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/expenses`, body),

  /** GET /transport/bookings/{id}/expenses */
  expenses: (bookingId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/transport/bookings/${bookingId}/expenses`),

  /** POST /transport/bookings/{id}/breakdown */
  reportBreakdown: (bookingId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/breakdown`, body),

  /** POST /transport/bookings/{id}/rebook */
  rebook: (bookingId: string, body: Record<string, unknown> = {}): Promise<TransportBooking> =>
    post<TransportBooking>(`/transport/bookings/${bookingId}/rebook`, body),

  /** POST /transport/bookings/{id}/rate-farmer */
  rateFarmer: (bookingId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/rate-farmer`, body),

  /** GET /transport/bookings/{id}/commission-invoice */
  commissionInvoice: (bookingId: string): Promise<unknown> =>
    readOne<unknown>(`/transport/bookings/${bookingId}/commission-invoice`),

  /** GET /transport/trips/{id}/return-loads */
  returnLoads: (tripId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/transport/trips/${tripId}/return-loads`),

  // --- loads & bids ---
  /** GET /transport/loads */
  loads: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/transport/loads', { params }),

  /** GET /transport/loads/matched */
  matchedLoads: (): Promise<unknown[]> => readList<unknown[]>('/transport/loads/matched'),

  /** POST /transport/loads */
  createLoad: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/transport/loads', payload),

  /** POST /transport/loads/{id}/bid */
  bid: (loadId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/loads/${loadId}/bid`, payload),

  /** GET /transport/loads/{id}/bids */
  loadBids: (loadId: string): Promise<unknown[]> => readList<unknown[]>(`/transport/loads/${loadId}/bids`),

  /** POST /transport/loads/{id}/bids/{bidId}/counter */
  counterBid: (loadId: string, bidId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/loads/${loadId}/bids/${bidId}/counter`, payload),

  /** POST /transport/loads/{id}/accept-bid */
  acceptBid: (loadId: string, bidId: string): Promise<unknown> =>
    post<unknown>(`/transport/loads/${loadId}/accept-bid`, { bidId }),

  // --- vehicles management ---
  /** GET /transport/vehicles/my */
  myVehicles: (): Promise<TransportVehicle[]> =>
    readList<TransportVehicle>('/transport/vehicles/my', { mock: MOCK_VEHICLES }),

  /** POST /transport/vehicles */
  addVehicle: (payload: Partial<TransportVehicle>): Promise<TransportVehicle> =>
    post<TransportVehicle>('/transport/vehicles', payload),

  /** PUT /transport/vehicles/{id} */
  updateVehicle: (vehicleId: string, updates: Partial<TransportVehicle>): Promise<TransportVehicle> =>
    put<TransportVehicle>(`/transport/vehicles/${vehicleId}`, updates),

  /** DELETE /transport/vehicles/{id} */
  removeVehicle: (vehicleId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/transport/vehicles/${vehicleId}`),

  /** PUT /transport/vehicles/{id}/availability */
  setAvailability: (vehicleId: string, available: boolean): Promise<unknown> =>
    put<unknown>(`/transport/vehicles/${vehicleId}/availability`, { available }),

  /** POST /transport/vehicles/{id}/location */
  updateVehicleLocation: (vehicleId: string, lat: number, lng: number): Promise<unknown> =>
    post<unknown>(`/transport/vehicles/${vehicleId}/location`, { lat, lng }),

  // --- drivers ---
  /** GET /transport/drivers */
  drivers: (): Promise<unknown[]> => readList<unknown[]>('/transport/drivers'),

  /** POST /transport/drivers */
  addDriver: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/transport/drivers', payload),

  /** GET /transport/drivers/{id}/analytics */
  driverAnalytics: (driverId: string): Promise<unknown> =>
    readOne<unknown>(`/transport/drivers/${driverId}/analytics`),

  // --- load templates ---
  /** GET /transport/load-templates */
  loadTemplates: (): Promise<unknown[]> => readList<unknown[]>('/transport/load-templates'),

  /** POST /transport/load-templates */
  createLoadTemplate: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/transport/load-templates', payload),

  /** DELETE /transport/load-templates/{id} */
  deleteLoadTemplate: (templateId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/transport/load-templates/${templateId}`),

  /** POST /transport/load-templates/{id}/repeat */
  repeatLoadTemplate: (templateId: string): Promise<unknown> =>
    post<unknown>(`/transport/load-templates/${templateId}/repeat`),

  // --- profile, wallet, payouts, settlements ---
  /** GET /transport/profile */
  profile: (): Promise<unknown> => readOne<unknown>('/transport/profile'),

  /** PUT /transport/profile */
  updateProfile: (updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>('/transport/profile', updates),

  /** GET /transport/wallet */
  wallet: (): Promise<unknown> => readOne<unknown>('/transport/wallet'),

  /** POST /transport/payouts */
  payout: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/transport/payouts', payload),

  /** GET /transport/settlements */
  settlements: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/transport/settlements', { params }),

  /** GET /transport/ledger/mine */
  ledger: (): Promise<unknown[]> => readList<unknown[]>('/transport/ledger/mine'),

  /** GET /transport/dashboard */
  dashboard: (): Promise<unknown> => readOne<unknown>('/transport/dashboard'),

  /** GET /transport/analytics */
  analytics: (): Promise<unknown> => readOne<unknown>('/transport/analytics'),

  /** GET /transport/fare-trends */
  fareTrends: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/transport/fare-trends', { params }),

  /** GET /transport/compliance */
  compliance: (): Promise<unknown> => readOne<unknown>('/transport/compliance'),

  /** GET /transport/ratings */
  ratings: (): Promise<unknown[]> => readList<unknown[]>('/transport/ratings'),

  /** GET /transport/farmers/{farmerId}/reputation */
  farmerReputation: (farmerId: string): Promise<unknown> =>
    readOne<unknown>(`/transport/farmers/${farmerId}/reputation`),

  /** POST /transport/favorites/{transporterId} */
  favorite: (transporterId: string): Promise<unknown> => post<unknown>(`/transport/favorites/${transporterId}`),

  /** GET /transport/favorites */
  favorites: (): Promise<unknown[]> => readList<unknown[]>('/transport/favorites'),

  // --- share links ---
  /** POST /transport/bookings/{id}/share */
  shareBooking: (bookingId: string): Promise<{ token: string }> =>
    post<{ token: string }>(`/transport/bookings/${bookingId}/share`),

  /** DELETE /transport/bookings/{id}/share */
  unshareBooking: (bookingId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/transport/bookings/${bookingId}/share`),

  /** GET /transport/shared/{token} */
  sharedBooking: (token: string): Promise<TransportBooking> =>
    readOne<TransportBooking>(`/transport/shared/${token}`),

  // --- disputes ---
  /** POST /transport/bookings/{id}/damage-disputes */
  openDamageDispute: (bookingId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/damage-disputes`, body),

  /** GET /transport/bookings/{id}/damage-disputes */
  damageDisputes: (bookingId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/transport/bookings/${bookingId}/damage-disputes`),

  /** POST /transport/bookings/{id}/damage-disputes/{disputeId}/resolve */
  resolveDamageDispute: (bookingId: string, disputeId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/damage-disputes/${disputeId}/resolve`, body),

  // --- payments & escrow ---
  /** POST /transport/bookings/{id}/payments */
  payBooking: (bookingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/payments`, payload),

  /** POST /transport/bookings/{id}/escrow/release */
  releaseEscrow: (bookingId: string): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/escrow/release`),
};
