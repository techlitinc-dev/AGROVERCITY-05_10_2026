import { post, readList, readOne } from './http';

/** FPO namespace — my FPO, directory, pools, machinery. */
export const fpo = {
  /** GET /fpo/me */
  me: (): Promise<unknown> => readOne<unknown>('/fpo/me'),

  /** GET /fpo/directory */
  directory: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/fpo/directory', { params }),

  /** POST /fpo/{fpoId}/join-request */
  joinRequest: (fpoId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/fpo/${fpoId}/join-request`, payload),

  /** POST /fpo/{fpoId}/join-request/approve */
  approveJoinRequest: (fpoId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/fpo/${fpoId}/join-request/approve`, payload),

  /** GET /fpo/pools */
  pools: (): Promise<unknown[]> => readList<unknown[]>('/fpo/pools'),

  /** POST /fpo/pools/{poolId}/join */
  joinPool: (poolId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/fpo/pools/${poolId}/join`, payload),

  /** GET /fpo/machinery */
  machinery: (): Promise<unknown[]> => readList<unknown[]>('/fpo/machinery'),
};
