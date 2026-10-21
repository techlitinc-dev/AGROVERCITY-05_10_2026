import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ArrowDownRight,
  X,
  SearchX,
} from 'lucide-react';
import { diary, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { FarmDiaryEntry } from '../../types';

/** SR 16 — household diary kinds and how they map onto backend DiaryEntryIn. */
type HouseholdKind = 'buy' | 'expense' | 'income';

const KIND_OPTIONS: { id: HouseholdKind; label: string }[] = [
  { id: 'buy', label: 'Buy (खरीद)' },
  { id: 'expense', label: 'Expense (खर्च)' },
  { id: 'income', label: 'Income (कमाई)' },
];

/** Per-kind category options (household budget vocabulary). */
const CATEGORIES_BY_KIND: Record<HouseholdKind, string[]> = {
  buy: ['Groceries', 'Vegetables', 'Fruits', 'Dairy', 'Grains', 'Other'],
  expense: ['Utilities', 'Rent', 'Medical', 'Education', 'Travel', 'Other'],
  income: ['Salary', 'Other'],
};

const UNIT_OPTIONS = ['kg', 'g', 'L', 'ml', 'pcs', 'pack', 'dozen', 'unit'];

/** POST /diary/entries returns { entry, agriCoinsEarned } — unwrap defensively. */
const unwrapEntry = (res: unknown): FarmDiaryEntry => {
  const rec = (res ?? {}) as Record<string, unknown>;
  return (rec.entry ?? rec) as FarmDiaryEntry;
};

const pad2 = (n: number) => String(n).padStart(2, '0');
const localDateStr = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const todayStr = () => localDateStr(new Date());

/** Money-out rows render red; money-in rows render green. */
const isMoneyIn = (e: FarmDiaryEntry) => e.type === 'income' || e.tradeType === 'sell';
const isMoneyOut = (e: FarmDiaryEntry) =>
  !isMoneyIn(e) && (e.type === 'expense' || e.type === 'household' || e.tradeType === 'buy');

interface MonthCursor {
  year: number;
  month: number; // 0-based
}

const EMPTY_FORM = {
  kind: 'buy' as HouseholdKind,
  category: 'Groceries',
  title: '',
  amount: '',
  date: todayStr(),
  quantity: '',
  unit: '',
  party: '',
  notes: '',
};

export const CustomerDiaryView: React.FC = () => {
  const [cursor, setCursor] = useState<MonthCursor>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [entries, setEntries] = useState<FarmDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Search-across-months state
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FarmDiaryEntry[] | null>(null);
  const [searching, setSearching] = useState(false);

  // Add-entry form state
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const monthKey = `${cursor.year}-${pad2(cursor.month + 1)}`;
  const monthFrom = `${monthKey}-01`;
  const monthTo = localDateStr(new Date(cursor.year, cursor.month + 1, 0));
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });

  const loadMonth = async () => {
    setLoading(true);
    try {
      const list = await diary.entries({ from: monthFrom, to: monthTo, pageSize: 200 });
      setEntries(list);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    diary
      .entries({ from: monthFrom, to: monthTo, pageSize: 200 })
      .then((list) => active && setEntries(list))
      .catch((err) => active && setError(apiErrorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [monthFrom, monthTo]);

  // Debounced cross-month search (GET /diary/entries?q=…)
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      diary
        .entries({ q, pageSize: 50 })
        .then((list) => active && setResults(list))
        .catch((err) => active && setError(apiErrorMessage(err)))
        .finally(() => active && setSearching(false));
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  const grouped = useMemo(() => {
    const map = new Map<string, FarmDiaryEntry[]>();
    for (const entry of entries) {
      const list = map.get(entry.date) ?? [];
      list.push(entry);
      map.set(entry.date, list);
    }
    return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const totalSpent = entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalBought = entries
    .filter((e) => e.type === 'household' || e.tradeType === 'buy')
    .reduce((sum, e) => sum + (e.amount || 0), 0);

  const shiftMonth = (delta: number) => {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  const jumpToEntry = (entry: FarmDiaryEntry) => {
    const key = (entry.date || '').slice(0, 7);
    const [y, m] = key.split('-').map(Number);
    if (y && m) setCursor({ year: y, month: m - 1 });
    setQuery('');
    setResults(null);
  };

  const set = (key: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const applyKind = (kind: HouseholdKind) =>
    setForm((f) => ({ ...f, kind, category: CATEGORIES_BY_KIND[kind][0] }));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const amount = Number(form.amount);
    if (!form.title.trim()) {
      setError('Please enter a title for the entry.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    const quantity = form.quantity === '' ? NaN : Number(form.quantity);
    if (form.quantity !== '' && (!Number.isFinite(quantity) || quantity <= 0)) {
      setError('Quantity must be a positive number (or leave it empty).');
      return;
    }
    setSaving(true);
    try {
      // Buy posts as type "household" + tradeType "buy" (backend DiaryEntryIn).
      const created = unwrapEntry(
        await diary.create({
          title: form.title.trim(),
          category: form.category,
          type: form.kind === 'buy' ? 'household' : form.kind,
          amount,
          date: form.date || todayStr(),
          ...(form.kind === 'buy' ? { tradeType: 'buy' } : {}),
          ...(Number.isFinite(quantity) ? { quantity } : {}),
          ...(form.unit ? { unit: form.unit } : {}),
          ...(form.party.trim() ? { party: form.party.trim() } : {}),
          ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        })
      );
      setNotice('Entry saved to household diary.');
      setModalOpen(false);
      setForm({ ...EMPTY_FORM, date: todayStr() });
      const entryMonth = (created.date || '').slice(0, 7);
      if (entryMonth === monthKey) {
        await loadMonth();
      } else if (entryMonth) {
        const [y, m] = entryMonth.split('-').map(Number);
        if (y && m) setCursor({ year: y, month: m - 1 });
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (entry: FarmDiaryEntry) => {
    if (!window.confirm(`Delete "${entry.title || entry.category}" from the diary?`)) return;
    setError(null);
    setBusyId(entry.id);
    try {
      await diary.remove(entry.id);
      setEntries((prev) => prev.filter((en) => en.id !== entry.id));
      setNotice('Diary entry deleted.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const searchingActive = query.trim().length >= 2;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            Household Diary (Kharcha Pustika)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Month-wise record of household purchases, expenses and income
          </p>
        </div>
        <button
          onClick={() => {
            setForm({ ...EMPTY_FORM, date: todayStr() });
            setModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Entry</span>
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

      {/* Month summary chips */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
            <span>Total Spent</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-rose-700">{formatCurrency(totalSpent)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Utilities, rent, medical & other expenses</p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
            <span>Total Bought</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-700">{formatCurrency(totalBought)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Groceries, vegetables, dairy & household buys</p>
        </div>
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
            <span>Entries</span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-700">
              <BookOpen className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-2 text-2xl font-black text-slate-900">{entries.length}</div>
          <p className="text-[11px] text-slate-400 mt-1">{monthLabel}</p>
        </div>
      </div>

      {/* Month navigator + search */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex items-center justify-between md:justify-start gap-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs px-2 py-1.5">
          <button
            onClick={() => shiftMonth(-1)}
            className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            title="Previous month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-extrabold text-slate-900 min-w-[10rem] text-center">
            {monthLabel}
          </span>
          <button
            onClick={() => shiftMonth(1)}
            className="p-2 rounded-xl text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors"
            title="Next month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all months (title, category, notes, party)…"
            className="w-full pl-10 pr-9 py-2.5 text-xs rounded-2xl border border-slate-200/80 bg-white shadow-xs focus:outline-none focus:border-emerald-600"
          />
          {query && (
            <button
              onClick={() => {
                setQuery('');
                setResults(null);
              }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Search results (across months) */}
      {searchingActive && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">
              Search results for “{query.trim()}”
            </h3>
            <span className="text-xs text-slate-400 font-semibold">
              {searching ? 'Searching…' : `${results?.length ?? 0} found`}
            </span>
          </div>
          {searching ? (
            <p className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
              Searching diary…
            </p>
          ) : !results || results.length === 0 ? (
            <div className="py-10 text-center">
              <SearchX className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-400">
                No entries match your search.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {results.map((entry) => (
                <li
                  key={entry.id}
                  className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-xs text-slate-900 truncate">
                      {entry.title || entry.category}
                    </div>
                    <div className="text-[10px] text-slate-400 font-semibold">
                      {formatDate(entry.date)} · {entry.category}
                      {entry.party ? ` · ${entry.party}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`font-mono font-bold text-xs ${
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
                    <button
                      onClick={() => jumpToEntry(entry)}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-600 text-[10px] font-bold transition-colors"
                    >
                      Jump to month
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Month entries grouped by date */}
      {!searchingActive && (
        <div className="space-y-4">
          {loading ? (
            <div className="py-12 text-center text-xs font-bold text-slate-400 animate-pulse bg-white rounded-3xl border border-slate-200/80 shadow-xs">
              Loading diary entries…
            </div>
          ) : grouped.length === 0 ? (
            <div className="py-12 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
              <BookOpen className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm font-bold text-slate-700">No entries in {monthLabel}</p>
              <p className="text-xs text-slate-400 mt-1">
                Tap “Add Entry” to record your first household purchase, expense or income.
              </p>
            </div>
          ) : (
            grouped.map(([date, dayEntries]) => (
              <div
                key={date}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden"
              >
                <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    {formatDate(date)}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {dayEntries.length} {dayEntries.length === 1 ? 'entry' : 'entries'}
                  </span>
                </div>
                <ul className="divide-y divide-slate-100">
                  {dayEntries.map((entry) => (
                    <li
                      key={entry.id}
                      className="p-4 flex items-start justify-between gap-3 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-bold text-xs text-slate-900">
                            {entry.title || entry.category}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {entry.category}
                          </span>
                          {entry.type === 'household' && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 text-amber-800">
                              Bought
                            </span>
                          )}
                          {entry.tradeType === 'sell' && (
                            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-800">
                              Sold
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] font-semibold text-slate-400">
                          {entry.quantity != null && entry.unit && (
                            <span>
                              {entry.quantity} {entry.unit}
                            </span>
                          )}
                          {entry.party && <span>Party: {entry.party}</span>}
                        </div>
                        {entry.notes && (
                          <p className="mt-1 text-[11px] text-slate-500 italic truncate">
                            {entry.notes}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-mono font-bold text-sm ${
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
                        <button
                          onClick={() => handleDelete(entry)}
                          disabled={busyId === entry.id}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      )}

      {/* Add entry modal */}
      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Household Entry"
        description="Record a household purchase, monthly expense or income in your kharcha pustika"
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
              <select
                value={form.kind}
                onChange={(e) => applyKind(e.target.value as HouseholdKind)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
              >
                {KIND_OPTIONS.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={set('category')}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
              >
                {CATEGORIES_BY_KIND[form.kind].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
            <input
              type="text"
              placeholder={
                form.kind === 'buy'
                  ? 'e.g. Monthly vegetable basket'
                  : form.kind === 'expense'
                    ? 'e.g. Electricity bill'
                    : 'e.g. Salary credited'
              }
              value={form.title}
              onChange={set('title')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.amount}
                onChange={set('amount')}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={form.date}
                onChange={set('date')}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
          </div>

          {form.kind === 'buy' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity <span className="text-slate-400 font-semibold">(optional)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="e.g. 5"
                  value={form.quantity}
                  onChange={set('quantity')}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Unit <span className="text-slate-400 font-semibold">(optional)</span>
                </label>
                <select
                  value={form.unit}
                  onChange={set('unit')}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
                >
                  <option value="">Select unit…</option>
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Party / Source <span className="text-slate-400 font-semibold">(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Big Bazaar, landlord, employer"
              value={form.party}
              onChange={set('party')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Notes <span className="text-slate-400 font-semibold">(optional)</span>
            </label>
            <textarea
              rows={2}
              placeholder="Any extra detail…"
              value={form.notes}
              onChange={set('notes')}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 resize-none"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Entry'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
