import { del, post, put, readList, readOne } from './http';
import { MOCK_PRODUCE_LOTS } from './mocks';
import type { ProduceLot, TradeOffer } from '../../types';

/**
 * Lot write payload — the typed core plus the backend extras that POST/PUT
 * accept: photos[], lat, lng, village.
 */
export type LotPayload = Partial<ProduceLot> & Record<string, unknown>;

/** Produce lots namespace — /market/lots CRUD + offers board. */
export const lots = {
  /** GET /market/lots */
  list: (params?: Record<string, unknown>): Promise<ProduceLot[]> =>
    readList<ProduceLot>('/market/lots', { params, mock: MOCK_PRODUCE_LOTS }),

  /** GET /market/lots/browse */
  browse: (params?: Record<string, unknown>): Promise<ProduceLot[]> =>
    readList<ProduceLot>('/market/lots/browse', { params }),

  /** GET /market/lots/{id} */
  get: (lotId: string): Promise<ProduceLot> => readOne<ProduceLot>(`/market/lots/${lotId}`),

  /** POST /market/lots */
  create: (lot: LotPayload): Promise<ProduceLot> => post<ProduceLot>('/market/lots', lot),

  /** PUT /market/lots/{id} */
  update: (lotId: string, updates: LotPayload): Promise<ProduceLot> =>
    put<ProduceLot>(`/market/lots/${lotId}`, updates),

  /** DELETE /market/lots/{id} */
  remove: (lotId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/market/lots/${lotId}`),

  /** POST /market/lots/{id}/relist */
  relist: (lotId: string): Promise<ProduceLot> => post<ProduceLot>(`/market/lots/${lotId}/relist`),

  /** POST /market/lots/{id}/submit-for-review — farmer sends the lot to admin moderation. */
  submitForReview: (lotId: string): Promise<ProduceLot> =>
    post<ProduceLot>(`/market/lots/${lotId}/submit-for-review`),

  /** GET /market/lots/{id}/offers — offers board for a lot. */
  offers: (lotId: string): Promise<TradeOffer[]> =>
    readList<TradeOffer>(`/market/lots/${lotId}/offers`, { mock: [] }),
};
