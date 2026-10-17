import React, { useEffect, useState } from 'react';
import {
  Heart,
  Sprout,
  Home,
  Egg,
  Users,
  AlertCircle,
  CheckCircle2,
  Plus,
  Package,
  IndianRupee,
  Award,
  ClipboardList,
  BadgePercent,
} from 'lucide-react';
import { apiErrorMessage, gruhUdyog, women } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cn, formatCurrency, formatDateTime, formatNumber } from '../../lib/utils';
import { asRecord, asRecords, pick, pickNum, pickStr } from '../shared/records';

type Tab = 'shg' | 'garden' | 'livestock' | 'gruh';

const TABS: { id: Tab; label: string }[] = [
  { id: 'shg', label: 'My SHG' },
  { id: 'garden', label: 'Kitchen Garden' },
  { id: 'livestock', label: 'Backyard Livestock' },
  { id: 'gruh', label: 'Gruh Udyog Studio' },
];

export const WomenGruhUdyogView: React.FC = () => {
  const [tab, setTab] = useState<Tab>('shg');
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 4000);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Heart className="w-7 h-7 text-pink-600" />
          Mahila Gruh Udyog & SHG Enterprise Hub
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Empowering rural women self-help groups (SHG) with savings circles, kitchen gardens, backyard livestock, and zero-brokerage home enterprises
        </p>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'whitespace-nowrap px-4 py-2 rounded-2xl text-xs font-bold border transition-colors',
              tab === t.id
                ? 'bg-pink-600 text-white border-pink-600 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'shg' && <ShgPanel flash={flash} />}
      {tab === 'garden' && <GardenPanel flash={flash} />}
      {tab === 'livestock' && <LivestockPanel />}
      {tab === 'gruh' && <GruhPanel flash={flash} />}
    </div>
  );
};

/* ------------------------------------------------------------------ SHG */

const ShgPanel: React.FC<{ flash: (k: 'ok' | 'err', t: string) => void }> = ({ flash }) => {
  const [shg, setShg] = useState<Record<string, unknown> | null>(null);
  const [checked, setChecked] = useState(false);
  const [meetings, setMeetings] = useState<Record<string, unknown>[]>([]);
  const [groupName, setGroupName] = useState('');
  const [contribution, setContribution] = useState('500');
  const [depositAmount, setDepositAmount] = useState('500');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await women.shg();
      const rec = asRecord(res);
      setShg(Object.keys(rec).length > 0 ? rec : null);
    } catch {
      setShg(null);
    } finally {
      setChecked(true);
    }
    women
      .meetings()
      .then((rows) => setMeetings(asRecords(rows)))
      .catch(() => undefined);
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createGroup = async () => {
    if (!groupName.trim() || busy) return;
    setBusy(true);
    try {
      await women.createShg({ name: groupName.trim(), monthlyContribution: Number(contribution) || 500 });
      flash('ok', `SHG "${groupName.trim()}" created — invite members from your village to join.`);
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const deposit = async () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0 || busy) return;
    setBusy(true);
    try {
      await women.deposit({ amount });
      flash('ok', `${formatCurrency(amount)} deposited into the SHG savings corpus.`);
      await load();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  if (!checked) {
    return <p className="text-xs text-slate-400">Loading your SHG…</p>;
  }

  if (!shg) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 max-w-xl space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Users className="w-4 h-4 text-pink-600" /> Start a Self-Help Group
        </h3>
        <p className="text-xs text-slate-500">
          A Bachat Gat pools monthly contributions for micro-loans, bulk input buying, and emergency support.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Group name</label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="e.g. Laxmi Mahila Bachat Gat"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Monthly contribution (₹)</label>
            <input
              type="number"
              min={50}
              value={contribution}
              onChange={(e) => setContribution(e.target.value)}
              className="w-full sm:w-48 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
          </div>
          <button
            onClick={() => void createGroup()}
            disabled={!groupName.trim() || busy}
            className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {busy ? 'Creating…' : 'Create SHG'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-r from-pink-700 to-rose-800 rounded-3xl p-6 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-pink-200">My Self-Help Group</span>
          <h3 className="font-extrabold text-lg mt-0.5">{pickStr(shg, 'name') || 'SHG'}</h3>
          <p className="text-xs text-pink-200 mt-1">
            {formatNumber(pickNum(shg, 'members', 'memberCount'))} members · Formed{' '}
            {pickStr(shg, 'createdAt', 'formedAt') || '—'}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black">{formatCurrency(pickNum(shg, 'corpus', 'balance', 'totalSavings'))}</p>
          <p className="text-[10px] uppercase font-bold text-pink-200">Group Corpus</p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 max-w-xl">
        <h4 className="font-bold text-xs text-slate-900">Make a Savings Deposit</h4>
        <div className="flex gap-2">
          <input
            type="number"
            min={10}
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            className="flex-1 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
          />
          <button
            onClick={() => void deposit()}
            disabled={busy || !(Number(depositAmount) > 0)}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Deposit
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h4 className="font-bold text-xs text-slate-900">Meetings</h4>
        {meetings.length === 0 ? (
          <p className="text-xs text-slate-400">No meetings recorded yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {meetings.slice(0, 10).map((m, i) => (
              <div key={pickStr(m, 'id') || i} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-800">{pickStr(m, 'agenda', 'title') || 'SHG Meeting'}</p>
                  <p className="text-[11px] text-slate-400">
                    {formatDateTime(pickStr(m, 'date', 'heldAt', 'createdAt')) || '—'} ·{' '}
                    {formatNumber(pickNum(m, 'attendance', 'attendees'))} attended
                  </p>
                </div>
                {pick(m, 'collections') !== undefined && (
                  <span className="font-bold text-emerald-700">
                    {formatCurrency(pickNum(m, 'collections'))} collected
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* --------------------------------------------------------------- Garden */

const GardenPanel: React.FC<{ flash: (k: 'ok' | 'err', t: string) => void }> = ({ flash }) => {
  const [plans, setPlans] = useState<Record<string, unknown>[]>([]);
  const [title, setTitle] = useState('');
  const [crop, setCrop] = useState('');
  const [areaSqm, setAreaSqm] = useState('50');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    women
      .gardenPlans()
      .then((rows) => setPlans(asRecords(rows)))
      .catch(() => undefined);
  }, []);

  const create = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    try {
      await women.createGardenPlan({
        title: title.trim(),
        crop: crop.trim() || undefined,
        areaSqm: Number(areaSqm) || undefined,
      });
      flash('ok', `Garden plan "${title.trim()}" created.`);
      setTitle('');
      setCrop('');
      const rows = await women.gardenPlans().catch(() => []);
      setPlans(asRecords(rows));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3 max-w-xl">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Sprout className="w-4 h-4 text-emerald-600" /> New Kitchen Garden Plan
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Plan name"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
          <input
            type="text"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            placeholder="Crop (e.g. Methi)"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
          <input
            type="number"
            min={1}
            value={areaSqm}
            onChange={(e) => setAreaSqm(e.target.value)}
            placeholder="Area (sq m)"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
        </div>
        <button
          onClick={() => void create()}
          disabled={!title.trim() || busy}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
        >
          {busy ? 'Saving…' : 'Create Plan'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {plans.length === 0 && (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2">
            No garden plans yet — plan your first patch above.
          </p>
        )}
        {plans.map((p, i) => (
          <div key={pickStr(p, 'id') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-slate-900">{pickStr(p, 'title') || 'Garden plan'}</h4>
              <StatusBadge status={pickStr(p, 'status', 'season') || 'planned'} />
            </div>
            <p className="text-xs text-slate-500">
              {pickStr(p, 'crop') || 'Mixed vegetables'} · {pickNum(p, 'areaSqm', 'area')} sq m
            </p>
            {pickStr(p, 'notes', 'tips') && (
              <p className="text-[11px] text-slate-400 leading-relaxed">{pickStr(p, 'notes', 'tips')}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------ Livestock */

const LivestockPanel: React.FC = () => {
  const [animals, setAnimals] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    women
      .backyardLivestock()
      .then((rows) => setAnimals(asRecords(rows)))
      .catch(() => undefined);
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {animals.length === 0 && (
        <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center sm:col-span-2 lg:col-span-3">
          No backyard livestock registered — poultry, goats, and cattle tracked here earn extra women-mode rewards.
        </p>
      )}
      {animals.map((a, i) => (
        <div key={pickStr(a, 'id') || i} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
              <Egg className="w-4 h-4 text-amber-500" /> {pickStr(a, 'type', 'species', 'animal') || 'Livestock'}
            </h4>
            <span className="text-xs font-black text-slate-700">× {pickNum(a, 'count', 'quantity') || 1}</span>
          </div>
          <p className="text-xs text-slate-500">
            {pickStr(a, 'breed') || '—'} · {pickStr(a, 'purpose') || pickStr(a, 'category') || 'Backyard rearing'}
          </p>
          {pickNum(a, 'dailyYield') > 0 && (
            <p className="text-[11px] text-emerald-700 font-bold">
              ≈ {pickNum(a, 'dailyYield')} {pickStr(a, 'yieldUnit') || 'eggs/litres'} per day
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

/* ---------------------------------------------------------------- Gruh */

const GRUH_CATEGORIES = [
  'Papad & Fryums',
  'Pickles & Chutneys',
  'Spices & Masala',
  'Dairy & Sweets',
  'Grains & Flours',
  'Handicrafts',
  'Textiles & Apparel',
  'Bamboo & Cane',
  'Candles & Diyas',
  'Herbal & Cosmetics',
  'Other',
];

const BATCH_STATUSES = ['sold_out', 'expired'];

const GruhPanel: React.FC<{ flash: (k: 'ok' | 'err', t: string) => void }> = ({ flash }) => {
  const [units, setUnits] = useState<Record<string, unknown>[]>([]);
  const [unitId, setUnitId] = useState<string | null>(null);
  const [unitDetail, setUnitDetail] = useState<Record<string, unknown>>({});
  const [dashboard, setDashboard] = useState<Record<string, unknown>>({});
  const [products, setProducts] = useState<Record<string, unknown>[]>([]);
  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [offers, setOffers] = useState<Record<string, unknown>[]>([]);
  const [certs, setCerts] = useState<Record<string, unknown>[]>([]);
  const [newUnitName, setNewUnitName] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [uName, setUName] = useState('');
  const [uDesc, setUDesc] = useState('');
  const [uVillage, setUVillage] = useState('');
  const [uDistrict, setUDistrict] = useState('');
  const [uState, setUState] = useState('');
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodCategory, setProdCategory] = useState(GRUH_CATEGORIES[0]);
  const [prodMrp, setProdMrp] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('10');
  const [batchFor, setBatchFor] = useState<string | null>(null);
  const [batchNo, setBatchNo] = useState('');
  const [batchQty, setBatchQty] = useState('10');
  const [batchProduced, setBatchProduced] = useState('');
  const [batchExpiry, setBatchExpiry] = useState('');
  const [batchDetail, setBatchDetail] = useState<Record<string, unknown>>({});
  const [offerFor, setOfferFor] = useState<string | null>(null);
  const [offerTitle, setOfferTitle] = useState('');
  const [offerPct, setOfferPct] = useState('10');
  const [offerFrom, setOfferFrom] = useState('');
  const [offerUntil, setOfferUntil] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const activeUnit = units.find((u) => pickStr(u, 'id') === unitId) ?? unitDetail;
  const unitStatus = pickStr(activeUnit, 'status') || 'active';

  const loadUnits = async () => {
    const rows = await gruhUdyog.myUnits().catch(() => []);
    const list = asRecords(rows);
    setUnits(list);
    if (list.length > 0 && !unitId) {
      setUnitId(pickStr(list[0], 'id'));
    }
  };

  useEffect(() => {
    void loadUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!unitId) return;
    let alive = true;
    const load = async () => {
      const [u, d, p, o, off, c] = await Promise.all([
        gruhUdyog.unit(unitId).catch(() => ({})),
        gruhUdyog.unitDashboard(unitId).catch(() => ({})),
        gruhUdyog.products(unitId).catch(() => []),
        gruhUdyog.unitOrders(unitId).catch(() => []),
        gruhUdyog.offers(unitId).catch(() => []),
        gruhUdyog.certifications(unitId).catch(() => []),
      ]);
      if (!alive) return;
      setUnitDetail(asRecord(u));
      setDashboard(asRecord(d));
      setProducts(asRecords(p));
      setOrders(asRecords(o));
      setOffers(asRecords(off));
      setCerts(asRecords(c));
    };
    void load();
    return () => {
      alive = false;
    };
  }, [unitId]);

  const openProfile = () => {
    setUName(pickStr(activeUnit, 'name'));
    setUDesc(pickStr(activeUnit, 'description'));
    setUVillage(pickStr(activeUnit, 'village'));
    setUDistrict(pickStr(activeUnit, 'district'));
    setUState(pickStr(activeUnit, 'state'));
    setProfileOpen((o) => !o);
  };

  const saveProfile = async () => {
    if (!unitId || busy) return;
    setBusy('profile');
    try {
      const updated = await gruhUdyog.updateUnit(unitId, {
        name: uName.trim() || undefined,
        description: uDesc.trim() || undefined,
        village: uVillage.trim() || undefined,
        district: uDistrict.trim() || undefined,
        state: uState.trim() || undefined,
      });
      setUnitDetail(asRecord(updated));
      flash('ok', 'Unit profile updated.');
      setProfileOpen(false);
      await loadUnits();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const toggleUnitStatus = async () => {
    if (!unitId || busy) return;
    const pausing = unitStatus !== 'paused';
    setBusy('unit-status');
    try {
      const updated = pausing
        ? await gruhUdyog.pauseUnit(unitId)
        : await gruhUdyog.resumeUnit(unitId);
      setUnitDetail(asRecord(updated));
      flash('ok', pausing ? 'Unit paused — products are hidden from the mall.' : 'Unit resumed — you can publish and sell again.');
      await loadUnits();
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const openBatches = async (productId: string) => {
    if (batchFor === productId) {
      setBatchFor(null);
      return;
    }
    setBatchFor(productId);
    setOfferFor(null);
    try {
      const res = await gruhUdyog.product(productId);
      setBatchDetail(asRecord(res));
    } catch {
      setBatchDetail({});
    }
  };

  const refreshBatches = async (productId: string) => {
    try {
      const res = await gruhUdyog.product(productId);
      setBatchDetail(asRecord(res));
    } catch {
      setBatchDetail({});
    }
  };

  const addBatch = async (productId: string) => {
    if (!batchQty.trim() || !batchProduced || busy) return;
    setBusy('batch');
    try {
      await gruhUdyog.addBatch(productId, {
        batchNo: batchNo.trim() || undefined,
        quantity: Number(batchQty) || 0,
        productionDate: batchProduced,
        expiryDate: batchExpiry || undefined,
      });
      flash('ok', `Batch ${batchNo.trim() || 'added'} recorded for traceability.`);
      setBatchNo('');
      setBatchQty('10');
      setBatchProduced('');
      setBatchExpiry('');
      await refreshBatches(productId);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const setBatchStatus = async (batchId: string, productId: string, status: string) => {
    if (busy) return;
    setBusy(batchId);
    try {
      await gruhUdyog.updateBatchStatus(batchId, status);
      flash('ok', `Batch marked ${status.replace('_', ' ')}.`);
      await refreshBatches(productId);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const openOffer = (productId: string) => {
    setOfferFor((cur) => (cur === productId ? null : productId));
    setBatchFor(null);
  };

  const addOffer = async (productId: string) => {
    if (!offerTitle.trim() || !offerFrom || !offerUntil || busy) return;
    setBusy('offer');
    try {
      await gruhUdyog.addOffer(productId, {
        title: offerTitle.trim(),
        discountPercent: Number(offerPct) || 10,
        validFrom: offerFrom,
        validUntil: offerUntil,
      });
      flash('ok', `Offer "${offerTitle.trim()}" is live — the mall price updates automatically.`);
      setOfferTitle('');
      setOfferPct('10');
      setOfferFrom('');
      setOfferUntil('');
      setOfferFor(null);
      const off = await gruhUdyog.offers(unitId ?? '').catch(() => []);
      setOffers(asRecords(off));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const removeOffer = async (offerId: string) => {
    if (busy) return;
    setBusy(offerId);
    try {
      await gruhUdyog.removeOffer(offerId);
      flash('ok', 'Offer removed — mall price reverts to the regular selling price.');
      setOffers((prev) => prev.filter((o) => pickStr(o, 'id', 'offerId') !== offerId));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const run = async (key: string, fn: () => Promise<unknown>, okMsg: string, reload = true) => {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      if (okMsg) flash('ok', okMsg);
      if (reload && unitId) {
        const [p, o] = await Promise.all([
          gruhUdyog.products(unitId).catch(() => []),
          gruhUdyog.unitOrders(unitId).catch(() => []),
        ]);
        setProducts(asRecords(p));
        setOrders(asRecords(o));
      }
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const createUnit = async () => {
    if (!newUnitName.trim() || busy) return;
    setBusy('unit');
    try {
      const res = await gruhUdyog.createUnit({ name: newUnitName.trim(), category: 'Other' });
      flash('ok', `Gruh Udyog unit "${newUnitName.trim()}" registered.`);
      setNewUnitName('');
      const rec = asRecord(res);
      const id = pickStr(rec, 'id') || pickStr(asRecord(pick(rec, 'unit')), 'id');
      await loadUnits();
      if (id) setUnitId(id);
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const addProduct = async () => {
    if (!unitId || !prodName.trim() || busy) return;
    setBusy('product');
    try {
      const mrp = Number(prodMrp) || Number(prodPrice) || 0;
      const price = Number(prodPrice) || mrp;
      await gruhUdyog.addProduct(unitId, {
        title: prodName.trim(),
        category: prodCategory,
        mrp,
        price,
        stock: Number(prodStock) || 0,
      });
      flash('ok', `"${prodName.trim()}" added to your catalogue. Publish it to list on the Krishi Mall.`);
      setProdName('');
      setProdMrp('');
      setProdPrice('');
      setProdStock('10');
      setShowAddProduct(false);
      const p = await gruhUdyog.products(unitId).catch(() => []);
      setProducts(asRecords(p));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (units.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 max-w-xl space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Home className="w-4 h-4 text-pink-600" /> Register Your Home Enterprise
        </h3>
        <p className="text-xs text-slate-500">
          A Gruh Udyog unit lets SHG women list papad, masala, ghee, pickles and handicrafts directly on the Krishi Mall — zero brokerage.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newUnitName}
            onChange={(e) => setNewUnitName(e.target.value)}
            placeholder="Unit name (e.g. Laxmi Papad Udyog)"
            className="flex-1 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
          />
          <button
            onClick={() => void createUnit()}
            disabled={!newUnitName.trim() || busy === 'unit'}
            className="px-4 py-2.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {busy === 'unit' ? 'Registering…' : 'Register'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Unit switcher + dashboard */}
      <div className="flex flex-wrap items-center gap-2">
        {units.map((u) => {
          const id = pickStr(u, 'id');
          return (
            <button
              key={id}
              onClick={() => setUnitId(id)}
              className={cn(
                'px-4 py-2 rounded-2xl text-xs font-bold border transition-colors',
                unitId === id
                  ? 'bg-pink-600 text-white border-pink-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300'
              )}
            >
              {pickStr(u, 'name') || 'Unit'}
            </button>
          );
        })}
      </div>

      {/* Unit profile */}
      {Object.keys(activeUnit).length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                {pickStr(activeUnit, 'name') || 'Unit'}
                <StatusBadge status={unitStatus} />
              </h3>
              <p className="text-[11px] text-slate-400 capitalize">
                {pickStr(activeUnit, 'category') || 'Home enterprise'}
                {pickStr(activeUnit, 'shgName') ? ` · ${pickStr(activeUnit, 'shgName')} SHG` : ''}
              </p>
              {pickStr(activeUnit, 'description') && (
                <p className="text-xs text-slate-600 mt-1">{pickStr(activeUnit, 'description')}</p>
              )}
              <p className="text-[11px] text-slate-400 mt-0.5">
                {[pickStr(activeUnit, 'village'), pickStr(activeUnit, 'district'), pickStr(activeUnit, 'state')]
                  .filter(Boolean)
                  .join(', ') || 'Location not set'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={openProfile}
                className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-[11px] font-bold rounded-xl"
              >
                Edit Profile
              </button>
              <button
                onClick={() => void toggleUnitStatus()}
                disabled={busy === 'unit-status'}
                className={cn(
                  'px-3 py-1.5 text-[11px] font-bold rounded-xl disabled:opacity-40',
                  unitStatus === 'paused'
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-amber-50 border border-amber-200 text-amber-700'
                )}
              >
                {unitStatus === 'paused' ? 'Resume Unit' : 'Pause Unit'}
              </button>
            </div>
          </div>

          {profileOpen && (
            <div className="p-3 rounded-2xl border border-pink-100 bg-pink-50/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={uName}
                onChange={(e) => setUName(e.target.value)}
                placeholder="Unit name"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <input
                type="text"
                value={uVillage}
                onChange={(e) => setUVillage(e.target.value)}
                placeholder="Village"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <input
                type="text"
                value={uDistrict}
                onChange={(e) => setUDistrict(e.target.value)}
                placeholder="District"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <input
                type="text"
                value={uState}
                onChange={(e) => setUState(e.target.value)}
                placeholder="State"
                className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <textarea
                value={uDesc}
                onChange={(e) => setUDesc(e.target.value)}
                rows={2}
                placeholder="What does your unit make? (shows on the mall)"
                className="sm:col-span-2 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
              />
              <button
                onClick={() => void saveProfile()}
                disabled={busy === 'profile' || !uName.trim()}
                className="sm:col-span-2 px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
              >
                {busy === 'profile' ? 'Saving…' : 'Save Profile'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Sales', value: formatCurrency(pickNum(dashboard, 'totalSales', 'revenue')), icon: IndianRupee },
          { label: 'Orders', value: formatNumber(pickNum(dashboard, 'orders', 'orderCount')), icon: ClipboardList },
          { label: 'Products Live', value: formatNumber(products.length), icon: Package },
          { label: 'Live Offers', value: formatNumber(offers.length), icon: BadgePercent },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <s.icon className="w-4 h-4 text-pink-600 mb-1.5" />
            <p className="text-lg font-black text-slate-900">{s.value}</p>
            <p className="text-[10px] uppercase font-bold text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Orders */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h4 className="font-bold text-xs text-slate-900">Orders</h4>
        {orders.length === 0 ? (
          <p className="text-xs text-slate-400">No orders yet — share your catalogue in the village WhatsApp groups.</p>
        ) : (
          <div className="space-y-2">
            {orders.map((o, i) => {
              const id = pickStr(o, 'id', 'orderId') || String(i);
              const status = pickStr(o, 'status') || 'placed';
              return (
                <div key={id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">
                        {pickStr(o, 'productName', 'product') || 'Order'} × {pickNum(o, 'quantity') || 1}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {pickStr(o, 'buyerName', 'customer') || 'Customer'} ·{' '}
                        {formatCurrency(pickNum(o, 'total', 'amount', 'priceRupees'))} ·{' '}
                        {formatDateTime(pickStr(o, 'createdAt')) || '—'}
                      </p>
                    </div>
                    <StatusBadge status={status} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {status === 'placed' && (
                      <>
                        <button
                          onClick={() =>
                            void run(`a-${id}`, () => gruhUdyog.acceptOrder(id), 'Order accepted — buyer has been notified.')
                          }
                          disabled={busy !== null}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() =>
                            void run(
                              `r-${id}`,
                              () => gruhUdyog.rejectOrder(id, 'Unable to fulfil right now'),
                              'Order rejected — stock the buyer know.'
                            )
                          }
                          disabled={busy !== null}
                          className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {['accepted', 'packed'].includes(status) && (
                      <button
                        onClick={() =>
                          void run(`s-${id}`, () => gruhUdyog.updateOrderStatus(id, 'dispatched'), 'Order marked as dispatched.')
                        }
                        disabled={busy !== null}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                      >
                        Mark Dispatched
                      </button>
                    )}
                    {status === 'dispatched' && (
                      <button
                        onClick={() =>
                          void run(`d-${id}`, () => gruhUdyog.updateOrderStatus(id, 'delivered'), 'Order marked as delivered.')
                        }
                        disabled={busy !== null}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                      >
                        Mark Delivered
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Products */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-xs text-slate-900">Products</h4>
          <button
            onClick={() => setShowAddProduct((s) => !s)}
            className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold rounded-xl flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add Product
          </button>
        </div>

        {showAddProduct && (
          <div className="p-3 rounded-2xl border border-pink-100 bg-pink-50/50 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input
              type="text"
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              placeholder="Product name (e.g. Methi Papad 200g)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <select
              value={prodCategory}
              onChange={(e) => setProdCategory(e.target.value)}
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600 bg-white"
            >
              {GRUH_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={prodMrp}
              onChange={(e) => setProdMrp(e.target.value)}
              placeholder="MRP (₹)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <input
              type="number"
              min={0}
              value={prodPrice}
              onChange={(e) => setProdPrice(e.target.value)}
              placeholder="Selling price (₹)"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <input
              type="number"
              min={0}
              value={prodStock}
              onChange={(e) => setProdStock(e.target.value)}
              placeholder="Stock"
              className="px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
            />
            <button
              onClick={() => void addProduct()}
              disabled={!prodName.trim() || busy === 'product'}
              className="px-3 py-2 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
            >
              {busy === 'product' ? 'Saving…' : 'Save'}
            </button>
          </div>
        )}

        {products.length === 0 ? (
          <p className="text-xs text-slate-400">No products yet — add your first item above.</p>
        ) : (
          <div className="space-y-2">
            {products.map((p, i) => {
              const id = pickStr(p, 'id', 'productId') || String(i);
              const productStatus = pickStr(p, 'status') || 'draft';
              const published = productStatus === 'live';
              const stock = pickNum(p, 'stock', 'stockQty');
              const batches =
                batchFor === id ? asRecords(pick(batchDetail, 'batches')) : [];
              const activeOffer =
                batchFor === id ? asRecord(pick(batchDetail, 'activeOffer')) : {};
              return (
                <div key={id} className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 space-y-2">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <div>
                      <p className="font-bold text-slate-800">
                        {pickStr(p, 'title', 'name') || 'Product'}{' '}
                        <span className="text-slate-400 font-semibold">
                          · {formatCurrency(pickNum(p, 'price', 'priceRupees'))}
                          {pickNum(p, 'mrp') > pickNum(p, 'price')
                            ? ` (MRP ${formatCurrency(pickNum(p, 'mrp'))})`
                            : ''}
                        </span>
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {pickStr(p, 'category') || '—'} · Stock: {formatNumber(stock)}
                      </p>
                    </div>
                    <StatusBadge status={published ? 'active' : productStatus} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const next = stock + 5;
                        void run(
                          `st-${id}`,
                          () => gruhUdyog.updateStock(id, next),
                          '',
                        ).then(() => {
                          setProducts((prev) =>
                            prev.map((row) =>
                              (pickStr(row, 'id', 'productId') || '') === id
                                ? { ...row, stock: next }
                                : row
                            )
                          );
                          return undefined;
                        });
                      }}
                      disabled={busy !== null}
                      className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-xl"
                    >
                      +5 Stock
                    </button>
                    <button
                      onClick={() => void openBatches(id)}
                      disabled={busy !== null}
                      className={cn(
                        'px-3 py-1.5 text-[11px] font-bold rounded-xl disabled:opacity-40',
                        batchFor === id
                          ? 'bg-pink-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Batches
                    </button>
                    <button
                      onClick={() => openOffer(id)}
                      disabled={busy !== null}
                      className={cn(
                        'px-3 py-1.5 text-[11px] font-bold rounded-xl disabled:opacity-40',
                        offerFor === id
                          ? 'bg-pink-600 text-white'
                          : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                      )}
                    >
                      Offer
                    </button>
                    {published ? (
                      <button
                        onClick={() =>
                          void run(`u-${id}`, () => gruhUdyog.unpublishProduct(id), 'Product unpublished — hidden from the mall.')
                        }
                        disabled={busy !== null}
                        className="px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold rounded-xl"
                      >
                        Unpublish
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          void run(`p-${id}`, () => gruhUdyog.publishProduct(id), 'Product is now live on the Krishi Mall!')
                        }
                        disabled={busy !== null}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl"
                      >
                        Publish
                      </button>
                    )}
                    <button
                      onClick={() =>
                        void run(
                          `del-${id}`,
                          async () => {
                            await gruhUdyog.removeProduct(id);
                          },
                          'Product deleted.'
                        )
                      }
                      disabled={busy !== null}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold rounded-xl"
                    >
                      Delete
                    </button>
                  </div>

                  {/* Batches panel */}
                  {batchFor === id && (
                    <div className="p-3 rounded-2xl border border-pink-100 bg-white space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-700">Production Batches</p>
                        {Object.keys(activeOffer).length > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Offer: {pickStr(activeOffer, 'title')} (−{pickNum(activeOffer, 'discountPercent')}%)
                          </span>
                        )}
                      </div>
                      {batches.length === 0 ? (
                        <p className="text-[11px] text-slate-400">
                          No batches recorded — add one for FSSAI traceability.
                        </p>
                      ) : (
                        <div className="space-y-1.5">
                          {batches.map((b, j) => {
                            const batchId = pickStr(b, 'id') || String(j);
                            const bStatus = pickStr(b, 'status') || 'active';
                            return (
                              <div
                                key={batchId}
                                className="flex flex-wrap items-center justify-between gap-2 text-[11px] p-2 rounded-xl bg-slate-50 border border-slate-100"
                              >
                                <div>
                                  <span className="font-bold text-slate-800">
                                    {pickStr(b, 'batchNo') || `Batch ${j + 1}`}
                                  </span>{' '}
                                  · {formatNumber(pickNum(b, 'quantity'))} pcs
                                  <span className="text-slate-400">
                                    {' '}
                                    · made {pickStr(b, 'productionDate') || '—'}
                                    {pickStr(b, 'expiryDate') ? ` · expires ${pickStr(b, 'expiryDate')}` : ''}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <StatusBadge status={bStatus} />
                                  {bStatus !== 'sold_out' && bStatus !== 'expired' && (
                                    <select
                                      value=""
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          void setBatchStatus(batchId, id, e.target.value);
                                        }
                                      }}
                                      disabled={busy === batchId}
                                      className="px-2 py-1 rounded-lg border border-slate-200 text-[10px] font-bold bg-white"
                                    >
                                      <option value="">Mark…</option>
                                      {BATCH_STATUSES.map((s) => (
                                        <option key={s} value={s}>
                                          {s === 'sold_out' ? 'Sold out' : 'Expired'}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
                        <input
                          type="text"
                          value={batchNo}
                          onChange={(e) => setBatchNo(e.target.value)}
                          placeholder="Batch no (auto)"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="number"
                          min={1}
                          value={batchQty}
                          onChange={(e) => setBatchQty(e.target.value)}
                          placeholder="Qty"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="date"
                          value={batchProduced}
                          onChange={(e) => setBatchProduced(e.target.value)}
                          title="Production date"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="date"
                          value={batchExpiry}
                          onChange={(e) => setBatchExpiry(e.target.value)}
                          title="Expiry date (optional)"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <button
                          onClick={() => void addBatch(id)}
                          disabled={busy === 'batch' || !batchQty.trim() || !batchProduced}
                          className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                        >
                          {busy === 'batch' ? 'Adding…' : 'Add Batch'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Offer panel */}
                  {offerFor === id && (
                    <div className="p-3 rounded-2xl border border-pink-100 bg-white space-y-2">
                      <p className="text-[11px] font-bold text-slate-700">Time-boxed Discount Offer</p>
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                        <input
                          type="text"
                          value={offerTitle}
                          onChange={(e) => setOfferTitle(e.target.value)}
                          placeholder="Offer title"
                          className="col-span-2 px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="number"
                          min={1}
                          max={90}
                          value={offerPct}
                          onChange={(e) => setOfferPct(e.target.value)}
                          placeholder="% off"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="date"
                          value={offerFrom}
                          onChange={(e) => setOfferFrom(e.target.value)}
                          title="Valid from"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                        <input
                          type="date"
                          value={offerUntil}
                          onChange={(e) => setOfferUntil(e.target.value)}
                          title="Valid until"
                          className="px-2.5 py-1.5 text-[11px] rounded-xl border border-slate-300 focus:outline-none focus:border-pink-600"
                        />
                      </div>
                      <button
                        onClick={() => void addOffer(id)}
                        disabled={busy === 'offer' || !offerTitle.trim() || !offerFrom || !offerUntil}
                        className="px-3 py-1.5 bg-pink-600 hover:bg-pink-700 disabled:opacity-40 text-white text-[11px] font-bold rounded-xl"
                      >
                        {busy === 'offer' ? 'Activating…' : 'Activate Offer'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Offers */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
          <BadgePercent className="w-4 h-4 text-pink-600" /> Offers
        </h4>
        {offers.length === 0 ? (
          <p className="text-xs text-slate-400">
            No offers yet — open a product above and tap "Offer" to run a time-boxed discount on the mall.
          </p>
        ) : (
          <div className="space-y-2">
            {offers.map((o, i) => {
              const offerId = pickStr(o, 'id', 'offerId') || String(i);
              const productName = pickStr(o, 'productTitle', 'productName');
              return (
                <div
                  key={offerId}
                  className="flex flex-wrap items-center justify-between gap-2 text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100"
                >
                  <div>
                    <span className="font-bold text-slate-800">{pickStr(o, 'title') || 'Offer'}</span>
                    <span className="text-pink-700 font-black"> −{pickNum(o, 'discountPercent')}%</span>
                    <p className="text-[11px] text-slate-400">
                      {productName ? `${productName} · ` : ''}₹{formatNumber(pickNum(o, 'offerPrice'))} offer price ·{' '}
                      {pickStr(o, 'validFrom') || '—'} → {pickStr(o, 'validUntil') || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={pickStr(o, 'status') || 'active'} />
                    <button
                      onClick={() => void removeOffer(offerId)}
                      disabled={busy === offerId}
                      className="px-2.5 py-1 bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold rounded-lg disabled:opacity-40"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Certifications */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h4 className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
          <Award className="w-4 h-4 text-amber-500" /> Certifications
        </h4>
        {certs.length === 0 ? (
          <button
            onClick={() => {
              if (!unitId || busy) return;
              void run(
                'cert',
                () =>
                  gruhUdyog.addCertification(unitId, {
                    type: 'fssai',
                    number: `GU-${Date.now()}`,
                  }),
                'FSSAI basic certification applied for — verification takes 3–5 working days.'
              );
            }}
            disabled={busy !== null}
            className="px-4 py-2 bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-bold rounded-xl"
          >
            Apply for FSSAI Basic Registration
          </button>
        ) : (
          <div className="space-y-2">
            {certs.map((c, i) => (
              <div key={pickStr(c, 'id') || i} className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                <span className="font-bold text-slate-800">{pickStr(c, 'type', 'name') || 'Certification'}</span>
                <StatusBadge status={pickStr(c, 'status') || 'pending'} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
