import { registerLocale } from '../index';

/**
 * Farm P&L ("Finance CEO") strings — merged into `en`.
 */

const enPnl: Record<string, string> = {
  // ---- Period ----
  pnlLast6: '6M',
  pnlLast12: '12M',
  pnlLast24: '24M',
  pnlWindowLabel: '{from} → {to}',

  // ---- Executive summary ----
  pnlRevenue: 'Revenue',
  pnlCosts: 'Costs',
  pnlNetProfit: 'Net profit',
  pnlMargin: 'Net margin',
  pnlSavingsRate: 'Savings rate',
  pnlExpenseRatio: 'Cost ratio',
  pnlVsPrev: 'vs prev {months}M',
  pnlUp: '▲ {pct}%',
  pnlDown: '▼ {pct}%',

  // ---- Statement ----
  pnlStatementTitle: 'Profit & Loss statement',
  pnlIncomeLines: 'Income',
  pnlExpenseLines: 'Expenses',
  pnlTotalIncome: 'Total income',
  pnlTotalExpense: 'Total expenses',
  pnlGrossMarginNote: 'Every rupee of revenue keeps {amount} after costs.',

  // ---- Cash flow ----
  pnlCashflowTitle: 'Cash flow & position',
  pnlCumulativeNet: 'Cumulative net (cash position)',
  pnlSavingsTrend: 'Savings rate trend',
  pnlNetPosition: 'Net position',

  // ---- Where cash flows ----
  pnlDeepDiveTitle: 'Where is the cash flowing?',
  pnlShareOfSpend: '{pct}% of {type}',
  pnlAvgMonth: 'avg {amount}/mo',
  pnlPeak: 'peak {month}',
  pnlSpikeBadge: '⚡ spike',
  pnlSpend: 'spend',
  pnlEarnings: 'earnings',

  // ---- Category × month matrix ----
  pnlMatrixTitle: 'Category × month matrix',
  pnlMatrixHint: 'Top expense categories across the window — spot the heavy months.',

  // ---- Parties ----
  pnlPartiesTitle: 'Counterparties',
  pnlPartyIn: 'paid you',
  pnlPartyOut: 'you paid',
  pnlEmptyParties: 'Add a party to cashbook entries to see who your money moves with.',

  // ---- Crops ----
  pnlCropsTitle: 'Crop / activity P&L',
  pnlMarginCol: 'Margin',

  // ---- Highlights ----
  pnlHighlightsTitle: 'CEO highlights',
  pnlBestMonth: 'Best month',
  pnlWorstMonth: 'Tightest month',
  pnlBiggestExpense: 'Biggest cost head',
  pnlTopParty: 'Top counterparty',
  pnlNoData: 'Not enough data yet — record income & expenses in the Cashbook and the CEO dashboard comes alive.',
  pnlGoCashbook: 'Open Cashbook',

  // ---- Export ----
  pnlExportStatement: 'Statement CSV',
  pnlExportCashflow: 'Cash-flow CSV',
  pnlExportPdf: 'PDF report',
  pnlExportTally: 'Tally export',
  pnlExportFailed: 'Could not prepare the export — please retry',

  // ---- Per-crop statements ----
  pnlCropSelectLabel: 'Crop filter',
  pnlAllCrops: 'All crops',

  // ---- Break-even calculator (client-side arithmetic) ----
  pnlBreakEvenTitle: 'Break-even calculator',
  pnlBreakEvenHint: 'Estimate the price and yield you need to cover your costs.',
  pnlBreakEvenCost: 'Total input cost (₹)',
  pnlBreakEvenYield: 'Expected yield (quintals)',
  pnlBreakEvenPrice: 'Expected price (₹/quintal)',
  pnlBreakEvenPriceOut: 'Break-even price',
  pnlBreakEvenYieldOut: 'Break-even yield',
  pnlBreakEvenIncomplete: 'Enter cost, yield and price to see the break-even point',
};

registerLocale('en', enPnl);
