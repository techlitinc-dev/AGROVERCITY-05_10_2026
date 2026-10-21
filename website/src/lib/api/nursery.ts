import { del, post, put, readItems, readList, readOne } from './http';

/** Nursery API namespace — plants catalog, batches, inventory, orders, offers, payouts, AI insights. */
export const nursery = {
  // --- Profile & KYC ---
  /** GET /nursery/profile */
  profile: (): Promise<unknown> => readOne<unknown>('/nursery/profile'),

  /** PUT /nursery/profile */
  updateProfile: (payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>('/nursery/profile', payload),

  // --- Dashboard ---
  /** GET /nursery/dashboard */
  dashboard: (): Promise<unknown> => readOne<unknown>('/nursery/dashboard'),

  // --- Plants Catalog ---
  /** GET /nursery/plants */
  plants: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/nursery/plants', { params }),

  /** GET /nursery/plants/{id} */
  plant: (id: string): Promise<unknown> => readOne<unknown>(`/nursery/plants/${id}`),

  /** POST /nursery/plants */
  createPlant: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/nursery/plants', payload),

  /** PUT /nursery/plants/{id} */
  updatePlant: (id: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/nursery/plants/${id}`, payload),

  /** DELETE /nursery/plants/{id} */
  deletePlant: (id: string): Promise<unknown> => del<unknown>(`/nursery/plants/${id}`),

  // --- Batches & Stock ---
  /** GET /nursery/batches */
  batches: (): Promise<unknown[]> => readList<unknown[]>('/nursery/batches'),

  /** POST /nursery/batches */
  createBatch: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/nursery/batches', payload),

  /** POST /nursery/batches/{id}/stock-out */
  stockOut: (batchId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/nursery/batches/${batchId}/stock-out`, payload),

  /** GET /nursery/stock/alerts */
  stockAlerts: (): Promise<unknown> => readOne<unknown>('/nursery/stock/alerts'),

  // --- Orders ---
  /** GET /nursery/orders */
  orders: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/nursery/orders', { params }),

  /** GET /nursery/orders/{id} */
  order: (id: string): Promise<unknown> => readOne<unknown>(`/nursery/orders/${id}`),

  /** POST /nursery/orders/{id}/status */
  updateOrderStatus: (orderId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/nursery/orders/${orderId}/status`, payload),

  /** GET /nursery/orders/{id}/invoice */
  invoice: (orderId: string): Promise<unknown> => readOne<unknown>(`/nursery/orders/${orderId}/invoice`),

  // --- Ratings & Reviews ---
  /** GET /nursery/ratings — received reviews (newest first) */
  ratings: (): Promise<unknown> => readOne<unknown>('/nursery/ratings'),

  /** POST /ratings/{id}/reply — nursery replies to a received review */
  replyToRating: (ratingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/ratings/${ratingId}/reply`, payload),

  // --- Offers & Discounts ---
  /** GET /nursery/offers */
  offers: (): Promise<unknown[]> => readList<unknown[]>('/nursery/offers'),

  /** POST /nursery/offers */
  createOffer: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/nursery/offers', payload),

  /** DELETE /nursery/offers/{id} */
  deleteOffer: (id: string): Promise<unknown> => del<unknown>(`/nursery/offers/${id}`),

  // --- Payouts ---
  /** GET /nursery/payouts */
  payouts: (): Promise<unknown> => readOne<unknown>('/nursery/payouts'),

  /** POST /nursery/payouts/request */
  requestPayout: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/nursery/payouts/request', payload),

  // --- AI Analysis ---
  /** GET /nursery/ai-insights */
  aiInsights: (): Promise<unknown> => readOne<unknown>('/nursery/ai-insights'),
};
