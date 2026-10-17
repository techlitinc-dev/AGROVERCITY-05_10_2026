import React, { useCallback, useEffect, useState } from 'react';
import { Handshake, Plus, RefreshCcw, ArrowRight, CalendarClock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { contracts, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight, formatDate } from '../../lib/utils';
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

/**
 * Buyer-mode contract desk: targeted supply contracts the buyer creates with
 * chosen farmers, counterparty accept/decline handling, and delivery-slot
 * generation that materializes purchases against the contract.
 */
export const BuyerContractDesk: React.FC = () => {
  const [mine, setMine] = useState<Rec[]>([]);
  const [deliveriesByContract, setDeliveriesByContract] = useState<Map<string, Rec[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await contracts.mine({ role: 'buyer' }).catch(() => [] as unknown[]);
      const rows = (list as unknown[]).map(rec);
      setMine(rows);
      const map = new Map<string, Rec[]>();
      await Promise.all(
        rows.slice(0, 12).map(async (c) => {
          const d = await contracts.deliveries(str(c.id)).catch(() => [] as unknown[]);
          map.set(str(c.id), (d as unknown[]).map(rec));
        })
      );
      setDeliveriesByContract(map);
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

  // --- create/edit contract form ---
  const [createModal, setCreateModal] = useState(false);
  const [farmerId, setFarmerId] = useState('');
  const [crop, setCrop] = useState('Soybean');
  const [qtyTotal, setQtyTotal] = useState(200);
  const [priceType, setPriceType] = useState<'fixed' | 'mandiLinked'>('fixed');
  const [baseRate, setBaseRate] = useState(4700);
  const [premium, setPremium] = useState(0);
  const [mandiName, setMandiName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [frequency, setFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly');
  const [qtyPerDelivery, setQtyPerDelivery] = useState(25);
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [paymentDays, setPaymentDays] = useState(7);
  const [terms, setTerms] = useState('');

  // edit state
  const [editTarget, setEditTarget] = useState<Rec | null>(null);
  const [editRate, setEditRate] = useState(4700);
  const [editLocation, setEditLocation] = useState('');
  const [editTerms, setEditTerms] = useState('');

  const createContract = async (e: React.FormEvent) => {
    e.preventDefault();
    await act(
      () =>
        contracts.create({
          farmerId,
          crop,
          quantityTotal: qtyTotal,
          priceType,
          baseRate: priceType === 'fixed' ? baseRate : undefined,
          premiumPerQuintal: premium,
          mandiName,
          schedule: { startDate, endDate, frequency, qtyPerDelivery },
          deliveryLocation,
          paymentTermsDays: paymentDays,
          termsText: terms,
        }),
      'Contract offered to farmer'
    );
    setCreateModal(false);
  };

  const [slotModal, setSlotModal] = useState<Rec | null>(null);
  const [slotDate, setSlotDate] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Handshake className="w-7 h-7 text-emerald-600" />
            Buyer Contract Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Targeted standing supply contracts with farmers — generate delivery slots that become purchases
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={() => setCreateModal(true)} className={primaryBtnCls}>
            <Plus className="w-4 h-4 inline mr-1" /> New Targeted Contract
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">{notice}</div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : mine.length === 0 ? (
        <div className={cardCls}>
          <EmptyState label="No contracts yet — offer a targeted contract to a farmer" />
        </div>
      ) : (
        <div className="space-y-4">
          {mine.map((c) => {
            const deliveries = deliveriesByContract.get(str(c.id)) ?? [];
            const schedule = rec(c.schedule);
            return (
              <div key={str(c.id)} className={`${cardCls} p-6 space-y-4`}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-base text-slate-900">{str(c.crop)} Supply Contract</h4>
                      <StatusBadge status={str(c.status, 'offered')} />
                      <span className="text-[11px] font-mono bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">#{str(c.id)}</span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Farmer: <strong>{str(c.farmerName || c.farmerId, 'Farmer')}</strong> ·{' '}
                      {str(c.priceType, 'fixed') === 'mandiLinked'
                        ? `Mandi-linked (${str(c.mandiName)}) + ${formatCurrency(num(c.premiumPerQuintal))}/q`
                        : `Fixed ${formatCurrency(num(c.baseRate ?? c.currentRate))}/q`}{' '}
                      · {formatWeight(num(c.quantityTotal ?? c.totalQuantityQuintal))}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {str(c.status) === 'offered' && (
                      <>
                        <button onClick={() => void act(() => contracts.accept(str(c.id)), 'Contract accepted')} className={primaryBtnCls}>
                          Accept & Sign
                        </button>
                        <button onClick={() => void act(() => contracts.decline(str(c.id), 'Terms not acceptable'), 'Contract declined')} className={ghostBtnCls}>
                          Decline
                        </button>
                      </>
                    )}
                    {str(c.status) === 'active' && (
                      <>
                        <button onClick={() => { setSlotModal(c); setSlotDate(''); }} className={primaryBtnCls}>
                          <CalendarClock className="w-3.5 h-3.5 inline mr-1" /> Generate Delivery Slot
                        </button>
                        <button
                          onClick={() => {
                            setEditTarget(c);
                            setEditRate(num(c.baseRate ?? c.currentRate));
                            setEditLocation(str(c.deliveryLocation));
                            setEditTerms(str(c.termsText));
                          }}
                          className={ghostBtnCls}
                        >
                          Edit
                        </button>
                      </>
                    )}
                    {['offered', 'active'].includes(str(c.status)) && (
                      <button onClick={() => void act(() => contracts.cancel(str(c.id), 'Cancelled by buyer'), 'Contract cancelled')} className={`${ghostBtnCls} text-rose-600`}>
                        Cancel
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Schedule</span>
                    <span className="font-bold text-slate-800">
                      {str(schedule.frequency, str(c.frequency, '—'))} · {formatWeight(num(schedule.qtyPerDelivery))}/slot
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Window</span>
                    <span className="font-bold text-slate-800">
                      {formatDate(str(schedule.startDate))} → {formatDate(str(schedule.endDate))}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Deliveries Generated</span>
                    <span className="font-bold text-slate-800">{num(c.deliveriesGenerated, deliveries.length)}</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 block text-[10px] uppercase font-bold">Payment Terms</span>
                    <span className="font-bold text-slate-800">{num(c.paymentTermsDays)} days</span>
                  </div>
                </div>

                {deliveries.length > 0 && (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold text-slate-700">Deliveries ({deliveries.length})</h5>
                    {deliveries.map((d) => (
                      <div key={str(d.id ?? d.purchaseId)} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl text-xs">
                        <span>
                          Slot {formatDate(str(d.slotDate ?? d.date))} · {formatWeight(num(d.quantity ?? d.quantityQuintal))}
                        </span>
                        <span className="flex items-center gap-2">
                          <StatusBadge status={str(d.status, 'confirmed')} />
                          <Link to={`/directbuyer/purchases/${str(d.purchaseId ?? d.id)}`} className="text-emerald-700 font-bold">
                            Track <ArrowRight className="w-3 h-3 inline" />
                          </Link>
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      <ModalSheet isOpen={createModal} onClose={() => setCreateModal(false)} title="New Targeted Supply Contract" description="Offered to a specific farmer; delivery slots materialize as purchases" maxWidth="lg">
        <form onSubmit={(e) => void createContract(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Farmer ID / UID</label>
              <input className={inputCls} value={farmerId} onChange={(e) => setFarmerId(e.target.value)} placeholder="usr_…" required />
            </div>
            <div>
              <label className={labelCls}>Crop</label>
              <input className={inputCls} value={crop} onChange={(e) => setCrop(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Total Qty (q)</label>
              <input type="number" className={inputCls} value={qtyTotal} onChange={(e) => setQtyTotal(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Pricing</label>
              <select className={inputCls} value={priceType} onChange={(e) => setPriceType(e.target.value as 'fixed' | 'mandiLinked')}>
                <option value="fixed">Fixed Rate</option>
                <option value="mandiLinked">Mandi-Linked</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>{priceType === 'fixed' ? 'Base Rate (₹/q)' : 'Premium (₹/q)'}</label>
              <input type="number" className={inputCls} value={priceType === 'fixed' ? baseRate : premium} onChange={(e) => (priceType === 'fixed' ? setBaseRate : setPremium)(Number(e.target.value))} required />
            </div>
          </div>
          {priceType === 'mandiLinked' && (
            <div>
              <label className={labelCls}>Reference Mandi</label>
              <input className={inputCls} value={mandiName} onChange={(e) => setMandiName(e.target.value)} required />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Start Date</label>
              <input type="date" className={inputCls} value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div>
              <label className={labelCls}>End Date</label>
              <input type="date" className={inputCls} value={endDate} onChange={(e) => setEndDate(e.target.value)} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Frequency</label>
              <select className={inputCls} value={frequency} onChange={(e) => setFrequency(e.target.value as 'weekly' | 'biweekly' | 'monthly')}>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Fortnightly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Qty / Delivery (q)</label>
              <input type="number" className={inputCls} value={qtyPerDelivery} onChange={(e) => setQtyPerDelivery(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Payment Days</label>
              <input type="number" className={inputCls} value={paymentDays} onChange={(e) => setPaymentDays(Number(e.target.value))} required />
            </div>
          </div>
          <div>
            <label className={labelCls}>Delivery Location</label>
            <input className={inputCls} value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} required />
          </div>
          <div>
            <label className={labelCls}>Terms</label>
            <textarea rows={2} className={inputCls} value={terms} onChange={(e) => setTerms(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Offer Contract to Farmer</button>
        </form>
      </ModalSheet>

      {/* Edit modal */}
      <ModalSheet isOpen={Boolean(editTarget)} onClose={() => setEditTarget(null)} title="Edit Contract" maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!editTarget) return;
            void act(
              () =>
                contracts.update(str(editTarget.id), {
                  baseRate: editRate,
                  deliveryLocation: editLocation,
                  termsText: editTerms,
                }),
              'Contract updated'
            );
            setEditTarget(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Base Rate (₹/q)</label>
            <input type="number" className={inputCls} value={editRate} onChange={(e) => setEditRate(Number(e.target.value))} required />
          </div>
          <div>
            <label className={labelCls}>Delivery Location</label>
            <input className={inputCls} value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Terms</label>
            <textarea rows={2} className={inputCls} value={editTerms} onChange={(e) => setEditTerms(e.target.value)} />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Save Changes</button>
        </form>
      </ModalSheet>

      {/* Slot generation */}
      <ModalSheet isOpen={Boolean(slotModal)} onClose={() => setSlotModal(null)} title="Generate Delivery Slot" description={slotModal ? `Creates a purchase for the next ${str(rec(slotModal.schedule).frequency, 'scheduled')} delivery` : undefined} maxWidth="sm">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!slotModal) return;
            void act(() => contracts.recordDelivery(str(slotModal.id), { slotDate }), 'Delivery slot generated');
            setSlotModal(null);
          }}
          className="space-y-4"
        >
          <div>
            <label className={labelCls}>Slot Date</label>
            <input type="date" className={inputCls} value={slotDate} onChange={(e) => setSlotDate(e.target.value)} required />
          </div>
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>Generate Slot Purchase</button>
        </form>
      </ModalSheet>
    </div>
  );
};
