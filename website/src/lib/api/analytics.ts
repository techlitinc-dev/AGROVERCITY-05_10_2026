import { post, readOne } from './http';

/** Analytics namespace — persona analytics + event tracking. */
export const analytics = {
  /** GET /analytics/customer */
  customer: (): Promise<unknown> => readOne<unknown>('/analytics/customer'),

  /** GET /analytics/seller */
  seller: (): Promise<unknown> => readOne<unknown>('/analytics/seller'),

  /** GET /analytics/north-star */
  northStar: (): Promise<unknown> => readOne<unknown>('/analytics/north-star'),

  /** POST /analytics/events — track a UI event. */
  track: (event: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>('/analytics/events', { event, ...payload }),
};
