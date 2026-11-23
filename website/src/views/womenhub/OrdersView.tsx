import React, { useCallback, useEffect, useState } from 'react';
import { PackageCheck } from 'lucide-react';
import { apiErrorMessage, womenHub } from '../../lib/api';

interface OrderRow {
  id: string;
  businessId: string;
  businessName: string;
  productName: string;
  photo?: string;
  quantity: number;
  pricePaisa: number;
  totalPaisa: number;
  status: string;
  source: 'women_hub' | 'e_market';
  buyerName?: string;
  buyerUid?: string;
  createdAt: string;
}

interface BusinessRow {
  id: string;
  name: string;
  category: string;
  status?: string;
}

const NEXT_ACTION: Record<string, string> = {
  placed: 'Accept order',
  accepted: 'Mark packed',
  packed: 'Mark ready for pickup',
  pickup: 'Mark in transit',
  in_transit: 'Mark delivered',
};

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

export const WomanHubOrdersView: React.FC = () => {
  const [businesses, setBusinesses] = useState<BusinessRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadBusinesses = useCallback(async () => {
    try {
      const items = asArray(await womenHub.myBusinesses()).map((b) => asRecord(b));
      const rows = items.map((b) => ({
        id: String(b.id ?? ''),
        name: String(b.name ?? ''),
        category: String(b.category ?? ''),
        status: String(b.status ?? 'active'),
      }));
      setBusinesses(rows);
      setSelected((current) => current ?? rows[0]?.id ?? null);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  const loadOrders = useCallback(async (businessId: string | null) => {
    if (!businessId) {
      setOrders([]);
      return;
    }
    try {
      const detail = asRecord(await womenHub.businessDetail(businessId));
      setOrders(asArray(detail.orders).map((o) => asRecord(o)) as unknown as OrderRow[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void loadBusinesses();
  }, [loadBusinesses]);

  useEffect(() => {
    void loadOrders(selected);
  }, [selected, loadOrders]);

  const advance = async (order: OrderRow) => {
    const targetMap: Record<string, string> = {
      placed: 'accepted',
      accepted: 'packed',
      packed: 'pickup',
      pickup: 'in_transit',
      in_transit: 'delivered',
    };
    const target = targetMap[order.status];
    if (!target) return;
    setBusyId(order.id);
    setNotice(null);
    try {
      await womenHub.setOrderStatus(order.id, target);
      setNotice(`Order ${order.id} marked ${target}.`);
      await loadOrders(selected);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-800">
          {notice}
        </div>
      )}

      {businesses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center">
          <PackageCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-xs font-bold text-slate-500">Create a business first — orders appear here.</p>
        </div>
      ) : (
        <>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {businesses.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelected(b.id)}
                className={`px-3.5 py-2 text-xs font-semibold rounded-2xl whitespace-nowrap transition-colors ${
                  selected === b.id
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {b.name}
                {b.status === 'paused' ? ' (paused)' : ''}
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {orders.length === 0 && (
              <p className="text-[11px] text-slate-400 text-center py-6">No orders for this business yet.</p>
            )}
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                {order.photo ? (
                  <img src={order.photo} alt="" className="w-14 h-14 rounded-2xl object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <PackageCheck className="w-6 h-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-900 truncate">
                    {order.productName}
                    <span className="ml-2 text-[10px] font-bold text-slate-400">
                      {order.source === 'e_market' ? 'E-market' : order.businessName}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {order.quantity} × ₹{((order.pricePaisa ?? 0) / 100).toFixed(0)} ={' '}
                    <span className="font-bold text-slate-700">₹{((order.totalPaisa ?? 0) / 100).toFixed(0)}</span>
                    {order.buyerName ? ` · ${order.buyerName}` : ''}
                  </p>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700 mt-0.5">
                    {order.status.replace(/_/g, ' ')}
                  </p>
                </div>
                {order.source === 'women_hub' && NEXT_ACTION[order.status] && (
                  <button
                    onClick={() => void advance(order)}
                    disabled={busyId === order.id}
                    className="px-4 py-2 rounded-2xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 shrink-0"
                  >
                    {NEXT_ACTION[order.status]}
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
