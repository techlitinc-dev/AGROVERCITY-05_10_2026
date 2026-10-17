import { post, readOne } from './http';

/** KYC namespace — cases, document upload, status. */
export const kyc = {
  /** POST /kyc/cases — open a KYC case for a persona. */
  createCase: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/kyc/cases', payload),

  /** GET /kyc/status */
  status: (): Promise<unknown> => readOne<unknown>('/kyc/status'),

  /** POST /kyc/cases/{caseId}/docs/{docId}/upload */
  uploadDoc: (caseId: string, docId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/kyc/cases/${caseId}/docs/${docId}/upload`, payload),
};
