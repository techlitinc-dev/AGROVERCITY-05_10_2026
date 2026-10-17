import { del, post, put, readList, readOne } from './http';

/** Gruh Udyog (home enterprise) namespace — units, products, batches, offers, orders. */
export const gruhUdyog = {
  /** GET /gruh-udyog/categories */
  categories: (): Promise<unknown[]> => readList<unknown[]>('/gruh-udyog/categories'),

  /** GET /gruh-udyog/units/me */
  myUnits: (): Promise<unknown[]> => readList<unknown[]>('/gruh-udyog/units/me'),

  /** POST /gruh-udyog/units */
  createUnit: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/gruh-udyog/units', payload),

  /** GET /gruh-udyog/units/{id} */
  unit: (unitId: string): Promise<unknown> => readOne<unknown>(`/gruh-udyog/units/${unitId}`),

  /** PUT /gruh-udyog/units/{id} */
  updateUnit: (unitId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/gruh-udyog/units/${unitId}`, updates),

  /** POST /gruh-udyog/units/{id}/pause */
  pauseUnit: (unitId: string): Promise<unknown> => post<unknown>(`/gruh-udyog/units/${unitId}/pause`),

  /** POST /gruh-udyog/units/{id}/resume */
  resumeUnit: (unitId: string): Promise<unknown> => post<unknown>(`/gruh-udyog/units/${unitId}/resume`),

  /** GET /gruh-udyog/units/{id}/dashboard */
  unitDashboard: (unitId: string): Promise<unknown> =>
    readOne<unknown>(`/gruh-udyog/units/${unitId}/dashboard`),

  /** GET /gruh-udyog/units/{id}/orders */
  unitOrders: (unitId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/gruh-udyog/units/${unitId}/orders`),

  /** POST /gruh-udyog/units/{id}/products */
  addProduct: (unitId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/gruh-udyog/units/${unitId}/products`, payload),

  /** GET /gruh-udyog/units/{id}/products */
  products: (unitId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/gruh-udyog/units/${unitId}/products`),

  /** GET /gruh-udyog/products/{id} */
  product: (productId: string): Promise<unknown> => readOne<unknown>(`/gruh-udyog/products/${productId}`),

  /** PUT /gruh-udyog/products/{id} */
  updateProduct: (productId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/gruh-udyog/products/${productId}`, updates),

  /** PUT /gruh-udyog/products/{id}/stock */
  updateStock: (productId: string, stock: number): Promise<unknown> =>
    put<unknown>(`/gruh-udyog/products/${productId}/stock`, { stock }),

  /** POST /gruh-udyog/products/{id}/publish */
  publishProduct: (productId: string): Promise<unknown> =>
    post<unknown>(`/gruh-udyog/products/${productId}/publish`),

  /** POST /gruh-udyog/products/{id}/unpublish */
  unpublishProduct: (productId: string): Promise<unknown> =>
    post<unknown>(`/gruh-udyog/products/${productId}/unpublish`),

  /** DELETE /gruh-udyog/products/{id} */
  removeProduct: (productId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/gruh-udyog/products/${productId}`),

  /** POST /gruh-udyog/products/{id}/batches */
  addBatch: (productId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/gruh-udyog/products/${productId}/batches`, payload),

  /** POST /gruh-udyog/batches/{id}/status */
  updateBatchStatus: (batchId: string, status: string): Promise<unknown> =>
    post<unknown>(`/gruh-udyog/batches/${batchId}/status`, { status }),

  /** POST /gruh-udyog/units/{id}/certifications */
  addCertification: (unitId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/gruh-udyog/units/${unitId}/certifications`, payload),

  /** GET /gruh-udyog/units/{id}/certifications */
  certifications: (unitId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/gruh-udyog/units/${unitId}/certifications`),

  /** POST /gruh-udyog/products/{id}/offers */
  addOffer: (productId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/gruh-udyog/products/${productId}/offers`, payload),

  /** GET /gruh-udyog/units/{id}/offers */
  offers: (unitId: string): Promise<unknown[]> => readList<unknown[]>(`/gruh-udyog/units/${unitId}/offers`),

  /** DELETE /gruh-udyog/offers/{id} */
  removeOffer: (offerId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/gruh-udyog/offers/${offerId}`),

  /** POST /gruh-udyog/orders/{id}/accept */
  acceptOrder: (orderId: string): Promise<unknown> => post<unknown>(`/gruh-udyog/orders/${orderId}/accept`),

  /** POST /gruh-udyog/orders/{id}/reject */
  rejectOrder: (orderId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/gruh-udyog/orders/${orderId}/reject`, reason ? { reason } : {}),

  /** POST /gruh-udyog/orders/{id}/status */
  updateOrderStatus: (orderId: string, status: string): Promise<unknown> =>
    post<unknown>(`/gruh-udyog/orders/${orderId}/status`, { status }),
};
