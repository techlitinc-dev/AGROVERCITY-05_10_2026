import React, { useCallback, useEffect, useState } from 'react';
import {
  BookOpen,
  Plus,
  RefreshCw,
  Download,
  Calendar,
  DollarSign,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  FileSpreadsheet,
  Tag,
  User,
  Filter,
} from 'lucide-react';
import { diary, apiClient, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight } from '../../lib/utils';
import { cardCls, inputCls, labelCls, primaryBtnCls, ghostBtnCls, rec, str, arr, num, paisaToRupees, type Rec } from './shared';

const DIARY_CATEGORIES = [
  { id: 'all', label: 'All Records' },
  { id: 'produce_purchase', label: 'Produce Purchase (खरेदी)' },
  { id: 'produce_sale', label: 'Produce Sale (विक्री)' },
  { id: 'transport_expense', label: 'Transport / Freight (वाहतूक)' },
  { id: 'mandi_tax', label: 'APMC / Mandi Cess (सेस)' },
  { id: 'labor', label: 'Hamali / Labor (हमाली)' },
  { id: 'storage', label: 'Godown / Cold Storage (गोदाम)' },
];

export const SellerDiaryView: React.FC = () => {
  const [entries, setEntries] = useState<Rec[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Add Entry Modal
  const [addModal, setAddModal] = useState(false);
  const [title, setTitle] = useState('Soybean purchase from Ramesh Jadhav');
  const [category, setCategory] = useState('produce_purchase');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState(180000);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [party, setParty] = useState('Ramesh Jadhav');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [cropName, setCropName] = useState('Soybean');
  const [quantity, setQuantity] = useState(40);
  const [unit, setUnit] = useState('quintal');
  const [notes, setNotes] = useState('Moisture tested at 11%, paid advance via UPI.');
  const [saving, setSaving] = useState(false);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await diary.entries().catch(() => []);
      setEntries(arr(res).map(rec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const filtered = entries.filter((e) => {
    if (activeCategory !== 'all' && str(e.category) !== activeCategory) return false;
    return true;
  });

  const totalIncome = entries
    .filter((e) => str(e.type) === 'income')
    .reduce((acc, e) => acc + (num(e.amount) || 0), 0);

  const totalExpense = entries
    .filter((e) => str(e.type) === 'expense')
    .reduce((acc, e) => acc + (num(e.amount) || 0), 0);

  const netPnl = totalIncome - totalExpense;

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await diary.create({
        title,
        category: category as any,
        type,
        amount,
        date,
        party,
        tradeType,
        cropName,
        quantity,
        unit,
        notes,
      });
      setNotice(`Business diary entry "${title}" recorded!`);
      setAddModal(false);
      await loadEntries();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const res = await apiClient.get('/diary/report.csv', {
        params: { from: '2026-10-01', to: '2026-10-31' },
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `Vyapari_Diary_Report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setNotice('Business diary CSV report downloaded successfully!');
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            Vyapari Business Diary & Khata Records
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Daily purchase logs, transport expenses, hamali payments, grain trade margins, and exportable ledger audit reports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExportCsv}
            className={`${ghostBtnCls} flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200`}
          >
            <Download className="w-3.5 h-3.5" /> Export Ledger CSV
          </button>
          <button
            type="button"
            onClick={() => setAddModal(true)}
            className={`${primaryBtnCls} flex items-center gap-1.5 text-xs font-black shadow-md`}
          >
            <Plus className="w-4 h-4" /> Add Diary Record
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-600 hover:underline">Dismiss</button>
        </div>
      )}

      {notice && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            {notice}
          </span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Snapshot Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className={`${cardCls} space-y-1`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" /> Total Sales Realization
          </span>
          <div className="text-2xl font-black text-emerald-700">{formatCurrency(totalIncome)}</div>
          <p className="text-[11px] text-slate-500">Mandi wholesale & direct buyer revenue</p>
        </div>

        <div className={`${cardCls} space-y-1`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" /> Total Outflow / Expenses
          </span>
          <div className="text-2xl font-black text-rose-700">{formatCurrency(totalExpense)}</div>
          <p className="text-[11px] text-slate-500">Procurement advances, freight & labor</p>
        </div>

        <div className={`${cardCls} space-y-1`}>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" /> Net Trading Margin
          </span>
          <div className={`text-2xl font-black ${netPnl >= 0 ? 'text-indigo-700' : 'text-rose-700'}`}>
            {formatCurrency(netPnl)}
          </div>
          <p className="text-[11px] text-slate-500">Net operating realization for month</p>
        </div>
      </div>

      {/* Categories Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold border-b border-slate-200">
        {DIARY_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={`px-3 py-1.5 rounded-xl whitespace-nowrap transition-all border ${
              activeCategory === c.id
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Diary Entries List */}
      <div className={`${cardCls} space-y-4`}>
        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            Khata Journal Log ({filtered.length} Entries)
          </h2>
          <span className="text-xs font-bold text-slate-400">Chronological</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading business diary entries…
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-slate-300 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No Journal Records Yet</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Add your daily purchases, freight notes, or income entries to maintain an audit-ready trade ledger.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filtered.map((item, idx) => {
              const isInc = str(item.type) === 'income';
              const amt = num(item.amount) || 0;
              const dateStr = str(item.date) || '2026-10-20';

              return (
                <div key={str(item.id) || idx} className="py-3.5 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] uppercase font-black px-2 py-0.5 rounded-full ${isInc ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        {isInc ? 'Inflow' : 'Outflow'}
                      </span>
                      <h4 className="text-sm font-black text-slate-900">{str(item.title)}</h4>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span>Date: <strong>{dateStr}</strong></span>
                      {Boolean(item.party) && <span>Party: <strong>{str(item.party)}</strong></span>}
                      {Boolean(item.cropName) && <span>Crop: <strong>{str(item.cropName)} ({num(item.quantity)} Qt)</strong></span>}
                    </div>

                    {Boolean(item.notes) && <p className="text-[11px] text-slate-400 italic">"{str(item.notes)}"</p>}
                  </div>

                  <div className="text-right shrink-0">
                    <div className={`text-base font-black ${isInc ? 'text-emerald-700' : 'text-slate-900'}`}>
                      {isInc ? '+' : '-'}{formatCurrency(amt)}
                    </div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      {str(item.category).replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Entry Modal */}
      {addModal && (
        <ModalSheet title="Record Business Diary Entry" isOpen={addModal} onClose={() => setAddModal(false)}>
          <form onSubmit={handleAddEntry} className="space-y-4">
            <div>
              <label className={labelCls}>Entry Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Accounting Type</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as any)}
                  className={inputCls}
                >
                  <option value="expense">Expense / Outflow (खर्च)</option>
                  <option value="income">Income / Inflow (जमा)</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={inputCls}
                >
                  <option value="produce_purchase">Produce Purchase</option>
                  <option value="produce_sale">Produce Sale</option>
                  <option value="transport_expense">Freight / Transport</option>
                  <option value="mandi_tax">APMC Cess / Tax</option>
                  <option value="labor">Hamali / Labor</option>
                  <option value="storage">Storage / Warehousing</option>
                  <option value="other">General Expense</option>
                </select>
              </div>

              <div>
                <label className={labelCls}>Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Transaction Date *</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Party / Farmer / Transporter</label>
                <input
                  type="text"
                  value={party}
                  onChange={(e) => setParty(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Crop Name</label>
                <input
                  type="text"
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Quantity (Quintals)</label>
                <input
                  type="number"
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>Notes & Observations</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setAddModal(false)}
                className={`${ghostBtnCls} text-xs font-bold`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className={`${primaryBtnCls} text-xs font-black px-5`}
              >
                {saving ? 'Recording…' : 'Save to Ledger'}
              </button>
            </div>
          </form>
        </ModalSheet>
      )}
    </div>
  );
};
