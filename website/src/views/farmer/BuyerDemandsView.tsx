import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Layers,
  Building2,
  MapPin,
  Calendar,
  Send,
  Check,
  ShieldCheck,
  BadgeCheck,
  Lock,
  Sprout,
  Package,
  Users,
  Repeat,
  Eye,
} from 'lucide-react';
import { demands, lots, users, apiErrorMessage } from '../../lib/api';
import {
  applyToDemand,
  getMyLeads,
  isKycError,
  isMpinError,
  type Lead,
  type SupplyBasis,
} from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { MpinPad } from '../../components/common/MpinPad';
import { formatCurrency, formatWeight } from '../../lib/utils';
import {
  DIRECT_CONNECT_TERMS,
  FREQUENCY_LABEL,
  SUPPLY_BASIS_LABEL,
} from '../trade/directConnect';
import type { BuyerDemand, ProduceLot } from '../../types';

type DemandRow = BuyerDemand;

type FeedTab = 'matches' | 'all';

const qtyOf = (d: DemandRow): number => d.quantity ?? d.requiredQuantityQuintal ?? 0;
const priceOf = (d: DemandRow): number => d.targetPrice ?? d.maxPrice ?? d.maxPricePerQuintal ?? 0;
const isRecurring = (d: DemandRow): boolean =>
  d.supplyType === 'recurring' || (d.frequency ?? 'oneTime') !== 'oneTime';

/** Server-derived verification badges — identity and business stay distinct. */
export const VerificationBadges: React.FC<{ summary?: BuyerDemand['buyerSummary'] }> = ({ summary }) => {
  if (!summary) return null;
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap">
      {summary.identityVerified && (
        <span
          title="Identity Verified — completed unified KYC"
          className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1"
        >
          <BadgeCheck className="w-3 h-3" /> Identity Verified
        </span>
      )}
      {summary.businessVerified && (
        <span
          title="Business Verified — business documents reviewed"
          className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1"
        >
          <ShieldCheck className="w-3 h-3" /> Business Verified
        </span>
      )}
    </span>
  );
};

export const BuyerDemandsView: React.FC = () => {
  const [tab, setTab] = useState<FeedTab>('matches');
  const [allDemands, setAllDemands] = useState<DemandRow[]>([]);
  const [matchedDemands, setMatchedDemands] = useState<DemandRow[]>([]);
  const [myApplications, setMyApplications] = useState<Lead[]>([]);
  const [myLots, setMyLots] = useState<ProduceLot[]>([]);
  const [me, setMe] = useState<{ kycStatus?: string; vyapariVerified?: boolean }>({});
  const [cropFilter, setCropFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'oneTime' | 'recurring'>('all');
  const [qtyMin, setQtyMin] = useState('');
  const [qtyMax, setQtyMax] = useState('');
  const [supplyDate, setSupplyDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, unknown> = {};
      if (cropFilter) params.crop = cropFilter;
      if (districtFilter) params.district = districtFilter;
      if (typeFilter !== 'all') params.supplyType = typeFilter;
      if (qtyMin) params.quantityMin = Number(qtyMin);
      if (qtyMax) params.quantityMax = Number(qtyMax);
      if (supplyDate) params.supplyDate = supplyDate;
      const [all, matched, apps, myLotsList, meRes] = await Promise.all([
        demands.browse(params),
        demands.matches(),
        getMyLeads('received', undefined, 'demand').catch(() => [] as Lead[]),
        lots.list().catch(() => [] as ProduceLot[]),
        users.getMe().catch(() => ({})),
      ]);
      setAllDemands(all as DemandRow[]);
      setMatchedDemands(matched as DemandRow[]);
      setMyApplications(apps);
      setMyLots(myLotsList);
      setMe(meRes as typeof me);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [cropFilter, districtFilter, typeFilter, qtyMin, qtyMax, supplyDate]);

  useEffect(() => {
    void load();
  }, [load]);

  const kycVerified = me.kycStatus === 'verified' || me.vyapariVerified === true;

  const appFor = (demandId: string): Lead | undefined =>
    myApplications.find((l) => l.demandId === demandId && ['submitted', 'contacted', 'dealDone'].includes(l.status));

  const feed = tab === 'matches' ? matchedDemands : allDemands;

  // ---- detail modal ----
  const [detailDemand, setDetailDemand] = useState<DemandRow | null>(null);

  // ---- apply modal ----
  const [selectedDemand, setSelectedDemand] = useState<DemandRow | null>(null);
  const [offerPrice, setOfferPrice] = useState<number>(0);
  const [offerQuantity, setOfferQuantity] = useState<number>(0);
  const [supplyBasis, setSupplyBasis] = useState<SupplyBasis>('farmGate');
  const [availableDate, setAvailableDate] = useState('');
  const [supplyLocation, setSupplyLocation] = useState('');
  const [canRecur, setCanRecur] = useState<boolean | null>(null);
  const [sourceLotId, setSourceLotId] = useState('');
  const [qualityDetails, setQualityDetails] = useState('');
  const [packagingCapability, setPackagingCapability] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step, setStep] = useState<'form' | 'mpin'>('form');
  const [sending, setSending] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState(false);
  const [mpinKey, setMpinKey] = useState(0);

  const openApply = (demand: DemandRow) => {
    const existing = appFor(demand.id);
    const maxPrice = priceOf(demand);
    setSelectedDemand(demand);
    setOfferPrice(existing?.pricePerUnit ?? (maxPrice > 0 ? Math.max(1, maxPrice - 100) : 0));
    setOfferQuantity(existing?.quantity ?? Math.min(20, qtyOf(demand)));
    setSupplyBasis(existing?.supplyBasis ?? 'farmGate');
    setAvailableDate(existing?.availableDate ?? '');
    setSupplyLocation(existing?.supplyLocation ?? '');
    setCanRecur(existing?.canRecur ?? null);
    setSourceLotId(existing?.sourceLotId ?? '');
    setQualityDetails(existing?.qualityDetails ?? '');
    setPackagingCapability(existing?.packagingCapability ?? '');
    setOfferMessage(existing?.message ?? '');
    setTermsAccepted(Boolean(existing));
    setStep(existing ? 'mpin' : 'form');
    setApplyError(null);
    setApplySuccess(Boolean(existing));
    setMpinKey((k) => k + 1);
  };

  const closeApply = () => {
    setSelectedDemand(null);
    setApplyError(null);
    setApplySuccess(false);
    setStep('form');
  };

  const handlePrefillLot = (lotId: string) => {
    setSourceLotId(lotId);
    const lot = myLots.find((l) => l.id === lotId);
    if (lot && !applySuccess) {
      const lotQty = lot.quantityQuintal ?? 0;
      if (!offerQuantity && lotQty) setOfferQuantity(lotQty);
      if (!availableDate && lot.harvestDate) setAvailableDate(lot.harvestDate.slice(0, 10));
      if (!qualityDetails && lot.variety) setQualityDetails(`${lot.crop} ${lot.variety}`);
    }
  };

  const handleMpinSuccess = async (mpin: string) => {
    if (!selectedDemand) return;
    setSending(true);
    setApplyError(null);
    try {
      const { lead } = await applyToDemand(selectedDemand.id, {
        pricePerUnit: offerPrice,
        quantity: offerQuantity,
        message: offerMessage,
        termsAccepted: true,
        mpin,
        supplyBasis,
        availableDate,
        supplyLocation,
        canRecur: selectedDemand.supplyType === 'recurring' ? Boolean(canRecur) : undefined,
        sourceLotId: sourceLotId || undefined,
        qualityDetails,
        packagingCapability,
      });
      setMyApplications((prev) => [
        lead,
        ...prev.filter((l) => !(l.demandId === selectedDemand.id && l.status !== 'dismissed')),
      ]);
      setApplySuccess(true);
      setNotice(
        `Application submitted to ${selectedDemand.buyerCompany || selectedDemand.buyerName}. Your contact stays private until the buyer reviews and accepts the connection.`,
      );
      setTimeout(() => closeApply(), 1400);
    } catch (err) {
      if (isMpinError(err)) {
        setApplyError('Incorrect MPIN — try again.');
        setMpinKey((k) => k + 1);
      } else if (isKycError(err)) {
        setApplyError('Complete your identity verification (KYC) before applying — your application was not sent.');
        setStep('form');
      } else {
        setApplyError(apiErrorMessage(err));
      }
    } finally {
      setSending(false);
    }
  };

  const filters = useMemo(
    () => (
      <div className="flex flex-wrap gap-2 mt-3">
        <input
          type="text"
          placeholder="Crop"
          value={cropFilter}
          onChange={(e) => setCropFilter(e.target.value)}
          className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-32"
        />
        <input
          type="text"
          placeholder="District"
          value={districtFilter}
          onChange={(e) => setDistrictFilter(e.target.value)}
          className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-32"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5"
        >
          <option value="all">One-time + recurring</option>
          <option value="oneTime">One-time only</option>
          <option value="recurring">Recurring only</option>
        </select>
        <input
          type="number"
          placeholder="Min q"
          value={qtyMin}
          onChange={(e) => setQtyMin(e.target.value)}
          className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-20"
        />
        <input
          type="number"
          placeholder="Max q"
          value={qtyMax}
          onChange={(e) => setQtyMax(e.target.value)}
          className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5 w-20"
        />
        <input
          type="date"
          title="Supply date"
          value={supplyDate}
          onChange={(e) => setSupplyDate(e.target.value)}
          className="text-xs font-semibold bg-white border border-slate-200 rounded-xl px-3 py-1.5"
        />
        <Link
          to="/farmer/industrial/applications"
          className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-1.5 hover:bg-emerald-100 transition-all"
        >
          My Applications ({myApplications.length})
        </Link>
      </div>
    ),
    [cropFilter, districtFilter, typeFilter, qtyMin, qtyMax, supplyDate, myApplications.length]
  );

  const renderCard = (demand: DemandRow) => {
    const existing = appFor(demand.id);
    const recurring = isRecurring(demand);
    return (
      <div
        key={demand.id}
        className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Building2 className="w-4 h-4" />
            </span>
            <div>
              <h4 className="font-extrabold text-base text-slate-900">
                {demand.buyerSummary?.companyName || demand.buyerCompany || demand.companyName || 'Industrial Buyer'}
              </h4>
              <p className="text-[11px] text-slate-400">Buyer: {demand.buyerSummary?.name || demand.buyerName}</p>
            </div>
            <VerificationBadges summary={demand.buyerSummary} />
            {recurring ? (
              <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <Repeat className="w-3 h-3" /> Recurring · {FREQUENCY_LABEL[demand.frequency ?? 'weekly']}
              </span>
            ) : (
              <span className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
                One-time
              </span>
            )}
            {existing && (
              <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" /> Applied — {existing.status === 'contacted' ? 'buyer in contact' : existing.status === 'dealDone' ? 'deal completed' : 'submitted'}
              </span>
            )}
          </div>

          <div className="text-xs text-slate-700 font-medium">
            Crop Needed:{' '}
            <strong className="text-slate-900">
              {demand.crop} {demand.variety && `(${demand.variety})`}
            </strong>
            {(demand.qualityGrade || demand.gradeNotes) && (
              <span className="text-slate-500">
                {' '}
                · Grade {demand.qualityGrade || '—'}
                {demand.gradeNotes ? ` — ${demand.gradeNotes}` : ''}
              </span>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
            {recurring && (
              <p>
                <strong>{demand.quantityPerDelivery ?? '—'} {demand.unit || 'quintal'}</strong> per delivery ·{' '}
                {FREQUENCY_LABEL[demand.frequency ?? 'weekly']}
                {demand.startDate ? ` · from ${demand.startDate}` : ''}
                {demand.endDate ? ` to ${demand.endDate}` : ''}
              </p>
            )}
            <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {demand.deliveryLocation || 'Location on request'}
                {demand.district ? `, ${demand.district}` : ''}
              </span>
              {!recurring && (demand.neededBy || demand.validUntil) && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Needed by: {demand.neededBy || demand.validUntil}
                </span>
              )}
              {demand.packagingRequirements && (
                <span className="flex items-center gap-1">
                  <Package className="w-3.5 h-3.5 text-slate-400" /> {demand.packagingRequirements}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-3 pt-1 text-[10px]">
              {demand.partialAllowed !== false && (
                <span className="flex items-center gap-1 text-emerald-700 font-bold">
                  <Check className="w-3 h-3" /> Partial quantity OK
                </span>
              )}
              {demand.multipleFarmersAllowed !== false && (
                <span className="flex items-center gap-1 text-emerald-700 font-bold">
                  <Users className="w-3 h-3" /> Multiple farmers OK
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-end justify-between gap-3 flex-shrink-0">
          <div className="text-left sm:text-right">
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Volume</span>
            <span className="text-sm font-bold text-slate-800">
              {formatWeight(qtyOf(demand))}
            </span>
            {priceOf(demand) > 0 && (
              <div className="mt-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Price</span>
                <span className="text-xl font-black text-emerald-700">{formatCurrency(priceOf(demand))}</span>
                <span className="text-xs text-slate-500"> /{demand.targetUnit || demand.unit || 'q'}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setDetailDemand(demand)}
              className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs transition-all flex items-center gap-1.5"
            >
              <Eye className="w-3.5 h-3.5" /> Details
            </button>
            <button
              onClick={() => openApply(demand)}
              className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
            >
              <span>{existing ? 'View Application' : 'Apply'}</span>
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Layers className="w-7 h-7 text-emerald-600" />
          Industrial Buyer Requirements
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Industrial buyers post what they need to source. Apply with your quantity, price, availability and supply
          basis — your contact stays private until the buyer reviews and accepts the connection. Sampling, quality,
          price, transport, payment and delivery are settled directly between you two; Agrovercity never holds money.
        </p>
        <div className="flex items-center gap-2 mt-3">
          {(
            [
              { key: 'matches', label: 'Matches your crops', icon: Sprout },
              { key: 'all', label: 'All requirements', icon: Layers },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 ${
                tab === t.key
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>
        {filters}
      </div>

      {!kycVerified && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800">
          Complete your identity verification (KYC) to apply — your contact details are shared only after KYC, terms
          acceptance and MPIN verification.
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between gap-4">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline shrink-0">
            Dismiss
          </button>
        </div>
      )}

      <div className="space-y-4">
        {loading ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading industrial buyer requirements…
          </div>
        ) : feed.length === 0 ? (
          <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            {tab === 'matches'
              ? 'No open requirements match your crops yet. Try the "All requirements" tab or add crops to your profile.'
              : 'No open requirements match these filters. Try widening the crop, area or quantity.'}
          </div>
        ) : (
          feed.map(renderCard)
        )}
      </div>

      {/* Requirement details — farmer-friendly, never private contacts */}
      <ModalSheet
        isOpen={Boolean(detailDemand)}
        onClose={() => setDetailDemand(null)}
        title="Requirement Details"
        maxWidth="md"
      >
        {detailDemand && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-extrabold text-base text-slate-900">
                {detailDemand.buyerSummary?.companyName || detailDemand.buyerCompany || 'Industrial Buyer'}
              </span>
              <VerificationBadges summary={detailDemand.buyerSummary} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Crop</span>
                <span className="font-bold text-slate-800">
                  {detailDemand.crop} {detailDemand.variety ? `(${detailDemand.variety})` : ''}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Total quantity</span>
                <span className="font-bold text-slate-800">
                  {qtyOf(detailDemand)} {detailDemand.unit || 'quintal'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Supply type</span>
                <span className="font-bold text-slate-800">
                  {isRecurring(detailDemand)
                    ? `${FREQUENCY_LABEL[detailDemand.frequency ?? 'weekly']} recurring — ${detailDemand.quantityPerDelivery ?? '—'} ${detailDemand.unit || 'quintal'} per delivery`
                    : 'One-time'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Schedule</span>
                <span className="font-bold text-slate-800">
                  {isRecurring(detailDemand)
                    ? `${detailDemand.startDate || 'flexible start'} → ${detailDemand.endDate || 'ongoing'}`
                    : detailDemand.neededBy || 'Flexible'}
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Delivery / collection</span>
                <span className="font-bold text-slate-800">{detailDemand.deliveryLocation || '—'}</span>
                {detailDemand.transportArrangement && (
                  <span className="text-slate-500 block">{detailDemand.transportArrangement}</span>
                )}
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Target price</span>
                <span className="font-bold text-emerald-800">
                  {priceOf(detailDemand) > 0 ? `${formatCurrency(priceOf(detailDemand))} /${detailDemand.targetUnit || detailDemand.unit || 'q'}` : 'Not disclosed'}
                </span>
              </div>
            </div>
            {(detailDemand.qualityGrade || detailDemand.gradeNotes || detailDemand.qualityConditions) && (
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Quality</span>
                {detailDemand.qualityGrade && <p>Grade {detailDemand.qualityGrade}</p>}
                {detailDemand.gradeNotes && <p>{detailDemand.gradeNotes}</p>}
                {detailDemand.qualityConditions && <p>Acceptance: {detailDemand.qualityConditions}</p>}
              </div>
            )}
            {(detailDemand.packagingRequirements || detailDemand.labellingRequirements || detailDemand.samplingRequirements) && (
              <div className="p-3 bg-slate-50 rounded-2xl space-y-1">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Packaging & sampling</span>
                {detailDemand.packagingRequirements && <p>Packaging: {detailDemand.packagingRequirements}</p>}
                {detailDemand.labellingRequirements && <p>Labelling: {detailDemand.labellingRequirements}</p>}
                {detailDemand.samplingRequirements && <p>Sampling/inspection: {detailDemand.samplingRequirements}</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-[10px] font-bold">
              {detailDemand.partialAllowed !== false && (
                <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                  Partial quantity allowed
                </span>
              )}
              {detailDemand.multipleFarmersAllowed !== false && (
                <span className="px-2 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                  Multiple farmers allowed
                </span>
              )}
            </div>
            {detailDemand.notes && <p className="text-slate-600 bg-slate-50 rounded-2xl p-3">{detailDemand.notes}</p>}
            <p className="text-[10px] text-slate-400 leading-relaxed">
              Agrovercity only connects both parties — sampling, final quantity and price, transport, packaging,
              delivery, payment, invoices, supply agreements and disputes are handled directly between you and the
              buyer.
            </p>
            <button
              onClick={() => {
                setDetailDemand(null);
                openApply(detailDemand);
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" /> Apply to supply
            </button>
          </div>
        )}
      </ModalSheet>

      {/* Apply modal: quote → availability → terms → MPIN */}
      <ModalSheet
        isOpen={Boolean(selectedDemand)}
        onClose={closeApply}
        title={applySuccess ? 'Application Submitted' : 'Apply to Supply'}
        description={
          selectedDemand
            ? `Your quote for ${selectedDemand.crop}. Contacts unlock only after the buyer accepts the connection.`
            : undefined
        }
        maxWidth="md"
      >
        {applySuccess ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <span className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Check className="w-8 h-8" />
            </span>
            <p className="text-sm font-bold text-slate-900">Application submitted</p>
            <p className="text-xs text-slate-500 max-w-sm">
              {selectedDemand?.buyerCompany || selectedDemand?.buyerName} can review your quote now. Your phone and
              WhatsApp stay hidden until the buyer accepts the connection — then both of you can call, WhatsApp and
              chat.
            </p>
          </div>
        ) : step === 'form' ? (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Required crop:</span>
                <span className="font-bold text-slate-900">
                  {selectedDemand?.crop} {selectedDemand?.variety ? `(${selectedDemand?.variety})` : ''}
                </span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Total quantity:</span>
                <span className="font-bold text-slate-900">
                  {selectedDemand ? `${qtyOf(selectedDemand)} ${selectedDemand.unit || 'quintal'}` : ''}
                </span>
              </div>
              {priceOf(selectedDemand ?? ({} as DemandRow)) > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Buyer target:</span>
                  <span className="font-bold text-emerald-800">
                    {formatCurrency(priceOf(selectedDemand!))}/
                    {selectedDemand?.targetUnit || selectedDemand?.unit || 'q'}
                  </span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantity offered ({selectedDemand?.unit || 'q'})</label>
                <input
                  type="number"
                  value={offerQuantity || ''}
                  onChange={(e) => setOfferQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your price (₹/{selectedDemand?.targetUnit || selectedDemand?.unit || 'q'})</label>
                <input
                  type="number"
                  value={offerPrice || ''}
                  onChange={(e) => setOfferPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 text-emerald-800"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Supply basis</label>
                <select
                  value={supplyBasis}
                  onChange={(e) => setSupplyBasis(e.target.value as SupplyBasis)}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 bg-white"
                >
                  {(Object.keys(SUPPLY_BASIS_LABEL) as SupplyBasis[]).map((b) => (
                    <option key={b} value={b}>
                      {SUPPLY_BASIS_LABEL[b]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Available / harvest date</label>
                <input
                  type="date"
                  value={availableDate}
                  onChange={(e) => setAvailableDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Farm / supply location</label>
              <input
                value={supplyLocation}
                onChange={(e) => setSupplyLocation(e.target.value)}
                placeholder="Village, District"
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
              />
            </div>

            {selectedDemand?.supplyType === 'recurring' && (
              <div className="p-3 bg-violet-50 border border-violet-200 rounded-2xl space-y-2">
                <p className="text-xs font-bold text-violet-900">
                  This is a recurring requirement — {FREQUENCY_LABEL[selectedDemand.frequency ?? 'weekly']},{' '}
                  {selectedDemand.quantityPerDelivery} {selectedDemand.unit || 'quintal'} per delivery.
                </p>
                <div className="flex gap-2">
                  {[
                    { value: true, label: 'I can supply regularly' },
                    { value: false, label: 'One-time only' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => setCanRecur(opt.value)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                        canRecur === opt.value
                          ? 'bg-violet-600 border-violet-600 text-white'
                          : 'bg-white border-violet-200 text-violet-700'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Prefill from my produce lot (optional)</label>
              <select
                value={sourceLotId}
                onChange={(e) => handlePrefillLot(e.target.value)}
                className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white"
              >
                <option value="">— none —</option>
                {myLots
                  .filter((l) => l.status === 'open')
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.crop} {l.variety ? `(${l.variety})` : ''} · {(l.quantityQuintal ?? 0)} q
                    </option>
                  ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quality details</label>
                <input
                  value={qualityDetails}
                  onChange={(e) => setQualityDetails(e.target.value)}
                  placeholder="Grade, moisture, variety…"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Packaging capability</label>
                <input
                  value={packagingCapability}
                  onChange={(e) => setPackagingCapability(e.target.value)}
                  placeholder="50kg gunny bags…"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Short message to the buyer</label>
              <textarea
                rows={2}
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600"
              />
              <span className="text-[11px] text-slate-600 leading-relaxed">{DIRECT_CONNECT_TERMS}</span>
            </label>

            {applyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                {applyError}
              </div>
            )}

            <button
              type="button"
              disabled={!termsAccepted || offerPrice <= 0 || offerQuantity <= 0 || !availableDate || (selectedDemand?.supplyType === 'recurring' && canRecur === null)}
              onClick={() => {
                setApplyError(null);
                setMpinKey((k) => k + 1);
                setStep('mpin');
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" /> Continue — Verify MPIN
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center justify-between">
              <span>
                Quote: <strong className="text-slate-900">{offerQuantity} {selectedDemand?.unit || 'q'}</strong> @{' '}
                <strong className="text-emerald-800">{formatCurrency(offerPrice)}/{selectedDemand?.unit || 'q'}</strong> ·{' '}
                {SUPPLY_BASIS_LABEL[supplyBasis]}
              </span>
              <button type="button" onClick={() => setStep('form')} className="font-bold text-emerald-700 hover:underline">
                Edit
              </button>
            </div>
            <MpinPad
              key={mpinKey}
              onSuccess={(mpin) => void handleMpinSuccess(mpin)}
              title="Verify MPIN to Submit Application"
              subtitle="Confirms your identity and acknowledges contact sharing once the buyer accepts"
            />
            {applyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                {applyError}
              </div>
            )}
            {sending && (
              <div className="py-2 text-center text-xs font-bold text-slate-500 animate-pulse">
                Verifying & submitting application…
              </div>
            )}
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
