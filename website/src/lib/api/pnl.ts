import { api } from './client';

/**
 * Farm P&L ("Finance CEO") — full profit & loss + cash-flow analysis over
 * the user's cashbook. Verified against backend/app/routers/pnl.py
 * (`/pnl/dashboard`, powered by services/pnl_engine.py).
 */

export interface PnlWindow {
  from: string;
  to: string;
}

export interface PnlSummary {
  income: number;
  expense: number;
  net: number;
  marginPct: number;
  expenseRatioPct: number;
  savingsRate: number;
  prevIncome: number;
  prevExpense: number;
  prevNet: number;
  incomeDeltaPct: number;
  expenseDeltaPct: number;
  netDeltaPct: number;
  prevSavingsRate: number;
}

export interface PnlStatementLine {
  category: string;
  type: 'income' | 'expense';
  amount: number;
  sharePct: number;
  count: number;
}

export interface PnlCashflowMonth {
  month: string;
  income: number;
  expense: number;
  net: number;
  cumulativeNet: number;
  savingsRate: number;
}

export interface PnlCategoryDeepDive {
  category: string;
  type: 'income' | 'expense';
  total: number;
  sharePct: number;
  count: number;
  avgPerMonth: number;
  maxMonth: { month: string; amount: number };
  spike: boolean;
  monthly: Array<{ month: string; amount: number }>;
}

export interface PnlParty {
  party: string;
  inflow: number;
  outflow: number;
  net: number;
  count: number;
}

export interface PnlCrop {
  cropName: string;
  income: number;
  expense: number;
  net: number;
  marginPct: number;
  count: number;
}

export interface PnlHighlights {
  bestMonth: PnlCashflowMonth | null;
  worstMonth: PnlCashflowMonth | null;
  biggestExpense: PnlStatementLine | null;
  topParty: PnlParty | null;
}

export interface PnlDashboard {
  months: number;
  window: PnlWindow;
  previousWindow: PnlWindow;
  summary: PnlSummary;
  statement: { income: PnlStatementLine[]; expense: PnlStatementLine[] };
  cashflow: PnlCashflowMonth[];
  categoryDeepDive: PnlCategoryDeepDive[];
  parties: PnlParty[];
  crops: PnlCrop[];
  highlights: PnlHighlights;
}

export async function pnlDashboard(months = 12): Promise<PnlDashboard> {
  const { data } = await api.get<PnlDashboard>('/pnl/dashboard', { params: { months } });
  return data;
}
