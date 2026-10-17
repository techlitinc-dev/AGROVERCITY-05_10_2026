import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2,
  Layers,
  Plus,
  Award,
  RefreshCcw,
  ArrowRight,
  Link2,
  Handshake,
  ShoppingBag,
  Star,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { directBuyer, demands, purchases, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight, formatDate } from '../../lib/utils';
import type { BuyerDemand, PurchaseOrder } from '../../types';
import {
  cardCls,
  EmptyState,
  ErrorBanner,
  ghostBtnCls,
  inputCls,
  labelCls,
  LoadingBlock,
  num,
  paisaToRupees,
  primaryBtnCls,
  rec,
  str,
  type Rec,
} from './shared';

/** Direct buyer procurement desk: demands CRUD + incoming purchases & QC. */
export const DirectBuyerHome: React.FC = () => {
  const [dashboard, setDashboard] = useState<Rec>({});
  const [demandList, setDemandList] = useState<BuyerDemand[]>([]);
  const [purchaseList, setPurchaseList] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, dm, p] = await Promise.all([
        directBuyer.dashboard().catch(() => ({})),
        demands.list().catch(() => [] as BuyerDemand[]),
        purchases.mine({ role: 'buyer' }).catch(() => [] as PurchaseOrder[]),
      ]);
      setDashboard(rec(d));
      setDemandList(dm);
      setPurchaseList(p);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (fn: () => Promise<unknown>, successMsg?: string) => {
      setActionError(null);
      setNotice(null);
      try {
        await fn();
        if (successMsg) setNotice(successMsg);
        await load();
      } catch (err) {
        setActionError(apiErrorMessage(err));
      }
    },
    [load]
  );

  // --- demand form ---
  const [demandModal, setDemandModal] = useState(false);
  const [editingDemand, setEditingDemand] = useState<BuyerDemand | null>(null);
  const [crop, setCrop] = useState('Soybean');
  const [variety, setVariety] = useState('');
  const [qty, setQty] = useState(100);
  const [maxPrice, setMaxPrice] = useState(4850);
  const [delivery, setDelivery] = useState('');
  const [state, setState] = useState('Maharashtra');
  const [district, setDistrict] = useState('');
  const [specs, setSpecs] = useState('');
  const [validUntil, setValidUntil] = useState('');

  const openCreate = () => {
    setEditingDemand(null);
    setCrop('Soybean');
    setVariety('');
    setQty(100);
    setMaxPrice(4850);
    setDelivery('');
    setState('Maharashtra');
    setDistrict('');
    setSpecs('');
    setValidUntil('');
    setDemandModal(true);
  };

  const openEdit = (d: BuyerDemand) => {
    setEditingDemand(d);
    setCrop(d.crop);
    setVariety(d.variety || '');
    setQty(d.requiredQuantityQuintal);
    setMaxPrice(d.maxPricePerQuintal);
    setDelivery(d.deliveryLocation);
    setState(d.state);
    setDistrict(d.district);
    setSpecs(d.qualitySpecs);
    setValidUntil(d.validUntil);
    setDemandModal(true);
  };

  const saveDemand = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      crop,
      variety,
      requiredQuantityQuintal: qty,
      maxPricePerQuintal: maxPrice,
      deliveryLocation: delivery,
      state,
      district,
      qualitySpecs: specs,
      validUntil,
    };
    if (editingDemand) {
      await act(() => demands.update(editingDemand.id, payload), 'Demand updated');
    } else {
      await act(() => demands.create(payload), 'Demand published');
    }
    setDemandModal(false);
  };

  // --- QC modal ---
  const [qcPo, setQcPo] = useState<PurchaseOrder | null>(null);
  const [qcGrade, setQcGrade] = useState<'A' | 'B' | 'C'>('A');
  const [qcAccepted, setQcAccepted] = useState(0);
  const [qcRejected, setQcRejected] = useState(0);
  const [qcNote, setQcNote] = useState('');

  const saveQc = async () => {
    if (!qcPo) return;
    await act(() => purchases.qc(qcPo.id, { grade: qcGrade, acceptedQty: qcAccepted, rejectedQty: qcRejected, note: qcNote }), 'QC recorded');
    setQcPo(null);
  };

  const openDemands = demandList.filter((d) => d.status === 'open');
  const escrowHeld = rec(dashboard.escrowHeld ?? dashboard.escrow);
  const incoming = purchaseList.filter((p) => !['completed', 'cancelled'].includes(p.status));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Direct Buyer B2B Procurement Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Publish institutional crop demands, review farmer quotes, inspect arrivals with QC grading, and disburse balances
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCreate} className={primaryBtnCls}>
            <Plus className="w-4 h-4 inline mr-1" /> Post Bulk Crop Demand
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">{notice}</div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard
              title="Active Procurement Demands"
              value={`${openDemands.length} Demands`}
              subtitle={`${demandList.length} total in register`}
              icon={Layers}
              colorScheme="blue"
            />
            <StatCard
              title="Incoming Shipments"
              value={`${incoming.length} Orders`}
              subtitle="Pickup / transit / delivered"
              icon={Building2}
              colorScheme="green"
            />
            <StatCard
              title="Escrow Funded Balance"
              value={formatCurrency(paisaToRupees(escrowHeld.amountPaisa ?? escrowHeld.paisa) || num(escrowHeld.amount))}
              subtitle="Protected B2B procurement"
              icon={Award}
              colorScheme="amber"
            />
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { to: '/directbuyer/feed', label: 'Farm-gate Feed', icon: ShoppingBag },
              { to: '/directbuyer/offers', label: 'Offer Inbox', icon: Award },
              { to: '/directbuyer/contracts', label: 'Contract Desk', icon: Handshake },
              { to: '/directbuyer/standing', label: 'Standing Orders', icon: Layers },
              { to: '/directbuyer/intel', label: 'Market Intel', icon: Link2 },
              { to: '/directbuyer/analytics', label: 'Analytics', icon: Building2 },
              { to: '/directbuyer/team', label: 'Org Team', icon: Star },
            ].map((l) => (
              <Link key={l.to} to={l.to} className={`${cardCls} p-3.5 flex items-center gap-2.5 hover:border-emerald-300 transition-all text-xs font-bold text-slate-800`}>
                <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                  <l.icon className="w-4 h-4" />
                </span>
                {l.label}
                <ArrowRight className="w-3.5 h-3.5 ml-auto text-slate-400" />
              </Link>
            ))}
          </div>

          {/* Demands register */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">My Procurement Demands ({demandList.length})</h3>
            {demandList.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No demands posted yet — publish your first bulk demand" />
              </div>
            ) : (
              <div className={`${cardCls} overflow-hidden`}>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                      <th className="py-3 px-5">Crop & Specs</th>
                      <th className="py-3 px-3">Volume</th>
                      <th className="py-3 px-3">Max Price</th>
                      <th className="py-3 px-3">Delivery</th>
                      <th className="py-3 px-3">Valid Until</th>
                      <th className="py-3 px-3">Status</th>
                      <th className="py-3 px-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {demandList.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5 font-bold text-slate-900">
                          {d.crop} {d.variety ? `(${d.variety})` : ''}
                          <span className="text-[10px] text-slate-400 block font-normal truncate max-w-56">{d.qualitySpecs}</span>
                        </td>
                        <td className="py-3 px-3 font-semibold text-slate-700">{formatWeight(d.requiredQuantityQuintal)}</td>
                        <td className="py-3 px-3 font-bold text-emerald-800">{formatCurrency(d.maxPricePerQuintal)}/q</td>
                        <td className="py-3 px-3 text-slate-600">{d.deliveryLocation}</td>
                        <td className="py-3 px-3 text-slate-600">{formatDate(d.validUntil)}</td>
                        <td className="py-3 px-3">
                          <StatusBadge status={d.status} />
                        </td>
                        <td className="py-3 px-5 text-right">
                          <div className="inline-flex gap-1.5">
                            {d.status === 'open' && (
                              <>
                                <button onClick={() => openEdit(d)} className={ghostBtnCls}>Edit</button>
                                <button onClick={() => void act(() => demands.close(d.id), 'Demand closed')} className={ghostBtnCls}>
                                  Close
                                </button>
                              </>
                            )}
                            {d.status === 'closed' && (
                              <button onClick={() => void act(() => demands.reopen(d.id), 'Demand reopened')} className={ghostBtnCls}>
                                Reopen
                              </button>
                            )}
                            <button onClick={() => void act(() => demands.remove(d.id), 'Demand deleted')} className={`${ghostBtnCls} text-rose-600`}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Incoming deliveries & QC desk */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Incoming Deliveries & QC Inspection Desk</h3>
            {purchaseList.length === 0 ? (
              <div className={cardCls}>
                <EmptyState label="No purchases yet — browse the farm-gate feed to buy" />
              </div>
            ) : (
              <div className="space-y-3">
                {purchaseList.map((po) => (
                  <div key={po.id} className={`${cardCls} p-6 space-y-4`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <h4 className="font-bold text-base text-slate-900">
                          {po.crop} ({formatWeight(po.quantityQuintal)}) from {po.farmerName}
                        </h4>
                        <p className="text-xs text-slate-400">
                          Order #{po.id} • Agreed Price: {formatCurrency(po.agreedPricePerQuintal)}/q
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={po.status} />
                        <Link to={`/directbuyer/purchases/${po.id}`} className={ghostBtnCls}>
                          Detail <ArrowRight className="w-3 h-3 inline" />
                        </Link>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Order Value</span>
                        <span className="font-black text-emerald-800 text-sm">{formatCurrency(po.totalAmount)}</span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Advance Funded</span>
                        <span className="font-bold text-slate-800 text-sm">
                          {po.advancePaid ? formatCurrency(po.advanceAmount) : 'Not yet'}
                        </span>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <span className="text-slate-400 block text-[10px] uppercase font-bold">Gate Handover OTP</span>
                        <span className="font-mono font-bold text-slate-800 text-sm">{po.handoverOtp || '—'}</span>
                      </div>
                    </div>

                    {po.status === 'delivered' && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => {
                            setQcPo(po);
                            setQcAccepted(po.quantityQuintal);
                            setQcRejected(0);
                          }}
                          className={primaryBtnCls}
                        >
                          <Award className="w-4 h-4 inline mr-1" /> Execute QC Inspection
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Demand create/edit modal */}
      <ModalSheet
        isOpen={demandModal}
        onClose={() => setDemandModal(false)}
        title={editingDemand ? 'Edit Crop Demand' : 'Post Institutional Crop Demand'}
        description="Specify bulk volume and target ceiling price for farmer supply"
        maxWidth="md"
      >
        <form onSubmit={(e) => void saveDemand(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Crop</label>
              <input className={inputCls} value={crop} onChange={(e) => setCrop(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>Variety</label>
              <input className={inputCls} value={variety} onChange={(e) => setVariety(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Volume (Quintals)</label>
              <input type="number" className={inputCls} value={qty} onChange={(e) => setQty(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Max Ceiling Price (₹/q)</label>
              <input type="number" className={`${inputCls} font-bold text-emerald-800`} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Delivery Location</label>
            <input className={inputCls} value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="Vashi APMC Yard, Navi Mumbai" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>State</label>
              <input className={inputCls} value={state} onChange={(e) => setState(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>District</label>
              <input className={inputCls} value={district} onChange={(e) => setDistrict(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Quality Specifications</label>
            <textarea rows={2} className={inputCls} value={specs} onChange={(e) => setSpecs(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Valid Until</label>
            <input type="date" className={inputCls} value={validUntil} onChange={(e) => setValidUntil(e.target.value)} required />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>
            {editingDemand ? 'Save Demand' : 'Publish Bulk Demand'}
          </button>
        </form>
      </ModalSheet>

      {/* QC modal */}
      <ModalSheet
        isOpen={Boolean(qcPo)}
        onClose={() => setQcPo(null)}
        title="Produce Quality Inspection (QC)"
        description={qcPo ? `Record physical inspection grade for #${qcPo.id}` : undefined}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Assigned Grade</label>
            <div className="grid grid-cols-3 gap-2">
              {(['A', 'B', 'C'] as const).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setQcGrade(g)}
                  className={`p-2.5 rounded-xl border text-xs font-bold transition-all ${
                    qcGrade === g ? 'bg-emerald-50 border-emerald-600 text-emerald-900' : 'border-slate-200 text-slate-700'
                  }`}
                >
                  Grade {g}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Accepted Qty (q)</label>
              <input type="number" className={inputCls} value={qcAccepted} onChange={(e) => setQcAccepted(Number(e.target.value))} />
            </div>
            <div>
              <label className={labelCls}>Rejected Qty (q)</label>
              <input type="number" className={inputCls} value={qcRejected} onChange={(e) => setQcRejected(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Note</label>
            <textarea rows={2} className={inputCls} value={qcNote} onChange={(e) => setQcNote(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button onClick={() => void saveQc()} className={`${primaryBtnCls} w-full py-3`}>
            Confirm Inspection & Continue
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
