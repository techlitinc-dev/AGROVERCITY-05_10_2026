import { del, post, readList, readOne } from './http';
import { MOCK_EQUIPMENT } from './mocks';
import type { EquipmentMachine } from '../../types';

/** Equipment rental namespace — discovery & booking lifecycle (renter side). */
export const equipment = {
  /** GET /equipment */
  list: (params?: Record<string, unknown>): Promise<EquipmentMachine[]> =>
    readList<EquipmentMachine>('/equipment', { params, mock: MOCK_EQUIPMENT }),

  /** GET /equipment/{id}/slots */
  slots: (equipmentId: string, params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>(`/equipment/${equipmentId}/slots`, { params }),

  /** POST /equipment/{id}/quote */
  quote: (equipmentId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/${equipmentId}/quote`, payload),

  /** POST /equipment/slots/{slotId}/book */
  bookSlot: (slotId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/equipment/slots/${slotId}/book`, payload),

  /** POST /equipment/slots/{slotId}/waitlist */
  waitlistSlot: (slotId: string): Promise<unknown> => post<unknown>(`/equipment/slots/${slotId}/waitlist`),

  /** DELETE /equipment/bookings/{id} */
  cancelBooking: (bookingId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/equipment/bookings/${bookingId}`),

  /** GET /equipment/bookings/{id}/execution */
  bookingExecution: (bookingId: string): Promise<unknown> =>
    readOne<unknown>(`/equipment/bookings/${bookingId}/execution`),

  /** POST /equipment/bookings/{id}/execution */
  updateExecution: (bookingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/execution`, payload),

  /** GET /equipment/bookings/{id}/contract */
  bookingContract: (bookingId: string): Promise<unknown> =>
    readOne<unknown>(`/equipment/bookings/${bookingId}/contract`),

  /** POST /equipment/bookings/{id}/contract/esign */
  esignContract: (bookingId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/contract/esign`, payload),

  /** POST /equipment/bookings/{id}/payments */
  pay: (bookingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/payments`, payload),

  /** POST /equipment/bookings/{id}/payments/order */
  createPaymentOrder: (bookingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/payments/order`, payload),

  /** POST /equipment/bookings/{id}/payments/verify */
  verifyPayment: (bookingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/payments/verify`, payload),

  /** POST /equipment/bookings/{id}/deposit */
  payDeposit: (bookingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/deposit`, payload),

  /** GET /equipment/bookings/{id}/invoice */
  invoice: (bookingId: string): Promise<unknown> =>
    readOne<unknown>(`/equipment/bookings/${bookingId}/invoice`),

  /** GET /equipment/bookings/{id}/chat-room */
  chatRoom: (bookingId: string): Promise<unknown> =>
    readOne<unknown>(`/equipment/bookings/${bookingId}/chat-room`),

  /** POST /equipment/bookings/{id}/counter/accept */
  acceptCounter: (bookingId: string): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/counter/accept`),

  /** POST /equipment/bookings/{id}/counter/decline */
  declineCounter: (bookingId: string): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/counter/decline`),

  /** GET /equipment/disputes */
  disputes: (): Promise<unknown[]> => readList<unknown[]>('/equipment/disputes'),

  /** GET /equipment/disputes/{id} */
  dispute: (disputeId: string): Promise<unknown> => readOne<unknown>(`/equipment/disputes/${disputeId}`),

  /** POST /equipment/bookings/{id}/disputes */
  openDispute: (bookingId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/disputes`, body),

  /** POST /equipment/disputes/{id}/evidence */
  disputeEvidence: (disputeId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/disputes/${disputeId}/evidence`, body),
};
