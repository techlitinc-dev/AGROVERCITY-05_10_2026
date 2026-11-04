import { del, post, readList, readOne } from './http';
import { MOCK_EQUIPMENT } from './mocks';
import type { EquipmentMachine } from '../../types';

/** Contact snapshot revealed only after the acceptance unlock. */
export interface EquipmentContact {
  name?: string;
  fullName?: string;
  village?: string;
  district?: string;
  phone?: string;
  phoneDigits?: string | null;
  whatsappDigits?: string | null;
  verified?: boolean;
}

/** Renter-side booking row from GET /equipment/my-bookings (SR 27). */
export interface EquipmentMyBooking {
  id: string;
  userId?: string;
  farmerName?: string;
  slotId?: string;
  equipmentId?: string;
  date?: string;
  slotName?: string;
  priceRupees?: number;
  ownerType?: string;
  status: string;
  createdAt?: string;
  machineName?: string | null;
  machineType?: string | null;
  ownerId?: string | null;
  ownerName?: string | null;
  ownerVerified?: boolean;
  /** Present ONLY after the owner's acceptance unlock. */
  ownerContact?: EquipmentContact | null;
  chatRoomId?: string;
  workLocation?: string;
  workType?: string;
  workQuantity?: number;
  workUnit?: string;
  notes?: string;
  cancellationReason?: string | null;
  statusHistory?: { status: string; at: string; by?: string; reason?: string }[];
}

/** Direct-connect booking-request payload (spec §7). */
export interface EquipmentRequestPayload {
  farmerName: string;
  workLocation?: string;
  workType?: string;
  workQuantity?: number;
  workUnit?: 'acres' | 'hours' | 'days' | '';
  notes?: string;
  termsAccepted: boolean;
}

/** Equipment rental namespace — discovery & booking lifecycle (renter side). */
export const equipment = {
  /** GET /equipment — optional filters: q (substring), type (machineType exact). */
  list: (params?: Record<string, unknown>): Promise<EquipmentMachine[]> =>
    readList<EquipmentMachine>('/equipment', { params, mock: MOCK_EQUIPMENT }),

  /** GET /equipment/my-bookings — the caller's bookings, newest first. */
  myBookings: (): Promise<EquipmentMyBooking[]> =>
    readList<EquipmentMyBooking>('/equipment/my-bookings'),

  /** POST /equipment/demand-posts — farmer posts the machine they need. */
  createDemandPost: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/equipment/demand-posts', payload),

  /** GET /equipment/demand-posts — open demand posts (equipment-owner board). */
  demandPosts: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/equipment/demand-posts', { params }),

  /** GET /equipment/demand-posts/mine — my posts with owner quotes. */
  myDemandPosts: (): Promise<unknown[]> => readList<unknown[]>('/equipment/demand-posts/mine'),

  /** DELETE /equipment/demand-posts/{id} — close my demand post. */
  deleteDemandPost: (postId: string): Promise<unknown> =>
    del<unknown>(`/equipment/demand-posts/${postId}`),

  /** POST /equipment/demand-posts/{id}/quotes — owner quotes on a demand post. */
  quoteDemandPost: (postId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/demand-posts/${postId}/quotes`, payload),

  /** GET /equipment/{id}/slots */
  slots: (equipmentId: string, params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>(`/equipment/${equipmentId}/slots`, { params }),

  /** POST /equipment/{id}/quote */
  quote: (equipmentId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/equipment/${equipmentId}/quote`, payload),

  /** POST /equipment/slots/{slotId}/book — direct-connect request (spec §7). */
  bookSlot: (slotId: string, payload: EquipmentRequestPayload): Promise<unknown> =>
    post<unknown>(`/equipment/slots/${slotId}/book`, payload),

  /** POST /equipment/slots/{slotId}/waitlist */
  waitlistSlot: (slotId: string): Promise<unknown> => post<unknown>(`/equipment/slots/${slotId}/waitlist`),

  /** DELETE /equipment/bookings/{id} */
  cancelBooking: (bookingId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/equipment/bookings/${bookingId}`),

  /** POST /equipment/bookings/{id}/cancel — cancellation with a reason (spec §11). */
  cancelBookingWithReason: (bookingId: string, reason: string): Promise<unknown> =>
    post<unknown>(`/equipment/bookings/${bookingId}/cancel`, { reason }),

  /** POST /equipment/reports — issue reporting for either participant (spec §13). */
  reportIssue: (payload: {
    targetUserId: string;
    bookingId?: string;
    category: 'workNotCompleted' | 'equipmentIssue' | 'conduct' | 'safety' | 'other';
    details?: string;
  }): Promise<unknown> => post<unknown>('/equipment/reports', payload),

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
