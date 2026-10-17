import { post, readList, readOne } from './http';

/** Referrals namespace. */
export const referrals = {
  /** GET /referrals */
  summary: (): Promise<unknown> => readOne<unknown>('/referrals'),

  /** POST /referrals/invite */
  invite: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/referrals/invite', payload),
};
