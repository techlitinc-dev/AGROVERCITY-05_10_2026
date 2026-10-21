import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PiggyBank,
  Plus,
  Search,
  Wallet,
  TrendingDown,
  CalendarDays,
  Receipt,
  SearchX,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  CartesianGrid,
  Legend,
} from 'recharts';
import { diary, users, apiErrorMessage } from '../../lib/api';
import type { UserSettings } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { FarmDiaryEntry } from '../../types';

/** Expense vocabulary for the quick-add form (backend DiaryEntryIn type "expense"). */
const EXPENSE_CATEGORIES = ['Utilities', 'Rent', 'Medical', 'Education', 'Travel', 'Other'];

const pad2 = (n: number) => String(n).padStart(2, '0');
const localDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => localDateStr(new Date());

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asNum = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && !Number.isNaN(v) ? v : fallback;
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

/** Money-out rows (expenses + household buys) vs money-in rows. */
const isMoneyOut = (e: FarmDiaryEntry) =>
  e.type === 'expense' || e.type === 'household' || e.tradeType === 'buy';
const isMoneyIn = (e: FarmDiaryEntry) => e.type === 'income' || e.tradeType === 'sell';

const monthShort = (key: string): string => {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

const EMPTY_EXPENSE_FORM = {
  title: '',
  category: 'Utilities',
  amount: '',
  date: todayStr(),
  notes: '',
};

export const CustomerFinanceView: React.FC = () => {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [monthEntries, setMonthEntries] = useState<FarmDiaryEntry[]>([]);
  const [recent, setRecent] = useState<FarmDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [savingBudget, setSavingBudget] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [savingExpense, setSavingExpense] = useState(false);
  const [form, setForm] = useState(EMPTY_EXPENSE_FORM);

  // Recent-list search (server-side q filter)
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FarmDiaryEntry[] | null>(null);
  const [searching, setSearching] = useState(false);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
  const monthFrom = `${monthKey}-01`;
  const monthTo = localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));

  const reload = useCallback(async () => {
    const [s, m, r] = await Promise.all([
      users.getSettings().catch(() => null),
      diary.entries({ from: monthFrom, to: monthTo, pageSize: 200 }).catch(() => [] as FarmDiaryEntry[]),
      diary.entries({ pageSize: 50 }).catch(() => [] as FarmDiaryEntry[]),
    ]);
    if (s) {
      setSettings(s);
      const existing = Number((s as Record<string, unknown>).householdBudgetMonthly);
      setBudgetInput(Number.isFinite(existing) && existing > 0 ? String(existing) : '');
    }
    setMonthEntries(m);
    setRecent(r);
  }, [monthFrom, monthTo]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    diary
      .summary()
      .then((sm) => active && sm && setSummary(asRecord(sm)))
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    reload().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [reload]);

  const budget = useMemo(() => {
    const value = Number(settings?.householdBudgetMonthly);
    return Number.isFinite(value) && value > 0 ? value : 0;
  }, [settings]);

  // Chart: last 12 months of money movement (backend byMonth: YYYY-MM + income/expense).
  const chartData = useMemo(() => {
    if (!summary) return [];
    return asArray(summary.byMonth)
      .map((row) => {
        const rec = asRecord(row);
        return {
          month: monthShort(asStr(rec.month)),
          Expenses: asNum(rec.expense),
          Income: asNum(rec.income),
        };
      })
      .slice(-12);
  }, [summary]);

  // Current-month automatic calculations (client-side from fetched entries).
  const monthSpent = monthEntries.filter(isMoneyOut).reduce((sum, e) => sum + (e.amount || 0), 0);
  const monthEarned = monthEntries.filter(isMoneyIn).reduce((sum, e) => sum + (e.amount || 0), 0);
  const remaining = budget > 0 ? budget - monthSpent : null;
  const pctUsed = budget > 0 ? Math.round((monthSpent / budget) * 100) : null;
  // This view always tracks the current calendar month.
  const daysElapsed = now.getDate();
  const avgDailySpend = daysElapsed > 0 ? monthSpent / daysElapsed : 0;

  // Debounced server-side search for the recent list
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      diary
        .entries({ q, pageSize: 50 })
        .then((list) => active && setSearchResults(list))
        .catch((e) => active && setError(apiErrorMessage(e)))
        .finally(() => active && setSearching(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const visibleRecent = (searchResults ?? recent).slice(0, 10);
  const listIsSearch = searchResults !== null;

  const handleSaveBudget = async () => {
    setError(null);
    setNotice(null);
    const value = Number(budgetInput);
    if (!Number.isFinite(value) || value < 0) {
      setError('Enter a valid monthly budget (₹).');
      return;
    }
    setSavingBudget(true);
    try {
      // Merge-safe: spread the settings we read back and only override the budget key.
      const saved = await users.updateSettings({
        ...(settings ?? {}),
        householdBudgetMonthly: value,
      });
      setSettings(saved);
      setNotice('Monthly household budget saved.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSavingBudget(false);
    }
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const amount = Number(form.amount);
    if (!form.title.trim()) {
      setError('Please enter a title for the expense.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    setSavingExpense(true);
    try {
      await diary.create({
        title: form.title.trim(),
        category: form.category,
        type: 'expense',
        amount,
        date: form.date || todayStr(),
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
      });
      setNotice('Expense added.');
      setExpenseModalOpen(false);
      setForm({ ...EMPTY_EXPENSE_FORM, date: todayStr() });
      const [sm, m, r] = await Promise.all([
        diary.summary().catch(() => null),
        diary.entries({ from: monthFrom, to: monthTo, pageSize: 200 }).catch(() => [] as FarmDiaryEntry[]),
        diary.entries({ pageSize: 50 }).catch(() => [] as FarmDiaryEntry[]),
      ]);
      if (sm) setSummary(asRecord(sm));
      setMonthEntries(m);
      setRecent(r);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingExpense(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <PiggyBank className="w-7 h-7 text-emerald-600" />
            Finance CEO (Household)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Monthly budget, household spending trends and money-in / money-out overview
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ ...EMPTY_EXPENSE_FORM, date: todayStr() });
            setExpenseModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Expense</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          Loading household finance…
        </div>
      ) : (
        <>
          {/* Budget + current-month stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Monthly Budget</span>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">
                  Household budget (₹ / month)
                </label>
                <input
                  type="number"
                  min={0}
                  step="100"
                  placeholder="e.g. 20000"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <button
                onClick={handleSaveBudget}
                disabled={savingBudget}
                className="w-full py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] shadow-sm transition-all disabled:opacity-60"
              >
                {savingBudget ? 'Saving…' : budget > 0 ? 'Update Budget' : 'Save Budget'}
              </button>
              {budget === 0 && (
                <p className="text-[10px] text-slate-400">
                  Set a budget to unlock budget tracking and the chart reference line.
                </p>
              )}
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Spent This Month</span>
                <span className="p-2 rounded-xl bg-rose-50 text-rose-700">
                  <TrendingDown className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-black text-rose-700">{formatCurrency(monthSpent)}</div>
              <p className="text-[11px] text-slate-400 mt-1">
                {monthEarned > 0 ? `${formatCurrency(monthEarned)} earned this month` : 'Expenses + household purchases'}
              </p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Remaining Budget</span>
                <span className="p-2 rounded-xl bg-sky-50 text-sky-700">
                  <PiggyBank className="w-4 h-4" />
                </span>
              </div>
              <div
                className={`mt-2 text-2xl font-black ${
                  remaining === null
                    ? 'text-slate-900'
                    : remaining >= 0
                      ? 'text-sky-700'
                      : 'text-rose-700'
                }`}
              >
                {remaining === null ? '—' : formatCurrency(remaining)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                {pctUsed === null
                  ? 'Set a budget to see the remaining balance'
                  : `${pctUsed}% of ${formatCurrency(budget)} used`}
              </p>
            </div>

            <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
              <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
                <span>Avg Daily Spend</span>
                <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
                  <CalendarDays className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-black text-slate-900">{formatCurrency(avgDailySpend)}</div>
              <p className="text-[11px] text-slate-400 mt-1">
                Per day over {daysElapsed} day{daysElapsed === 1 ? '' : 's'} this month
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Monthly spend chart */}
            <div className="lg:col-span-3 bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <TrendingDown className="w-5 h-5 text-emerald-600" /> Monthly Money Movement
                </h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Last {chartData.length || '…'} months
                </span>
              </div>
              {chartData.length === 0 ? (
                <div className="py-12 text-center">
                  <TrendingDown className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-bold text-slate-700">No money tracked yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Add expenses and income in your household diary to see the monthly trend.
                  </p>
                </div>
              ) : (
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} axisLine={false} />
                      <YAxis
                        tick={{ fontSize: 10, fill: '#64748b' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => (v >= 1000 ? `₹${v / 1000}k` : `₹${v}`)}
                        width={56}
                      />
                      <Tooltip
                        formatter={(value) => formatCurrency(Number(value))}
                        contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 11 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {budget > 0 && (
                        <ReferenceLine
                          y={budget}
                          stroke="#f59e0b"
                          strokeDasharray="4 4"
                          label={{ value: 'Budget', position: 'insideTopRight', fontSize: 10, fill: '#b45309' }}
                        />
                      )}
                      <Bar dataKey="Expenses" fill="#e11d48" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Income" fill="#059669" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              <p className="text-[10px] text-slate-400">
                Bars reflect income/expense entries; household buys are counted in the “Spent This Month”
                stat above.
              </p>
            </div>

            {/* Recent entries with search */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-emerald-600" /> Recent Entries
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">
                    {searching ? 'Searching…' : `${visibleRecent.length} shown`}
                  </span>
                </div>
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search entries…"
                    className="w-full pl-10 pr-3 py-2.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto max-h-96">
                {searching ? (
                  <p className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
                    Searching…
                  </p>
                ) : visibleRecent.length === 0 ? (
                  <div className="py-10 text-center">
                    <SearchX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold text-slate-400">
                      {listIsSearch ? 'No entries match your search.' : 'No diary entries yet.'}
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {visibleRecent.map((entry) => (
                      <li key={entry.id} className="p-3.5 hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-xs text-slate-900 truncate">
                            {entry.title || entry.category}
                          </span>
                          <span
                            className={`font-mono font-bold text-xs shrink-0 ${
                              isMoneyIn(entry)
                                ? 'text-emerald-700'
                                : isMoneyOut(entry)
                                  ? 'text-rose-700'
                                  : 'text-slate-500'
                            }`}
                          >
                            {isMoneyIn(entry) ? '+' : isMoneyOut(entry) ? '−' : ''}
                            {formatCurrency(entry.amount || 0)}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-semibold text-slate-400">
                          {formatDate(entry.date)} · {entry.category}
                          {entry.party ? ` · ${entry.party}` : ''}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Quick add-expense modal */}
      <ModalSheet
        isOpen={expenseModalOpen}
        onClose={() => setExpenseModalOpen(false)}
        title="Add Household Expense"
        description="Quickly log an expense — it appears in the diary and monthly analytics"
        maxWidth="sm"
      >
        <form onSubmit={handleAddExpense} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
            <input
              type="text"
              placeholder="e.g. Electricity bill"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
              >
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Note <span className="text-slate-400 font-semibold">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="Any extra detail…"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <button
            type="submit"
            disabled={savingExpense}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
          >
            {savingExpense ? 'Saving…' : 'Add Expense'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
