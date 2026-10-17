import { del, post, readList } from './http';

/** Vault namespace — document vault. */
export const vault = {
  /** GET /vault/documents */
  documents: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/vault/documents', { params }),

  /** POST /vault/documents */
  upload: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/vault/documents', payload),

  /** DELETE /vault/documents/{docId} */
  remove: (docId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/vault/documents/${docId}`),
};
