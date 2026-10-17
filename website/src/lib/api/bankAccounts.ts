import { del, post, readList } from './http';

/** Bank accounts namespace — linked accounts, verification, primary. */
export const bankAccounts = {
  /** GET /bank-accounts */
  list: (): Promise<unknown[]> => readList<unknown[]>('/bank-accounts'),

  /** POST /bank-accounts */
  add: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/bank-accounts', payload),

  /** POST /bank-accounts/{id}/verify */
  verify: (accountId: string): Promise<unknown> => post<unknown>(`/bank-accounts/${accountId}/verify`),

  /** POST /bank-accounts/{id}/set-primary */
  setPrimary: (accountId: string): Promise<unknown> =>
    post<unknown>(`/bank-accounts/${accountId}/set-primary`),

  /** DELETE /bank-accounts/{id} */
  remove: (accountId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/bank-accounts/${accountId}`),
};
