import { del, post, put, readList, readOne } from './http';
import { MOCK_BUYER_DEMANDS } from './mocks';
import type { BuyerDemand } from '../../types';

/** Buyer demands namespace — /demands CRUD + browse. */
export const demands = {
  /** GET /demands */
  list: (params?: Record<string, unknown>): Promise<BuyerDemand[]> =>
    readList<BuyerDemand>('/demands', { params, mock: MOCK_BUYER_DEMANDS }),

  /** GET /demands/browse */
  browse: (params?: Record<string, unknown>): Promise<BuyerDemand[]> =>
    readList<BuyerDemand>('/demands/browse', { params, mock: MOCK_BUYER_DEMANDS }),

  /** GET /demands/standing */
  standing: (): Promise<BuyerDemand[]> => readList<BuyerDemand>('/demands/standing', { mock: [] }),

  /** GET /demands/{id} */
  get: (demandId: string): Promise<BuyerDemand> => readOne<BuyerDemand>(`/demands/${demandId}`),

  /** POST /demands */
  create: (demand: Partial<BuyerDemand>): Promise<BuyerDemand> => post<BuyerDemand>('/demands', demand),

  /** PUT /demands/{id} */
  update: (demandId: string, updates: Partial<BuyerDemand>): Promise<BuyerDemand> =>
    put<BuyerDemand>(`/demands/${demandId}`, updates),

  /** POST /demands/{id}/close */
  close: (demandId: string): Promise<BuyerDemand> => post<BuyerDemand>(`/demands/${demandId}/close`),

  /** POST /demands/{id}/reopen */
  reopen: (demandId: string): Promise<BuyerDemand> => post<BuyerDemand>(`/demands/${demandId}/reopen`),

  /** DELETE /demands/{id} */
  remove: (demandId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/demands/${demandId}`),
};
