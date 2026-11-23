import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, Inbox, ShoppingBag } from 'lucide-react';
import { apiErrorMessage, womenHub } from '../../lib/api';
import { formatPaisa } from '../../lib/utils';
import { asRecords, pickNum, pickStr, Rec } from '../shared/records';

/** xlsx Sr 4.0 — farmer-side order pipeline. */
const PIPELINE = ['placed', 'accepted', 'packed', 'pickup', 'in_transit', 'delivered'];
const LABELS: Record<string, string> = {
  placed: 'Placed',
  accepted: 'Accepted',
  packed: 'Packed',
  pickup: 'Pickup',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

/**
 * My Orders & Track + Requirements (womenhub 21nov.xlsx Part B Sr 4.0/5.0) —
 * orders placed to Women Hub businesses with the exact status pipeline
 * (placed → accepted → packed → pickup → in transit → delivered, cancel
 * before acceptance) and the enquiry history with pending/responded status.
 */
export const WomenHubOrdersView: React.FC = () => {
  const [tab, setTab] = useState<'orders' | 'requirements'>('orders');
  const [orders, setOrders] = useState<Rec[] | null>(null);
  const [enquiries, setEnquiries] = useState<Rec[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [orderRows, enquiryRows] = await Promise.all([
        womenHub.myOrders(),
        womenHub.myEnquiries(),
      ]);
      setOrders(asRecords(orderRows));
      setEnquiries(asRecords(enquiryRows));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const cancel = async (orderId: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await womenHub.cancelOrder(orderId);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <ShoppingBag className="w-7 h-7 text-pink-600" />
          Women Hub — My Orders &amp; Requirements
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Track orders placed with Women Hub businesses and follow up on the requirements you
          posted.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border p-3 text-xs flex items-start gap-2 bg-rose-50 border-rose-200 text-rose-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2 text-xs font-bold">
        <button
          onClick={() => setTab('orders')}
          className={`px-4 py-2 rounded-xl ${
            tab === 'orders' ? 'bg-pink-600 text-white' : 'bg-white border border-slate-200 text-slate-500'
          }`}
        >
          My Orders ({orders?.length ?? 0})
        </button>
        <button
          onClick={() => setTab('requirements')}
          className={`px-4 py-2 rounded-xl ${
            tab === 'requirements'
              ? 'bg-pink-600 text-white'
              : 'bg-white border border-slate-200 text-slate-500'
          }`}
        >
          My Requirements ({enquiries?.length ?? 0})
        </button>
      </div>

      {tab === 'orders' &&
        (orders === null ? (
          <p className="text-xs text-slate-400">Loading orders…</p>
        ) : orders.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 text-center">
            No orders yet — discover Women Hub businesses and place your first order.{' '}
            <Link to="/farmer/women-hub" className="font-bold text-pink-700 hover:underline">
              Browse businesses
            </Link>
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const status = pickStr(o, 'status');
              const stageIdx = PIPELINE.indexOf(status);
              return (
                <div
                  key={pickStr(o, 'id')}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {pickStr(o, 'productName')} × {pickNum(o, 'quantity')}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {pickStr(o, 'businessName')} · {formatPaisa(pickNum(o, 'totalPaisa'))}
                      </p>
                    </div>
                    {status === 'placed' && (
                      <button
                        onClick={() => void cancel(pickStr(o, 'id'))}
                        disabled={busy}
                        className="px-3 py-1.5 border border-rose-300 text-rose-600 text-[11px] font-bold rounded-lg disabled:opacity-40"
                      >
                        Cancel
                      </button>
                    )}
                  </div>

                  {status === 'cancelled' ? (
                    <p className="text-[11px] font-bold text-rose-600">Cancelled</p>
                  ) : (
                    <div className="flex items-center gap-1">
                      {PIPELINE.map((stage, idx) => (
                        <div key={stage} className="flex items-center gap-1 flex-1">
                          <div
                            className={`h-2 flex-1 rounded-full ${
                              idx <= stageIdx ? 'bg-pink-500' : 'bg-slate-200'
                            }`}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                  {status !== 'cancelled' && (
                    <p className="text-[11px] font-bold text-pink-700">{LABELS[status]}</p>
                  )}
                </div>
              );
            })}
          </div>
        ))}

      {tab === 'requirements' &&
        (enquiries === null ? (
          <p className="text-xs text-slate-400">Loading requirements…</p>
        ) : enquiries.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-8 text-center flex items-center justify-center gap-2">
            <Inbox className="w-4 h-4" /> No requirements posted yet.
          </p>
        ) : (
          <div className="space-y-3">
            {enquiries.map((e) => (
              <div
                key={pickStr(e, 'id')}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold text-slate-900">
                    {pickStr(e, 'productName') || 'General'} — {pickStr(e, 'quantity')}
                  </p>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      pickStr(e, 'status') === 'responded'
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                        : 'bg-amber-50 border border-amber-200 text-amber-700'
                    }`}
                  >
                    {pickStr(e, 'status')}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">
                  To <b>{pickStr(e, 'businessName')}</b>: {pickStr(e, 'message')}
                </p>
                {pickStr(e, 'response') && (
                  <p className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl p-2">
                    Response: {pickStr(e, 'response')}
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
};
