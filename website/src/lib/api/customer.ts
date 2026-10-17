import { del, post, put, readList, readOne } from './http';

/** e-Market customer namespace — demands, quotes, orders, subscriptions, storefronts. */
export const customer = {
  // --- analytics & planner ---
  /** GET /customer/analytics */
  analytics: (): Promise<unknown> => readOne<unknown>('/customer/analytics'),

  /** GET /customer/planner */
  planner: (): Promise<unknown> => readOne<unknown>('/customer/planner'),

  /** GET /customer/browse/near-me */
  nearMe: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/customer/browse/near-me', { params }),

  /** GET /customer/storefronts/{farmerId} */
  storefront: (farmerId: string): Promise<unknown> =>
    readOne<unknown>(`/customer/storefronts/${farmerId}`),

  // --- demands & quotes ---
  /** GET /customer/demands */
  demands: (): Promise<unknown[]> => readList<unknown[]>('/customer/demands'),

  /** POST /customer/demands */
  createDemand: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/demands', payload),

  /** DELETE /customer/demands/{id} */
  removeDemand: (demandId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/customer/demands/${demandId}`),

  /** GET /customer/quotes */
  quotes: (): Promise<unknown[]> => readList<unknown[]>('/customer/quotes'),

  /** POST /customer/quotes */
  createQuote: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/quotes', payload),

  /** POST /customer/quotes/{id}/counter */
  counterQuote: (quoteId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/customer/quotes/${quoteId}/counter`, payload),

  /** POST /customer/quotes/{id}/accept */
  acceptQuote: (quoteId: string): Promise<unknown> => post<unknown>(`/customer/quotes/${quoteId}/accept`),

  // --- orders ---
  /** GET /customer/orders */
  orders: (): Promise<unknown[]> => readList<unknown[]>('/customer/orders'),

  /** POST /customer/orders/{id}/inspection */
  orderInspection: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/customer/orders/${orderId}/inspection`, payload),

  /** POST /customer/orders/{id}/qr-handover */
  orderQrHandover: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/customer/orders/${orderId}/qr-handover`, payload),

  /** POST /customer/orders/{id}/cancel */
  cancelOrder: (orderId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/customer/orders/${orderId}/cancel`, reason ? { reason } : {}),

  /** POST /customer/orders/{id}/no-show */
  reportNoShow: (orderId: string): Promise<unknown> =>
    post<unknown>(`/customer/orders/${orderId}/no-show`),

  /** POST /customer/cart/checkout */
  checkout: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/cart/checkout', payload),

  // --- subscriptions ---
  /** GET /customer/subscriptions */
  subscriptions: (): Promise<unknown[]> => readList<unknown[]>('/customer/subscriptions'),

  /** POST /customer/subscriptions */
  createSubscription: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/subscriptions', payload),

  /** PUT /customer/subscriptions/{id} */
  updateSubscription: (subscriptionId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/customer/subscriptions/${subscriptionId}`, updates),

  /** DELETE /customer/subscriptions/{id} */
  cancelSubscription: (subscriptionId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/customer/subscriptions/${subscriptionId}`),

  // --- favorites & invoices ---
  /** GET /customer/suppliers/favorites */
  favoriteSuppliers: (): Promise<unknown[]> => readList<unknown[]>('/customer/suppliers/favorites'),

  /** POST /customer/suppliers/favorites */
  addFavoriteSupplier: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/customer/suppliers/favorites', payload),

  /** GET /customer/invoices/consolidated */
  consolidatedInvoices: (): Promise<unknown[]> => readList<unknown[]>('/customer/invoices/consolidated'),
};
