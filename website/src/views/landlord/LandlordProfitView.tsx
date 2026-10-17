import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Download, FileDown, RefreshCw, TrendingUp, Wallet, X } from 'lucide-react';
import { land, apiClient, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency } from '../../lib/utils';
import { asArr, asRec, downloadBlob, firstNum, firstStr, fmtDate, str, type Rec } from './utils';

const EXPENSE_CATEGORIES = [
  'boundary_maintenance',
  'soil_health',
  'irrigation',
  'fencing',
  'land_preparation',
  'other',
];

/** /landlord/profit — profit dashboard, plot expenses, analytics, CSV export. */
export const LandlordProfitView: React.FC = () => {
  const [dashboard, setDashboard] = useState<Rec>({});
  const [analytics, setAnalytics] = useState<Rec>({});
  const [plots, setPlots] = useState<Rec[]>([]);
  const [expensePlot, setExpensePlot] = useState('');
  const [expenses, setExpenses] = useState<Rec[]>([]);
  const [expenseForm, setExpenseForm] = useState({ category: 'other', amountRupees: 0, expenseDate: '', note: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, a, p] = await Promise.all([land.profitDashboard(), land.analytics(), land.plots()]);
      setDashboard(asRec(d));
      setAnalytics(asRec(a));
      setPlots(asArr(p).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const flash = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  useEffect(() => {
    if (!expensePlot) {
      setExpenses([]);
      return;
    }
    land
      .plotExpenses(expensePlot)
      .then((ex) => setExpenses(asArr(ex).map(asRec)))
      .catch(() => setExpenses([]));
  }, [expensePlot]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expensePlot) return;
    try {
      await land.addPlotExpense(expensePlot, {
        category: expenseForm.category,
        amountRupees: expenseForm.amountRupees,
        expenseDate: expenseForm.expenseDate || undefined,
        note: expenseForm.note || undefined,
      });
      setExpenseForm({ category: 'other', amountRupees: 0, expenseDate: '', note: '' });
      flash('Expense recorded.');
      const ex = await land.plotExpenses(expensePlot);
      setExpenses(asArr(ex).map(asRec));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  /** /land/profit-dashboard/export returns a CSV file, not JSON. */
  const handleExport = async () => {
    try {
      const res = await apiClient.get('/land/profit-dashboard/export', { responseType: 'blob' });
      downloadBlob('land-profit-dashboard.csv', res.data as Blob);
      flash('Profit report exported (CSV).');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  const incomeRec = asRec(dashboard.income);
  const incomeRent = firstNum(incomeRec, ['rentCollectedRupees'], -1);
  const incomeShare = firstNum(incomeRec, ['cropShareRupees'], -1);
  const income =
    incomeRent >= 0 || incomeShare >= 0
      ? Math.max(incomeRent, 0) + Math.max(incomeShare, 0)
      : firstNum(dashboard, ['totalIncome', 'income', 'grossIncome'], 0);
  const expense = firstNum(dashboard, ['expensesRupees', 'totalExpenses', 'expenses', 'totalExpense'], 0);
  const profit = firstNum(dashboard, ['netProfitRupees', 'netProfit', 'profit'], income - expense);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/landlord" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Landlord Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-emerald-600" />
            Profit & Analytics
          </h1>
          <p className="text-xs text-slate-500 mt-1">Lease income vs plot expenses, yield-linked analytics, and profit export</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={load}
            className="p-2.5 rounded-2xl border border-slate-200 text-slate-500 hover:bg-slate-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2"
          >
            <Download className="w-4 h-4" /> Export Report
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>{notice}</span>
        </div>
      )}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Lease Income" value={formatCurrency(income)} subtitle="Collected + escrowed rent" icon={TrendingUp} colorScheme="green" />
        <StatCard title="Total Expenses" value={formatCurrency(expense)} subtitle="Plot upkeep & improvements" icon={Wallet} colorScheme="amber" />
        <StatCard
          title="Net Profit"
          value={formatCurrency(profit)}
          subtitle={firstStr(dashboard, ['period', 'range'], 'All time')}
          icon={FileDown}
          colorScheme={profit >= 0 ? 'blue' : 'slate'}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Dashboard breakdown */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Profit Dashboard</h3>
          {Object.keys(dashboard).length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No profit data available yet.</p>
          ) : (
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                <span className="text-slate-500">Rent collected</span>
                <span className="font-bold text-emerald-800">{formatCurrency(Math.max(incomeRent, 0))}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                <span className="text-slate-500">Crop-share settled</span>
                <span className="font-bold text-emerald-800">{formatCurrency(Math.max(incomeShare, 0))}</span>
              </div>
              <div className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                <span className="text-slate-500">Plot expenses</span>
                <span className="font-bold text-rose-700">-{formatCurrency(expense)}</span>
              </div>
              <div className="flex justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-xs">
                <span className="text-emerald-700 font-bold">Net profit</span>
                <span className="font-black text-emerald-900">{formatCurrency(profit)}</span>
              </div>
              {asArr(dashboard.byMonth).length > 0 && (
                <div className="pt-2 space-y-1">
                  <p className="text-[10px] uppercase font-bold text-slate-400">Month-wise</p>
                  {asArr(dashboard.byMonth).map(asRec).map((row) => (
                    <div key={str(row.month)} className="flex justify-between p-2 bg-slate-50 rounded-xl text-[11px]">
                      <span className="font-bold text-slate-700">{str(row.month)}</span>
                      <span className={firstNum(row, ['netRupees'], 0) >= 0 ? 'text-emerald-700 font-bold' : 'text-rose-700 font-bold'}>
                        {formatCurrency(firstNum(row, ['netRupees'], 0))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Analytics */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Land Analytics</h3>
          {Object.keys(analytics).length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-6">No analytics available yet.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(analytics).map(([k, v]) => (
                <div key={k} className="flex justify-between p-3 bg-slate-50 rounded-2xl text-xs">
                  <span className="text-slate-500 capitalize">{k.replace(/([A-Z])/g, ' $1')}</span>
                  <span className="font-bold text-slate-900 text-right max-w-[60%] truncate">
                    {typeof v === 'number' ? formatCurrency(v) : typeof v === 'string' ? v : JSON.stringify(v)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Plot expenses */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Plot Expenses</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <form onSubmit={handleAddExpense} className="space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Plot</label>
              <select
                value={expensePlot}
                onChange={(e) => setExpensePlot(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                required
              >
                <option value="">Select plot…</option>
                {plots.map((p) => (
                  <option key={str(p.id)} value={str(p.id)}>
                    {firstStr(p, ['name', 'title'], 'Plot')}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  required
                >
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
                <input
                  type="number"
                  value={expenseForm.amountRupees}
                  onChange={(e) => setExpenseForm({ ...expenseForm, amountRupees: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={expenseForm.expenseDate}
                onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
              <input
                type="text"
                value={expenseForm.note}
                onChange={(e) => setExpenseForm({ ...expenseForm, note: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              />
            </div>
            <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs">
              Add Expense
            </button>
          </form>

          <div className="space-y-2">
            {!expensePlot ? (
              <p className="text-xs text-slate-400 text-center py-10">Select a plot to view and add expenses.</p>
            ) : expenses.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">No expenses logged for this plot.</p>
            ) : (
              expenses.map((ex) => (
                <div key={str(ex.id) || JSON.stringify(ex).slice(0, 24)} className="flex items-center justify-between p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs">
                  <div>
                    <p className="font-bold text-slate-800">{firstStr(ex, ['category', 'title'], 'Expense').replace(/_/g, ' ')}</p>
                    <p className="text-slate-400">{fmtDate(ex.expenseDate ?? ex.date ?? ex.createdAt)}</p>
                  </div>
                  <span className="font-bold text-rose-700">
                    {formatCurrency(firstNum(ex, ['amountRupees', 'amount'], 0) || firstNum(ex, ['amountPaisa'], 0) / 100)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
