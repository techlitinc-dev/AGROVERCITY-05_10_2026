import { download, post, readList, readOne } from './http';
import { MOCK_PURCHASES } from './mocks';
import type { PurchaseOrder } from '../../types';

/**
 * Purchases namespace — full trade lifecycle.
 * Path-param helpers: purchases.advance(id, body), purchases.pay(id), …
 */
export const purchases = {
  // --- core ---
  /** GET /purchases */
  list: (params?: Record<string, unknown>): Promise<PurchaseOrder[]> =>
    readList<PurchaseOrder>('/purchases', { params, mock: MOCK_PURCHASES }),

  /** GET /purchases/mine (alias of list with scope=mine where supported) */
  mine: (params?: Record<string, unknown>): Promise<PurchaseOrder[]> =>
    readList<PurchaseOrder>('/purchases', { params: { ...params, scope: 'mine' }, mock: MOCK_PURCHASES }),

  /** GET /purchases/{id} */
  get: (purchaseId: string): Promise<PurchaseOrder> =>
    readOne<PurchaseOrder>(`/purchases/${purchaseId}`),

  /** POST /purchases */
  create: (payload: Record<string, unknown>): Promise<PurchaseOrder> =>
    post<PurchaseOrder>('/purchases', payload),

  // --- lifecycle (mutations always throw on failure) ---
  /** POST /purchases/{id}/advance */
  advance: (purchaseId: string, body: Record<string, unknown> = {}): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/purchases/${purchaseId}/advance`, body),

  /** POST /purchases/{id}/pickup */
  pickup: (purchaseId: string, body: Record<string, unknown>): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/purchases/${purchaseId}/pickup`, body),

  /** POST /purchases/{id}/dispatch */
  dispatch: (purchaseId: string, body: Record<string, unknown> = {}): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/purchases/${purchaseId}/dispatch`, body),

  /** POST /purchases/{id}/deliver */
  deliver: (purchaseId: string, body: Record<string, unknown> = {}): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/purchases/${purchaseId}/deliver`, body),

  /** POST /purchases/{id}/qc */
  qc: (purchaseId: string, body: Record<string, unknown>): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/purchases/${purchaseId}/qc`, body),

  /** POST /purchases/{id}/resolve */
  resolve: (purchaseId: string, body: Record<string, unknown>): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/purchases/${purchaseId}/resolve`, body),

  /** POST /purchases/{id}/pay */
  pay: (purchaseId: string, body: Record<string, unknown> = {}): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/purchases/${purchaseId}/pay`, body),

  /** POST /purchases/{id}/rate */
  rate: (purchaseId: string, body: { rating: number; review?: string; target: 'farmer' | 'buyer' }): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(`/purchases/${purchaseId}/rate`, body),

  /** POST /purchases/{id}/cancel */
  cancel: (purchaseId: string, reason?: string): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/purchases/${purchaseId}/cancel`, reason ? { reason } : {}),

  // --- escrow & handover ---
  /** POST /purchases/{id}/escrow/fund */
  escrowFund: (purchaseId: string, body: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/purchases/${purchaseId}/escrow/fund`, body),

  /** GET /purchases/{id}/handover-otp */
  handoverOtp: (purchaseId: string): Promise<{ otp: string }> =>
    readOne<{ otp: string }>(`/purchases/${purchaseId}/handover-otp`),

  /** POST /purchases/{id}/handover/verify */
  handoverVerify: (purchaseId: string, otp: string): Promise<PurchaseOrder> =>
    post<PurchaseOrder>(`/purchases/${purchaseId}/handover/verify`, { otp }),

  /** POST /purchases/{id}/qc/photos */
  qcPhotos: (purchaseId: string, body: Record<string, unknown>): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(`/purchases/${purchaseId}/qc/photos`, body),

  // --- documents ---
  /** GET /purchases/{id}/invoice */
  invoice: (purchaseId: string): Promise<unknown> => readOne<unknown>(`/purchases/${purchaseId}/invoice`),

  /** GET /purchases/{id}/invoice.pdf — returns a Blob. */
  invoicePdf: (purchaseId: string): Promise<Blob> => download(`/purchases/${purchaseId}/invoice.pdf`),

  /** GET /purchases/{id}/receipt */
  receipt: (purchaseId: string): Promise<unknown> => readOne<unknown>(`/purchases/${purchaseId}/receipt`),

  // --- disputes & evidence ---
  /** GET /purchases/{id}/disputes */
  disputes: (purchaseId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/purchases/${purchaseId}/disputes`),

  /** POST /purchases/{id}/disputes */
  openDispute: (purchaseId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/purchases/${purchaseId}/disputes`, body),

  /** POST /purchases/{id}/disputes/{disputeId}/evidence */
  disputeEvidence: (purchaseId: string, disputeId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/purchases/${purchaseId}/disputes/${disputeId}/evidence`, body),

  // --- comms ---
  /** GET /purchases/{id}/chat-room */
  chatRoom: (purchaseId: string): Promise<unknown> =>
    readOne<unknown>(`/purchases/${purchaseId}/chat-room`),
};
