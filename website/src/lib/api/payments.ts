import { post, readPaged } from './http';
import type { Paged, Params } from './http';

/** Counterparty of a transaction, resolved from the user doc when present. */
export interface TransactionCounterparty {
  userId: string;
  name?: string;
  persona?: string;
}

/** One normalized ledger row from GET /payments/transactions. */
export interface Transaction {
  id: string;
  source?: string;
  direction: 'received' | 'sent';
  amount: number;
  currency: string;
  status: string;
  type: string;
  purpose: string;
  counterparty: TransactionCounterparty | null;
  createdAt: string;
  invoiceUrl?: string | null;
  refundStatus?: string | null;
}

/** Cross-page summary computed by the backend over the filtered ledger. */
export interface TransactionTotals {
  totalReceived: number;
  totalSent: number;
  refundsPending: number;
}

export interface TransactionsResponse extends Paged<Transaction> {
  totals?: TransactionTotals;
}

export interface TransactionParams {
  direction?: 'received' | 'sent';
  status?: string;
  type?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

/** Payments namespace — unified transaction ledger + refund requests. */
export const payments = {
  /** GET /payments/transactions — paged ledger of every payment the caller sent or received. */
  getTransactions: (params: TransactionParams = {}): Promise<TransactionsResponse> =>
    readPaged<Transaction>('/payments/transactions', { params: params as Params }) as Promise<TransactionsResponse>,

  /** POST /payments/{id}/refund-request — payer-initiated refund request (idempotent). */
  requestRefund: (paymentId: string): Promise<Transaction> =>
    post<Transaction>(`/payments/${paymentId}/refund-request`),
};
