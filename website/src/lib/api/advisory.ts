import { post, readList, readOne } from './http';

/** Advisory namespace — AI agronomist scans, crop plans, pest radar. */
export const advisory = {
  /** POST /advisory/saturation */
  saturation: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/saturation', payload),

  /** POST /advisory/sowing-intent */
  sowingIntent: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/sowing-intent', payload),

  /** POST /advisory/disease-scan */
  diseaseScan: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/disease-scan', payload),

  /** GET /advisory/disease-scans */
  diseaseScans: (): Promise<unknown[]> => readList<unknown[]>('/advisory/disease-scans'),

  /** POST /advisory/npk */
  npkAdvice: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/npk', payload),

  /** POST /advisory/crop-plan */
  cropPlan: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/crop-plan', payload),

  /** POST /advisory/crop-plan/confirm */
  confirmCropPlan: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/advisory/crop-plan/confirm', payload),

  /** GET /advisory/pest-radar */
  pestRadar: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/advisory/pest-radar', { params }),

  /** GET /admin/... excluded — admin advisory lives in admin.fieldOps */
  /** POST /soil-tests/book */
  bookSoilTest: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/soil-tests/book', payload),

  /** GET /soil-tests */
  soilTests: (): Promise<unknown[]> => readList<unknown[]>('/soil-tests'),

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
