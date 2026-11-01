import { del, post, put, readList, readOne } from './http';
import { MOCK_BUYER_DEMANDS } from './mocks';
import type { BuyerDemand } from '../../types';

/** Buyer demands namespace — /demands CRUD + browse + industrial sourcing. */
export const demands = {
  /** GET /demands */
  list: (params?: Record<string, unknown>): Promise<BuyerDemand[]> =>
    readList<BuyerDemand>('/demands', { params, mock: MOCK_BUYER_DEMANDS }),

  /** GET /demands/browse */
  browse: (params?: Record<string, unknown>): Promise<BuyerDemand[]> =>
    readList<BuyerDemand>('/demands/browse', { params, mock: MOCK_BUYER_DEMANDS }),

  /** GET /demands/matches — "Matches your crops" (deterministic crop/location). */
  matches: (params?: Record<string, unknown>): Promise<BuyerDemand[]> =>
    readList<BuyerDemand>('/demands/matches', { params, mock: [] }),

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

  /** POST /demands/{id}/pause */
  pause: (demandId: string): Promise<BuyerDemand> => post<BuyerDemand>(`/demands/${demandId}/pause`),

  /** POST /demands/{id}/resume */
  resume: (demandId: string): Promise<BuyerDemand> => post<BuyerDemand>(`/demands/${demandId}/resume`),

  /** POST /demands/{id}/fulfil — buyer-controlled; never automatic. */
  fulfil: (demandId: string): Promise<BuyerDemand> => post<BuyerDemand>(`/demands/${demandId}/fulfil`),

  /** POST /demands/{id}/duplicate — copies requirement fields into a new draft. */
  duplicate: (demandId: string): Promise<BuyerDemand> => post<BuyerDemand>(`/demands/${demandId}/duplicate`),

  /** POST /demands/{id}/reopen */
  reopen: (demandId: string): Promise<BuyerDemand> => post<BuyerDemand>(`/demands/${demandId}/reopen`),

  /** DELETE /demands/{id} */
  remove: (demandId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/demands/${demandId}`),
};
