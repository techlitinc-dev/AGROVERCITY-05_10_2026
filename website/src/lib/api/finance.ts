import { post, readList, readOne } from './http';
import { MOCK_LOANS } from './mocks';
import type { LoanApplication } from '../../types';

/** Finance namespace — credit score, KCC, loan calculator & applications. */
export const finance = {
  /** GET /finance/credit-score */
  creditScore: (): Promise<unknown> => readOne<unknown>('/finance/credit-score'),

  /** POST /finance/loan-calculator */
  loanCalculator: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/finance/loan-calculator', payload),

  /** GET /finance/kcc */
  kcc: (): Promise<unknown> => readOne<unknown>('/finance/kcc'),

  /** GET /finance/loans */
  loans: (params?: Record<string, unknown>): Promise<LoanApplication[]> =>
    readList<LoanApplication>('/finance/loans', { params, mock: MOCK_LOANS }),

  /** POST /finance/loans/apply */
  applyLoan: (payload: Record<string, unknown>): Promise<LoanApplication> =>
    post<LoanApplication>('/finance/loans/apply', payload),
};
