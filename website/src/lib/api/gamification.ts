import { post, readList, readOne } from './http';

/** Gamification (Kisan Coins) namespace. */
export const gamification = {
  /** GET /gamification/status */
  status: (): Promise<unknown> => readOne<unknown>('/gamification/status'),

  /** GET /gamification/ledger */
  ledger: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/gamification/ledger', { params }),

  /** GET /gamification/rewards */
  rewards: (): Promise<unknown[]> => readList<unknown[]>('/gamification/rewards'),

  /** POST /gamification/redeem */
  redeem: (rewardId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>('/gamification/redeem', { rewardId, ...payload }),

  /** GET /gamification/leaderboard */
  leaderboard: (): Promise<unknown[]> => readList<unknown[]>('/gamification/leaderboard'),
};
