import { post, put, readList, readOne } from '../../lib/api';

/**
 * Dairy-manager endpoints that are live on the backend but not yet exposed on
 * the `dairy.manager` namespace in `lib/api/dairy.ts`. Per project convention
 * we do NOT edit `lib/api`; these use the exported http helpers directly so
 * envelope unwrapping + error contracts stay identical. (Tracked as an API
 * gap for a future `lib/api` regeneration pass.)
 */
export const dairyExtras = {
  // --- rate chart (/livestock/dairy/rate-chart) ---
  activeRateChart: (species = 'cow'): Promise<unknown> =>
    readOne<unknown>('/livestock/dairy/rate-chart', { params: { species } }),
  rateChartVersions: (species = 'cow'): Promise<unknown[]> =>
    readList<unknown[]>('/livestock/dairy/rate-chart/versions', { params: { species } }),
  createRateChart: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/dairy/rate-chart', payload),
  updateRateChart: (chartId: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/livestock/dairy/rate-chart/${chartId}`, payload),

  // --- procurement collections (/livestock/procurement/*) ---
  calcRate: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/procurement/rate-calc', payload),
  collections: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/livestock/procurement/collections', { params }),
  createCollection: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/procurement/collections', payload),
  procurementSummary: (date?: string): Promise<unknown> =>
    readOne<unknown>('/livestock/procurement/summary', { params: date ? { date } : {} }),

  // --- payments batches: mark-paid with UTR/payout reference ---
  // (lib `dairy.manager.markBatchPaid` posts no body; backend accepts payoutRef)
  markBatchPaid: (batchId: string, payoutRef: string): Promise<unknown> =>
    post<unknown>(`/livestock/dairy/payments/batches/${batchId}/mark-paid`, { payoutRef }),

  // --- sales (/livestock/dairy/sales/*) ---
  salesCustomers: (): Promise<unknown[]> => readList<unknown[]>('/livestock/dairy/sales/customers'),
  createSalesCustomer: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/dairy/sales/customers', payload),
  updateSalesCustomer: (customerId: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/livestock/dairy/sales/customers/${customerId}`, payload),
  salesOrders: (): Promise<unknown[]> => readList<unknown[]>('/livestock/dairy/sales/orders'),
  createSalesOrder: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/dairy/sales/orders', payload),
  updateSalesOrderStatus: (orderId: string, status: string): Promise<unknown> =>
    post<unknown>(`/livestock/dairy/sales/orders/${orderId}/status`, { status }),
  salesSummary: (): Promise<unknown> => readOne<unknown>('/livestock/dairy/sales/summary'),

  // --- stock (/livestock/dairy/stock/items) ---
  stockItems: (): Promise<unknown[]> => readList<unknown[]>('/livestock/dairy/stock/items'),
  createStockItem: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/livestock/dairy/stock/items', payload),
  adjustStockItem: (itemId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/livestock/dairy/stock/items/${itemId}/adjust`, payload),

  // --- reports & analytics (/livestock/dairy/reports/*, /livestock/dairy/analytics) ---
  dailyReport: (date?: string): Promise<unknown> =>
    readOne<unknown>('/livestock/dairy/reports/daily', { params: date ? { date } : {} }),
  plReport: (month?: string): Promise<unknown> =>
    readOne<unknown>('/livestock/dairy/reports/pl', { params: month ? { month } : {} }),
  dairyAnalytics: (month?: string): Promise<unknown> =>
    readOne<unknown>('/livestock/dairy/analytics', { params: month ? { month } : {} }),

  // --- AI demand forecast (POST /ai-power/demand/forecast — not in lib/api) ---
  forecastDemand: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/ai-power/demand/forecast', payload),
};

export default dairyExtras;
