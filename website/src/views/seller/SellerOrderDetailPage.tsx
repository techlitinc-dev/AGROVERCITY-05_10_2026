import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Package, XCircle, RotateCcw, Receipt } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { mall, seller, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import {
  arr,
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  num,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

const NEXT: Record<string, { status: string; label: string }> = {
  placed: { status: 'confirmed', label: 'Confirm Order' },
  paid: { status: 'confirmed', label: 'Confirm Order' },
  confirmed: { status: 'shipped', label: 'Mark Shipped' },
  shipped: { status: 'out_for_delivery', label: 'Out for Delivery' },
  out_for_delivery: { status: 'delivered', label: 'Mark Delivered' },
};

/** Order detail for a seller's marketplace order: timeline + status + cancel. */
export const SellerOrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Rec | null>(null);
  const [timeline, setTimeline] = useState<Rec[]>([]);
  const [bnpl, setBnpl] = useState<Rec | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const [o, t] = await Promise.all([
        mall.order(id),
        mall.orderTimeline(id).catch(() => [] as unknown[]),
      ]);
      const ord = rec(o);
      setOrder(ord);
      setTimeline((t as unknown[]).map(rec));
      if (ord.paymentMethod === 'bnpl') {
        setBnpl(rec(await mall.bnplSchedule(id).catch(() => null)));
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const [noteModal, setNoteModal] = useState<{ status: string; label: string } | null>(null);
  const [statusNote, setStatusNote] = useState('');
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  const doStatus = async () => {
    if (!noteModal || !id) return;
    setActionError(null);
    try {
      await seller.updateOrderStatus(id, noteModal.status, statusNote || undefined);
      setNoteModal(null);
      setStatusNote('');
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e));
    }
  };

  const doCancel = async () => {
    if (!id) return;
    setActionError(null);
    try {
      await mall.cancelOrder(id, cancelReason || undefined);
      setCancelModal(false);
      await load();
    } catch (e) {
      setActionError(apiErrorMessage(e));
    }
  };

  const items = arr(order?.items).map(rec);
  const status = str(order?.status, 'placed');
  const events = arr(order?.events).map(rec);
  const schedule = arr(bnpl?.bnplSchedule).map(rec);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
        <Link to="/seller/orders" className={ghostBtnCls}>
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Package className="w-7 h-7 text-emerald-600" />
            Order #{id}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Marketplace order timeline & fulfilment control</p>
        </div>
        {order && <StatusBadge status={status} />}
      </div>

      <ErrorBanner message={error ?? actionError} />
      {loading && <LoadingBlock />}

      {!loading && order && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-3 space-y-4">
            {/* items */}
            <div className={`${cardCls} p-6 space-y-4`}>
              <h3 className="font-bold text-sm text-slate-900">Items</h3>
              {items.length === 0 ? (
                <EmptyState label="No item detail on this order" />
              ) : (
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{str(it.title || it.name, 'Item')}</p>
                        <p className="text-[11px] text-slate-400">
                          Qty {num(it.qty, num(it.quantity, 1))} × {formatCurrency(num(it.price, num(it.unitPrice)))}
                        </p>
                      </div>
                      <span className="font-black text-emerald-800">
                        {formatCurrency(num(it.qty, num(it.quantity, 1)) * num(it.price, num(it.unitPrice)))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex justify-between border-t border-slate-100 pt-3 text-sm font-black text-slate-900">
                <span>Total {order.paymentMethod ? `· ${str(order.paymentMethod)}` : ''}</span>
                <span className="text-emerald-800">{formatCurrency(num(order.finalTotal, num(order.total)))}</span>
              </div>
            </div>

            {/* BNPL */}
            {schedule.length > 0 && (
              <div className={`${cardCls} p-6 space-y-3`}>
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-emerald-600" /> BNPL Installment Schedule
                </h3>
                <div className="space-y-2">
                  {schedule.map((s, i) => (
                    <div key={i} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl text-xs">
                      <span>
                        Installment {num(s.installmentNo, i + 1)} · due {str(s.dueDate, '')}
                      </span>
                      <span className="flex items-center gap-2 font-bold">
                        {formatCurrency(num(s.amount))}
                        <StatusBadge status={str(s.status, 'pending')} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* actions */}
            <div className="flex flex-wrap gap-2">
              {NEXT[status] && (
                <button onClick={() => setNoteModal(NEXT[status])} className={primaryBtnCls}>
                  {NEXT[status].label}
                </button>
              )}
              {!['delivered', 'cancelled'].includes(status) && (
                <button onClick={() => setCancelModal(true)} className={`${ghostBtnCls} text-rose-700 border-rose-200 hover:bg-rose-50`}>
                  <XCircle className="w-3.5 h-3.5 inline mr-1" /> Cancel Order
                </button>
              )}
              <button onClick={() => void load()} className={ghostBtnCls}>
                <RotateCcw className="w-3.5 h-3.5 inline mr-1" /> Refresh
              </button>
            </div>
          </div>

          {/* timeline */}
          <div className="lg:col-span-2">
            <div className={`${cardCls} p-6 space-y-4`}>
              <h3 className="font-bold text-sm text-slate-900">Timeline</h3>
              {timeline.length === 0 && events.length === 0 ? (
                <EmptyState label="No timeline events yet" />
              ) : (
                <ol className="relative border-l-2 border-slate-100 ml-2 space-y-4">
                  {(timeline.length > 0 ? timeline : events).map((ev, i) => (
                    <li key={i} className="ml-4">
                      <span className="absolute -left-[7px] mt-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                      <p className="text-xs font-bold text-slate-900 capitalize">{str(ev.status || ev.event, 'Event')}</p>
                      <p className="text-[11px] text-slate-400">
                        {formatDateTime(str(ev.at || ev.timestamp || ev.createdAt))}
                        {ev.note ? ` — ${str(ev.note)}` : ''}
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      {/* status note modal */}
      <ModalSheet isOpen={Boolean(noteModal)} onClose={() => setNoteModal(null)} title={noteModal?.label} maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Note (optional)</label>
            <input className={inputCls} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} placeholder="e.g. Packed 40kg bags, ready for pickup" />
          </div>
          <ErrorBanner message={actionError} />
          <button onClick={() => void doStatus()} className={`${primaryBtnCls} w-full py-3`}>
            Confirm {noteModal?.label}
          </button>
        </div>
      </ModalSheet>

      {/* cancel modal */}
      <ModalSheet isOpen={cancelModal} onClose={() => setCancelModal(false)} title="Cancel Order" description="Cancelling notifies the customer and reverses any payment per policy" maxWidth="sm">
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Reason</label>
            <textarea rows={2} className={inputCls} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button onClick={() => void doCancel()} className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs">
            Confirm Cancellation
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
