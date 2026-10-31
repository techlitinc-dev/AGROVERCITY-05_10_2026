import React, { useCallback, useEffect, useState } from 'react';
import {
  MapPin,
  Droplets,
  Calendar,
  Star,
  Flag,
  ShieldAlert,
  BadgeCheck,
  Clock,
  XCircle,
  Mountain,
} from 'lucide-react';
import { land, ratings, users, apiErrorMessage } from '../../lib/api';
import { isKycError } from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RateUserModal } from '../../components/common/RateUserModal';
import { UserVerificationBadge } from '../../components/common/UserVerificationBadge';
import { formatCurrency } from '../../lib/utils';
import {
  LAND_DIRECT_CONNECT_TERMS,
  LandContactActions,
  LandReportModal,
  LandOutcomeModal,
  NegotiationChecklist,
} from '../land/shared';

interface ListingRow {
  id: string;
  village: string;
  taluka?: string;
  district: string;
  state?: string;
  areaAcres: number;
  irrigated?: boolean | null;
  waterSource?: string | null;
  expectedRentRupees: number;
  rentUnit?: string;
  availableFrom?: string | null;
  minDurationMonths?: number | null;
  maxDurationMonths?: number | null;
  soilType?: string | null;
  electricityAvailable?: boolean | null;
  roadAccess?: string | null;
  currentCropStatus?: string | null;
  permittedCrops?: string | null;
  notes?: string | null;
  photos?: string[];
  surveyNumber?: string | null;
  landlordName?: string;
  landlordVerified?: boolean;
  landVerified?: boolean;
  status?: string;
  createdAt?: string;
}

interface RequestRow {
  id: string;
  status: string;
  listingId: string;
  listingVillage?: string;
  listingDistrict?: string;
  listingAreaAcres?: number;
  listingStatus?: string;
  durationMonths?: number;
  proposedStartDate?: string | null;
  intendedCrop?: string;
  offeredRentRupees?: number | null;
  offeredRentUnit?: string;
  message?: string;
  createdAt?: string;
  landlordId?: string;
  landlordVerified?: boolean;
  landVerified?: boolean;
  landlordContact?: Record<string, unknown> | null;
  chatRoomId?: string;
  outcome?: { outcome?: string; finalRentRupees?: number | null } | null;
  reason?: string;
}

type ReqTab = 'all' | 'pending' | 'contacted' | 'dealDone' | 'closed';
const STATUS_GROUP: Record<Exclude<ReqTab, 'all'>, string[]> = {
  pending: ['pending'],
  contacted: ['contacted'],
  dealDone: ['dealDone'],
  closed: ['rejected', 'dismissed', 'withdrawn', 'cancelled'],
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Requested',
  contacted: 'In contact',
  dealDone: 'Lease completed',
  dismissed: 'Did not happen',
  withdrawn: 'Withdrawn',
  rejected: 'Declined',
};

export const FarmlandView: React.FC = () => {
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [myRequests, setMyRequests] = useState<RequestRow[]>([]);
  const [me, setMe] = useState<{ name?: string; kycStatus?: string }>({});
  const [tab, setTab] = useState<'find' | 'requests'>('find');
  const [reqTab, setReqTab] = useState<ReqTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filters
  const [district, setDistrict] = useState('');
  const [minAcres, setMinAcres] = useState(0);
  const [irrigated, setIrrigated] = useState('');
  const [maxRent, setMaxRent] = useState(0);
  const [availableFrom, setAvailableFrom] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'rentAsc' | 'rentDesc' | 'area' | 'available'>('latest');

  // Detail / interest modals
  const [detail, setDetail] = useState<ListingRow | null>(null);
  const [interestTarget, setInterestTarget] = useState<ListingRow | null>(null);
  const [durationMonths, setDurationMonths] = useState(12);
  const [startDate, setStartDate] = useState('');
  const [intendedCrop, setIntendedCrop] = useState('');
  const [offeredRent, setOfferedRent] = useState(0);
  const [offeredRentUnit, setOfferedRentUnit] = useState('perAcrePerYear');
  const [message, setMessage] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sending, setSending] = useState(false);

  // Actions on requests
  const [outcomeTarget, setOutcomeTarget] = useState<RequestRow | null>(null);
  const [rateTarget, setRateTarget] = useState<RequestRow | null>(null);
  const [reportTarget, setReportTarget] = useState<RequestRow | null>(null);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await land.listings({
        ...(district ? { district } : {}),
        ...(minAcres ? { acres: minAcres } : {}),
        ...(irrigated ? { irrigated } : {}),
        ...(maxRent ? { maxRent } : {}),
        ...(availableFrom ? { availableFrom } : {}),
        ...(sortBy !== 'latest' ? { sort: sortBy } : {}),
      })) as unknown as ListingRow[];
      setListings(res);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [district, minAcres, irrigated, maxRent, availableFrom, sortBy]);

  const loadRequests = useCallback(async () => {
    try {
      const res = (await land.myLeaseRequests()) as unknown as RequestRow[];
      setMyRequests(res);
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    void loadListings();
    users.getMe().then((u) => setMe(u as typeof me)).catch(() => {});
  }, [loadListings]);

  useEffect(() => {
    if (tab === 'requests') void loadRequests();
  }, [tab, loadRequests]);

  const grouped = reqTab === 'all' ? myRequests : myRequests.filter((r) => STATUS_GROUP[reqTab].includes(r.status));

  const openInterest = (l: ListingRow) => {
    setInterestTarget(l);
    setDurationMonths(l.minDurationMonths ?? 12);
    setStartDate(l.availableFrom && l.availableFrom > new Date().toISOString().slice(0, 10) ? l.availableFrom : '');
    setIntendedCrop('');
    setOfferedRent(l.expectedRentRupees || 0);
    setOfferedRentUnit(l.rentUnit || 'perAcrePerYear');
    setMessage('');
    setTermsAccepted(false);
  };

  const submitInterest = async () => {
    if (!interestTarget) return;
    setSending(true);
    setError(null);
    try {
      await land.createLeaseRequest({
        listingId: interestTarget.id,
        durationMonths,
        proposedStartDate: startDate || undefined,
        intendedCrop,
        offeredRentRupees: offeredRent > 0 ? offeredRent : undefined,
        offeredRentUnit: offeredRent > 0 ? offeredRentUnit : undefined,
        message,
        termsAccepted,
      });
      setNotice('Interest sent — the landlord reviews it and can accept your contact request.');
      setInterestTarget(null);
      setTab('requests');
      setReqTab('all');
      await loadRequests();
    } catch (e) {
      if (isKycError(e)) {
        setError('Complete your identity verification (KYC) to send interest — see Profile.');
        setInterestTarget(null);
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setSending(false);
    }
  };

  const submitWithdraw = async (r: RequestRow) => {
    setBusyId(r.id);
    setError(null);
    try {
      await land.recordOutcome(r.id, { outcome: 'withdrawn' });
      setNotice('Request withdrawn.');
      await loadRequests();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const submitRating = async (stars: number, review: string) => {
    if (!rateTarget) return;
    await ratings.submit({
      bookingKind: 'land_lease',
      bookingId: rateTarget.id,
      stars,
      ...(review ? { comment: review } : {}),
    });
    setRateTarget(null);
    setNotice('Thanks! Your rating was recorded.');
  };

  const kycVerified = me.kycStatus === 'verified';

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Mountain className="w-7 h-7 text-emerald-600" />
          Find Farm Land
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Browse farmland for lease. Send interest — after the landlord accepts your contact request, you inspect the
          land and settle everything directly. Agrovercity never holds rent or deposits.
        </p>
      </div>

      {!kycVerified && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Complete identity verification (KYC) to send interest requests.
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {[
          { id: 'find', label: 'Find Farm Land' },
          { id: 'requests', label: `My Land Requests (${myRequests.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'find' | 'requests')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'find' && (
        <>
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District / taluka"
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 w-40"
              />
              <input
                type="number"
                min={0}
                value={minAcres || ''}
                onChange={(e) => setMinAcres(Number(e.target.value))}
                placeholder="Min acres"
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 w-24"
              />
              <input
                type="number"
                min={0}
                value={maxRent || ''}
                onChange={(e) => setMaxRent(Number(e.target.value))}
                placeholder="Max rent ₹"
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 w-28"
              />
              <input
                type="date"
                value={availableFrom}
                onChange={(e) => setAvailableFrom(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                title="Available from"
              />
              <select value={irrigated} onChange={(e) => setIrrigated(e.target.value)} className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white">
                <option value="">Irrigated or rainfed</option>
                <option value="true">Irrigated</option>
                <option value="false">Rainfed</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="ml-auto px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white">
                <option value="latest">Latest</option>
                <option value="rentAsc">Rent: low → high</option>
                <option value="rentDesc">Rent: high → low</option>
                <option value="area">Area</option>
                <option value="available">Availability date</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading farmland…</div>
          ) : listings.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              No farmland matches these filters. Try widening the district or budget.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {listings.map((l) => (
                <div key={l.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <UserVerificationBadge verified={l.landlordVerified} label="Verified Landlord" />
                          {l.landVerified && (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                              <BadgeCheck className="w-2.5 h-2.5" /> Land Docs Verified
                            </span>
                          )}
                        </div>
                        <h3 className="font-extrabold text-base text-slate-900 mt-1">
                          {l.areaAcres} acres · {l.village}
                        </h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {[l.taluka, l.district, l.state].filter(Boolean).join(', ')} · by {l.landlordName || 'Landlord'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-black text-emerald-700">{formatCurrency(l.expectedRentRupees)}</span>
                        <span className="text-[10px] text-slate-400 block">
                          {l.rentUnit === 'totalPerYear' ? '/year total' : '/acre/year'}
                        </span>
                      </div>
                    </div>

                    {l.photos && l.photos.length > 0 && (
                      <div className="h-28 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                        <img
                          src={l.photos[0]}
                          alt={`${l.village} land`}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Water</span>
                        <span className="font-extrabold text-slate-800 flex items-center gap-1">
                          <Droplets className="w-3 h-3 text-emerald-600" />
                          {l.irrigated === true ? 'Irrigated' : l.irrigated === false ? 'Rainfed' : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Available From</span>
                        <span className="font-extrabold text-slate-800 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-600" /> {l.availableFrom || 'Ask landlord'}
                        </span>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                        {l.waterSource ? `${l.waterSource} · ` : ''}
                        {l.minDurationMonths || l.maxDurationMonths
                          ? `Lease ${l.minDurationMonths ?? '…'}–${l.maxDurationMonths ?? '…'} months`
                          : 'Lease duration flexible'}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button onClick={() => setDetail(l)} className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs">
                      View Details
                    </button>
                    <button
                      onClick={() => openInterest(l)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                    >
                      Send Interest
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'requests' && (
        <>
          <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
            {(
              [
                ['all', 'All'],
                ['pending', 'Pending'],
                ['contacted', 'Contacted'],
                ['dealDone', 'Deal Completed'],
                ['closed', 'Declined / Withdrawn'],
              ] as [ReqTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setReqTab(id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  reqTab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {grouped.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              {reqTab === 'all' ? 'No requests yet — find land and send interest.' : `No ${reqTab} requests right now.`}
            </div>
          ) : (
            <div className="space-y-3">
              {grouped.map((r) => (
                <div key={r.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">
                        {r.listingAreaAcres ? `${r.listingAreaAcres} acres · ` : ''}
                        {r.listingVillage || 'Farmland'}
                      </span>
                      <UserVerificationBadge verified={r.landlordVerified} label="Verified Landlord" />
                      {r.landVerified && (
                        <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                          <BadgeCheck className="w-2.5 h-2.5" /> Land Docs Verified
                        </span>
                      )}
                      <StatusBadge status={STATUS_LABEL[r.status] ?? r.status} />
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1 flex-wrap">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {r.durationMonths ? `${r.durationMonths} months` : ''}
                      {r.proposedStartDate ? ` · from ${r.proposedStartDate}` : ''}
                      {r.intendedCrop ? ` · ${r.intendedCrop}` : ''}
                      {r.offeredRentRupees ? ` · offered ${formatCurrency(r.offeredRentRupees)}` : ''}
                    </p>
                    {r.message && <p className="text-[11px] text-slate-500 italic">“{r.message}”</p>}
                    {r.outcome?.finalRentRupees ? (
                      <p className="text-[10px] text-emerald-700 font-bold">
                        Reported closed at {formatCurrency(r.outcome.finalRentRupees)}
                        {r.offeredRentUnit === 'totalPerYear' ? '/year total' : '/acre/year'} (user-reported)
                      </p>
                    ) : null}
                    {r.reason && <p className="text-[10px] text-rose-600">Declined: {r.reason}</p>}
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                    {r.landlordContact && (
                      <LandContactActions contact={r.landlordContact as never} chatRoomId={r.chatRoomId} />
                    )}
                    {r.status === 'pending' && (
                      <button
                        onClick={() => void submitWithdraw(r)}
                        disabled={busyId === r.id}
                        className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" /> Withdraw
                      </button>
                    )}
                    {(r.status === 'contacted' || r.status === 'dealDone' || r.status === 'dismissed') && (
                      <button
                        onClick={() => setOutcomeTarget(r)}
                        className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px]"
                      >
                        Update Outcome
                      </button>
                    )}
                    {r.status === 'dealDone' && (
                      <>
                        <button
                          onClick={() => setRateTarget(r)}
                          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center gap-1"
                        >
                          <Star className="w-3 h-3" /> Rate landlord
                        </button>
                        <button
                          onClick={() => setReportTarget(r)}
                          className="px-2.5 py-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-bold text-[10px] flex items-center gap-1"
                        >
                          <Flag className="w-3 h-3" /> Report
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Details modal */}
      <ModalSheet
        isOpen={Boolean(detail)}
        onClose={() => setDetail(null)}
        title={detail ? `${detail.areaAcres} acres · ${detail.village}` : ''}
        description={detail ? [detail.taluka, detail.district, detail.state].filter(Boolean).join(', ') : undefined}
        maxWidth="sm"
      >
        {detail && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <UserVerificationBadge verified={detail.landlordVerified} label="Verified Landlord" size="sm" />
              {detail.landVerified && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> Land Docs Verified
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Verification means identity/document review only — never guaranteed ownership, title, boundaries, or land quality.
            </p>
            {detail.photos && detail.photos.length > 0 && (
              <div className="h-40 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                <img src={detail.photos[0]} alt="Land" className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Area</span>
                <span className="font-extrabold text-slate-800">{detail.areaAcres} acres</span></div>
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Water</span>
                <span className="font-extrabold text-slate-800">{detail.irrigated === true ? 'Irrigated' : detail.irrigated === false ? 'Rainfed' : '—'}</span></div>
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Expected Rent</span>
                <span className="font-extrabold text-slate-800">{formatCurrency(detail.expectedRentRupees)} {detail.rentUnit === 'totalPerYear' ? '/year total' : '/acre/year'}</span></div>
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Available From</span>
                <span className="font-extrabold text-slate-800">{detail.availableFrom || 'Ask landlord'}</span></div>
              {detail.waterSource && <div className="col-span-2"><span className="text-[10px] font-bold text-slate-400 uppercase block">Water Source</span>
                <span className="font-semibold text-slate-700">{detail.waterSource}</span></div>}
              {detail.soilType && <div className="col-span-2"><span className="text-[10px] font-bold text-slate-400 uppercase block">Soil</span>
                <span className="font-semibold text-slate-700">{detail.soilType}</span></div>}
              {detail.electricityAvailable != null && <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Electricity</span>
                <span className="font-semibold text-slate-700">{detail.electricityAvailable ? 'Available' : 'Not available'}</span></div>}
              {detail.roadAccess && <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Road Access</span>
                <span className="font-semibold text-slate-700">{detail.roadAccess}</span></div>}
              {detail.currentCropStatus && <div className="col-span-2"><span className="text-[10px] font-bold text-slate-400 uppercase block">Current Condition</span>
                <span className="font-semibold text-slate-700">{detail.currentCropStatus}</span></div>}
              {detail.permittedCrops && <div className="col-span-2"><span className="text-[10px] font-bold text-slate-400 uppercase block">Permitted Crops / Restrictions</span>
                <span className="font-semibold text-slate-700">{detail.permittedCrops}</span></div>}
              {(detail.minDurationMonths || detail.maxDurationMonths) && (
                <div className="col-span-2"><span className="text-[10px] font-bold text-slate-400 uppercase block">Lease Duration</span>
                  <span className="font-semibold text-slate-700">{detail.minDurationMonths ?? '…'}–{detail.maxDurationMonths ?? '…'} months</span></div>
              )}
            </div>
            {detail.notes && <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">{detail.notes}</p>}
            <NegotiationChecklist />
            <p className="text-[10px] text-slate-400 leading-relaxed">{LAND_DIRECT_CONNECT_TERMS}</p>
            <button
              onClick={() => { setDetail(null); openInterest(detail); }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
            >
              Send Interest
            </button>
          </div>
        )}
      </ModalSheet>

      {/* Interest modal */}
      <ModalSheet
        isOpen={Boolean(interestTarget)}
        onClose={() => setInterestTarget(null)}
        title={interestTarget ? `Send Interest · ${interestTarget.village}` : ''}
        description="Sending interest does not reserve the land or create a lease — it shares your interest with the landlord."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Lease Duration (months) *</label>
              <input type="number" min={1} max={120} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold" value={durationMonths} onChange={(e) => setDurationMonths(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Proposed Start Date *</label>
              <input type="date" className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Intended Crop / Use *</label>
            <input type="text" className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={intendedCrop} onChange={(e) => setIntendedCrop(e.target.value)} placeholder="e.g. Onion, soybean, dairy fodder" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Offered Rent (₹, optional)</label>
              <input type="number" min={0} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold" value={offeredRent || ''} onChange={(e) => setOfferedRent(Number(e.target.value))} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Rent Unit</label>
              <select className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white" value={offeredRentUnit} onChange={(e) => setOfferedRentUnit(e.target.value)}>
                <option value="perAcrePerYear">Per acre / year</option>
                <option value="totalPerYear">Total / year</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Message (optional)</label>
            <textarea rows={2} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600" />
            <span className="text-[11px] text-slate-600 leading-relaxed">{LAND_DIRECT_CONNECT_TERMS}</span>
          </label>
          <button
            onClick={() => void submitInterest()}
            disabled={!durationMonths || !startDate || !intendedCrop.trim() || !termsAccepted || sending}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send Interest'}
          </button>
          <p className="text-[10px] text-slate-400 text-center">No deposit, no advance, no platform payment — everything is settled directly with the landlord.</p>
        </div>
      </ModalSheet>

      <LandOutcomeModal
        open={Boolean(outcomeTarget)}
        onClose={() => setOutcomeTarget(null)}
        requestId={outcomeTarget?.id ?? null}
        allowWithdraw
        onSaved={() => {
          setNotice('Outcome updated.');
          void loadRequests();
        }}
      />
      <RateUserModal
        open={Boolean(rateTarget)}
        onClose={() => setRateTarget(null)}
        title="Rate the landlord"
        subtitle={rateTarget ? `${rateTarget.listingVillage ?? 'Farmland'} — one rating per connection` : undefined}
        submitLabel="Submit Rating"
        onSubmit={submitRating}
      />
      <LandReportModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetUserId={reportTarget?.landlordId ?? ''}
        requestId={reportTarget?.id}
        onReported={() => setNotice('Issue reported — moderation will review it.')}
      />
    </div>
  );
};
