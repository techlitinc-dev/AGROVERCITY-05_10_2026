import { post, readList, readOne } from './http';

/** Billing namespace — plans, subscription, invoices. */
export const billing = {
  /** GET /billing/plans */
  plans: (): Promise<unknown[]> => readList<unknown[]>('/billing/plans'),

  /** GET /billing/subscription */
  subscription: (): Promise<unknown> => readOne<unknown>('/billing/subscription'),

  /** GET /billing/subscriptions */
  subscriptions: (): Promise<unknown[]> => readList<unknown[]>('/billing/subscriptions'),

  /** POST /billing/subscribe */
  subscribe: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/billing/subscribe', payload),

  /** GET /billing/invoices */
  invoices: (): Promise<unknown[]> => readList<unknown[]>('/billing/invoices'),
};
