import { post, put, readList, readOne } from './http';

/** Women economy namespace — SHG, meetings, garden plans, home enterprise. */
export const women = {
  // --- SHG ---
  /** GET /women/shg */
  shg: (): Promise<unknown> => readOne<unknown>('/women/shg'),

  /** POST /women/shg */
  createShg: (payload: Record<string, unknown>): Promise<unknown> => post<unknown>('/women/shg', payload),

  /** POST /women/shg/deposit */
  deposit: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/shg/deposit', payload),

  /** GET /women/shg/meetings */
  meetings: (): Promise<unknown[]> => readList<unknown[]>('/women/shg/meetings'),

  /** POST /women/shg/meetings */
  createMeeting: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/shg/meetings', payload),

  /** POST /women/shg/meetings/{id}/attendance */
  markAttendance: (meetingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/shg/meetings/${meetingId}/attendance`, payload),

  /** POST /women/shg/meetings/{id}/collections */
  recordCollection: (meetingId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/shg/meetings/${meetingId}/collections`, payload),

  // --- garden plans ---
  /** GET /women/garden-plans */
  gardenPlans: (): Promise<unknown[]> => readList<unknown[]>('/women/garden-plans'),

  /** POST /women/garden-plans */
  createGardenPlan: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/garden-plans', payload),

  /** PUT /women/garden-plans/{id} */
  updateGardenPlan: (planId: string, updates: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/women/garden-plans/${planId}`, updates),

  // --- home enterprise ---
  /** GET /women/home-enterprise */
  homeEnterprise: (): Promise<unknown> => readOne<unknown>('/women/home-enterprise'),

  /** POST /women/home-enterprise */
  setupHomeEnterprise: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/home-enterprise', payload),

  /** POST /women/home-enterprise/listings */
  createListing: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/home-enterprise/listings', payload),

  /** GET /women/backyard-livestock */
  backyardLivestock: (): Promise<unknown[]> => readList<unknown[]>('/women/backyard-livestock'),
};
