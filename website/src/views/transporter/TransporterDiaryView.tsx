import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
  Scale,
  Pencil,
  Trash2,
  Camera,
  Search,
  X,
} from 'lucide-react';
import { diary, uploads, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { FarmDiaryEntry } from '../../types';

/** Backend trade-diary extras on top of the typed FarmDiaryEntry core. */
type TradeDiaryEntry = FarmDiaryEntry & {
  title?: string;
  cropName?: string;
  tradeType?: 'buy' | 'sell';
  unit?: string;
  party?: string;
  photos?: string[];
};

/** POST/PUT return { entry, agriCoinsEarned } — unwrap defensively. */
const unwrapEntry = (res: unknown): TradeDiaryEntry => {
  const rec = (res ?? {}) as Record<string, unknown>;
  return (rec.entry ?? rec) as TradeDiaryEntry;
};

const TRADE_CATEGORIES = [
  'Freight Earning',
  'Fuel / Diesel',
  'Toll & Taxes',
  'Vehicle Maintenance',
  'Tyres & Spares',
  'Loading Labour',
  'Miscellaneous',
];

const entryLabel = (e: TradeDiaryEntry): string =>
  e.title || e.cropName || e.notes || 'Trade entry';

/** /transporter/diary — transporter trade diary (buy/sell khata). */
export const TransporterDiaryView: React.FC = () => {
  const [entries, setEntries] = useState<TradeDiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TradeDiaryEntry | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [appliedQ, setAppliedQ] = useState('');
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  // Form state
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('sell');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(TRADE_CATEGORIES[0]);
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');

  const load = (q: string) => {
    setLoading(true);
    diary
      .entries(q ? { q } : {})
      .then((rows) => setEntries(rows as TradeDiaryEntry[]))
      .catch((err) => setError(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Month summary computed client-side from loaded entries.
  const monthKey = new Date().toISOString().slice(0, 7);
  const monthEntries = useMemo(
    () => entries.filter((e) => (e.date || '').startsWith(monthKey)),
    [entries, monthKey]
  );
  const totalBuy = monthEntries
    .filter((e) => e.tradeType === 'buy')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSell = monthEntries
    .filter((e) => e.tradeType === 'sell')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const net = totalSell - totalBuy;

  const resetForm = () => {
    setEditingEntry(null);
    setTradeType('sell');
    setTitle('');
    setCategory(TRADE_CATEGORIES[0]);
    setQuantity(1);
    setPrice(0);
    setDate(new Date().toISOString().slice(0, 10));
    setNotes('');
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const openEdit = (entry: TradeDiaryEntry) => {
    setEditingEntry(entry);
    setTradeType(entry.tradeType ?? (entry.type === 'income' ? 'sell' : 'buy'));
    setTitle(entry.title || entry.cropName || '');
    setCategory(TRADE_CATEGORIES.includes(entry.category) ? entry.category : TRADE_CATEGORIES[0]);
    setQuantity(entry.quantity ?? 1);
    setPrice(entry.amount ?? 0);
    setDate(entry.date);
    setNotes(entry.notes || '');
    setPhotoFile(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
    setModalOpen(true);
  };

  const buildPayload = async (): Promise<Record<string, unknown>> => {
    let photos: string[] = editingEntry?.photos ?? [];
    if (photoFile) {
      const uploaded = (await uploads.upload(photoFile, {
        folder: 'diary',
        purpose: 'diary-entry-photo',
      })) as { url?: string; fileUrl?: string };
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (url) photos = [...photos, url];
    }
    return {
      title: title.trim() || 'Trade entry',
      category,
      type: tradeType === 'buy' ? 'expense' : 'income',
      amount: price,
      date,
      notes: notes.trim(),
      quantity,
      tradeType,
      ...(photos.length > 0 ? { photos } : {}),
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPhotoBusy(true);
    try {
      const payload = await buildPayload();
      if (editingEntry) {
        const updated = unwrapEntry(await diary.update(editingEntry.id, payload));
        setEntries((prev) => prev.map((en) => (en.id === updated.id ? { ...en, ...updated } : en)));
        setNotice('Diary entry updated.');
      } else {
        const created = unwrapEntry(await diary.create(payload));
        setEntries((prev) => [created, ...prev.filter((en) => en.id !== created.id)]);
        setNotice('Trade entry saved to diary.');
      }
      setModalOpen(false);
      resetForm();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setPhotoBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedQ(searchInput.trim());
    load(searchInput.trim());
  };

  const clearSearch = () => {
    setSearchInput('');
    setAppliedQ('');
    load('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            Transporter Trade Diary (Vyapaar Khata)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Track every freight buy/sell — fuel, tolls, maintenance, and freight earnings for the month
          </p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 transition-all self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Note</span>
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
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Month Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
            <span>Total Buy (Expense)</span>
            <span className="p-2 rounded-xl bg-rose-50 text-rose-700">
              <ArrowDownRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-rose-700">{formatCurrency(totalBuy)}</div>
          <p className="text-[11px] text-slate-400 mt-1">This month — fuel, toll, repairs</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
            <span>Total Sell (Income)</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
              <ArrowUpRight className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 text-2xl font-black text-emerald-700">{formatCurrency(totalSell)}</div>
          <p className="text-[11px] text-slate-400 mt-1">This month — freight earnings</p>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400 uppercase">
            <span>Net (Sell − Buy)</span>
            <span className="p-2 rounded-xl bg-sky-50 text-sky-700">
              <Scale className="w-4 h-4" />
            </span>
          </div>
          <div className={`mt-3 text-2xl font-black ${net >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {net < 0 ? `−${formatCurrency(Math.abs(net))}` : formatCurrency(net)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">{monthEntries.length} entr(ies) this month</p>
        </div>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search notes, crops, parties…"
            className="w-full pl-9 pr-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs"
        >
          Search
        </button>
        {appliedQ && (
          <button
            type="button"
            onClick={clearSearch}
            className="px-3 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" /> Clear “{appliedQ}”
          </button>
        )}
      </form>

      {/* Trade Ledger Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">Trade Entries</h3>
          <span className="text-xs text-slate-400 font-semibold">{entries.length} Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 uppercase font-bold text-[10px] tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">Date</th>
                <th className="py-3 px-4">Entry</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Qty</th>
                <th className="py-3 px-4">Notes</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
                    Loading trade diary…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-xs font-semibold text-slate-400">
                    {appliedQ
                      ? `No entries match “${appliedQ}”.`
                      : 'No trade entries yet. Add your first buy or sell note.'}
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="py-3.5 px-6 font-medium text-slate-600">{formatDate(entry.date)}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {entryLabel(entry)}
                      <span className="block text-[10px] font-semibold text-slate-400">{entry.category}</span>
                      {entry.photos && entry.photos.length > 0 && (
                        <span className="mt-1 flex gap-1">
                          {entry.photos.slice(0, 3).map((p, i) => (
                            <a key={i} href={p} target="_blank" rel="noreferrer">
                              <img src={p} alt="" className="w-8 h-8 rounded-lg object-cover border border-slate-200" />
                            </a>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          entry.tradeType === 'buy'
                            ? 'bg-rose-50 text-rose-700 border-rose-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {entry.tradeType === 'buy' ? 'Buy' : 'Sell'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {entry.quantity != null ? entry.quantity : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500 italic max-w-[220px] truncate">{entry.notes || '—'}</td>
                    <td
                      className={`py-3.5 px-4 text-right font-bold text-sm font-mono ${
                        entry.tradeType === 'buy' ? 'text-rose-700' : 'text-emerald-700'
                      }`}
                    >
                      {entry.tradeType === 'buy' ? `−${formatCurrency(entry.amount)}` : `+${formatCurrency(entry.amount)}`}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => openEdit(entry)}
                          className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Edit entry"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={busyId === entry.id}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Entry Modal */}
      <ModalSheet
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          resetForm();
        }}
        title={editingEntry ? 'Edit Trade Entry' : 'Add Trade Note'}
        description="Record a buy (expense) or sell (earning) for your transport business"
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTradeType('buy')}
              className={`py-2.5 rounded-xl font-bold text-xs border transition-all ${
                tradeType === 'buy'
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Buy (खरीद)
            </button>
            <button
              type="button"
              onClick={() => setTradeType('sell')}
              className={`py-2.5 rounded-xl font-bold text-xs border transition-all ${
                tradeType === 'sell'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-slate-200 text-slate-600'
              }`}
            >
              Sell (बिक्री)
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Name / Title</label>
            <input
              type="text"
              placeholder="e.g. Diesel refill at NH-52 pump"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                {TRADE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity</label>
              <input
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Price / Amount (₹)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 text-emerald-800"
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
            <label className="block text-xs font-bold text-slate-700 mb-1">Note (optional)</label>
            <input
              type="text"
              placeholder="Party name, invoice no., vehicle no…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>

          <div className="p-3 border-2 border-dashed border-slate-300 rounded-2xl flex items-center gap-3">
            <Camera className="w-5 h-5 text-slate-400 flex-shrink-0" />
            <div className="flex-1 text-[11px] text-slate-500">
              {photoFile ? photoFile.name : 'Attach a photo (bill / receipt) — optional'}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[11px]"
            >
              Choose
            </button>
          </div>

          <button
            type="submit"
            disabled={photoBusy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-60"
          >
            {photoBusy ? 'Uploading photo…' : editingEntry ? 'Save Changes' : 'Save Trade Entry'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
