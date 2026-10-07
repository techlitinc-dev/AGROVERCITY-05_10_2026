import { api } from './client';

/**
 * Price-alerts API — typed mirror of backend/app/routers/price_alerts.py.
 *
 * Backend quirks (verified against the router + tests/test_price_alerts.py):
 * - `targetPrice` is compared against the mandi `modalPrice` (₹ per quintal,
 *   integer) — it is NOT a paisa field. Send whole rupees so the comparison is
 *   meaningful.
 * - `GET /price-alerts` is not side-effect free: listing evaluates each alert
 *   and, when the modal price crosses the target, stamps `firedAt` and sends
 *   the `price_alert` notification. `fired` reflects that stamp.
 * - `currentModal` is null when no mandi price row matches the crop.
 * - `DELETE` answers 204 with an empty body.
 * - The shared `client.ts` interceptor already sets `Idempotency-Key` (uuid4)
 *   on this module's POST/DELETE calls, so writes are replay-safe (rule 7).
 */

export interface PriceAlert {
  id: string;
  crop: string;
  targetPrice: number;
  above: boolean;
  /** Null when the crop has no mandi price row yet. */
  currentModal: number | null;
  fired: boolean;
  createdAt: string;
}

export interface PriceAlertPayload {
  crop: string;
  /** Whole rupees per quintal, compared against the mandi modal price. */
  targetPrice: number;
  /** True = alert when the modal price rises to/above target; false = falls to/below. */
  above: boolean;
}

export async function listPriceAlerts(): Promise<{ data: PriceAlert[] }> {
  const { data } = await api.get<{ data: PriceAlert[] }>('/price-alerts');
  return data;
}

export async function createPriceAlert(payload: PriceAlertPayload): Promise<PriceAlert> {
  const { data } = await api.post<PriceAlert>('/price-alerts', payload);
  return data;
}

export async function deletePriceAlert(alertId: string): Promise<void> {
  await api.delete(`/price-alerts/${alertId}`);
}
