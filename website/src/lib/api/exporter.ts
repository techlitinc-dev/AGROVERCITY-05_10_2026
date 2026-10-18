import { del, post, put, readList, readOne } from './http';
import type { ExportRfq, ExportQuote, ExportOrder } from '../../types';

/**
 * Exporter API namespace — connects directly to FastAPI `/v1/exporter/*` endpoints.
 * Covers RFQs, Seller Quotes, Export Orders, Shipping Milestones, Export Documents (APEDA/Phyto),
 * LC/Remittance Finance, Verified Suppliers, and Trade Analytics.
 */
export const exporter = {
  // --- RFQs ---
  /** GET /exporter/rfqs */
  rfqs: (params?: Record<string, unknown>): Promise<ExportRfq[]> =>
    readList<ExportRfq>('/exporter/rfqs', { params }),

  /** GET /exporter/rfqs/browse */
  browseRfqs: (params?: Record<string, unknown>): Promise<ExportRfq[]> =>
    readList<ExportRfq>('/exporter/rfqs/browse', { params }),

  /** GET /exporter/rfqs/{id} */
  rfq: (rfqId: string): Promise<ExportRfq> =>
    readOne<ExportRfq>(`/exporter/rfqs/${rfqId}`),

  /** POST /exporter/rfqs */
  createRfq: (payload: Record<string, unknown>): Promise<ExportRfq> =>
    post<ExportRfq>('/exporter/rfqs', payload),

  /** POST /exporter/rfqs/{id}/close */
  closeRfq: (rfqId: string): Promise<ExportRfq> =>
    post<ExportRfq>(`/exporter/rfqs/${rfqId}/close`),

  /** POST /exporter/rfqs/{id}/reopen */
  reopenRfq: (rfqId: string): Promise<ExportRfq> =>
    post<ExportRfq>(`/exporter/rfqs/${rfqId}/reopen`),

  /** DELETE /exporter/rfqs/{id} */
  deleteRfq: (rfqId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/exporter/rfqs/${rfqId}`),

  // --- Quotes ---
  /** GET /exporter/rfqs/{rfq_id}/quotes */
  quotes: (rfqId: string): Promise<ExportQuote[]> =>
    readList<ExportQuote>(`/exporter/rfqs/${rfqId}/quotes`),

  /** POST /exporter/rfqs/{rfq_id}/quotes */
  submitQuote: (rfqId: string, payload: Record<string, unknown>): Promise<ExportQuote> =>
    post<ExportQuote>(`/exporter/rfqs/${rfqId}/quotes`, payload),

  /** GET /exporter/quotes/mine */
  myQuotes: (): Promise<ExportQuote[]> =>
    readList<ExportQuote>('/exporter/quotes/mine'),

  /** POST /exporter/quotes/{id}/accept */
  acceptQuote: (quoteId: string): Promise<ExportOrder> =>
    post<ExportOrder>(`/exporter/quotes/${quoteId}/accept`),

  /** POST /exporter/quotes/{id}/reject */
  rejectQuote: (quoteId: string): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(`/exporter/quotes/${quoteId}/reject`),

  // --- Export Orders ---
  /** GET /exporter/orders */
  orders: (params?: Record<string, unknown>): Promise<ExportOrder[]> =>
    readList<ExportOrder>('/exporter/orders', { params }),

  /** GET /exporter/orders/{id} */
  order: (orderId: string): Promise<ExportOrder> =>
    readOne<ExportOrder>(`/exporter/orders/${orderId}`),

  /** POST /exporter/orders/{id}/status */
  updateOrderStatus: (orderId: string, status: string, note?: string): Promise<ExportOrder> =>
    post<ExportOrder>(`/exporter/orders/${orderId}/status`, { status, note }),

  /** PUT /exporter/orders/{id}/shipment */
  updateShipment: (orderId: string, payload: Record<string, unknown>): Promise<ExportOrder> =>
    put<ExportOrder>(`/exporter/orders/${orderId}/shipment`, payload),

  /** POST /exporter/orders/{id}/shipment/events */
  addShipmentEvent: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/exporter/orders/${orderId}/shipment/events`, payload),

  // --- Export Documents ---
  /** GET /exporter/orders/{id}/documents */
  documents: (orderId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/exporter/orders/${orderId}/documents`),

  /** POST /exporter/orders/{id}/documents */
  uploadDocument: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/exporter/orders/${orderId}/documents`, payload),

  /** DELETE /exporter/orders/{id}/documents/{doc_id} */
  deleteDocument: (orderId: string, docId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/exporter/orders/${orderId}/documents/${docId}`),

  // --- LC / Remittance Finance ---
  /** POST /exporter/orders/{id}/lc */
  recordLc: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/exporter/orders/${orderId}/lc`, payload),

  /** POST /exporter/orders/{id}/remittances */
  recordRemittance: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/exporter/orders/${orderId}/remittances`, payload),

  /** GET /exporter/orders/{id}/finance */
  finance: (orderId: string): Promise<unknown> =>
    readOne<unknown>(`/exporter/orders/${orderId}/finance`),

  // --- Suppliers Directory ---
  /** GET /exporter/suppliers */
  suppliers: (): Promise<unknown[]> =>
    readList<unknown[]>('/exporter/suppliers'),

  /** GET /exporter/suppliers/saved */
  savedSuppliers: (): Promise<unknown[]> =>
    readList<unknown[]>('/exporter/suppliers/saved'),

  /** POST /exporter/suppliers/{id}/save */
  saveSupplier: (sellerId: string): Promise<unknown> =>
    post<unknown>(`/exporter/suppliers/${sellerId}/save`),

  /** DELETE /exporter/suppliers/{id}/saved */
  removeSavedSupplier: (sellerId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/exporter/suppliers/${sellerId}/saved`),

  // --- Analytics & Profile ---
  /** GET /exporter/analytics */
  analytics: (): Promise<unknown> =>
    readOne<unknown>('/exporter/analytics'),

  /** GET /exporter/dashboard */
  dashboard: (): Promise<unknown> =>
    readOne<unknown>('/exporter/dashboard'),

  /** GET /exporter/profile */
  profile: (): Promise<unknown> =>
    readOne<unknown>('/exporter/profile'),
};
