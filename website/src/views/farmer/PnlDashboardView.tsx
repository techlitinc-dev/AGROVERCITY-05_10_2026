import React, { useCallback, useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Calculator,
  Plus,
  Download,
  ArrowUpRight,
  Sprout,
} from 'lucide-react';
import { pnl, diary, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

export const PnlDashboardView: React.FC = () => {
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [crops, setCrops] = useState<unknown[]>([]);
  const [diarySummary, setDiarySummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Break-even calculator
  const [beCosts, setBeCosts] = useState(60000);
  const [bePrice, setBePrice] = useState(4800);
  const [beResult, setBeResult] = useState<Record<string, unknown> | null>(null);

  // Add expense modal
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseCrop, setExpenseCrop] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Fertilizers');
  const [expenseAmount, setExpenseAmount] = useState(2000);
  const [expenseNote, setExpenseNote] = useState('');

  const reload = useCallback(async () => {
    const [s, c, d] = await Promise.all([
      pnl.summary().catch(() => null),
      pnl.crops().catch(() => []),
      diary.summary().catch(() => null),
    ]);
    if (s) setSummary(asRecord(s));
    setCrops(c);
    if (d) setDiarySummary(asRecord(d));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reload]);

  const totalIncome = asNum(summary?.totalIncome ?? summary?.income);
  const totalExpense = asNum(summary?.totalExpense ?? summary?.expenses);
  const netProfit = asNum(summary?.netProfit ?? summary?.profit, totalIncome - totalExpense);

  const runBreakEven = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await pnl.breakEven({
        totalCost: beCosts,
        costPerQuintal: beCosts,
        expectedPricePerQuintal: bePrice,
        pricePerQuintal: bePrice,
      });
      setBeResult(asRecord(res));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleAddExpense = async () => {
    if (!expenseCrop) {
      setError('Pick a crop to attach the expense to.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await pnl.addCropExpense(expenseCrop, {
        category: expenseCategory,
        amount: expenseAmount,
        note: expenseNote,
      });
      await reload();
      setExpenseModalOpen(false);
      setExpenseNote('');
      setNotice('Expense added to crop P&L.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDownloadReport = async () => {
    setError(null);
    try {
      const blob = await pnl.reportPdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'farm-pnl-report.pdf';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const cropSummaries = asArray(crops).map((c) => asRecord(c));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <PiggyBank className="w-7 h-7 text-emerald-600" />
            Farm Profit & Loss
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Season profit & loss, crop-wise economics, break-even price and expense tracking
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={() => setExpenseModalOpen(true)}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
          <button
            onClick={handleDownloadReport}
            className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all"
          >
            <Download className="w-4 h-4" />
            <span>Season Report (PDF)</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading P&L…
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Total Income</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-black text-emerald-700">{formatCurrency(totalIncome)}</div>
              <p className="text-[11px] text-slate-400 mt-1">Crop sales, subsidies & other income</p>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Total Expenses</span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-700">
                  <TrendingDown className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-3 text-2xl font-black text-rose-700">{formatCurrency(totalExpense)}</div>
              <p className="text-[11px] text-slate-400 mt-1">Inputs, labor, machinery & diesel</p>
            </div>
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Net Profit</span>
                <span className={`p-2 rounded-xl ${netProfit >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                  <TrendingUp className="w-4 h-4" />
                </span>
              </div>
              <div className={`mt-3 text-2xl font-black ${netProfit >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                {formatCurrency(netProfit)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {summary ? `Season: ${asStr(summary.season ?? summary.period, 'Current')}` : 'Across all recorded activity'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Crop-wise P&L */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Sprout className="w-5 h-5 text-emerald-600" /> Crop-wise Economics
              </h3>
              {cropSummaries.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">
                  Record diary entries and sales to see per-crop profit.
                </p>
              ) : (
                <div className="space-y-3">
                  {cropSummaries.map((c, i) => {
                    const profit = asNum(c.netProfit ?? c.profit, asNum(c.income) - asNum(c.expense));
                    return (
                      <div key={asStr(c.cropId ?? c.crop, String(i))} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-slate-900">{asStr(c.crop ?? c.name, 'Crop')}</span>
                          <span className={`font-black ${profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatCurrency(profit)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span>Income {formatCurrency(asNum(c.income ?? c.totalIncome, 0))}</span>
                          <span>Expense {formatCurrency(asNum(c.expense ?? c.totalExpense, 0))}</span>
                          <span>Yield {asNum(c.yieldQuintal ?? c.yield, 0)} q</span>
                        </div>
                        {asNum(c.breakEvenPerQuintal, 0) > 0 && (
                          <div className="text-[10px] font-bold text-amber-700">
                            Break-even {formatCurrency(asNum(c.breakEvenPerQuintal))}/q
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Break-even calculator */}
            <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <Calculator className="w-5 h-5 text-emerald-600" /> Break-even Calculator
              </h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Total Cost (₹)</label>
                  <input
                    type="number"
                    value={beCosts}
                    onChange={(e) => setBeCosts(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-600 mb-1">Expected Price (₹/q)</label>
                  <input
                    type="number"
                    value={bePrice}
                    onChange={(e) => setBePrice(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-bold"
                  />
                </div>
              </div>
              <button
                onClick={runBreakEven}
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-60"
              >
                {busy ? 'Calculating…' : 'Compute Break-even'}
              </button>
              {beResult && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Break-even Price</span>
                    <span className="font-black text-sm">
                      {formatCurrency(asNum(beResult.breakEvenPerQuintal ?? beResult.breakEvenPrice, 0))}/q
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Break-even Yield</span>
                    <span className="font-black text-sm">
                      {asNum(beResult.breakEvenQuintals ?? beResult.breakEvenYield, 0)} q
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 block">Margin at Expected Price</span>
                    <span className="font-black text-sm">
                      {formatCurrency(asNum(beResult.marginPerQuintal ?? beResult.margin, 0))}/q
                    </span>
                  </div>
                </div>
              )}

              {/* Diary analytics summary */}
              <div className="pt-3 border-t border-slate-100 space-y-2">
                <h4 className="font-bold text-xs text-slate-900">Diary Analytics</h4>
                {diarySummary ? (
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 font-bold block text-[9px] uppercase">Entries</span>
                      <span className="font-black text-slate-800">
                        {asNum(diarySummary.totalEntries ?? diarySummary.entries, 0)}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 font-bold block text-[9px] uppercase">Top Expense</span>
                      <span className="font-black text-slate-800">
                        {asStr(diarySummary.topExpenseCategory ?? '', '—')}
                      </span>
                    </div>
                    <div className="p-2.5 bg-slate-50 rounded-xl">
                      <span className="text-slate-400 font-bold block text-[9px] uppercase">Updated</span>
                      <span className="font-black text-slate-800">
                        {formatDate(asStr(diarySummary.generatedAt ?? diarySummary.asOf, new Date().toISOString()))}
                      </span>
                    </div>
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400">Diary analytics unavailable.</p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add expense modal */}
      <ModalSheet
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title="Add Crop Expense"
        description="Attach an expense to a crop for accurate per-crop P&L"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Crop</label>
            <select
              value={expenseCrop}
              onChange={(e) => setExpenseCrop(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              <option value="">Select crop…</option>
              {cropSummaries.map((c, i) => (
                <option key={asStr(c.cropId ?? c.crop, String(i))} value={asStr(c.cropId ?? c.crop)}>
                  {asStr(c.crop ?? c.name, 'Crop')}
                </option>
              ))}
              {cropSummaries.length === 0 && (
                <>
                  <option value="soybean">Soybean</option>
                  <option value="wheat">Wheat</option>
                  <option value="onion">Onion</option>
                </>
              )}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={expenseCategory}
                onChange={(e) => setExpenseCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Seeds">Seeds</option>
                <option value="Fertilizers">Fertilizers</option>
                <option value="Pesticides">Pesticides</option>
                <option value="Labor">Labor</option>
                <option value="Diesel/Machinery">Diesel / Machinery</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
            <input
              type="text"
              value={expenseNote}
              onChange={(e) => setExpenseNote(e.target.value)}
              placeholder="e.g. 2 bags DAP + 1 bag MOP"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={handleAddExpense}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Add Expense'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
