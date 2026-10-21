import React, { useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  Calendar,
  DollarSign,
  Download,
  Tag,
  X,
  FileText,
  Sprout,
} from 'lucide-react';
import { diary } from '../../lib/api';

export const NurseryDiaryView: React.FC = () => {
  const [entries, setEntries] = useState<Array<Record<string, unknown>>>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('plant_care');
  const [type, setType] = useState<'farmActivity' | 'expense' | 'income'>('farmActivity');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadEntries = () => {
    setLoading(true);
    diary
      .entries()
      .then((res) => {
        setEntries(Array.isArray(res) ? (res as unknown as Array<Record<string, unknown>>) : []);
      })
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadEntries();
  }, []);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await diary.create({
        title,
        category: category as any,
        type: type === 'income' ? 'income' : 'expense',
        amount: Number(amount),
        date,
        notes,
      });
      setShowModal(false);
      setTitle('');
      setNotes('');
      setAmount(0);
      loadEntries();
    } catch (err) {
      alert('Failed to save diary entry');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCsv = () => {
    window.open('/v1/diary/report.csv', '_blank');
  };

  const totalExpense = entries
    .filter((e) => e.type === 'expense')
    .reduce((acc, cur) => acc + Number(cur.amount || 0), 0);

  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((acc, cur) => acc + Number(cur.amount || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-emerald-700" />
            Nursery Plant Care & Activity Diary
          </h1>
          <p className="text-xs text-slate-500">
            Log daily watering schedules, foliar spray applications, grafting batches, labor expenses, and sapling income.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" /> Export CSV
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-md transition"
          >
            <Plus className="w-4 h-4" /> Add Diary Entry
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Total Care Activities
          </span>
          <div className="text-2xl font-black text-slate-900">{entries.length}</div>
          <p className="text-[11px] text-slate-400">Recorded care logs</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Nursery Expenses
          </span>
          <div className="text-2xl font-black text-rose-700">
            ₹{totalExpense.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-slate-400">Nutrients, soil, labor</p>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block">
            Direct Shop Income
          </span>
          <div className="text-2xl font-black text-emerald-800">
            ₹{totalIncome.toLocaleString('en-IN')}
          </div>
          <p className="text-[11px] text-emerald-700">Counter sapling sales</p>
        </div>
      </div>

      {/* Entries List */}
      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Sprout className="w-4 h-4 text-emerald-700" />
            Nursery Care Log ({entries.length})
          </h3>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-slate-400 font-bold">Loading entries…</div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <BookOpen className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs text-slate-500 font-bold">No diary entries logged yet.</p>
            <p className="text-[11px] text-slate-400">
              Click "Add Diary Entry" to log daily maintenance or grafting progress.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {entries.map((entry, idx) => {
              const eType = String(entry.type || 'farmActivity');
              const amt = Number(entry.amount || 0);

              return (
                <div key={idx} className="p-4 hover:bg-slate-50/70 transition flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-900">{String(entry.title)}</h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {String(entry.category || 'plant_care')}
                      </span>
                    </div>

                    {Boolean(entry.notes) && (
                      <p className="text-xs text-slate-600 max-w-xl">{String(entry.notes)}</p>
                    )}

                    <p className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" /> {String(entry.date)}
                    </p>
                  </div>

                  {amt > 0 && (
                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-black ${
                          eType === 'income' ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {eType === 'income' ? '+' : '-'}₹{amt.toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                Add Plant Care / Financial Log
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateEntry} className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">Activity Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Neem Oil Spray on Bed A-3 grafts"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white"
                  >
                    <option value="plant_care">Plant Care & Spray</option>
                    <option value="watering">Watering & Irrigation</option>
                    <option value="grafting">Grafting & Propagation</option>
                    <option value="potting">Potting & Bed Soil</option>
                    <option value="sapling_sale">Sapling Counter Sale</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as 'farmActivity' | 'expense' | 'income')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="farmActivity">Care Activity (No ₹)</option>
                    <option value="expense">Expense (Input / Labor)</option>
                    <option value="income">Income (Sale)</option>
                  </select>
                </div>
              </div>

              {type !== 'farmActivity' && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">Amount (₹)</label>
                  <input
                    type="number"
                    min="1"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none font-bold text-sm"
                  />
                </div>
              )}

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">Observation Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Applied 5ml/liter neem oil for mealybug prevention..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold transition disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Record Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
