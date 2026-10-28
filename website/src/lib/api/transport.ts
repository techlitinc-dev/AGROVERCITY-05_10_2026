import { del, download, patch, post, put, readList, readOne } from './http';
import type { TransportBooking, TransportVehicle } from '../../types';

/** Bounds for the route viewport, as returned by the route endpoint. */
export interface BookingRouteBounds {
  south: number;
  west: number;
  north: number;
  east: number;
}

/** Route payload from GET /transport/bookings/{id}/route (may 404 BOOKING_NOT_FOUND / 422 GEO_REQUIRED). */
export interface BookingRoute {
  bookingId: string;
  provider: 'google' | 'mock';
  fallback: boolean;
  distanceKm: number;
  durationMin: number;
  polyline?: string | null;
  bounds?: BookingRouteBounds | null;
  legs?: unknown[];
  coordsKey?: string;
}

/** Transport namespace — bookings, vehicles, loads/bids, trips, wallet & payouts. */
export const transport = {
  // --- discovery ---
  /** GET /transport/vehicles — vehicle rate card from the `vehicle_catalog`
   *  collection (seeded by scripts/seed_vehicle_catalog.py). No mock fallback:
   *  an empty catalog renders an empty board. */
  vehicles: (params?: Record<string, unknown>): Promise<TransportVehicle[]> =>
    readList<TransportVehicle>('/transport/vehicles', { params }),

  /** GET /transport/nearby-vehicles */
  nearbyVehicles: (params?: Record<string, unknown>): Promise<TransportVehicle[]> =>
    readList<TransportVehicle>('/transport/nearby-vehicles', { params }),

  /** POST /transport/fare-estimate */
  fareEstimate: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/transport/fare-estimate', payload),

  // --- bookings (farmer/shipper side) ---
  /** GET /transport/bookings */
  bookings: (params?: Record<string, unknown>): Promise<TransportBooking[]> =>
    readList<TransportBooking>('/transport/bookings', { params }),

  /** POST /transport/bookings */
  createBooking: (payload: Record<string, unknown>): Promise<TransportBooking> =>
    post<TransportBooking>('/transport/bookings', payload),

  /** POST /transport/instant-bookings */
  instantBooking: (payload: Record<string, unknown>): Promise<TransportBooking> =>
    post<TransportBooking>('/transport/instant-bookings', payload),

  /** GET /transport/bookings/{id} */
  booking: (bookingId: string): Promise<TransportBooking> =>
    readOne<TransportBooking>(`/transport/bookings/${bookingId}`),

  /** GET /transport/bookings/{id}/route — distance/duration + encoded polyline between pickup & drop pins. */
  getBookingRoute: (bookingId: string): Promise<BookingRoute> =>
    readOne<BookingRoute>(`/transport/bookings/${bookingId}/route`),

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

  /** POST /transport/bookings/{id}/assign-driver — backend AssignDriverRequest is {driverName, driverPhone}. */
  assignDriver: (bookingId: string, driver: { driverName: string; driverPhone: string }): Promise<TransportBooking> =>
    post<TransportBooking>(`/transport/bookings/${bookingId}/assign-driver`, driver),

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

  // --- booking offers / fare negotiation ---
  /** GET /transport/bookings/{id}/offers — offer thread (both booking parties). */
  bookingOffers: (bookingId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/transport/bookings/${bookingId}/offers`),

  /** POST /transport/bookings/{id}/offer — transporter proposes a fare. */
  createBookingOffer: (bookingId: string, body: { farePaise: number; message?: string }): Promise<unknown> =>
    post<unknown>(`/transport/bookings/${bookingId}/offer`, body),

  /** POST /transport/bookings/{id}/offers/{offerId}/accept|decline|counter — counterparty only. */
  respondBookingOffer: (
    bookingId: string,
    offerId: string,
    action: 'accept' | 'decline' | 'counter',
    body?: { farePaise?: number; message?: string }
  ): Promise<unknown> => post<unknown>(`/transport/bookings/${bookingId}/offers/${offerId}/${action}`, body ?? {}),

  // --- receipts ---
  /** GET /transport/bookings/{id}/receipt — JSON receipt payload. */
  bookingReceipt: (bookingId: string): Promise<unknown> =>
    readOne<unknown>(`/transport/bookings/${bookingId}/receipt`),

  /** GET /transport/bookings/{id}/receipt.pdf — PDF download. */
  bookingReceiptPdf: (bookingId: string): Promise<Blob> =>
    download(`/transport/bookings/${bookingId}/receipt.pdf`),

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

  /** GET /transport/loads/mine — my posted demands with applications (bids);
   * contact details are present only on the accepted application. */
  myLoads: (): Promise<unknown[]> => readList<unknown[]>('/transport/loads/mine'),

  /** GET /transport/loads/my-bids — my applications across the board; an
   * accepted entry carries `contactReveal.farmer` (phone + WhatsApp). */
  myLoadBids: (): Promise<unknown[]> => readList<unknown[]>('/transport/loads/my-bids'),

  /** GET /transport/loads/matched */
  matchedLoads: (): Promise<unknown[]> => readList<unknown[]>('/transport/loads/matched'),

  /** POST /transport/loads */
  createLoad: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/transport/loads', payload),

  /** POST /transport/loads/{id}/bid — direct-connect apply: quoted fare +
   * vehicle + termsAccepted + MPIN. Contact stays hidden until the load
   * owner accepts the bid. */
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
    readList<TransportVehicle>('/transport/vehicles/my'),

  /** POST /transport/vehicles */
  addVehicle: (payload: Partial<TransportVehicle>): Promise<TransportVehicle> =>
    post<TransportVehicle>('/transport/vehicles', payload),

  /** PUT /transport/vehicles/{id} */
  updateVehicle: (vehicleId: string, updates: Partial<TransportVehicle>): Promise<TransportVehicle> =>
    put<TransportVehicle>(`/transport/vehicles/${vehicleId}`, updates),

  /** DELETE /transport/vehicles/{id} */
  removeVehicle: (vehicleId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/transport/vehicles/${vehicleId}`),

  /** PUT /transport/vehicles/{id}/availability — backend AvailabilityRequest is {availableDates}. */
  setAvailability: (vehicleId: string, availableDates: string[]): Promise<unknown> =>
    put<unknown>(`/transport/vehicles/${vehicleId}/availability`, { availableDates }),

  /** GET /transport/vehicles/{id}/calendar — live bookings occupying the vehicle's days. */
  vehicleCalendar: (vehicleId: string): Promise<unknown> =>
    readOne<unknown>(`/transport/vehicles/${vehicleId}/calendar`),

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

  /** POST /transport/load-templates/{id}/repeat — instantiate as a fresh open load. */
  repeatLoadTemplate: (
    templateId: string,
    body?: { pickupDate?: string; pickupTime?: string; targetFare?: number }
  ): Promise<unknown> =>
    post<unknown>(`/transport/load-templates/${templateId}/repeat`, {
      // The backend requires pickupDate — default to tomorrow when the caller
      // doesn't supply one (e.g. one-tap "book again" from a template card).
      pickupDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
      ...body,
    }),

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

  /** GET /transport/payouts — the caller's payout history, newest first. */
  payouts: (): Promise<unknown[]> => readList<unknown[]>('/transport/payouts'),

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

  /** GET /transport/ratings/given — ratings this transporter submitted. */
  ratingsGiven: (): Promise<unknown[]> => readList<unknown[]>('/transport/ratings/given'),

  /** GET /transport/ai-insights — route demand, earnings trend, utilization, suggestions (plan-gated like /transport/analytics). */
  aiInsights: (): Promise<unknown> => readOne<unknown>('/transport/ai-insights'),

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
