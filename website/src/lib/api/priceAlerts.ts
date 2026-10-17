import { del, post, readList } from './http';

/** Price alerts namespace — CRUD for mandi price alerts. */
export const priceAlerts = {
  /** GET /price-alerts */
  list: (): Promise<unknown[]> => readList<unknown[]>('/price-alerts'),

  /** POST /price-alerts */
  create: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/price-alerts', payload),

  /** DELETE /price-alerts/{id} */
  remove: (alertId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/price-alerts/${alertId}`),
};
