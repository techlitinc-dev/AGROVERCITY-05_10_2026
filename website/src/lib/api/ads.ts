import { del, post, readList, readOne } from './http';

/** Ads namespace — sponsored listings. */
export const ads = {
  /** GET /ads/active */
  active: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/ads/active', { params }),

  /** POST /ads/{id}/impression */
  impression: (adId: string): Promise<unknown> => post<unknown>(`/ads/${adId}/impression`),

  /** POST /ads/{id}/click */
  click: (adId: string): Promise<unknown> => post<unknown>(`/ads/${adId}/click`),

  /** GET /ads/mine */
  mine: (): Promise<unknown[]> => readList<unknown[]>('/ads/mine'),

  /** POST /ads */
  create: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/ads', payload),

  /** GET /ads/{id} */
  get: (adId: string): Promise<unknown> => readOne<unknown>(`/ads/${adId}`),

  /** PUT /ads/{id} */
  update: (adId: string, updates: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/ads/${adId}`, updates),

  /** DELETE /ads/{id} */
  remove: (adId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/ads/${adId}`),

  /** GET /ads/{id}/analytics */
  adAnalytics: (adId: string): Promise<unknown> => readOne<unknown>(`/ads/${adId}/analytics`),
};
