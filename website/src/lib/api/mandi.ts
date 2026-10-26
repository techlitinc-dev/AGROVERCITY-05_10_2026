import { del, post, readItems, readList, readOne } from './http';
import { MOCK_MANDI_PRICES } from './mocks';
import type { MandiPrice } from '../../types';

/** Mandi namespace — prices, compare, forecast, smart-select, price alerts live in priceAlerts.ts. */
export const mandi = {
  /** GET /mandi/prices */
  prices: (params?: Record<string, unknown>): Promise<MandiPrice[]> =>
    readList<MandiPrice>('/mandi/prices', { params, mock: MOCK_MANDI_PRICES }),

  /** GET /mandi/list */
  list: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/mandi/list', { params }),

  /** GET /mandi/vyapari-rates */
  vyapariRates: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/mandi/vyapari-rates', { params }),

  /** GET /mandi/compare */
  compare: (params: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/mandi/compare', { params }),

  /** GET /mandi/prices/history */
  history: (params: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/mandi/prices/history', { params }),

  /** GET /mandi/forecast */
  forecast: (params?: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/mandi/forecast', { params }),

  /** POST /mandi/smart-select */
  smartSelect: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/mandi/smart-select', payload),

  /** GET /mandi/favorites — saved markets ({items: [...]} envelope; typed shape in follows.ts). */
  favoritesList: (): Promise<unknown[]> => readItems<unknown>('/mandi/favorites'),

  /** GET /mandi/live/filters — Agmarknet commodity groups / commodities / states. */
  liveFilters: (): Promise<unknown> => readOne<unknown>('/mandi/live/filters'),

  /** GET /mandi/live — daily modal price / arrival / MSP rows from Agmarknet. */
  live: (params?: Record<string, unknown>): Promise<any> => readOne<any>('/mandi/live', { params }),

  /** POST /mandi/live/refresh — scrape Agmarknet into mandi_prices/history (throttled). */
  liveRefresh: (): Promise<any> => post<any>('/mandi/live/refresh'),

  /** GET /mandi/analytics/movers — top gainers/losers + MSP spread. */
  movers: (params?: Record<string, unknown>): Promise<any> =>
    readOne<any>('/mandi/analytics/movers', { params }),

  /** POST /mandi/favorites — body {mandiId}; 404 for unknown mandi. */
  addFavorite: (mandiId: string): Promise<unknown> =>
    post<unknown>('/mandi/favorites', { mandiId }),

  /** DELETE /mandi/favorites/{mandiId} — idempotent remove. */
  removeFavorite: (mandiId: string): Promise<{ status: string }> =>
    del<{ status: string }>(`/mandi/favorites/${encodeURIComponent(mandiId)}`),
};
