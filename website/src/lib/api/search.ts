import { del, post, readList, readOne } from './http';

/** Search namespace — global search + saved searches. */
export const search = {
  /** GET /search */
  query: (q: string, params: Record<string, unknown> = {}): Promise<unknown[]> =>
    readList<unknown[]>('/search', { params: { q, ...params } }),

  // --- saved searches ---
  /** GET /saved-searches */
  saved: (): Promise<unknown[]> => readList<unknown[]>('/saved-searches'),

  /** POST /saved-searches */
  save: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/saved-searches', payload),

  /** GET /saved-searches/{id} */
  savedSearch: (searchId: string): Promise<unknown> => readOne<unknown>(`/saved-searches/${searchId}`),

  /** DELETE /saved-searches/{id} */
  removeSaved: (searchId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/saved-searches/${searchId}`),

  /** POST /saved-searches/{id}/alerts */
  toggleAlerts: (searchId: string, enabled: boolean): Promise<unknown> =>
    post<unknown>(`/saved-searches/${searchId}/alerts`, { enabled }),
};
