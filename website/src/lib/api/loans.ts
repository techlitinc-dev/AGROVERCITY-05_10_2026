import { api } from './client';

/**
 * Bank "CreditDesk" loan wrappers (phase-03 WS-03).
 * Verified against backend/app/routers/loans.py + routers/finance.py.
 * All calls go through client.ts, which attaches Idempotency-Key on writes and
 * raises ApiError with the `{"error":{code,...}}` envelope on failure.
 */

export type LoanStatus =
  | 'submitted'
  | 'underReview'
  | 'infoRequested'
  | 'approved'
  | 'rejected'
  | 'disbursed'
  | 'cancelled';

export interface LoanDocument {
  documentId: string;
  name: string;
  storagePath: string;
  uploadedAt: string;
}

export interface LoanTimelineEntry {
  status: string;
  statusText: string;
  note?: string | null;
  at: string;
  by?: string | null;
}

/** WS-07 M14 prescreen annotation (arrives with the AI brief; optional). */
export interface LoanAiAnnotation {
  riskBand?: 'low' | 'medium' | 'high';
  missingDocs?: string[];
}

export interface Loan {
  applicationId: string;
  amount: number;
  tenureMonths: number;
  purpose: string;
  status: LoanStatus;
  createdAt: string;
  applicationNumber?: string | null;
  userId?: string | null;
  farmerName?: string | null;
  farmerPhone?: string | null;
  farmerCreditScore?: number | null;
  farmerCreditTier?: string | null;
  bankAccountId?: string | null;
  bankAccountLast4?: string | null;
  bankIfsc?: string | null;
  sanctionedAmount?: number | null;
  interestRate?: number | null;
  disbursementRef?: string | null;
  disbursedAt?: string | null;
  rejectionReason?: string | null;
  assignedOfficerId?: string | null;
  assignedOfficerName?: string | null;
  documents: LoanDocument[];
  timeline: LoanTimelineEntry[];
  note?: string | null;
  updatedAt?: string | null;
  /** WS-03 task 3.9 — optional partner-bank scope for the referral fee. */
  partnerBankId?: string | null;
  /** Optional district filter field carried on the application. */
  district?: string | null;
  /** WS-03 task 3.17 — optional AI annotation; absent = screens unchanged. */
  ai?: LoanAiAnnotation | null;
}

export interface LoanScheduleEntry {
  installmentNo: number;
  dueDate: string;
  emi: number;
  principal: number;
  interest: number;
  outstanding: number;
}

export interface LoanQueuePage {
  data: Loan[];
  page: number;
  pageSize: number;
  total: number;
  /** Opaque cursor for the next page (null when this is the last page). */
  nextCursor: string | null;
}

export interface LoanQueueParams {
  status?: LoanStatus;
  q?: string;
  minAmount?: number;
  maxAmount?: number;
  district?: string;
  cursor?: string | null;
  page?: number;
  pageSize?: number;
}

export interface LoanStats {
  byStatus: Record<string, number>;
  totalApplications: number;
  totalRequestedAmount: number;
  totalSanctionedAmount: number;
  pendingReview: number;
  /** WS-03 task 3.3 — queue depth split by SLA bucket. */
  queueDepthBySla?: { breach: number; dueSoon: number; onTrack: number };
  approvalsToday?: number;
  /** WS-03 task 3.3 — disbursals this week, integer paisa. */
  disbursalsThisWeek?: { count: number; amountPaisa: number };
  /** WS-03 task 3.6 — NPA watch + portfolio totals (integer paisa). */
  atRiskAccounts?: number;
  portfolioTotals?: {
    sanctionedPaisa: number;
    disbursedPaisa: number;
    outstandingPaisa: number;
  };
  npaWatch?: LoanNpaRow[];
  /** Integer percent (0–100). */
  emiCollectionRate?: number;
}

export interface LoanNpaRow {
  applicationId: string;
  applicationNumber: string | null;
  farmerName: string | null;
  amountPaisa: number;
  status: LoanStatus;
  daysOverdue: number;
  creditScore: number | null;
}

export interface ApprovePayload {
  sanctionedAmount: number;
  interestRate: number;
  tenureMonths: number;
  /** Officer note — required by the console action bar. */
  reason?: string;
  note?: string;
}

export interface RejectPayload {
  reason: string;
}

export interface InfoRequestPayload {
  note: string;
}

export interface RespondPayload {
  message: string;
}

export interface DisbursePayload {
  disbursementRef: string;
  disbursedAmount?: number;
}

export async function getQueue(params: LoanQueueParams = {}): Promise<LoanQueuePage> {
  const { data } = await api.get<LoanQueuePage>('/loans/queue', { params });
  return data;
}

export async function getStats(): Promise<LoanStats> {
  const { data } = await api.get<LoanStats>('/loans/stats');
  return data;
}

export async function getLoan(id: string): Promise<Loan> {
  const { data } = await api.get<Loan>(`/loans/${id}`);
  return data;
}

export async function reviewLoan(id: string): Promise<Loan> {
  const { data } = await api.post<Loan>(`/loans/${id}/review`);
  return data;
}

export async function approveLoan(id: string, payload: ApprovePayload): Promise<Loan> {
  const { data } = await api.post<Loan>(`/loans/${id}/approve`, {
    sanctionedAmount: payload.sanctionedAmount,
    interestRate: payload.interestRate,
    tenureMonths: payload.tenureMonths,
    note: payload.reason ?? payload.note,
  });
  return data;
}

export async function rejectLoan(id: string, payload: RejectPayload): Promise<Loan> {
  const { data } = await api.post<Loan>(`/loans/${id}/reject`, { reason: payload.reason });
  return data;
}

export async function requestInfo(id: string, payload: InfoRequestPayload): Promise<Loan> {
  const { data } = await api.post<Loan>(`/loans/${id}/info-request`, { message: payload.note });
  return data;
}

export async function respondLoan(id: string, payload: RespondPayload): Promise<Loan> {
  const { data } = await api.post<Loan>(`/loans/${id}/respond`, payload);
  return data;
}

export async function cancelLoan(id: string): Promise<Loan> {
  const { data } = await api.post<Loan>(`/loans/${id}/cancel`);
  return data;
}

export async function disburseLoan(id: string, payload: DisbursePayload): Promise<Loan> {
  const { data } = await api.post<Loan>(`/loans/${id}/disburse`, payload);
  return data;
}

export async function getSchedule(id: string): Promise<LoanScheduleEntry[]> {
  const { data } = await api.get<{ data: LoanScheduleEntry[] }>(`/loans/${id}/schedule`);
  return data.data;
}

export async function uploadLoanDocument(id: string, files: File[]): Promise<Loan> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  const { data } = await api.post<Loan>(`/loans/${id}/documents`, form);
  return data;
}

/** Farmer's own loan applications (GET /finance/loans). */
export async function getMyLoans(): Promise<Loan[]> {
  const { data } = await api.get<{ data: Loan[] }>('/finance/loans');
  return data.data;
}

export interface CreditScore {
  kisanCreditScore: number;
  creditTier: string;
  creditLimit: number;
  factors: string[];
}

export interface Kcc {
  bankName: string;
  cardNumberMasked: string;
  kccLimit: number;
  availableLimit: number;
}

export interface LoanFarmer360 {
  applicationId: string;
  profile: {
    userId?: string | null;
    name?: string | null;
    phone?: string | null;
    village?: string | null;
    district?: string | null;
  };
  credit: { kisanCreditScore: number | null; creditTier: string | null };
  kcc: Kcc | null;
  landCrop: { landHoldingAcres?: number | null; primaryCrops: string[] };
  repaymentHistory: Loan[];
  documents: LoanDocument[];
}

/** GET /finance/credit-score (caller-scoped). */
export async function getCreditScore(): Promise<CreditScore> {
  const { data } = await api.get<CreditScore>('/finance/credit-score');
  return data;
}

/** GET /finance/kcc (farmer-scoped; the banker console reads it via farmer360). */
export async function getKcc(): Promise<Kcc> {
  const { data } = await api.get<Kcc>('/finance/kcc');
  return data;
}

/** WS-03 task 3.5 — banker-scoped farmer-360 aggregate for the CreditDesk detail. */
export async function getLoanFarmer360(id: string): Promise<LoanFarmer360> {
  const { data } = await api.get<LoanFarmer360>(`/loans/${id}/farmer360`);
  return data;
}

