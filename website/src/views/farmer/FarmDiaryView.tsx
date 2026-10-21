import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Camera,
  Pencil,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { diary, uploads, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { DiaryEntryType, DiaryTradeType, FarmDiaryEntry } from '../../types';

/** SR 12 — entry-type breadth, matching backend DiaryEntryIn.type. */
const ENTRY_TYPES: { id: DiaryEntryType; label: string }[] = [
  { id: 'expense', label: 'Expense (खर्च)' },
  { id: 'income', label: 'Income (कमाई)' },
  { id: 'farmActivity', label: 'Farm Activity (काम)' },
  { id: 'transport', label: 'Transport (वाहतूक)' },
  { id: 'equipment', label: 'Equipment (यंत्र)' },
  { id: 'lesson', label: 'Lesson (शिक्षण)' },
  { id: 'order', label: 'Order (ऑर्डर)' },
  { id: 'household', label: 'Household (घर)' },
];

const TYPE_BADGE_LABEL: Record<DiaryEntryType, string> = {
  income: 'Income',
  expense: 'Expense',
  farmActivity: 'Activity',
  transport: 'Transport',
  equipment: 'Equipment',
  lesson: 'Lesson',
  order: 'Order',
  household: 'Household',
};

/** Per-type category options — income/expense keep the original cashbook list. */
const CATEGORIES_BY_TYPE: Record<DiaryEntryType, string[]> = {
  income: ['Crop Sale', 'Subsidy', 'Seeds', 'Fertilizers', 'Pesticides', 'Labor', 'Diesel/Machinery', 'Other'],
  expense: ['Seeds', 'Fertilizers', 'Pesticides', 'Labor', 'Diesel/Machinery', 'Crop Sale', 'Subsidy', 'Other'],
  farmActivity: ['Sowing', 'Weeding', 'Irrigation', 'Harvesting', 'Spraying', 'Other'],
  transport: ['Freight', 'Booking', 'Other'],
  equipment: ['Rent', 'Maintenance', 'Fuel', 'Other'],
  lesson: ['Course', 'Workshop', 'Other'],
  order: ['Advance', 'Delivery', 'Other'],
  household: ['Gruh Udyog', 'SHG', 'Other'],
};

/** Types that carry a buy/sell tag and counterparty. */
const TRADE_TYPES: DiaryEntryType[] = ['income', 'expense'];

/** POST/PUT return { entry, agriCoinsEarned? } — unwrap defensively. */
const unwrapEntry = (res: unknown): FarmDiaryEntry => {
  const rec = (res ?? {}) as Record<string, unknown>;
  return (rec.entry ?? rec) as FarmDiaryEntry;
};

const todayStr = () => new Date().toISOString().slice(0, 10);

export const FarmDiaryView: React.FC = () => {
  const [entries, setEntries] = useState<FarmDiaryEntry[]>([]);
  const [summary, setSummary] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<FarmDiaryEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [photosEntry, setPhotosEntry] = useState<FarmDiaryEntry | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Form State
  const [type, setType] = useState<DiaryEntryType>('expense');
  const [category, setCategory] = useState<string>('Fertilizers');
  const [title, setTitle] = useState('');
  const [cropName, setCropName] = useState('Soybean');
  const [party, setParty] = useState('');
  const [tradeType, setTradeType] = useState<DiaryTradeType>('buy');
  const [amount, setAmount] = useState(2500);
  const [date, setDate] = useState(todayStr());
  const [notes, setNotes] = useState('');

  const isTrade = TRADE_TYPES.includes(type);
  const showCrop = isTrade || type === 'farmActivity';

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([diary.entries(), diary.summary().catch(() => null)])
      .then(([e, s]) => {
        if (!active) return;
        setEntries(e);
        if (s) setSummary(s as Record<string, unknown>);
      })
      .catch((err) => active && setError(apiErrorMessage(err)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const totalIncome = entries
    .filter((e) => e.type === 'income')
    .reduce((sum, e) => sum + e.amount, 0);

  const totalExpense = entries
    .filter((e) => e.type === 'expense')
    .reduce((sum, e) => sum + e.amount, 0);

  const netProfit = totalIncome - totalExpense;

  const breakEven =
    summary && typeof summary === 'object'
      ? (summary.breakEvenPerQuintal as number | undefined) ?? (summary.breakEven as number | undefined)
      : undefined;

  const applyType = (next: DiaryEntryType) => {
    setType(next);
    setCategory(CATEGORIES_BY_TYPE[next][0]);
    if (TRADE_TYPES.includes(next)) {
      setTradeType(next === 'income' ? 'sell' : 'buy');
      setAmount((prev) => prev || 2500);
    } else {
      setAmount(0);
    }
  };

  const resetForm = () => {
    setEditingEntry(null);
    setType('expense');
    setCategory('Fertilizers');
    setTitle('');
    setCropName('Soybean');
    setParty('');
    setTradeType('buy');
    setAmount(2500);
    setDate(todayStr());
    setNotes('');
  };

  const openEdit = (entry: FarmDiaryEntry) => {
    const entryType = (ENTRY_TYPES.some((t) => t.id === entry.type) ? entry.type : 'expense') as DiaryEntryType;
    setEditingEntry(entry);
    setType(entryType);
    setCategory(
      CATEGORIES_BY_TYPE[entryType].includes(entry.category)
        ? entry.category
        : CATEGORIES_BY_TYPE[entryType][0]
    );
    setTitle(entry.title || '');
    setCropName(entry.cropName || entry.crop || 'Soybean');
    setParty(entry.party || '');
    setTradeType(entry.tradeType || (entryType === 'income' ? 'sell' : 'buy'));
    setAmount(entry.amount);
    setDate(entry.date);
    setNotes(entry.notes || '');
    setModalOpen(true);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload = {
      title: title.trim() || category,
      category,
      type,
      amount: isTrade ? amount : amount || 0,
      date,
      notes: notes.trim() || undefined,
      ...(showCrop && cropName.trim() ? { cropName: cropName.trim() } : {}),
      ...(isTrade ? { tradeType, party: party.trim() } : {}),
    };
    try {
      if (editingEntry) {
        const updated = unwrapEntry(await diary.update(editingEntry.id, payload));
        setEntries((prev) => prev.map((en) => (en.id === updated.id ? { ...en, ...updated } : en)));
        setNotice('Diary entry updated.');
      } else {
        const created = unwrapEntry(await diary.create(payload));
        setEntries((prev) => [created, ...prev]);
        setNotice('Entry saved to farm diary.');
      }
      setModalOpen(false);
      resetForm();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleDeleteEntry = async (id: string) => {
    setError(null);
    setBusyId(id);
    try {
      await diary.remove(id);
      setEntries((prev) => prev.filter((en) => en.id !== id));
      setNotice('Diary entry deleted.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const handlePhotoUpload = async (file: File | undefined) => {
    if (!file || !photosEntry) return;
    setPhotoBusy(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'diary', purpose: 'diary-entry-photo' })) as
        | Array<{ url?: string; fileUrl?: string }>
        | { url?: string; fileUrl?: string }
        | undefined;
      const first = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      const url = first?.url ?? first?.fileUrl ?? '';
      if (!url) throw new Error('Upload succeeded but no URL was returned.');
      await diary.addPhotos(photosEntry.id, { photoUrls: [url] });
      setNotice(`Photo attached to entry #${photosEntry.id}.`);
      setPhotosEntry(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPhotoBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
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
            Track crop-wise revenue, expenses, farm activities, and true net profit
          </p>
        </div>

        <div className="flex gap-2 self-start sm:self-auto">
          <Link
            to="/farmer/pnl"
            className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-all"
          >
            <TrendingUp className="w-4 h-4" />
            <span>P&L Dashboard</span>
          </Link>
          <button
            onClick={() => {
              resetForm();
              setModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Diary Entry</span>
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
          <p className="text-[11px] text-slate-400 mt-1">
            {typeof breakEven === 'number' ? `Break-even: ${formatCurrency(breakEven)} / quintal` : 'Break-even available in the P&L dashboard'}
          </p>
        </div>
      </div>

      {/* Cashbook Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Recent Diary Entries</h3>
          <span className="text-xs text-slate-400 font-semibold">{entries.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Entry</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Notes / Purpose</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
                    Loading diary entries…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs font-semibold text-slate-400">
                    No diary entries yet. Add your first record.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const cropLabel = entry.cropName || entry.crop || '—';
                  return (
                    <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-6 font-medium text-slate-600">{formatDate(entry.date)}</td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">{entry.title || cropLabel}</div>
                        <div className="text-[10px] text-slate-400 font-semibold">
                          {TYPE_BADGE_LABEL[entry.type] || entry.type}
                          {entry.type !== 'income' && entry.type !== 'expense' && ` · ${cropLabel}`}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col items-start gap-1">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              entry.type === 'income'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : entry.type === 'expense'
                                  ? 'bg-slate-100 text-slate-700'
                                  : 'bg-sky-50 text-sky-700 border border-sky-200'
                            }`}
                          >
                            {entry.category}
                          </span>
                          {(entry.tradeType || entry.party) && (
                            <span className="flex flex-wrap gap-1">
                              {entry.tradeType && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                                    entry.tradeType === 'sell'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {entry.tradeType === 'sell' ? 'Sold' : 'Bought'}
                                </span>
                              )}
                              {entry.party && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600">
                                  Party: {entry.party}
                                </span>
                              )}
                              {cropLabel !== '—' && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-slate-100 text-slate-600">
                                  Crop: {cropLabel}
                                </span>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-slate-500 italic">{entry.notes || '—'}</td>
                      <td
                        className={`py-3.5 px-4 text-right font-bold text-sm font-mono ${
                          entry.type === 'income'
                            ? 'text-emerald-700'
                            : entry.type === 'expense'
                              ? 'text-slate-900'
                              : 'text-slate-500'
                        }`}
                      >
                        {entry.type === 'income'
                          ? `+${formatCurrency(entry.amount)}`
                          : entry.type === 'expense'
                            ? `-${formatCurrency(entry.amount)}`
                            : entry.amount > 0
                              ? formatCurrency(entry.amount)
                              : '—'}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => setPhotosEntry(entry)}
                            className="p-1.5 text-slate-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                            title="Attach photo"
                          >
                            <Camera className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEdit(entry)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Edit entry"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(entry.id)}
                            disabled={busyId === entry.id}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                            title="Delete entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Diary Entry Modal */}
      <ModalSheet
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingEntry ? 'Edit Farm Diary Entry' : 'Add Farm Diary Entry'}
        description="Record income, expenses, farm activities and more for an accurate season P&L"
        maxWidth="md"
      >
        <form onSubmit={handleAddEntry} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Entry Type</label>
            <select
              value={type}
              onChange={(e) => applyType(e.target.value as DiaryEntryType)}
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
            >
              {ENTRY_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {isTrade && (
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setTradeType('sell')}
                className={`py-2.5 rounded-xl font-bold text-xs border transition-all ${
                  tradeType === 'sell'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Sold (बेचा)
              </button>
              <button
                type="button"
                onClick={() => setTradeType('buy')}
                className={`py-2.5 rounded-xl font-bold text-xs border transition-all ${
                  tradeType === 'buy'
                    ? 'bg-amber-50 border-amber-300 text-amber-800'
                    : 'bg-white border-slate-200 text-slate-600'
                }`}
              >
                Bought (खरीदा)
              </button>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Title</label>
            <input
              type="text"
              placeholder="e.g. Urea purchase from cooperative"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
              >
                {CATEGORIES_BY_TYPE[type].map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {showCrop && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Crop</label>
                <select
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-emerald-600"
                >
                  <option value="Soybean">Soybean</option>
                  <option value="Wheat">Wheat</option>
                  <option value="Onion">Onion</option>
                  <option value="Cotton">Cotton</option>
                  <option value="Vegetables">Vegetables</option>
                </select>
              </div>
            )}
          </div>

          {isTrade && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Party (who paid / who was paid)
              </label>
              <input
                type="text"
                placeholder="e.g. Anil Traders, Kisan Cooperative"
                value={party}
                onChange={(e) => setParty(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (₹)</label>
              <input
                type="number"
                min={0}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
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
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
          >
            {editingEntry ? 'Save Changes' : 'Save Entry to Diary'}
          </button>
        </form>
      </ModalSheet>

      {/* Attach Photo Modal */}
      <ModalSheet
        isOpen={Boolean(photosEntry)}
        onClose={() => setPhotosEntry(null)}
        title="Attach Photo to Entry"
        description={`Add a bill, receipt or field photo as proof for entry #${photosEntry?.id ?? ''}`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-4 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-2">
            <Camera className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs text-slate-600">
              Upload a photo of the invoice, receipt or field activity
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => handlePhotoUpload(e.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              disabled={photoBusy}
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-60"
            >
              {photoBusy ? 'Uploading…' : 'Choose Photo'}
            </button>
          </div>
        </div>
      </ModalSheet>
    </div>
  );
};
