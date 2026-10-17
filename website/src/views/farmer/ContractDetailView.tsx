import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  FileText,
  ArrowLeft,
  ShieldCheck,
  Check,
  PackageCheck,
  Plus,
  Truck,
  TrendingUp,
} from 'lucide-react';
import { contracts, mandi, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { MpinPad } from '../../components/common/MpinPad';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight, formatDateTime } from '../../lib/utils';
import type { SupplyContract, MandiPrice } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const asNum = (v: unknown, fallback = 0): number => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

export const ContractDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contract, setContract] = useState<SupplyContract | null>(null);
  const [deliveries, setDeliveries] = useState<unknown[]>([]);
  const [mandiPrices, setMandiPrices] = useState<MandiPrice[]>([]);
  const [mandiPricesLoading, setMandiPricesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [signModalOpen, setSignModalOpen] = useState(false);
  const [signedSuccess, setSignedSuccess] = useState(false);
  const [declineModalOpen, setDeclineModalOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [deliveryModalOpen, setDeliveryModalOpen] = useState(false);
  const [deliveryQty, setDeliveryQty] = useState(5);
  const [deliveryNote, setDeliveryNote] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!id) return;
    const [c, d] = await Promise.all([
      contracts.get(id),
      contracts.deliveries(id).catch(() => []),
    ]);
    setContract(c);
    setDeliveries(d);
  }, [id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    reload()
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [reload]);

  useEffect(() => {
    if (!contract?.crop) return;
    let active = true;
    setMandiPricesLoading(true);
    mandi
      .prices({ commodity: contract.crop })
      .then((list) => active && setMandiPrices(list))
      .catch(() => active && setMandiPrices([]))
      .finally(() => active && setMandiPricesLoading(false));
    return () => {
      active = false;
    };
  }, [contract?.crop]);

  const handleMpinSign = async (mpin: string) => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await contracts.accept(id, { mpin });
      setContract((prev) => (prev ? { ...prev, ...updated } : updated));
      setSignedSuccess(true);
      setTimeout(() => {
        setSignedSuccess(false);
        setSignModalOpen(false);
      }, 900);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleDecline = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await contracts.decline(id, declineReason || 'Farmer declined the offered terms');
      setContract((prev) => (prev ? { ...prev, ...updated } : updated));
      setDeclineModalOpen(false);
      setNotice('Contract declined.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRecordDelivery = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      await contracts.recordDelivery(id, { quantityQuintal: deliveryQty, note: deliveryNote });
      const list = await contracts.deliveries(id).catch(() => []);
      setDeliveries(list);
      setDeliveryModalOpen(false);
      setDeliveryNote('');
      setNotice('Delivery recorded against the contract.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const fulfilledQty: number = deliveries.reduce<number>(
    (sum, d) => sum + asNum(asRecord(d).quantityQuintal ?? asRecord(d).quantity, 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/farmer/contracts')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to contracts"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-emerald-600" />
              Supply Contract #{id}
            </h1>
            <p className="text-xs text-slate-500 mt-1">Terms, MPIN e-sign and delivery fulfilment</p>
          </div>
        </div>
        {contract && <StatusBadge status={contract.status} />}
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

      {loading || !contract ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading contract…
        </div>
      ) : (
        <>
          {/* Terms card */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-3 rounded-2xl bg-amber-50 text-amber-700">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">{contract.crop} Supply Contract</h3>
                <p className="text-xs text-slate-500">Buyer: <strong>{contract.buyerName}</strong>{contract.farmerName ? ` • Farmer: ${contract.farmerName}` : ''}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Commitment</span>
                <p className="font-extrabold text-slate-900 mt-0.5">{formatWeight(contract.totalQuantityQuintal)}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Pricing Model</span>
                <p className="font-extrabold text-emerald-700 mt-0.5 capitalize">
                  {contract.pricingType} ({formatCurrency(contract.baseRatePerQuintal)}/q)
                </p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Delivery Cadence</span>
                <p className="font-extrabold text-slate-900 mt-0.5 capitalize">{contract.frequency}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Payment Window</span>
                <p className="font-extrabold text-slate-900 mt-0.5">{contract.paymentTermsDays} Days Post QC</p>
              </div>
            </div>

            {contract.premiumPerQuintal ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs text-emerald-900">
                Mandi-linked premium: <strong>+{formatCurrency(contract.premiumPerQuintal)}/q</strong> above base rate when modal price exceeds threshold.
              </div>
            ) : null}

            {/* Fulfilment progress */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-600">
                <span className="flex items-center gap-1.5"><Truck className="w-4 h-4 text-sky-600" /> Fulfilment Progress</span>
                <span>{fulfilledQty.toFixed(1)} / {contract.totalQuantityQuintal} q</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2.5">
                <div
                  className="bg-emerald-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (fulfilledQty / Math.max(1, contract.totalQuantityQuintal)) * 100)}%` }}
                />
              </div>
            </div>

            {/* Signature actions */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              {contract.signedByFarmer ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-2xl border border-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>
                    MPIN E-Signed {contract.signedAt ? `on ${formatDateTime(contract.signedAt)}` : ''} — Legally Enforceable
                  </span>
                </div>
              ) : contract.status === 'offered' || contract.status === 'open' ? (
                <>
                  <button
                    onClick={() => setDeclineModalOpen(true)}
                    className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => setSignModalOpen(true)}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>E-Sign Contract (MPIN)</span>
                  </button>
                </>
              ) : null}

              {contract.status === 'active' && (
                <button
                  onClick={() => setDeliveryModalOpen(true)}
                  className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2"
                >
                  <PackageCheck className="w-4 h-4" />
                  <span>Record Delivery</span>
                </button>
              )}
            </div>
          </div>

          {/* Current mandi price check */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Current Mandi Price — {contract.crop}
              </h3>
              <Link
                to={`/farmer/mandi?commodity=${encodeURIComponent(contract.crop)}`}
                className="text-[10px] font-bold text-emerald-700 hover:underline"
              >
                Open in Mandi Prices
              </Link>
            </div>
            {mandiPricesLoading ? (
              <p className="text-xs font-bold text-slate-400 animate-pulse">Fetching live mandi rates…</p>
            ) : mandiPrices.length === 0 ? (
              <p className="text-xs text-slate-400">
                No live mandi rates for this crop right now. Check the Mandi Prices page for nearby commodities.
              </p>
            ) : (
              (() => {
                const best = mandiPrices.reduce((a, b) => (b.modalPrice > a.modalPrice ? b : a));
                const delta = best.modalPrice - contract.baseRatePerQuintal;
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Best Modal Rate</span>
                        <p className="font-extrabold text-emerald-700 mt-0.5">{formatCurrency(best.modalPrice)}/q</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{best.mandi}, {best.district}</p>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">vs Contract Base Rate</span>
                        <p className={`font-extrabold mt-0.5 ${delta >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                          {delta >= 0 ? '+' : ''}{formatCurrency(delta)}/q
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{formatCurrency(contract.baseRatePerQuintal)}/q contracted</p>
                      </div>
                      <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">MSP Floor</span>
                        <p className="font-extrabold text-slate-900 mt-0.5">
                          {best.msp ? `${formatCurrency(best.msp)}/q` : 'Not notified'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {mandiPrices.slice(0, 3).map((p) => (
                        <div
                          key={p.id}
                          className="p-2.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <p className="font-bold text-slate-900">{p.mandi} <span className="text-slate-400 font-semibold">• {p.district}</span></p>
                            <p className="text-[10px] text-slate-400">
                              {p.variety} • {p.priceDate}
                              {p.trendPercentage !== 0 && (
                                <span className={p.trendPercentage > 0 ? 'text-emerald-600 font-bold' : 'text-rose-500 font-bold'}>
                                  {' '}({p.trendPercentage > 0 ? '▲' : '▼'} {Math.abs(p.trendPercentage)}%)
                                </span>
                              )}
                            </p>
                          </div>
                          <p className="font-extrabold text-slate-900">{formatCurrency(p.modalPrice)}/q</p>
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()
            )}
          </div>

          {/* Deliveries */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">Deliveries ({deliveries.length})</h3>
              {contract.status === 'active' && (
                <button
                  onClick={() => setDeliveryModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px] flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add Delivery
                </button>
              )}
            </div>
            {deliveries.length === 0 ? (
              <p className="text-xs text-slate-400">No deliveries recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {deliveries.map((d, i) => {
                  const r = asRecord(d);
                  return (
                    <div key={asStr(r.id, String(i))} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-900">{asNum(r.quantityQuintal ?? r.quantity, 0)} Quintals delivered</p>
                        <p className="text-[10px] text-slate-400">
                          {asStr(r.createdAt ?? r.date, '') && formatDateTime(asStr(r.createdAt ?? r.date))}
                          {asStr(r.note) ? ` • ${asStr(r.note)}` : ''}
                        </p>
                      </div>
                      <StatusBadge status={asStr(r.status, 'recorded')} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {/* MPIN sign modal */}
      <ModalSheet
        isOpen={signModalOpen}
        onClose={() => setSignModalOpen(false)}
        title="MPIN E-Sign Contract Authorization"
        description="Enter your 4-digit MPIN to execute the digital signature"
        maxWidth="sm"
      >
        <div className="space-y-4">
          {signedSuccess ? (
            <div className="p-6 text-center space-y-2">
              <Check className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
              <h4 className="font-bold text-base text-slate-900">Contract Signed Successfully!</h4>
              <p className="text-xs text-slate-500">Contract is now active and legally enforceable.</p>
            </div>
          ) : (
            <MpinPad
              onSuccess={handleMpinSign}
              title="Enter 4-Digit MPIN to Sign"
              subtitle="Secured by Agrovercity Legal Protocol"
            />
          )}
          {busy && <p className="text-center text-xs font-bold text-slate-400">Verifying…</p>}
        </div>
      </ModalSheet>

      {/* Decline modal */}
      <ModalSheet
        isOpen={declineModalOpen}
        onClose={() => setDeclineModalOpen(false)}
        title="Decline Contract"
        description="The buyer will be notified of your decision"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Rate below current mandi modal"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={handleDecline}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Declining…' : 'Confirm Decline'}
          </button>
        </div>
      </ModalSheet>

      {/* Record delivery modal */}
      <ModalSheet
        isOpen={deliveryModalOpen}
        onClose={() => setDeliveryModalOpen(false)}
        title="Record Contract Delivery"
        description="Log a fulfilled delivery slot against this contract"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Quantity (Quintals)</label>
            <input
              type="number"
              step="0.1"
              value={deliveryQty}
              onChange={(e) => setDeliveryQty(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Note (optional)</label>
            <input
              type="text"
              value={deliveryNote}
              onChange={(e) => setDeliveryNote(e.target.value)}
              placeholder="e.g. Grade A, 50kg bags, gate delivery"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={handleRecordDelivery}
            disabled={busy || deliveryQty <= 0}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Record Delivery'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
