import { download, post, readList, readOne } from './http';
import { MOCK_INSURANCE_CLAIMS } from './mocks';
import type { CropInsuranceClaim } from '../../types';

/** Insurance namespace — farmer policies/claims + provider desk. */
export const insurance = {
  // --- farmer side ---
  /** GET /insurance/schemes */
  schemes: (): Promise<unknown[]> => readList<unknown[]>('/insurance/schemes'),

  /** GET /insurance/rates */
  rates: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/insurance/rates', { params }),

  /** POST /insurance/premium-calculator */
  premiumCalculator: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/insurance/premium-calculator', payload),

  /** GET /insurance/policies */
  policies: (): Promise<unknown[]> => readList<unknown[]>('/insurance/policies'),

  /** POST /insurance/policies/apply */
  applyPolicy: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/insurance/policies/apply', payload),

  /** GET /insurance/policies/{id}/certificate */
  policyCertificate: (policyId: string): Promise<Blob> =>
    download(`/insurance/policies/${policyId}/certificate`),

  /** GET /insurance/claims */
  claims: (): Promise<CropInsuranceClaim[]> =>
    readList<CropInsuranceClaim>('/insurance/claims', { mock: MOCK_INSURANCE_CLAIMS }),

  /** POST /insurance/claims — claim intimation. */
  intimateClaim: (payload: Partial<CropInsuranceClaim>): Promise<CropInsuranceClaim> =>
    post<CropInsuranceClaim>('/insurance/claims', payload),

  /** GET /insurance/claims/{id} */
  claim: (claimId: string): Promise<CropInsuranceClaim> =>
    readOne<CropInsuranceClaim>(`/insurance/claims/${claimId}`),

  /** POST /insurance/claims/{id}/appeal */
  appealClaim: (claimId: string, body: Record<string, unknown>): Promise<CropInsuranceClaim> =>
    post<CropInsuranceClaim>(`/insurance/claims/${claimId}/appeal`, body),

  // --- provider desk ---
  /** GET /insurance/provider/stats */
  providerStats: (): Promise<unknown> => readOne<unknown>('/insurance/provider/stats'),

  /** GET /insurance/provider/stats/export */
  providerStatsExport: (): Promise<unknown> => readOne<unknown>('/insurance/provider/stats/export'),

  /** GET /insurance/provider/policies */
  providerPolicies: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/insurance/provider/policies', { params }),

  /** GET /insurance/provider/policies/{id} */
  providerPolicy: (policyId: string): Promise<unknown> =>
    readOne<unknown>(`/insurance/provider/policies/${policyId}`),

  /** POST /insurance/provider/policies/{id}/review */
  reviewPolicy: (policyId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/insurance/provider/policies/${policyId}/review`, body),

  /** GET /insurance/provider/claims */
  providerClaims: (params?: Record<string, unknown>): Promise<CropInsuranceClaim[]> =>
    readList<CropInsuranceClaim>('/insurance/provider/claims', { params, mock: MOCK_INSURANCE_CLAIMS }),

  /** GET /insurance/provider/claims/{id} */
  providerClaim: (claimId: string): Promise<CropInsuranceClaim> =>
    readOne<CropInsuranceClaim>(`/insurance/provider/claims/${claimId}`),

  /** POST /insurance/provider/claims/{id}/schedule_survey */
  scheduleSurvey: (claimId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/insurance/provider/claims/${claimId}/schedule_survey`, body),

  /** POST /insurance/provider/claims/{id}/survey_report */
  submitSurveyReport: (claimId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/insurance/provider/claims/${claimId}/survey_report`, body),

  /** POST /insurance/provider/claims/{id}/review */
  reviewClaim: (claimId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/insurance/provider/claims/${claimId}/review`, body),

  /** POST /insurance/provider/claims/{id}/disburse */
  disburseClaim: (claimId: string, body: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/insurance/provider/claims/${claimId}/disburse`, body),

  /** POST /insurance/provider/rates */
  addRate: (body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/insurance/provider/rates', body),

  /** GET /insurance/provider/surveyors */
  surveyors: (): Promise<unknown[]> => readList<unknown[]>('/insurance/provider/surveyors'),

  /** POST /insurance/provider/surveyors */
  addSurveyor: (body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/insurance/provider/surveyors', body),

  /** DELETE /insurance/provider/surveyors/{id} */
  removeSurveyor: (surveyorId: string): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(`/insurance/provider/surveyors/${surveyorId}`),
};
