import React, { useState } from 'react';
import {
  BookOpen,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  PieChart,
  Download,
  Filter,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { MOCK_FARM_DIARY } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { FarmDiaryEntry } from '../../types';

export const FarmDiaryView: React.FC = () => {
  const [entries, setEntries] = useState<FarmDiaryEntry[]>(MOCK_FARM_DIARY);
  const [modalOpen, setModalOpen] = useState(false);

  // Form State
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [crop, setCrop] = useState('Soybean');
  const [category, setCategory] = useState<FarmDiaryEntry['category']>('Fertilizers');
  const [amount, setAmount] = useState(2500);
  const [date, setDate] = useState('2026-10-17');
  const [notes, setNotes] = useState('');

  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalExpense = entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);

  const netProfit = totalIncome - totalExpense;

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: FarmDiaryEntry = {
      id: 'fd_' + Date.now(),
      date,
      type,
      crop,
      category,
      amount,
      notes,
    };
    setEntries([newEntry, ...entries]);
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            Farm Diary & P&L (Khaata-Kitaab)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track crop-wise revenue, fertilizer/labor expenses, break-even price, and true net profit
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Cashbook Entry</span>
        </button>
      </div>

      {/* P&L Executive Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
            <span>Total Crop Income</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-700">{formatCurrency(totalIncome)}</div>
          <p className="text-[11px] text-slate-400 mt-1">From produce sales & subsidies</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
            <span>Total Farm Expenses</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-rose-700">{formatCurrency(totalExpense)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Seeds, diesel, labor & chemicals</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
            <span>Net Farm Profit (P&L)</span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-700">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">{formatCurrency(netProfit)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Break-even: ₹3,120 / quintal</p>
        </div>
      </div>

      {/* Cashbook Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Recent Cashbook Entries</h3>
          <span className="text-xs text-slate-400 font-semibold">{entries.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Crop</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Notes / Purpose</th>
                <th className="py-3 px-6 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-3.5 px-6 font-medium text-slate-600">{formatDate(entry.date)}</td>
                  <td className="py-3.5 px-4 font-bold text-slate-900">{entry.crop}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        entry.type === 'income'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {entry.category}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-500 italic">{entry.notes || '—'}</td>
                  <td
                    className={`py-3.5 px-6 text-right font-bold text-sm font-mono ${
                      entry.type === 'income' ? 'text-emerald-700' : 'text-slate-900'
                    }`}
                  >
                    {entry.type === 'income' ? `+${formatCurrency(entry.amount)}` : `-${formatCurrency(entry.amount)}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Cashbook Entry Modal */}
      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Farm Diary Entry"
        description="Record income or expenditure for accurate season P&L"
        maxWidth="md"
      >
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2.5 rounded-xl font-bold text-xs border transition-all ${
                type === 'expense'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Expense (खर्च)
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2.5 rounded-xl font-bold text-xs border transition-all ${
                type === 'income'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Income (कमाई)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop</label>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Soybean">Soybean</option>
                <option value="Wheat">Wheat</option>
                <option value="Onion">Onion</option>
                <option value="Cotton">Cotton</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Seeds">Seeds</option>
                <option value="Fertilizers">Fertilizers</option>
                <option value="Pesticides">Pesticides</option>
                <option value="Labor">Labor Wages</option>
                <option value="Diesel/Machinery">Diesel / Machinery</option>
                <option value="Crop Sale">Crop Sale (Income)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Description</label>
            <input
              type="text"
              placeholder="e.g. Purchased 2 bags DAP from cooperative"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Save Entry to Diary
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
