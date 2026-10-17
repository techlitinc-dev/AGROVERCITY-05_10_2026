import { post, readList, readOne } from './http';

/** Calls namespace — in-app voice/video call signalling. */
export const calls = {
  /** POST /calls — initiate a call. */
  start: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/calls', payload),

  /** POST /calls/{id}/answer */
  answer: (callId: string): Promise<unknown> => post<unknown>(`/calls/${callId}/answer`),

  /** POST /calls/{id}/decline */
  decline: (callId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/calls/${callId}/decline`, reason ? { reason } : {}),

  /** POST /calls/{id}/end */
  end: (callId: string): Promise<unknown> => post<unknown>(`/calls/${callId}/end`),

  /** GET /calls */
  history: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/calls', { params }),

  /** GET /calls/{id} */
  get: (callId: string): Promise<unknown> => readOne<unknown>(`/calls/${callId}`),
};
