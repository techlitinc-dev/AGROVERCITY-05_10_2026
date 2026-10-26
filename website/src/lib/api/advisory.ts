import { del, post, readList, readOne } from './http';

/** Advisory namespace — AI agronomist scans, crop plans, pest radar. */
export const advisory = {
  /** POST /advisory/saturation */
  saturation: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/saturation', payload),

  /** POST /advisory/sowing-intent */
  sowingIntent: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/sowing-intent', payload),

  /** POST /advisory/disease-scan — multipart; ~60 s timeout for slow vision calls. */
  diseaseScan: (
    payload: FormData | Record<string, unknown>,
    opts?: { timeout?: number; onUploadProgress?: (percent: number) => void },
  ): Promise<any> => post<any>('/advisory/disease-scan', payload, opts),

  /** GET /advisory/disease-scans */
  diseaseScans: (): Promise<unknown[]> => readList<unknown[]>('/advisory/disease-scans'),

  /** DELETE /advisory/disease-scans/{scanId} — remove one of my scan reports. */
  deleteDiseaseScan: (scanId: string): Promise<any> =>
    del<any>(`/advisory/disease-scans/${scanId}`),

  /** POST /advisory/npk */
  npkAdvice: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/npk', payload),

  /**
   * POST /advisory/crop-plan — long-running: the planner calls the AI
   * agronomist and can take a few minutes on a slow network (results cache
   * 6h server-side).
   */
  cropPlan: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/crop-plan', payload, { timeout: 300000 }),

  /** GET /reference/crops-suggest — crop catalog typeahead (name/vernacular/aliases). */
  cropSuggest: (q: string): Promise<unknown> =>
    readOne<unknown>('/reference/crops-suggest', { params: { q, limit: 8 } }),

  /** POST /advisory/crop-plan/confirm */
  confirmCropPlan: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/crop-plan/confirm', payload),

  /** GET /admin/... excluded — admin advisory lives in admin.fieldOps */
  /** Climate: GET /climate/carbon-potential */
  carbonPotential: (params?: Record<string, unknown>): Promise<unknown> =>
    readOne<unknown>('/climate/carbon-potential', { params }),

  /** GET /climate/resilient-varieties */
  resilientVarieties: (): Promise<unknown[]> => readList<unknown[]>('/climate/resilient-varieties'),

  /** GET /climate/enrollments/mine */
  myClimateEnrollments: (): Promise<unknown[]> => readList<unknown[]>('/climate/enrollments/mine'),

  /** POST /climate/enrollments */
  enrollClimate: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/climate/enrollments', payload),
};
