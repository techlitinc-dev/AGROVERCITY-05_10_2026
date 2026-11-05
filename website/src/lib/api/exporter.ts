import { del, post, put, readList, readOne } from './http';
import { newIdempotencyKey } from '../utils';
import type { ExportApplication, ExportOrder, ExportRfq } from '../../types';

/**
 * Exporter API namespace — connects directly to FastAPI `/v1/exporter/*` endpoints.
 *
 * Two generations live here:
 * 1. Farmer–exporter DIRECT-CONNECT SOURCING (active workflow): structured
 *    RFQs, farmer applications, KYC+terms+MPIN contact unlock, user-reported
 *    outcomes, connections. No payments, escrow, LC, customs, freight, or
 *    export orders exist in this flow.
 * 2. LEGACY seller-trade pipeline (kept for compatibility only): seller
 *    quotes, quote-accept → export orders / shipping / LC / remittances.
 */

const idempotencyKey = (): Record<string, string> => ({
  'Idempotency-Key': newIdempotencyKey(),
});

export type ApplicationOutcome =
  | 'stillInContact'
  | 'dealDoneOffline'
  | 'didNotHappen'
  | 'withdrawn';

export interface ExportReadinessPayload {
  crops: {
    crop: string;
    normalQuantity?: number | null;
    unit?: string | null;
    availableFrom?: string | null;
    availableTo?: string | null;
  }[];
  farmLocation?: string | null;
  village?: string | null;
  district?: string | null;
  state?: string | null;
  certifications?: string[];
  residueTestRefs?: string[];
  packagingCapability?: string | null;
  previousExportExperience?: string | null;
}

export const exporter = {
  // ============================================================
  // DIRECT-CONNECT SOURCING — RFQs (exporter side)
  // ============================================================

  /** GET /exporter/rfqs — my requirements (all statuses). */
  rfqs: (params?: Record<string, unknown>): Promise<ExportRfq[]> =>
    readList<ExportRfq>('/exporter/rfqs', { params }),

  /** GET /exporter/rfqs/{id} — RFQ detail with quotes summary (owner). */
  rfq: (rfqId: string): Promise<ExportRfq> =>
    readOne<ExportRfq>(`/exporter/rfqs/${rfqId}`),

  /** POST /exporter/rfqs — create (optionally as draft with publish:false). */
  createRfq: (payload: Record<string, unknown>): Promise<ExportRfq> =>
    post<ExportRfq>('/exporter/rfqs', payload, { headers: idempotencyKey() }),

  /** PUT /exporter/rfqs/{id} — edit a draft/open/paused requirement. */
  updateRfq: (rfqId: string, payload: Record<string, unknown>): Promise<ExportRfq> =>
    put<ExportRfq>(`/exporter/rfqs/${rfqId}`, payload),

  /** POST /exporter/rfqs/{id}/publish — publish a draft. */
  publishRfq: (rfqId: string): Promise<ExportRfq> =>
    post<ExportRfq>(`/exporter/rfqs/${rfqId}/publish`),

  /** POST /exporter/rfqs/{id}/pause — stop accepting applications. */
  pauseRfq: (rfqId: string): Promise<ExportRfq> =>
    post<ExportRfq>(`/exporter/rfqs/${rfqId}/pause`),

  /** POST /exporter/rfqs/{id}/resume — reopen a paused requirement. */
  resumeRfq: (rfqId: string): Promise<ExportRfq> =>
    post<ExportRfq>(`/exporter/rfqs/${rfqId}/resume`),

  /** POST /exporter/rfqs/{id}/fulfill — exporter marks sourcing complete. */
  fulfillRfq: (rfqId: string): Promise<ExportRfq> =>
    post<ExportRfq>(`/exporter/rfqs/${rfqId}/fulfill`),

  /** POST /exporter/rfqs/{id}/close — close the requirement. */
  closeRfq: (rfqId: string): Promise<ExportRfq> =>
    post<ExportRfq>(`/exporter/rfqs/${rfqId}/close`),

  /** POST /exporter/rfqs/{id}/reopen — reopen a closed/fulfilled requirement. */
  reopenRfq: (rfqId: string): Promise<ExportRfq> =>
    post<ExportRfq>(`/exporter/rfqs/${rfqId}/reopen`),

  /** DELETE /exporter/rfqs/{id} — delete a draft/open/paused requirement. */
  deleteRfq: (rfqId: string): Promise<unknown> =>
    del<unknown>(`/exporter/rfqs/${rfqId}`),

  // ============================================================
  // DIRECT-CONNECT SOURCING — applications (both sides)
  // ============================================================

  /** GET /exporter/rfqs/{id}/applications — comparison board (RFQ owner). */
  rfqApplications: (rfqId: string): Promise<ExportApplication[]> =>
    readList<ExportApplication>(`/exporter/rfqs/${rfqId}/applications`),

  /** GET /exporter/applications/mine — farmer's own applications. */
  myApplications: (status?: string): Promise<ExportApplication[]> =>
    readList<ExportApplication>('/exporter/applications/mine', {
      params: status ? { status } : undefined,
    }),

  /** GET /exporter/applications/{id} — participant-only detail. */
  application: (applicationId: string): Promise<ExportApplication> =>
    readOne<ExportApplication>(`/exporter/applications/${applicationId}`),

  /** POST /exporter/rfqs/{id}/applications — farmer applies (terms ack). */
  applyOnRfq: (rfqId: string, payload: Record<string, unknown>): Promise<ExportApplication> =>
    post<ExportApplication>(`/exporter/rfqs/${rfqId}/applications`, payload, {
      headers: idempotencyKey(),
    }),

  /** POST /exporter/applications/{id}/withdraw — farmer withdraws. */
  withdrawApplication: (applicationId: string): Promise<ExportApplication> =>
    post<ExportApplication>(`/exporter/applications/${applicationId}/withdraw`),

  /** POST /exporter/applications/{id}/dismiss — exporter dismisses. */
  dismissApplication: (applicationId: string): Promise<ExportApplication> =>
    post<ExportApplication>(`/exporter/applications/${applicationId}/dismiss`),

  /** POST /exporter/applications/{id}/contact — exporter unlocks contact
   * (KYC + terms + MPIN). Idempotent; reveals contacts; opens one chat room;
   * never creates an order or payment. */
  unlockContact: (
    applicationId: string,
    payload: { termsAccepted: boolean; mpin?: string },
  ): Promise<ExportApplication> =>
    post<ExportApplication>(`/exporter/applications/${applicationId}/contact`, payload, {
      headers: idempotencyKey(),
    }),

  /** POST /exporter/applications/{id}/outcome — user-reported outcome. */
  reportOutcome: (
    applicationId: string,
    payload: {
      outcome: ApplicationOutcome;
      finalQuantity?: number;
      finalQuantityUnit?: string;
      finalPrice?: number;
      finalPriceUnit?: string;
      finalCurrency?: string;
      supplyDate?: string;
      collectionLocation?: string;
    },
  ): Promise<ExportApplication> =>
    post<ExportApplication>(`/exporter/applications/${applicationId}/outcome`, payload),

  /** GET /exporter/connections — exporter's contacted farmers. */
  connections: (): Promise<ExportApplication[]> =>
    readList<ExportApplication>('/exporter/connections'),

  /** GET /exporter/connections/mine — farmer's contacted exporters. */
  myConnections: (): Promise<ExportApplication[]> =>
    readList<ExportApplication>('/exporter/connections/mine'),

  /** POST /exporter/applications/{id}/report — record an issue (no escrow
   * freeze, no refund, no liability finding). */
  reportIssue: (
    applicationId: string,
    payload: { category: string; summary: string },
  ): Promise<unknown> =>
    post<unknown>(`/exporter/applications/${applicationId}/report`, payload),

  // ============================================================
  // FARMER — opportunity discovery + readiness profile
  // ============================================================

  /** GET /exporter/opportunities — open requirements (privacy-sanitized). */
  opportunities: (params?: Record<string, unknown>): Promise<ExportRfq[]> =>
    readList<ExportRfq>('/exporter/opportunities', { params }),

  /** GET /exporter/opportunities/{id} — farmer-friendly requirement detail. */
  opportunity: (rfqId: string): Promise<ExportRfq> =>
    readOne<ExportRfq>(`/exporter/opportunities/${rfqId}`),

  /** GET /exporter/readiness/mine — farmer export-readiness profile. */
  getReadiness: (): Promise<ExportReadinessPayload & { farmerId?: string }> =>
    readOne<ExportReadinessPayload & { farmerId?: string }>('/exporter/readiness/mine'),

  /** PUT /exporter/readiness/mine — save export-readiness profile. */
  saveReadiness: (payload: ExportReadinessPayload): Promise<ExportReadinessPayload> =>
    put<ExportReadinessPayload>('/exporter/readiness/mine', payload),

  // ============================================================
  // LEGACY seller-trade pipeline (compatibility only — not part of the
  // farmer–exporter direct-connect workflow)
  // ============================================================

  /** GET /exporter/rfqs/browse — legacy seller-facing RFQ browse. */
  browseRfqs: (params?: Record<string, unknown>): Promise<ExportRfq[]> =>
    readList<ExportRfq>('/exporter/rfqs/browse', { params }),

  /** GET /exporter/rfqs/{id}/quotes — legacy seller quotes board. */
  quotes: (rfqId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/exporter/rfqs/${rfqId}/quotes`),

  /** POST /exporter/rfqs/{id}/quotes — legacy seller quote submission. */
  submitQuote: (rfqId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/exporter/rfqs/${rfqId}/quotes`, payload),

  /** GET /exporter/quotes/mine — legacy seller quote list. */
  myQuotes: (): Promise<unknown[]> => readList<unknown[]>('/exporter/quotes/mine'),

  /** POST /exporter/quotes/{id}/accept — legacy quote accept (creates
   * purchase + export order). Not used by the direct-connect workflow. */
  acceptQuote: (quoteId: string): Promise<unknown> =>
    post<unknown>(`/exporter/quotes/${quoteId}/accept`, {}, { headers: idempotencyKey() }),

  /** POST /exporter/quotes/{id}/reject — legacy seller quote reject. */
  rejectQuote: (quoteId: string): Promise<unknown> =>
    post<unknown>(`/exporter/quotes/${quoteId}/reject`),

  // --- Export Orders (legacy; routes kept but hidden from the sourcing nav) ---
  orders: (params?: Record<string, unknown>): Promise<ExportOrder[]> =>
    readList<ExportOrder>('/exporter/orders', { params }),
  order: (orderId: string): Promise<ExportOrder> =>
    readOne<ExportOrder>(`/exporter/orders/${orderId}`),
  updateOrderStatus: (orderId: string, status: string, note?: string): Promise<ExportOrder> =>
    post<ExportOrder>(`/exporter/orders/${orderId}/status`, { status, note }),
  updateShipment: (orderId: string, payload: Record<string, unknown>): Promise<ExportOrder> =>
    put<ExportOrder>(`/exporter/orders/${orderId}/shipment`, payload),
  addShipmentEvent: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/exporter/orders/${orderId}/shipment/events`, payload),
  documents: (orderId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/exporter/orders/${orderId}/documents`),
  uploadDocument: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/exporter/orders/${orderId}/documents`, payload),
  deleteDocument: (orderId: string, docId: string): Promise<unknown> =>
    del<unknown>(`/exporter/orders/${orderId}/documents/${docId}`),
  recordLc: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/exporter/orders/${orderId}/lc`, payload),
  recordRemittance: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/exporter/orders/${orderId}/remittances`, payload),
  finance: (orderId: string): Promise<unknown> =>
    readOne<unknown>(`/exporter/orders/${orderId}/finance`),

  // --- Suppliers directory (legacy) ---
  suppliers: (): Promise<unknown[]> => readList<unknown[]>('/exporter/suppliers'),
  savedSuppliers: (): Promise<unknown[]> =>
    readList<unknown[]>('/exporter/suppliers/saved'),
  saveSupplier: (sellerId: string): Promise<unknown> =>
    post<unknown>(`/exporter/suppliers/${sellerId}/save`),
  removeSavedSupplier: (sellerId: string): Promise<unknown> =>
    del<unknown>(`/exporter/suppliers/${sellerId}/saved`),

  // --- Analytics & profile ---
  analytics: (): Promise<unknown> => readOne<unknown>('/exporter/analytics'),
  dashboard: (): Promise<unknown> => readOne<unknown>('/exporter/dashboard'),
  profile: (): Promise<unknown> => readOne<unknown>('/exporter/profile'),
};
