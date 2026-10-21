import { post, put, readItems, readList, readOne } from './http';

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

  /** GET /women/garden-templates — seeded kitchen-garden suggestion catalog (SR 25). */
  gardenTemplates: (): Promise<unknown[]> =>
    readList<unknown[]>('/women/garden-templates'),

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

  // --- hub dashboard / insights (phase-06) ---
  /** GET /women/dashboard */
  dashboard: (): Promise<unknown> => readOne<unknown>('/women/dashboard'),

  /** GET /women/insights */
  insights: (): Promise<unknown> => readOne<unknown>('/women/insights'),

  // --- SHG directory & join requests ---
  /** GET /women/directory?q=&village=&district= */
  directory: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readItems<unknown[]>('/women/directory', { params }),

  /** POST /women/shg/join-requests */
  createJoinRequest: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/shg/join-requests', payload),

  /** GET /women/shg/join-requests */
  joinRequests: (): Promise<unknown[]> => readItems<unknown[]>('/women/shg/join-requests'),

  /** POST /women/shg/join-requests/{uid}/approve */
  approveJoinRequest: (uid: string): Promise<unknown> =>
    post<unknown>(`/women/shg/join-requests/${uid}/approve`),

  /** POST /women/shg/join-requests/{uid}/decline */
  declineJoinRequest: (uid: string): Promise<unknown> =>
    post<unknown>(`/women/shg/join-requests/${uid}/decline`),

  // --- SHG loan fund ---
  /** GET /women/shg/loans */
  loans: (): Promise<unknown[]> => readItems<unknown[]>('/women/shg/loans'),

  /** POST /women/shg/loans */
  requestLoan: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/women/shg/loans', payload),

  /** POST /women/shg/loans/{id}/approve */
  approveLoan: (loanId: string): Promise<unknown> =>
    post<unknown>(`/women/shg/loans/${loanId}/approve`),

  /** POST /women/shg/loans/{id}/cancel */
  cancelLoan: (loanId: string): Promise<unknown> =>
    post<unknown>(`/women/shg/loans/${loanId}/cancel`),

  /** POST /women/shg/loans/{id}/repay */
  repayLoan: (loanId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/women/shg/loans/${loanId}/repay`, payload),
};
