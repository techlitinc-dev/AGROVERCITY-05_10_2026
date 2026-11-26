import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, Package } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';

interface StockRow {
  productId: string;
  title: string;
  availability: number;
  reserved: number;
  lowStockThreshold: number;
  lowStock: boolean;
}

interface Movement {
  id: string;
  productTitle?: string;
  kind: string;
  quantity: number;
  before: number;
  after: number;
  reason?: string;
  createdAt: string;
}

export const StockView: React.FC = () => {
  const [rows, setRows] = useState<StockRow[]>([]);
  const [alerts, setAlerts] = useState<StockRow[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [form, setForm] = useState({ productId: '', kind: 'in', quantity: '1', reason: '' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const overview = (await agriMarketSeller.stock()) as { items: StockRow[]; lowStockAlerts: StockRow[] };
      setRows(overview.items);
      setAlerts(overview.lowStockAlerts);
      setMovements((await agriMarketSeller.stockMovements()) as unknown as Movement[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    if (!form.productId || !form.quantity) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await agriMarketSeller.addStockEntry({
        productId: form.productId,
        kind: form.kind,
        quantity: Number(form.quantity),
        reason: form.reason,
      });
      setNotice('Stock entry recorded.');
      setForm({ productId: '', kind: 'in', quantity: '1', reason: '' });
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const field =
    'w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600';

  return (
    <div className="space-y-4">
      {error && <p className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</p>}
      {notice && <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">{notice}</p>}

      {alerts.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-4">
          <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5 mb-1">
            <BellRing className="w-4 h-4" /> Low-stock alerts
          </p>
          <ul className="text-[11px] text-amber-800 space-y-0.5">
            {alerts.map((a) => (
              <li key={a.productId}>
                {a.title} — {a.availability} left (threshold {a.lowStockThreshold})
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-black text-slate-900 mb-3">Stock in / out entry</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <label className="block col-span-2">
            <span className="text-[11px] font-bold text-slate-500">Product</span>
            <select className={field} value={form.productId} onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}>
              <option value="">Select product…</option>
              {rows.map((r) => (
                <option key={r.productId} value={r.productId}>
                  {r.title} — {r.availability} in stock
                </option>
              ))}
            </select>
            {rows.length === 0 && (
              <span className="block mt-1 text-[11px] text-amber-700 font-bold">
                No products yet — add one in My Products first to record stock.
              </span>
            )}
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Kind</span>
            <select className={field} value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))}>
              <option value="in">Stock in</option>
              <option value="out">Stock out</option>
              <option value="adjust">Adjust to count</option>
            </select>
          </label>
          <label className="block">
            <span className="text-[11px] font-bold text-slate-500">Quantity</span>
            <input className={field} type="number" min={0} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
          </label>
          <label className="block col-span-2 sm:col-span-3">
            <span className="text-[11px] font-bold text-slate-500">Reason</span>
            <input className={field} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} placeholder="fresh batch / damaged / physical count" />
          </label>
        </div>
        <button
          onClick={() => void submit()}
          disabled={busy || !form.productId}
          className="mt-3 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Record entry'}
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-black text-slate-900 mb-3">Availability &amp; reserved</p>
        <div className="space-y-1.5">
          {rows.map((r) => (
            <div key={r.productId} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-slate-400" /> {r.title}
              </span>
              <span className={r.lowStock ? 'font-bold text-amber-700' : 'text-slate-500'}>
                {r.availability} available · {r.reserved} reserved
              </span>
            </div>
          ))}
          {rows.length === 0 && <p className="text-[11px] text-slate-400">No products yet.</p>}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
        <p className="text-xs font-black text-slate-900 mb-3">Movements &amp; adjustment history</p>
        <div className="space-y-1.5">
          {movements.slice(0, 30).map((m) => (
            <div key={m.id} className="flex items-center justify-between text-[11px] border-b border-slate-100 pb-1.5">
              <span className="text-slate-700">
                <span className="font-bold">{m.productTitle}</span> — {m.kind} {m.quantity}
                {m.reason ? ` · ${m.reason}` : ''}
              </span>
              <span className="text-slate-400">
                {m.before} → {m.after}
              </span>
            </div>
          ))}
          {movements.length === 0 && <p className="text-[11px] text-slate-400">No stock movements yet.</p>}
        </div>
      </div>
    </div>
  );
};
