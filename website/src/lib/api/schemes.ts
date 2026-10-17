import { post, readList, readOne } from './http';

/** Govt schemes namespace — discovery, matching, applications. */
export const schemes = {
  /** GET /schemes */
  list: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/schemes', { params }),

  /** GET /schemes/portals */
  portals: (): Promise<unknown[]> => readList<unknown[]>('/schemes/portals'),

  /** GET /schemes/matches — schemes matched to the current user. */
  matches: (): Promise<unknown[]> => readList<unknown[]>('/schemes/matches'),

  /** GET /schemes/{id} */
  get: (schemeId: string): Promise<unknown> => readOne<unknown>(`/schemes/${schemeId}`),

  /** POST /schemes/{id}/apply */
  apply: (schemeId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/schemes/${schemeId}/apply`, payload),

  /** POST /schemes/deadline-reminders */
  deadlineReminders: (payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>('/schemes/deadline-reminders', payload),
};
