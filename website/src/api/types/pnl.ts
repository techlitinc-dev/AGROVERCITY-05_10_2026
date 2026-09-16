export interface ExpenseBreakdownItem {
  category: string;
  amount: number;
}

export interface CropPandL {
  id: string;
  name: string;
  season: string;
  area: number;
  yieldQuintals: number;
  marketAvgRate: number;
  grossRevenue: number;
  totalExpenses: number;
  netProfit: number;
  roiPercent: number;
  expensesBreakdown: ExpenseBreakdownItem[];
}

export interface PnlSummary {
  grossIncome: number;
  productionCost: number;
  netProfit: number;
}

export interface BreakEvenBody {
  totalCost: number;
  expectedYieldQuintals: number;
}

export interface BreakEvenRes {
  minSafePricePerQuintal: number;
}
