import { del, post, put, readList } from './http';

/** Support namespace — FAQ + ask. */
export const support = {
  /** GET /faq */
  faq: (params?: Record<string, unknown>): Promise<unknown[]> => readList<unknown[]>('/faq', { params }),

  /** POST /faq (admin authoring) */
  createFaq: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/faq', payload),

  /** PUT /faq/{articleId} */
  updateFaq: (articleId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/faq/${articleId}`, updates),

  /** DELETE /faq/{articleId} */
  removeFaq: (articleId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/faq/${articleId}`),

  /** POST /support/ask */
  ask: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/support/ask', payload),
};
