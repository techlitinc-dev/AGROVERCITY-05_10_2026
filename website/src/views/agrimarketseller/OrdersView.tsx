import React, { useCallback, useEffect, useState } from 'react';
import { Truck } from 'lucide-react';
import { apiErrorMessage, agriMarketSeller } from '../../lib/api';
import { download } from '../../lib/api';

interface OrderRow {
  id: string;
  userId?: string;
  buyerName?: string;
  status: string;
  total?: number;
  items?: { title?: string; quantity?: number; price?: number }[];
  createdAt?: string;
  dispatchDate?: string;
  deliveryPartner?: string;
  trackingRef?: string;
  address?: unknown;
  paymentMethod?: string;
  paymentStatus?: string;
  events?: { status?: string; at?: string; note?: string }[];
}

function fmtAddress(a: unknown): string {
  if (!a) return '';
  if (typeof a === 'string') return a;
  if (typeof a === 'object') {
    const o = a as Record<string, unknown>;
    const parts = ['name', 'phone', 'line1', 'line2', 'village', 'taluka', 'district', 'state', 'pincode']
      .map((k) => o[k])
      .filter((v): v is string => typeof v === 'string' && !!v);
    return parts.join(', ');
  }
  return '';
}

const NEXT_ACTION: Record<string, string> = {
  placed: 'Accept order',
  paid: 'Accept order',
  confirmed: 'Mark processed',
  shipped: 'Mark shipped',
  out_for_delivery: 'Mark delivered',
};

const ACTION_MAP: Record<string, string> = {
  'Accept order': 'accept',
  'Mark processed': 'process',
  'Mark packed': 'pack',
  'Mark shipped': 'ship',
  'Mark delivered': 'deliver',
};

export const OrdersView: React.FC = () => {
  const [items, setItems] = useState<OrderRow[]>([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [dispatchFor, setDispatchFor] = useState<OrderRow | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ dispatchDate: '', deliveryPartner: '', trackingRef: '' });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems((await agriMarketSeller.orders(filter || undefined)) as unknown as OrderRow[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (order: OrderRow, action: string) => {
    setBusyId(order.id);
    setError(null);
    setNotice(null);
    try {
      await agriMarketSeller.orderAction(order.id, action);
      setNotice(`Order ${order.id} — ${action} done.`);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const openDispatch = async (order: OrderRow) => {
    setDispatchFor(order);
    try {
      const d = (await agriMarketSeller.dispatch(order.id)) as Record<string, unknown>;
      setDispatchForm({
        dispatchDate: String(d.dispatchDate ?? ''),
        deliveryPartner: String(d.deliveryPartner ?? ''),
        trackingRef: String(d.trackingRef ?? ''),
      });
    } catch {
      setDispatchForm({ dispatchDate: '', deliveryPartner: '', trackingRef: '' });
    }
  };

  const saveDispatch = async () => {
    if (!dispatchFor) return;
    setBusyId(dispatchFor.id);
    try {
      await agriMarketSeller.saveDispatch(dispatchFor.id, dispatchForm);
      setNotice('Dispatch details saved.');
      setDispatchFor(null);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const invoice = async (orderId: string) => {
    try {
      const blob = await download(`/orders/${orderId}/invoice.pdf`);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">{error}</p>}
      {notice && <p className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">{notice}</p>}

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {['', 'placed', 'confirmed', 'shipped', 'out_for_delivery', 'delivered', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3.5 py-2 text-xs font-semibold rounded-2xl whitespace-nowrap transition-colors ${
              filter === s ? 'bg-emerald-600 text-white font-bold' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {items.map((order) => (
          <div key={order.id} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black text-slate-900">
                  #{order.id.replace(/^ord_/, '').toUpperCase()}
                  <span className="ml-2 text-[10px] font-bold text-slate-400">{order.buyerName || order.userId}</span>
                </p>
                <p className="text-[11px] text-slate-500">
                  {(order.items ?? []).map((i) => `${i.title} × ${i.quantity}`).join(', ')} · ₹{order.total ?? 0}
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                {order.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {NEXT_ACTION[order.status] && (
                <button
                  onClick={() => void act(order, ACTION_MAP[NEXT_ACTION[order.status]])}
                  disabled={busyId === order.id}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold disabled:opacity-50"
                >
                  {NEXT_ACTION[order.status]}
                </button>
              )}
              {['placed', 'paid', 'confirmed'].includes(order.status) && (
                <button
                  onClick={() => void act(order, 'reject')}
                  disabled={busyId === order.id}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 text-rose-600 text-[11px] font-bold disabled:opacity-50"
                >
                  Reject
                </button>
              )}
              <button
                onClick={() => void openDispatch(order)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold flex items-center gap-1"
              >
                <Truck className="w-3 h-3" /> Dispatch
              </button>
              <button
                onClick={() => void invoice(order.id)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-slate-600 text-[11px] font-bold"
              >
                Invoice (PDF)
              </button>
              <button
                onClick={() => setExpandedId((v) => (v === order.id ? null : order.id))}
                className="px-3 py-1.5 rounded-xl border border-emerald-200 text-emerald-700 text-[11px] font-bold"
              >
                {expandedId === order.id ? 'Hide details' : 'View details'}
              </button>
            </div>
            {expandedId === order.id && (
              <div className="border-t border-slate-100 pt-3 space-y-2 text-[11px] text-slate-600">
                {order.createdAt && (
                  <p>
                    <span className="font-bold text-slate-700">Ordered:</span>{' '}
                    {order.createdAt.slice(0, 16).replace('T', ' ')}
                  </p>
                )}
                <div className="rounded-2xl border border-slate-100 overflow-hidden">
                  {(order.items ?? []).map((item, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-3 py-1.5 border-b border-slate-100 last:border-b-0"
                    >
                      <span className="font-bold text-slate-800">{item.title}</span>
                      <span>
                        {item.quantity ?? 0} × ₹{item.price ?? 0} = ₹
                        {((item.quantity ?? 0) * (item.price ?? 0)).toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 font-bold text-slate-800">
                    <span>Total</span>
                    <span>₹{(order.total ?? 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <p>
                  <span className="font-bold text-slate-700">Buyer:</span> {order.buyerName || order.userId}
                </p>
                {fmtAddress(order.address) && (
                  <p>
                    <span className="font-bold text-slate-700">Delivery address:</span> {fmtAddress(order.address)}
                  </p>
                )}
                {(order.paymentMethod || order.paymentStatus) && (
                  <p>
                    <span className="font-bold text-slate-700">Payment:</span>{' '}
                    {[order.paymentMethod, order.paymentStatus].filter(Boolean).join(' · ')}
                  </p>
                )}
                {(order.dispatchDate || order.deliveryPartner || order.trackingRef) && (
                  <p>
                    <span className="font-bold text-slate-700">Dispatch:</span>{' '}
                    {[
                      order.dispatchDate ? `date ${order.dispatchDate}` : '',
                      order.deliveryPartner ? `partner ${order.deliveryPartner}` : '',
                      order.trackingRef ? `tracking ${order.trackingRef}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                {(order.events ?? []).length > 0 && (
                  <div>
                    <p className="font-bold text-slate-700 mb-1">Status history:</p>
                    <ul className="space-y-0.5">
                      {(order.events ?? []).map((ev, idx) => (
                        <li key={idx}>
                          • {(ev.status ?? '').replace(/_/g, ' ')}
                          {ev.at ? ` — ${ev.at.slice(0, 16).replace('T', ' ')}` : ''}
                          {ev.note ? ` (${ev.note})` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-400 text-center py-6">No orders in this bucket.</p>}
      </div>

      {dispatchFor && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs p-5 space-y-3">
          <p className="text-xs font-black text-slate-900">Delivery &amp; dispatch — #{dispatchFor.id.replace(/^ord_/, '').toUpperCase()}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              type="date"
              className="px-3 py-2.5 text-xs rounded-xl border border-slate-300"
              value={dispatchForm.dispatchDate}
              onChange={(e) => setDispatchForm((f) => ({ ...f, dispatchDate: e.target.value }))}
            />
            <input
              className="px-3 py-2.5 text-xs rounded-xl border border-slate-300"
              placeholder="Delivery partner"
              value={dispatchForm.deliveryPartner}
              onChange={(e) => setDispatchForm((f) => ({ ...f, deliveryPartner: e.target.value }))}
            />
            <input
              className="px-3 py-2.5 text-xs rounded-xl border border-slate-300"
              placeholder="Tracking reference"
              value={dispatchForm.trackingRef}
              onChange={(e) => setDispatchForm((f) => ({ ...f, trackingRef: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void saveDispatch()}
              disabled={busyId === dispatchFor.id}
              className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
            >
              Save dispatch
            </button>
            <button onClick={() => setDispatchFor(null)} className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
