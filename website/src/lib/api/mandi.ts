import { apiClient } from './client';
import { handleApiError } from './errors';
import { del, post, readItems, readList, readOne } from './http';
import { MOCK_MANDI_PRICES } from './mocks';
import type { MandiLiveFilters, MandiLiveResponse, MandiPrice } from '../../types';

/** Mandi namespace — government live prices, compare, forecast, smart-select, price alerts live in priceAlerts.ts. */
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
  history: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/mandi/prices/history', { params }),

  /** GET /mandi/forecast */
  forecast: (params?: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/mandi/forecast', { params }),

  /**
   * GET /mandi/live — latest reported government open-data mandi prices.
   * Daily figures (not a real-time stream). District defaults to the caller's
   * profile district. No mock fallback: a failed request throws.
   *
   * Uses the raw axios client because the response IS an envelope with a
   * `data` array (readOne would unwrap to the array).
   */
  live: async (params?: {
    district?: string;
    commodity?: string;
    limit?: number;
    offset?: number;
  }): Promise<MandiLiveResponse> => {
    try {
      const res = await apiClient.get<MandiLiveResponse>('/mandi/live', { params });
      return res.data;
    } catch (e) {
      handleApiError(e);
    }
  },

  /**
   * POST /mandi/live/refresh — invalidate the gov-feed cache for these params
   * and fetch fresh data. Never runs the retired Agmarknet scraper; on upstream
   * failure the last-good snapshot is returned flagged `stale`.
   */
  liveRefresh: async (params?: {
    district?: string;
    commodity?: string;
    limit?: number;
    offset?: number;
  }): Promise<MandiLiveResponse & { refreshed: boolean }> => {
    try {
      const res = await apiClient.post<MandiLiveResponse & { refreshed: boolean }>(
        '/mandi/live/refresh',
        params ?? {},
      );
      return res.data;
    } catch (e) {
      handleApiError(e);
    }
  },

  /** GET /mandi/live/filters — districts/commodities/mandis from stored genuine snapshots. */
  liveFilters: (): Promise<MandiLiveFilters> => readOne<MandiLiveFilters>('/mandi/live/filters'),

  /** POST /mandi/smart-select */
  smartSelect: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/mandi/smart-select', payload),

  /** GET /mandi/favorites — saved markets ({items: [...]} envelope; typed shape in follows.ts). */
  favoritesList: (): Promise<unknown[]> => readItems<unknown>('/mandi/favorites'),

  /** POST /mandi/favorites — body {mandiId}; 404 for unknown mandi. */
  addFavorite: (mandiId: string): Promise<unknown> =>
    post<unknown>('/mandi/favorites', { mandiId }),

  /** DELETE /mandi/favorites/{mandiId} — idempotent remove. */
  removeFavorite: (mandiId: string): Promise<{ status: string }> =>
    del<{ status: string }>(`/mandi/favorites/${encodeURIComponent(mandiId)}`),
};
