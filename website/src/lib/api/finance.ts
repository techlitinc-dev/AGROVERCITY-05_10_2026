import { api } from './client';
import type { Loan, LoanScheduleEntry } from './loans';

/**
 * Farmer finance ("KisanCredit") wrappers — phase-05 WS-05.
 * Verified against backend/app/routers/finance.py + routers/loans.py.
 *
 * This module ALIGNS with the existing `lib/api/loans.ts` (bank console):
 * the farmer credit-score / KCC / loans-list / schedule functions are re-used
 * from there rather than duplicated; only the farmer-only apply + EMI helpers
 * are added here. Money on the finance backend is plain rupees for the legacy
 * credit endpoints (685 is a score, not money); loan amounts are rupees.
 *
 * Backend quirks:
 * - `GET /finance/credit-score` defaults to 650/Silver when the user carries no
 *   score — the UI shows an honest empty state only when the call itself fails.
 * - `GET /finance/kcc` answers 404 `KCC_NOT_FOUND` when no KCC is linked; the
 *   KCC card renders the honest "not linked" state on that code.
 * - `Idempotency-Key` is attached by `client.ts` on every non-GET request.
 */

export type { Loan, LoanScheduleEntry } from './loans';
export { getCreditScore, getKcc, getMyLoans, getSchedule as getLoanSchedule } from './loans';
export type { CreditScore, Kcc } from './loans';

export interface LoanCalcInput {
  amount: number;
  tenureMonths: number;
  interestRate?: number;
}

export interface LoanCalcResult {
  emi: number;
  totalInterest: number;
  totalPayable: number;
}

export interface LoanApplyInput {
  amount: number;
  tenureMonths: number;
  purpose: string;
  bankAccountId?: string;
  district?: string;
  partnerBankId?: string;
}

export interface LoanApplyResult {
  applicationId: string;
  status: string;
}

/** POST /finance/loan-calculator — server EMI (rupees), authoritative reference. */
export async function loanCalculator(input: LoanCalcInput): Promise<LoanCalcResult> {
  const { data } = await api.post<LoanCalcResult>('/finance/loan-calculator', input);
  return data;
}

/** Farmer loan application (F17) — `POST /finance/loans/apply`. */
export async function applyLoan(input: LoanApplyInput): Promise<LoanApplyResult> {
  const { data } = await api.post<LoanApplyResult>('/finance/loans/apply', input);
  return data;
}

/* ----------------------------------------------------------------- EMI math -- */

/**
 * Reducing-balance EMI in integer paisa, computed client-side from user inputs
 * only (task 5.22 — pure arithmetic on user inputs, not a data fallback).
 * `annualRatePct` is a percent (e.g. 7 → 7%).
 */
export function computeEmiPaisa(
  principalPaisa: number,
  annualRatePct: number,
  tenureMonths: number
): number {
  if (principalPaisa <= 0 || tenureMonths <= 0) return 0;
  const r = annualRatePct / 12 / 100;
  if (r <= 0) return Math.round(principalPaisa / tenureMonths);
  const growth = Math.pow(1 + r, tenureMonths);
  return Math.round((principalPaisa * r * growth) / (growth - 1));
}

/** Reducing-balance EMI in rupees (display convenience over the paisa helper). */
export function computeEmiRupees(
  principalRupees: number,
  annualRatePct: number,
  tenureMonths: number
): number {
  return computeEmiPaisa(Math.round(principalRupees * 100), annualRatePct, tenureMonths) / 100;
}

/** A marketplace comparison row derived from a real loan application. */
export interface LoanOfferRow {
  applicationId: string;
  label: string;
  amountRupees: number;
  interestRate: number;
  tenureMonths: number;
  /** Integer paisa, computed from the application's own terms. */
  emiPaisa: number;
  status: string;
}

/**
 * Build comparison rows from the farmer's loan applications. There is no
 * separate partner-offers endpoint, so the marketplace compares the farmer's
 * own applications' real terms — never invented rates (rule 1).
 */
export function buildOfferRows(loans: Loan[]): LoanOfferRow[] {
  return loans.map((loan) => {
    const amount = loan.sanctionedAmount ?? loan.amount;
    const rate = loan.interestRate ?? 0;
    const tenure = loan.tenureMonths;
    return {
      applicationId: loan.applicationId,
      label: loan.applicationNumber ?? loan.applicationId,
      amountRupees: amount,
      interestRate: rate,
      tenureMonths: tenure,
      emiPaisa: rate > 0 ? computeEmiPaisa(Math.round(amount * 100), rate, tenure) : 0,
      status: loan.status,
    };
  });
}
