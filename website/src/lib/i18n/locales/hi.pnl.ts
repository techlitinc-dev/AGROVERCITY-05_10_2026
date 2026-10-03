import { registerLocale } from '../index';

/**
 * Farm P&L ("Finance CEO") strings — Hindi.
 */

const hiPnl: Record<string, string> = {
  // ---- Period ----
  pnlLast6: '6M',
  pnlLast12: '12M',
  pnlLast24: '24M',
  pnlWindowLabel: '{from} → {to}',

  // ---- Executive summary ----
  pnlRevenue: 'आय',
  pnlCosts: 'खर्च',
  pnlNetProfit: 'निवल लाभ',
  pnlMargin: 'नेट मार्जिन',
  pnlSavingsRate: 'बचत दर',
  pnlExpenseRatio: 'लागत अनुपात',
  pnlVsPrev: 'पिछले {months}M से',
  pnlUp: '▲ {pct}%',
  pnlDown: '▼ {pct}%',

  // ---- Statement ----
  pnlStatementTitle: 'लाभ-हानि विवरण',
  pnlIncomeLines: 'आय',
  pnlExpenseLines: 'खर्च',
  pnlTotalIncome: 'कुल आय',
  pnlTotalExpense: 'कुल खर्च',
  pnlGrossMarginNote: 'हर ₹1 आय में से {amount} बचत रहती है।',

  // ---- Cash flow ----
  pnlCashflowTitle: 'कैश फ्लो और स्थिति',
  pnlCumulativeNet: 'संचित नेट (कैश स्थिति)',
  pnlSavingsTrend: 'बचत दर रुझान',
  pnlNetPosition: 'नेट स्थिति',

  // ---- Where cash flows ----
  pnlDeepDiveTitle: 'पैसा किधर बह रहा है?',
  pnlShareOfSpend: '{type} का {pct}%',
  pnlAvgMonth: 'औसत {amount}/माह',
  pnlPeak: 'चरम {month}',
  pnlSpikeBadge: '⚡ उछाल',
  pnlSpend: 'खर्च',
  pnlEarnings: 'कमाई',

  // ---- Category × month matrix ----
  pnlMatrixTitle: 'श्रेणी × महीना मैट्रिक्स',
  pnlMatrixHint: 'खिड़की के दौरान मुख्य खर्च श्रेणियां — भारी महीने पहचानें।',

  // ---- Parties ----
  pnlPartiesTitle: 'पार्टियां',
  pnlPartyIn: 'इन्होंने दिया',
  pnlPartyOut: 'इन्हें दिया',
  pnlEmptyParties: 'पैसा किसके साथ घूमता है देखने के लिए कैशबुक एंट्री में पार्टी जोड़ें।',

  // ---- Crops ----
  pnlCropsTitle: 'फसल / गतिविधि लाभ-हानि',
  pnlMarginCol: 'मार्जिन',

  // ---- Highlights ----
  pnlHighlightsTitle: 'CEO झलकियां',
  pnlBestMonth: 'सबसे अच्छा महीना',
  pnlWorstMonth: 'सबसे कसा महीना',
  pnlBiggestExpense: 'सबसे बड़ा खर्च सिरा',
  pnlTopParty: 'प्रमुख पार्टी',
  pnlNoData: 'अभी डेटा कम है — कैशबुक में आय-खर्च दर्ज करें, CEO डैशबोर्ड जीवंत हो जाएगा।',
  pnlGoCashbook: 'कैशबुक खोलें',

  // ---- Export ----
  pnlExportStatement: 'विवरण CSV',
  pnlExportCashflow: 'कैश-फ्लो CSV',
};

registerLocale('hi', hiPnl);
