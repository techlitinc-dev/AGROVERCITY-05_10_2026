import { post, readList, readOne } from './http';
import { MOCK_TRADE_OFFERS } from './mocks';
import type { TradeOffer, PurchaseOrder } from '../../types';

/** Accept response: first call records my agreement (purchase null, status
 *  'agreement_pending'); the second party's call locks the deal and returns
 *  the created purchase. */
export interface OfferAcceptResult {
  offer: TradeOffer;
  purchase: PurchaseOrder | null;
}

/** Trade offers namespace — /offers. */
export const offers = {
  /** GET /offers/mine */
  mine: (params?: Record<string, unknown>): Promise<TradeOffer[]> =>
    readList<TradeOffer>('/offers/mine', { params, mock: MOCK_TRADE_OFFERS }),

  /** GET /offers/{id} */
  get: (offerId: string): Promise<TradeOffer> => readOne<TradeOffer>(`/offers/${offerId}`),

  /** POST /offers */
  create: (offer: Partial<TradeOffer>): Promise<TradeOffer> => post<TradeOffer>('/offers', offer),

  /** POST /offers/{id}/accept — records my agreement; locks the deal when the
   *  other party confirms too (mutual agreement). */
  accept: (offerId: string): Promise<OfferAcceptResult> =>
    post<OfferAcceptResult>(`/offers/${offerId}/accept`),

  /** POST /offers/{id}/agreement/cancel — withdraw my agreement while the
   *  deal waits for the other party's confirmation. */
  cancelAgreement: (offerId: string): Promise<TradeOffer> =>
    post<TradeOffer>(`/offers/${offerId}/agreement/cancel`),

  /** POST /offers/{id}/reject */
  reject: (offerId: string, reason?: string): Promise<TradeOffer> =>
    post<TradeOffer>(`/offers/${offerId}/reject`, reason ? { reason } : undefined),

  /** POST /offers/{id}/withdraw */
  withdraw: (offerId: string): Promise<TradeOffer> => post<TradeOffer>(`/offers/${offerId}/withdraw`),

  /** POST /offers/{id}/counter */
  counter: (offerId: string, payload: { pricePerUnit: number; message?: string }): Promise<TradeOffer> =>
    post<TradeOffer>(`/offers/${offerId}/counter`, payload),
};
