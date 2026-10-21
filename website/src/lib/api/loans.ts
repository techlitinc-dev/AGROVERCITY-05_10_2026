import { download, post, readList, readOne } from './http';
import type { LoanApplication } from '../../types';

/** Loans namespace — bank/fintech desk: queue, underwriting, disbursement, repayments. */
export const loans = {
  /** GET /loans/queue */
  queue: (params?: Record<string, unknown>): Promise<LoanApplication[]> =>
    readList<LoanApplication>('/loans/queue', { params }),

  /** GET /loans/stats */
  stats: (): Promise<unknown> => readOne<unknown>('/loans/stats'),

  /** GET /loans/audit-logs */
  auditLogs: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/loans/audit-logs', { params }),

  /** GET /loans/{id} */
  get: (applicationId: string): Promise<LoanApplication> =>
    readOne<LoanApplication>(`/loans/${applicationId}`),

  /** POST /loans/{id}/review */
  review: (applicationId: string, body: Record<string, unknown> = {}): Promise<LoanApplication> =>
    post<LoanApplication>(`/loans/${applicationId}/review`, body),

  /** POST /loans/{id}/approve */
  approve: (applicationId: string, body: Record<string, unknown> = {}): Promise<LoanApplication> =>
    post<LoanApplication>(`/loans/${applicationId}/approve`, body),

  /** POST /loans/{id}/reject */
  reject: (applicationId: string, reason: string): Promise<LoanApplication> =>
    post<LoanApplication>(`/loans/${applicationId}/reject`, { reason }),

  /** POST /loans/{id}/info-request */
  requestInfo: (applicationId: string, message: string): Promise<LoanApplication> =>
    post<LoanApplication>(`/loans/${applicationId}/info-request`, { message }),

  /** POST /loans/{id}/respond */
  respond: (applicationId: string, body: Record<string, unknown>): Promise<LoanApplication> =>
    post<LoanApplication>(`/loans/${applicationId}/respond`, body),

  /** POST /loans/{id}/cancel */
  cancel: (applicationId: string, reason?: string): Promise<LoanApplication> =>
    post<LoanApplication>(`/loans/${applicationId}/cancel`, reason ? { reason } : {}),

  /** POST /loans/{id}/disburse */
  disburse: (applicationId: string, body: Record<string, unknown> = {}): Promise<LoanApplication> =>
    post<LoanApplication>(`/loans/${applicationId}/disburse`, body),

  /** GET /loans/{id}/farmer360 */
  farmer360: (applicationId: string): Promise<unknown> =>
    readOne<unknown>(`/loans/${applicationId}/farmer360`),

  /** GET /loans/{id}/schedule */
  schedule: (applicationId: string): Promise<unknown> =>
    readOne<unknown>(`/loans/${applicationId}/schedule`),

  /** POST /loans/{id}/documents — multipart file upload (legacy). */
  addDocument: (applicationId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/loans/${applicationId}/documents`, body),

  /** POST /loans/{id}/documents/from-uploads — attach a file already uploaded
   * via POST /uploads ({name, url, type, storagePath?}). */
  attachDocument: (applicationId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/loans/${applicationId}/documents/from-uploads`, body),

  /** GET /loans/{id}/documents/{docId}/download */
  downloadDocument: (applicationId: string, documentId: string): Promise<Blob> =>
    download(`/loans/${applicationId}/documents/${documentId}/download`),

  /** POST /loans/{id}/repayments */
  addRepayment: (applicationId: string, body: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/loans/${applicationId}/repayments`, body),

  /** GET /loans/{id}/repayments */
  repayments: (applicationId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/loans/${applicationId}/repayments`),
};
