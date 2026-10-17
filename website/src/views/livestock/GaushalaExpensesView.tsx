import React, { useEffect, useState } from 'react';
import { Wallet, Plus, Pencil, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { livestock, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency, formatDate } from '../../lib/utils';
import { asRec, numOf, recArr, strOf, todayStr } from './helpers';

const CATEGORIES = ['fodder', 'medical', 'staff', 'utilities', 'transport', 'other'];

const EMPTY_EXPENSE = {
  category: 'fodder',
  amount: 0,
  note: '',
  expenseDate: todayStr(),
};

export const GaushalaExpensesView: React.FC = () => {
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(EMPTY_EXPENSE);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [e, s] = await Promise.all([
        livestock.gaushala.expenses().catch(() => []),
        livestock.gaushala.expenseSummary().catch(() => null),
      ]);
      setExpenses(recArr(e));
      setSummary(s ? asRec(s) : null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(EMPTY_EXPENSE);
    setModalOpen(true);
  };

  const openEdit = (x: Record<string, unknown>) => {
    setEditing(x);
    setForm({
      category: strOf(x.category, 'fodder') || 'fodder',
      amount: numOf(x.amount),
      note: strOf(x.note),
      expenseDate: strOf(x.expenseDate, todayStr()) || todayStr(),
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const payload = { ...form, amount: Number(form.amount) };
      if (editing) {
        await livestock.gaushala.updateExpense(strOf(editing.id), payload);
        setNotice('Expense updated.');
      } else {
        await livestock.gaushala.addExpense(payload);
        setNotice('Expense recorded.');
      }
      setModalOpen(false);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (x: Record<string, unknown>) => {
    if (!window.confirm(`Delete expense ${strOf(x.id)} (${formatCurrency(numOf(x.amount))})?`)) return;
    setError(null);
    try {
      await livestock.gaushala.removeExpense(strOf(x.id));
      setNotice('Expense deleted.');
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const monthTotal = numOf(summary?.monthTotal ?? summary?.thisMonthTotal);
  const total = numOf(summary?.total);
  const byCategory = asRec(summary?.byCategory);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Wallet className="w-7 h-7 text-emerald-600" />
            Gaushala Expenses
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Fodder, medical, staff and upkeep costs — published on the public transparency report
          </p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="This Month" value={formatCurrency(monthTotal)} icon={Wallet} colorScheme="amber" />
        <StatCard title="All Time" value={formatCurrency(total)} icon={Wallet} colorScheme="slate" />
        <StatCard title="Entries" value={expenses.length} icon={Plus} colorScheme="blue" />
        <StatCard
          title="Top Category"
          value={
            Object.entries(byCategory).sort((a, b) => numOf(b[1]) - numOf(a[1]))[0]?.[0]?.replace(/_/g, ' ') || '—'
          }
          icon={Wallet}
          colorScheme="green"
        />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        {loading ? (
          <p className="p-6 text-xs text-slate-400">Loading expenses…</p>
        ) : expenses.length === 0 ? (
          <p className="p-6 text-xs text-slate-400">No expenses recorded yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Note</th>
                  <th className="py-3 px-3 text-right">Amount</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {expenses.map((x) => (
                  <tr key={strOf(x.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-700">{formatDate(strOf(x.expenseDate))}</td>
                    <td className="py-3 px-3 capitalize text-slate-600">{strOf(x.category, 'other')}</td>
                    <td className="py-3 px-3 text-slate-600 max-w-[280px] truncate">{strOf(x.note) || '—'}</td>
                    <td className="py-3 px-3 text-right font-black text-rose-700">{formatCurrency(numOf(x.amount))}</td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEdit(x)}
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRemove(x)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit Expense' : 'Add Expense'}
        maxWidth="sm"
      >
        <form onSubmit={handleSave} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Category *</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              required
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Amount ₹ *</label>
            <input
              type="number"
              step="0.5"
              min="1"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
            <input
              type="date"
              value={form.expenseDate}
              onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note</label>
            <input
              type="text"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="e.g. 40 quintals green fodder"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Expense'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default GaushalaExpensesView;
