import React, { useCallback, useEffect, useState } from 'react';
import { Repeat, Plus, RefreshCcw, Pencil, XCircle } from 'lucide-react';
import { directBuyer, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import {
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

/** Standing (recurring) demand orders with price band, window and per-slot quantity. */
export const StandingOrdersPage: React.FC = () => {
  const [orders, setOrders] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await directBuyer.standingOrders().catch(() => [] as unknown[]);
      setOrders((list as unknown[]).map(rec));
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

  const [modal, setModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Rec | null>(null);
  const [crop, setCrop] = useState('Soybean');
  const [variety, setVariety] = useState('');
  const [minPrice, setMinPrice] = useState(4500);
  const [maxPrice, setMaxPrice] = useState(4900);
  const [qtyPerSlot, setQtyPerSlot] = useState(25);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [grade, setGrade] = useState<'A' | 'B' | 'C'>('A');

  const openCreate = () => {
    setEditTarget(null);
    setModal(true);
  };

  const openEdit = (o: Rec) => {
    setEditTarget(o);
    setCrop(str(o.crop));
    setVariety(str(o.variety));
    setMinPrice(num(o.minPrice));
    setMaxPrice(num(o.maxPrice));
    setQtyPerSlot(num(o.quantityPerSlot));
    setFrequency(str(o.frequency, 'weekly') as 'daily' | 'weekly' | 'monthly');
    setStartDate(str(o.startDate));
    setEndDate(str(o.endDate));
    setDeliveryLocation(str(o.deliveryLocation));
    setGrade(str(o.qualityGrade, 'A') as 'A' | 'B' | 'C');
    setModal(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editTarget) {
      await act(
        () =>
          directBuyer.updateStandingOrder(str(editTarget.id), {
            crop,
            variety,
            minPrice,
            maxPrice,
            quantityPerSlot: qtyPerSlot,
            frequency,
            deliveryLocation,
            qualityGrade: grade,
          }),
        'Standing order updated'
      );
    } else {
      await act(
        () =>
          directBuyer.createStandingOrder({
            crop,
            variety,
            minPrice,
            maxPrice,
            quantityPerSlot: qtyPerSlot,
            unit: 'quintal',
            frequency,
            startDate,
            endDate,
            deliveryLocation,
            qualityGrade: grade,
          }),
        'Standing order created'
      );
    }
    setModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Repeat className="w-7 h-7 text-emerald-600" />
            Standing Orders
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Recurring crop requirements with a price band — farmers fulfil slot-by-slot
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => void load()} className={ghostBtnCls}>
            <RefreshCcw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={openCreate} className={primaryBtnCls}>
            <Plus className="w-4 h-4 inline mr-1" /> New Standing Order
          </button>
        </div>
      </div>

      <ErrorBanner message={error ?? actionError} />
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">{notice}</div>
      )}

      {loading ? (
        <LoadingBlock />
      ) : orders.length === 0 ? (
        <div className={cardCls}>
          <EmptyState label="No standing orders — create a recurring requirement" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {orders.map((o) => (
            <div key={str(o.id)} className={`${cardCls} p-6 space-y-3`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-base text-slate-900">
                    {str(o.crop)} {str(o.variety) ? `(${str(o.variety)})` : ''}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Grade {str(o.qualityGrade, 'A')} · {str(o.frequency, 'weekly')} · #{str(o.id)}
                  </p>
                </div>
                <StatusBadge status={str(o.status, 'open')} />
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Band</span>
                  <span className="text-xs font-black text-emerald-800">
                    {formatCurrency(num(o.minPrice))}–{formatCurrency(num(o.maxPrice))}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Per Slot</span>
                  <span className="text-xs font-black text-slate-900">{num(o.quantityPerSlot)} q</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <span className="text-[9px] uppercase font-bold text-slate-400 block">Window</span>
                  <span className="text-[10px] font-bold text-slate-700">
                    {formatDate(str(o.startDate))} → {formatDate(str(o.endDate))}
                  </span>
                </div>
              </div>
              {str(o.deliveryLocation) && <p className="text-[11px] text-slate-500">Delivery: {str(o.deliveryLocation)}</p>}
              <div className="flex gap-2 pt-1">
                {str(o.status) === 'open' && (
                  <>
                    <button onClick={() => openEdit(o)} className={`${ghostBtnCls} flex-1`}>
                      <Pencil className="w-3.5 h-3.5 inline mr-1" /> Edit
                    </button>
                    <button onClick={() => void act(() => directBuyer.closeStandingOrder(str(o.id)), 'Standing order closed')} className={`${ghostBtnCls} flex-1 text-rose-600`}>
                      <XCircle className="w-3.5 h-3.5 inline mr-1" /> Close
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ModalSheet isOpen={modal} onClose={() => setModal(false)} title={editTarget ? 'Edit Standing Order' : 'New Standing Order'} maxWidth="md">
        <form onSubmit={(e) => void submit(e)} className="space-y-4">
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
              <label className={labelCls}>Min Price (₹/q)</label>
              <input type="number" className={inputCls} value={minPrice} onChange={(e) => setMinPrice(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Max Price (₹/q)</label>
              <input type="number" className={inputCls} value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))} required />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Qty / Slot (q)</label>
              <input type="number" className={inputCls} value={qtyPerSlot} onChange={(e) => setQtyPerSlot(Number(e.target.value))} required />
            </div>
            <div>
              <label className={labelCls}>Frequency</label>
              <select className={inputCls} value={frequency} onChange={(e) => setFrequency(e.target.value as 'daily' | 'weekly' | 'monthly')}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Grade</label>
              <select className={inputCls} value={grade} onChange={(e) => setGrade(e.target.value as 'A' | 'B' | 'C')}>
                <option>A</option>
                <option>B</option>
                <option>C</option>
              </select>
            </div>
          </div>
          {!editTarget && (
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
          )}
          <div>
            <label className={labelCls}>Delivery Location</label>
            <input className={inputCls} value={deliveryLocation} onChange={(e) => setDeliveryLocation(e.target.value)} />
          </div>
          <ErrorBanner message={actionError} />
          <button type="submit" className={`${primaryBtnCls} w-full py-3`}>
            {editTarget ? 'Save Changes' : 'Create Standing Order'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
