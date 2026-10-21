import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import QRCode from 'qrcode';
import {
  AlertCircle,
  ArrowLeft,
  BadgeIndianRupee,
  Check,
  ClipboardCheck,
  Handshake,
  Package,
  QrCode,
  ShieldCheck,
  Sprout,
  UserX,
  XCircle,
} from 'lucide-react';
import { apiErrorMessage, customer } from '../../lib/api';
import { formatCurrency, formatDateTime, formatPaisa } from '../../lib/utils';
import { asRecord, num, str, type AnyRecord } from './mallMappers';

interface ProcurementOrder extends AnyRecord {
  id?: string;
  crop?: string;
  grade?: string;
  farmerId?: string;
  farmerName?: string;
  quantityQuintals?: number;
  pricePerQuintal?: number;
  totalAmountRupees?: number;
  status?: string;
  escrowStatus?: string;
  depositPaisa?: number;
  parentOrderId?: string;
  lotId?: string;
  lotIds?: string[];
  logisticsMode?: string;
  statusTimeline?: Array<{ status?: string; at?: string }>;
  inspection?: { damagePct?: number; gradeMatch?: boolean; inspectionOutcome?: string; inspectedAt?: string } | null;
  deliveredAt?: string;
}

const STATUS_TONE: Record<string, string> = {
  created: 'bg-slate-100 text-slate-600',
  confirmed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  deposit_pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  in_fulfillment: 'bg-sky-50 text-sky-700 border border-sky-200',
  dispatched: 'bg-sky-50 text-sky-700 border border-sky-200',
  delivered: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  disputed: 'bg-rose-50 text-rose-700 border border-rose-200',
  settled: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
  cancelled: 'bg-slate-100 text-slate-400',
};

function escrowLabel(status?: string): string {
  switch (status) {
    case 'funded':
      return 'Deposit held in escrow';
    case 'released':
      return 'Escrow released to farmer';
    case 'refunded':
      return 'Escrow refunded to you';
    case 'frozen':
      return 'Escrow frozen (dispute)';
    default:
      return 'No deposit held';
  }
}

// ---------------------------------------------------------------- list view

export const CustomerProcurementsView: React.FC = () => {
  const [orders, setOrders] = useState<ProcurementOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    customer
      .orders()
      .then((payload) => {
        if (!mounted) return;
        const list = (Array.isArray(payload) ? payload : []) as ProcurementOrder[];
        const children = list
          .filter((o) => !o.isParent)
          .sort((a, b) => str(b.createdAt).localeCompare(str(a.createdAt)));
        setOrders(children);
      })
      .catch((e) => {
        if (mounted) setError(apiErrorMessage(e));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/customer/orders"
        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700"
      >
        <ArrowLeft className="w-4 h-4" />
        All Orders
      </Link>

      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Sprout className="w-7 h-7 text-emerald-600" />
          FarmGate Procurements
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Bulk produce orders with escrow protection, QR custody handover and a 72h inspection window
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-3xl border border-slate-200/80 p-5 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-3 bg-slate-100 rounded w-2/3 mt-2" />
            </div>
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-400 flex items-center justify-center mx-auto">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="font-extrabold text-base text-slate-800">No procurements yet</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Accept a farmer quote or check out a multi-farmer produce cart — every order is escrow-protected.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/customer/quotes"
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Open Quote Inbox
            </Link>
            <Link
              to="/customer/produce"
              className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
            >
              Browse Produce
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link
              key={str(order.id)}
              to={`/customer/procurements/${str(order.id)}`}
              className="block bg-white rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md hover:border-emerald-200 transition-all p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">
                    {str(order.crop, 'Produce')}
                    {order.grade ? <span className="text-slate-400 font-bold"> · {order.grade}</span> : null}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {order.farmerName || 'Farmer'} · {num(order.quantityQuintals)} q ·{' '}
                    {formatCurrency(num(order.pricePerQuintal))}/q
                  </p>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
                    STATUS_TONE[str(order.status)] ?? 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {str(order.status, '—').replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-3 border-t border-slate-100">
                <span className="text-sm font-black text-emerald-800">
                  {formatCurrency(num(order.totalAmountRupees))}
                  <span className="text-[10px] font-semibold text-slate-400 ml-2">{escrowLabel(order.escrowStatus)}</span>
                </span>
                <span className="text-[11px] font-bold text-emerald-700">Manage →</span>
              </div>
              {order.parentOrderId && (
                <p className="text-[10px] text-slate-400 mt-1.5">
                  Part of consolidated order #{order.parentOrderId.replace(/^ord_/, '').toUpperCase()}
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

// --------------------------------------------------------------- detail view

export const CustomerProcurementDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<ProcurementOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Inspection checklist form (E5 matrix).
  const [damagePct, setDamagePct] = useState(0);
  const [gradeMatch, setGradeMatch] = useState(true);
  const [photoUrls, setPhotoUrls] = useState('');
  const [inspectionNotes, setInspectionNotes] = useState('');
  const [inspectionBusy, setInspectionBusy] = useState(false);

  // QR custody handover.
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [qrBusy, setQrBusy] = useState(false);

  // Cancel + no-show.
  const [showCancel, setShowCancel] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [noShowBusy, setNoShowBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const payload = (await customer.orders()) as ProcurementOrder[];
      const list = Array.isArray(payload) ? payload : [];
      const found = list.find((o) => o.id === id);
      if (!found) {
        setError('Procurement not found — it may belong to another account.');
      } else {
        setOrder(found);
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

  useEffect(() => {
    if (!showQr || !id) return;
    QRCode.toDataURL(
      JSON.stringify({ type: 'farmgate_handover', orderId: id, at: new Date().toISOString() })
    )
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [showQr, id]);

  const handleInspection = async () => {
    if (!id || inspectionBusy) return;
    setInspectionBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = asRecord(
        await customer.orderInspection(id, {
          damagePct,
          gradeMatch,
          photoUrls: photoUrls
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean),
          notes: inspectionNotes,
        })
      );
      setNotice(
        `Inspection recorded — outcome ${str(updated.inspectionOutcome, 'normal')}. ` +
          (updated.inspectionOutcome === 'dispute'
            ? 'Escrow is frozen while the dispute is reviewed.'
            : 'The deposit has been released to the farmer.')
      );
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setInspectionBusy(false);
    }
  };

  const handleQrHandover = async () => {
    if (!id || qrBusy) return;
    setQrBusy(true);
    setError(null);
    setNotice(null);
    try {
      await customer.orderQrHandover(id, {});
      setShowQr(false);
      setNotice('Custody transferred — QR handover verified and escrow released.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setQrBusy(false);
    }
  };

  const handleCancel = async () => {
    if (!id || cancelBusy) return;
    setCancelBusy(true);
    setError(null);
    setNotice(null);
    try {
      const updated = asRecord(await customer.cancelOrder(id));
      setShowCancel(false);
      // Penalty copy straight from the API response (E2): a late customer
      // cancellation compensates the farmer 5–10% of the order value.
      const penalty = num(updated.farmerCompensationPaisa);
      setNotice(
        penalty > 0
          ? `Order cancelled. A ${formatPaisa(penalty)} penalty (${formatCurrency(
              penalty / 100
            )}) applies as farmer compensation; the prepaid remainder refunds to source.`
          : 'Order cancelled within the free window — the held deposit refunds to source.'
      );
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setCancelBusy(false);
    }
  };

  const handleNoShow = async () => {
    if (!id || noShowBusy) return;
    setNoShowBusy(true);
    setError(null);
    setNotice(null);
    try {
      await customer.reportNoShow(id);
      setNotice('Farmer no-show reported — 10% credited to you and the deposit refunded.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setNoShowBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-4 animate-pulse">
        <div className="h-6 bg-slate-100 rounded w-40" />
        <div className="h-40 bg-slate-100 rounded-3xl" />
        <div className="h-64 bg-slate-100 rounded-3xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-4">
        <h3 className="font-extrabold text-base text-slate-800">Procurement not found</h3>
        <p className="text-xs text-slate-500">{error ?? 'It may belong to another account.'}</p>
        <Link
          to="/customer/procurements"
          className="inline-block px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl"
        >
          Back to Procurements
        </Link>
      </div>
    );
  }

  const status = str(order.status);
  const timeline = Array.isArray(order.statusTimeline) ? order.statusTimeline : [];
  const cancellable = ['created', 'confirmed', 'deposit_pending'].includes(status);
  const inspectable = status === 'delivered' && !order.inspection;
  const inspectionRecord: {
    damagePct?: number;
    gradeMatch?: boolean;
    inspectionOutcome?: string;
    inspectedAt?: string;
  } | null = order.inspection ?? null;
  const farmerCompensationPaisa = num(order.farmerCompensationPaisa);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link
        to="/customer/procurements"
        className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700"
      >
        <ArrowLeft className="w-4 h-4" />
        All Procurements
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Sprout className="w-7 h-7 text-emerald-600" />
            {str(order.crop, 'Produce')}
            {order.grade ? <span className="text-base text-slate-400">· {order.grade}</span> : null}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {order.farmerName || 'Farmer'} · {num(order.quantityQuintals)} q ×{' '}
            {formatCurrency(num(order.pricePerQuintal))}/q ·{' '}
            {str(order.logisticsMode, '').replace(/_/g, ' ') || 'standard logistics'}
          </p>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${
            STATUS_TONE[status] ?? 'bg-slate-100 text-slate-600'
          }`}
        >
          {status.replace(/_/g, ' ')}
        </span>
      </div>

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-600" />
          {notice}
        </div>
      )}

      {/* Money + escrow */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-2">
        <div className="flex justify-between text-xs text-slate-600">
          <span>Order value:</span>
          <span className="font-bold text-slate-800">{formatCurrency(num(order.totalAmountRupees))}</span>
        </div>
        {num(order.depositPaisa) > 0 && (
          <div className="flex justify-between text-xs text-slate-600">
            <span>Escrow deposit (20%):</span>
            <span className="font-bold text-slate-800">{formatPaisa(num(order.depositPaisa))}</span>
          </div>
        )}
        <div className="flex justify-between text-xs text-slate-600 pt-1 border-t border-slate-100">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            Escrow status:
          </span>
          <span className="font-bold text-emerald-800">{escrowLabel(order.escrowStatus)}</span>
        </div>
        <p className="text-[10px] text-slate-400 pt-1">
          The deposit auto-releases to the farmer 72h after delivery unless you open a dispute.
        </p>
      </div>

      {/* Timeline */}
      {timeline.length > 0 && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-4">Status Timeline</h3>
          <ol className="relative border-l-2 border-slate-100 ml-2 space-y-4">
            {[...timeline].reverse().map((event, idx) => (
              <li key={idx} className="ml-4">
                <span
                  className={`absolute -left-[7px] mt-1 w-3 h-3 rounded-full border-2 ${
                    idx === 0 ? 'bg-emerald-500 border-emerald-500' : 'bg-white border-slate-300'
                  }`}
                />
                <p className="text-xs font-bold text-slate-800">{str(event.status, '—').replace(/_/g, ' ')}</p>
                <p className="text-[10px] text-slate-400">{formatDateTime(str(event.at))}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Inspection checklist (E5) */}
      {inspectable && (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 space-y-3">
          <h3 className="font-bold text-sm text-amber-900 flex items-center gap-1.5">
            <ClipboardCheck className="w-4 h-4 text-amber-600" />
            Delivery Inspection — within 72h of delivery
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-[11px] font-bold text-amber-800">
              Damage (%)
              <input
                type="range"
                min="0"
                max="100"
                value={damagePct}
                onChange={(e) => setDamagePct(parseInt(e.target.value, 10))}
                className="w-full accent-amber-600"
              />
              <span className="block text-amber-700">{damagePct}%</span>
            </label>
            <label className="flex items-center gap-2 text-[11px] font-bold text-amber-800 pt-4">
              <input
                type="checkbox"
                checked={gradeMatch}
                onChange={(e) => setGradeMatch(e.target.checked)}
                className="accent-amber-600"
              />
              Grade matches the agreed specification
            </label>
          </div>
          <input
            type="text"
            value={photoUrls}
            onChange={(e) => setPhotoUrls(e.target.value)}
            placeholder="Photo URLs (comma separated, optional)"
            className="w-full px-3 py-2 text-xs rounded-xl border border-amber-200 focus:outline-none focus:border-amber-500"
          />
          <textarea
            rows={2}
            value={inspectionNotes}
            onChange={(e) => setInspectionNotes(e.target.value)}
            placeholder="Inspection notes"
            className="w-full px-3 py-2 text-xs rounded-xl border border-amber-200 focus:outline-none focus:border-amber-500"
          />
          <p className="text-[10px] text-amber-700">
            ≤5% damage releases the full deposit; 6–20% deducts pro-rata; &gt;20% or a grade mismatch opens a
            dispute and freezes escrow.
          </p>
          <button
            type="button"
            onClick={() => void handleInspection()}
            disabled={inspectionBusy}
            className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            <ClipboardCheck className="w-4 h-4" />
            {inspectionBusy ? 'Saving…' : 'Submit inspection'}
          </button>
        </div>
      )}
      {inspectionRecord && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-1.5">
          <h3 className="font-bold text-sm text-slate-900">Inspection Record</h3>
          <p className="text-xs text-slate-600">
            Outcome: <strong>{str(inspectionRecord.inspectionOutcome, '—')}</strong> · Damage{' '}
            {num(inspectionRecord.damagePct)}% · Grade match{' '}
            {inspectionRecord.gradeMatch ? 'yes' : 'no'} · {formatDateTime(str(inspectionRecord.inspectedAt))}
          </p>
        </div>
      )}

      {/* QR handover */}
      {['confirmed', 'deposit_pending', 'in_fulfillment', 'dispatched', 'delivered'].includes(status) &&
        order.escrowStatus !== 'released' && (
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <QrCode className="w-4 h-4 text-emerald-600" />
              QR Custody Handover
            </h3>
            <p className="text-[11px] text-slate-500">
              Show this code to the farmer at pickup/delivery. Verifying the handover releases the escrow
              immediately — no need to wait for the 72h window.
            </p>
            {showQr ? (
              <div className="flex flex-col items-center gap-3">
                {qrDataUrl ? (
                  <img src={qrDataUrl} alt="Handover QR" className="w-44 h-44 rounded-2xl border border-slate-200" />
                ) : (
                  <p className="text-xs text-slate-400">Generating code…</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQr(false)}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-600"
                  >
                    Hide
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleQrHandover()}
                    disabled={qrBusy}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 font-bold text-xs text-white disabled:opacity-50"
                  >
                    {qrBusy ? 'Verifying…' : 'Mark handover complete'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowQr(true)}
                className="px-4 py-2.5 rounded-xl border border-emerald-200 text-emerald-700 hover:bg-emerald-50 font-bold text-xs flex items-center gap-1.5"
              >
                <QrCode className="w-4 h-4" />
                Show handover QR
              </button>
            )}
          </div>
        )}

      {/* Cancel + no-show */}
      {status !== 'cancelled' && (
        <div className="flex flex-wrap gap-3">
          {cancellable && (
            <button
              type="button"
              onClick={() => setShowCancel(true)}
              className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 font-bold text-xs flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              Cancel order
            </button>
          )}
          {!['delivered', 'settled', 'cancelled'].includes(status) && (
            <button
              type="button"
              onClick={() => void handleNoShow()}
              disabled={noShowBusy}
              className="px-4 py-2.5 rounded-xl border border-amber-200 text-amber-700 hover:bg-amber-50 font-bold text-xs flex items-center gap-1.5 disabled:opacity-50"
            >
              <UserX className="w-4 h-4" />
              {noShowBusy ? 'Reporting…' : 'Report farmer no-show'}
            </button>
          )}
        </div>
      )}
      {status === 'cancelled' && farmerCompensationPaisa > 0 && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center gap-2">
          <BadgeIndianRupee className="w-4 h-4" />
          Cancelled — farmer compensation {formatPaisa(farmerCompensationPaisa)} applied; the rest
          refunded to source.
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <Link
          to="/customer/procurements"
          className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5"
        >
          <Handshake className="w-4 h-4 text-emerald-600" />
          Back to procurements
        </Link>
      </div>

      {/* Cancel dialog with the E2 penalty copy surfaced up-front */}
      {showCancel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowCancel(false)} />
          <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-3">
            <h3 className="font-black text-sm text-slate-900">Cancel this procurement?</h3>
            <p className="text-xs text-slate-500">
              Free within 4h of placing. Later cancellations pay a 5% farmer-compensation penalty (10% inside
              2h of pickup); the prepaid remainder refunds to source.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowCancel(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 font-bold text-xs text-slate-700"
              >
                Keep Order
              </button>
              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={cancelBusy}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 font-bold text-xs text-white disabled:opacity-50"
              >
                {cancelBusy ? 'Cancelling…' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
