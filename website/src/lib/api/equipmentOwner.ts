import { del, post, put, readList, readOne } from './http';
import { MOCK_EQUIPMENT } from './mocks';
import type { EquipmentMachine } from '../../types';

/** Equipment owner namespace — fleet ops, bookings adjudication, damage claims, settlements. */
export const equipmentOwner = {
  // --- fleet ---
  /** GET /equipment/owner/fleet */
  fleet: (): Promise<EquipmentMachine[]> =>
    readList<EquipmentMachine>('/equipment/owner/fleet', { mock: MOCK_EQUIPMENT }),

  /** POST /equipment */
  addMachine: (machine: Partial<EquipmentMachine>): Promise<EquipmentMachine> =>
    post<EquipmentMachine>('/equipment', machine),

  /** PUT /equipment/{id} */
  updateMachine: (equipmentId: string, updates: Partial<EquipmentMachine>): Promise<EquipmentMachine> =>
    put<EquipmentMachine>(`/equipment/${equipmentId}`, updates),

  /** PUT /equipment/{id}/pricing-rules */
  setPricingRules: (equipmentId: string, rules: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/equipment/${equipmentId}/pricing-rules`, rules),

  /** POST /equipment/{id}/maintenance */
  logMaintenance: (equipmentId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/${equipmentId}/maintenance`, payload),

  /** GET /equipment/owner/maintenance */
  maintenance: (): Promise<unknown[]> => readList<unknown[]>('/equipment/owner/maintenance'),

  // --- booking adjudication ---
  /** GET /equipment/bookings/pending */
  pendingBookings: (): Promise<unknown[]> => readList<unknown[]>('/equipment/bookings/pending'),

  /** POST /equipment/bookings/{id}/approve */
  approveBooking: (bookingId: string): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/approve`),

  /** POST /equipment/bookings/{id}/reject */
  rejectBooking: (bookingId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/reject`, reason ? { reason } : {}),

  /** POST /equipment/bookings/{id}/counter */
  counterBooking: (bookingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/counter`, payload),

  /** POST /equipment/bookings/{id}/check-in */
  checkIn: (bookingId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/check-in`, payload),

  /** GET /equipment/bookings/{id}/check-in */
  checkInStatus: (bookingId: string): Promise<unknown> =>
    readOne<unknown>(`/equipment/bookings/${bookingId}/check-in`),

  // --- damage claims ---
  /** GET /equipment/owner/damage-claims */
  damageClaims: (): Promise<unknown[]> => readList<unknown[]>('/equipment/owner/damage-claims'),

  /** POST /equipment/owner/damage-claims */
  openDamageClaim: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/equipment/owner/damage-claims', payload),

  /** POST /equipment/owner/damage-claims/{id}/confirm-estimate */
  confirmDamageEstimate: (claimId: string): Promise<unknown> =>
    post<unknown>(`/equipment/owner/damage-claims/${claimId}/confirm-estimate`),

  /** POST /equipment/owner/damage-claims/{id}/resolve */
  resolveDamageClaim: (claimId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/owner/damage-claims/${claimId}/resolve`, payload),

  // --- verification & trust ---
  /** POST /equipment-rental/verification/documents */
  submitVerification: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/equipment-rental/verification/documents', payload),

  /** GET /equipment-rental/verification/status */
  verificationStatus: (): Promise<unknown> => readOne<unknown>('/equipment-rental/verification/status'),

  /** GET /equipment-rental/badge */
  badge: (): Promise<unknown> => readOne<unknown>('/equipment-rental/badge'),

  /** GET /equipment-rental/demand-heatmap */
  demandHeatmap: (): Promise<unknown> => readOne<unknown>('/equipment-rental/demand-heatmap'),

  /** GET /equipment-rental/ranking/explain */
  rankingExplain: (): Promise<unknown> => readOne<unknown>('/equipment-rental/ranking/explain'),

  /** GET /equipment-rental/recommendations */
  recommendations: (): Promise<unknown[]> => readList<unknown[]>('/equipment-rental/recommendations'),

  // --- demand posts ---
  /** POST /equipment/demand-posts */
  createDemandPost: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/equipment/demand-posts', payload),

  /** GET /equipment/demand-posts */
  demandPosts: (): Promise<unknown[]> => readList<unknown[]>('/equipment/demand-posts'),

  /** DELETE /equipment/demand-posts/{id} */
  deleteDemandPost: (postId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/equipment/demand-posts/${postId}`),

  /** POST /equipment/demand-posts/{id}/quotes */
  quoteDemandPost: (postId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/demand-posts/${postId}/quotes`, payload),

  // --- blacklist ---
  /** GET /equipment-rental/blacklist */
  blacklist: (): Promise<unknown[]> => readList<unknown[]>('/equipment-rental/blacklist'),

  /** POST /equipment-rental/blacklist */
  addBlacklist: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/equipment-rental/blacklist', payload),

  /** DELETE /equipment-rental/blacklist/{userId} */
  removeBlacklist: (userId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/equipment-rental/blacklist/${userId}`),

  // --- analytics & money ---
  /** GET /equipment/owner/dashboard */
  dashboard: (): Promise<unknown> => readOne<unknown>('/equipment/owner/dashboard'),

  /** GET /equipment/owner/analytics */
  analytics: (): Promise<unknown> => readOne<unknown>('/equipment/owner/analytics'),

  /** GET /equipment/settlements */
  settlements: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/equipment/settlements', { params }),

  /** GET /equipment-rental/settlements */
  rentalSettlements: (): Promise<unknown[]> => readList<unknown[]>('/equipment-rental/settlements'),

  /** GET /equipment-rental/commission */
  commission: (): Promise<unknown> => readOne<unknown>('/equipment-rental/commission'),

  /** GET /equipment/owner/tds-statements */
  tdsStatements: (): Promise<unknown[]> => readList<unknown[]>('/equipment/owner/tds-statements'),
};
