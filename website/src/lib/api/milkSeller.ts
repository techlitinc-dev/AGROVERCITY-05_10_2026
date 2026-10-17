import { del, post, put, readList, readOne } from './http';

/** Milk seller namespace — clients, deliveries, bills, analytics. */
export const milkSeller = {
  // --- clients ---
  /** GET /milk-seller/clients */
  clients: (): Promise<unknown[]> => readList<unknown[]>('/milk-seller/clients'),

  /** POST /milk-seller/clients */
  addClient: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/milk-seller/clients', payload),

  /** GET /milk-seller/clients/{id} */
  client: (clientId: string): Promise<unknown> => readOne<unknown>(`/milk-seller/clients/${clientId}`),

  /** PUT /milk-seller/clients/{id} */
  updateClient: (clientId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/milk-seller/clients/${clientId}`, updates),

  /** DELETE /milk-seller/clients/{id} */
  removeClient: (clientId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/milk-seller/clients/${clientId}`),

  /** GET /milk-seller/clients/{id}/calendar */
  clientCalendar: (clientId: string): Promise<unknown> =>
    readOne<unknown>(`/milk-seller/clients/${clientId}/calendar`),

  // --- deliveries ---
  /** GET /milk-seller/deliveries */
  deliveries: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/milk-seller/deliveries', { params }),

  /** POST /milk-seller/deliveries */
  recordDelivery: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/milk-seller/deliveries', payload),

  /** POST /milk-seller/deliveries/bulk */
  recordBulkDeliveries: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/milk-seller/deliveries/bulk', payload),

  /** GET /milk-seller/deliveries/{id} */
  delivery: (entryId: string): Promise<unknown> => readOne<unknown>(`/milk-seller/deliveries/${entryId}`),

  /** PUT /milk-seller/deliveries/{id} */
  updateDelivery: (entryId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/milk-seller/deliveries/${entryId}`, updates),

  /** DELETE /milk-seller/deliveries/{id} */
  removeDelivery: (entryId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/milk-seller/deliveries/${entryId}`),

  // --- bills ---
  /** GET /milk-seller/bills */
  bills: (): Promise<unknown[]> => readList<unknown[]>('/milk-seller/bills'),

  /** POST /milk-seller/bills/generate */
  generateBill: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/milk-seller/bills/generate', payload),

  /** GET /milk-seller/bills/{id} */
  bill: (billId: string): Promise<unknown> => readOne<unknown>(`/milk-seller/bills/${billId}`),

  /** POST /milk-seller/bills/{id}/send */
  sendBill: (billId: string): Promise<unknown> => post<unknown>(`/milk-seller/bills/${billId}/send`),

  /** POST /milk-seller/bills/{id}/payments */
  recordBillPayment: (billId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/milk-seller/bills/${billId}/payments`, payload),

  // --- analytics ---
  /** GET /milk-seller/analytics */
  analytics: (): Promise<unknown> => readOne<unknown>('/milk-seller/analytics'),
};
