/**
 * Shared, loosely-typed row helpers for the finance desks.
 *
 * The live loan/insurance/cold-storage payloads are richer than the legacy
 * mock `LoanApplication` type (e.g. `applicationId` + `amount` + camelCase
 * statuses like `underReview`), so the desk views read rows through these
 * accessors instead of pretending the mock shape is authoritative.
 */

export type Row = Record<string, unknown>;

export function str(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

export function num(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return fallback;
}

export function arr(v: unknown): Row[] {
  return Array.isArray(v) ? (v as Row[]) : [];
}

/** Rupees → paisa (backend ledgers are integer paisa). */
export const toPaisa = (rupees: number): number => Math.round(rupees * 100);

/** Paisa → rupees. */
export const fromPaisa = (paisa: number): number => paisa / 100;

export interface LoanRow extends Row {
  applicationId?: string;
  id?: string;
  applicationNumber?: string;
  farmerName?: string;
  farmerPhone?: string;
  amount?: number;
  tenureMonths?: number;
  purpose?: string;
  status?: string;
  createdAt?: string;
  farmerCreditScore?: number;
  farmerCreditTier?: string;
  district?: string;
  sanctionedAmount?: number;
  interestRate?: number;
  disbursementRef?: string;
  disbursedAt?: string;
  disbursedAmount?: number;
  rejectionReason?: string;
  note?: string;
  assignedOfficerName?: string;
  bankAccountLast4?: string;
  bankIfsc?: string;
  paidAmountPaisa?: number;
  emisPaid?: number;
  documents?: Row[];
  timeline?: Row[];
}

export const loanId = (loan: LoanRow): string => str(loan.applicationId ?? loan.id);

export interface RepaymentRow extends Row {
  repaymentId?: string;
  amountPaise?: number;
  mode?: string;
  emiIndex?: number | null;
  paidAt?: string;
  note?: string;
  runningPaidPaisa?: number;
  defaultRisk?: string;
}

export interface ScheduleRow extends Row {
  installmentNo?: number;
  dueDate?: string;
  emi?: number;
  principal?: number;
  interest?: number;
  outstanding?: number;
}

export interface AuditRow extends Row {
  id?: string;
  actor?: string;
  action?: string;
  decision?: string;
  reason?: string;
  at?: string;
  timestamp?: string;
  applicationNumber?: string;
}
