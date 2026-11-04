import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Wrench,
  MapPin,
  Clock,
  XCircle,
  Search,
  Star,
  BadgeCheck,
  Calendar,
  Flag,
  ShieldAlert,
} from 'lucide-react';
import { equipment, ratings, users, apiErrorMessage, addresses as addressesApi, addressLabel, addressSummary, type SavedAddress } from '../../lib/api';
import type { EquipmentMyBooking } from '../../lib/api/equipment';
import { isKycError } from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RateUserModal } from '../../components/common/RateUserModal';
import { UserVerificationBadge } from '../../components/common/UserVerificationBadge';
import { formatCurrency } from '../../lib/utils';
import { EQUIPMENT_DIRECT_CONNECT_TERMS, ContactActions, ReportIssueModal } from '../equipment/shared';

/** Discovery row — the backend's public equipment card (spec §6). */
interface MachineRow {
  id: string;
  name: string;
  type: string;
  location: string;
  photos?: string[];
  operatorOption?: string;
  capacity?: string;
  pricingUnit?: string;
  hourlyRate: number;
  ratePerDay?: number | null;
  fuelIncluded?: boolean | null;
  travelCharge?: string;
  minBookingQty?: number | null;
  notes?: string;
  nextAvailableDate?: string | null;
  ownerName?: string;
  ownerVerified?: boolean;
  equipmentVerified?: boolean;
  ratingAvg?: number | null;
  ratingCount?: number;
  specs?: string;
  distanceKm?: number;
  available?: boolean;
}

interface SlotRow {
  id: string;
  label: string;
  status: string;
  price: number;
}

type ReqTab = 'pending' | 'upcoming' | 'completed' | 'closed' | 'all';
const STATUS_GROUP: Record<Exclude<ReqTab, 'all'>, string[]> = {
  pending: ['pending'],
  upcoming: ['booked', 'in_progress'],
  completed: ['completed'],
  closed: ['rejected', 'cancelled', 'declined'],
};

const OPERATOR_LABEL: Record<string, string> = {
  withOperator: 'With operator',
  withoutOperator: 'Without operator',
  both: 'Operator optional',
};

export const EquipmentRentalView: React.FC = () => {
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [myBookings, setMyBookings] = useState<EquipmentMyBooking[]>([]);
  const [me, setMe] = useState<{ name?: string; kycStatus?: string }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Browse filters — essential only (spec §6)
  const [tab, setTab] = useState<'browse' | 'requests'>('browse');
  const [reqTab, setReqTab] = useState<ReqTab>('all');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [district, setDistrict] = useState('');
  const [operatorFilter, setOperatorFilter] = useState('');
  const [requiredDate, setRequiredDate] = useState('');
  const [sortBy, setSortBy] = useState<'latest' | 'rateAsc' | 'rateDesc' | 'available'>('latest');

  // Request modal state
  const [selectedMachine, setSelectedMachine] = useState<MachineRow | null>(null);
  const [detailMachine, setDetailMachine] = useState<MachineRow | null>(null);
  const [requestDate, setRequestDate] = useState('');
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const [workLocation, setWorkLocation] = useState('');
  const [workType, setWorkType] = useState('');

  // Farmer-posted "I need a machine" demand board + its create modal.
  const [myDemandPosts, setMyDemandPosts] = useState<Record<string, unknown>[]>([]);
  const [dpModalOpen, setDpModalOpen] = useState(false);
  const [dpBusy, setDpBusy] = useState(false);
  const [dpForm, setDpForm] = useState({
    machineType: '',
    acres: 0,
    dateFrom: '',
    dateTo: '',
    village: '',
    budgetPerHourRupees: 0,
    notes: '',
  });
  const [savedAddrs, setSavedAddrs] = useState<SavedAddress[]>([]);
  useEffect(() => {
    addressesApi
      .list()
      .then(setSavedAddrs)
      .catch(() => undefined);
  }, []);
  const [workQuantity, setWorkQuantity] = useState<number>(1);
  const [workUnit, setWorkUnit] = useState<'acres' | 'hours' | 'days'>('acres');
  const [notes, setNotes] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sending, setSending] = useState(false);

  // Actions on existing requests
  const [cancelTarget, setCancelTarget] = useState<EquipmentMyBooking | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [rateTarget, setRateTarget] = useState<EquipmentMyBooking | null>(null);
  const [reportTarget, setReportTarget] = useState<EquipmentMyBooking | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadMachines = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = (await equipment.list({
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(district ? { district } : {}),
        ...(operatorFilter ? { operator: operatorFilter } : {}),
      })) as unknown as MachineRow[];
      setMachines(res);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, typeFilter, district, operatorFilter]);

  const loadBookings = useCallback(async () => {
    try {
      setMyBookings(await equipment.myBookings());
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  }, []);

  const loadDemandPosts = useCallback(async () => {
    try {
      const rows = (await equipment.myDemandPosts()) as unknown as Record<string, unknown>[];
      setMyDemandPosts(rows);
    } catch {
      setMyDemandPosts([]);
    }
  }, []);

  useEffect(() => {
    void loadMachines();
    void loadDemandPosts();
    users.getMe().then((u) => setMe(u as typeof me)).catch(() => {});
  }, [loadMachines, loadDemandPosts]);

  useEffect(() => {
    if (tab === 'requests') void loadBookings();
  }, [tab, loadBookings]);

  const submitDemandPost = async () => {
    setDpBusy(true);
    setError(null);
    try {
      await equipment.createDemandPost({
        machineType: dpForm.machineType.trim(),
        acres: dpForm.acres || 0,
        dateFrom: dpForm.dateFrom,
        dateTo: dpForm.dateTo,
        ...(dpForm.village.trim() ? { village: dpForm.village.trim() } : {}),
        ...(dpForm.budgetPerHourRupees > 0 ? { budgetPerHourRupees: dpForm.budgetPerHourRupees } : {}),
        ...(dpForm.notes.trim() ? { notes: dpForm.notes.trim() } : {}),
      });
      setNotice('Equipment request posted — owners with a matching machine will quote.');
      setDpModalOpen(false);
      setDpForm({ machineType: '', acres: 0, dateFrom: '', dateTo: '', village: '', budgetPerHourRupees: 0, notes: '' });
      await loadDemandPosts();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setDpBusy(false);
    }
  };

  const closeDemandPost = async (id: string) => {
    if (!window.confirm('Close this equipment request? Owners will no longer see it.')) return;
    try {
      await equipment.deleteDemandPost(id);
      setNotice('Equipment request closed.');
      await loadDemandPosts();
    } catch (e) {
      setError(apiErrorMessage(e));
    }
  };

  // Type catalog derives from served listings — no hard-coded mirror list.
  const typeOptions = useMemo(
    () => [...new Set(machines.map((m) => m.type).filter(Boolean))].sort(),
    [machines]
  );

  const visibleMachines = useMemo(() => {
    let rows = [...machines];
    if (requiredDate) {
      rows = rows.filter((m) => m.nextAvailableDate && m.nextAvailableDate <= requiredDate);
    }
    rows.sort((a, b) => {
      if (sortBy === 'rateAsc') return a.hourlyRate - b.hourlyRate;
      if (sortBy === 'rateDesc') return b.hourlyRate - a.hourlyRate;
      if (sortBy === 'available')
        return (a.nextAvailableDate || '9999').localeCompare(b.nextAvailableDate || '9999');
      return 0; // "latest" keeps the backend's listing order
    });
    return rows;
  }, [machines, requiredDate, sortBy]);

  const groupedBookings = useMemo(() => {
    if (reqTab === 'all') return myBookings;
    const wanted = STATUS_GROUP[reqTab];
    return myBookings.filter((b) => wanted.includes(b.status));
  }, [myBookings, reqTab]);

  const loadSlots = async (machineId: string, date: string) => {
    setSlotsLoading(true);
    setPickedSlot(null);
    try {
      const res = (await equipment.slots(machineId, { date })) as unknown[];
      setSlots(
        res.map((s) => {
          const r = s as Record<string, unknown>;
          return {
            id: String(r.id ?? r.slotId),
            label: String(r.slotName ?? r.label ?? 'Slot'),
            status: String(r.status ?? 'unknown'),
            price: typeof r.priceRupees === 'number' ? (r.priceRupees as number) : 0,
          };
        })
      );
    } catch (e) {
      setError(apiErrorMessage(e));
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const openRequest = (m: MachineRow) => {
    const today = new Date().toISOString().slice(0, 10);
    setSelectedMachine(m);
    setRequestDate(m.nextAvailableDate && m.nextAvailableDate > today ? m.nextAvailableDate : today);
    setWorkLocation('');
    setWorkType('');
    setWorkQuantity(m.minBookingQty ?? 1);
    setWorkUnit('acres');
    setNotes('');
    setTermsAccepted(false);
    void loadSlots(m.id, m.nextAvailableDate && m.nextAvailableDate > today ? m.nextAvailableDate : today);
  };

  const submitRequest = async () => {
    if (!selectedMachine || !pickedSlot) return;
    setSending(true);
    setError(null);
    try {
      await equipment.bookSlot(pickedSlot, {
        farmerName: me.name || 'Farmer',
        workLocation,
        workType,
        workQuantity,
        workUnit,
        notes,
        termsAccepted,
      });
      setNotice(`Request sent to the owner of ${selectedMachine.name} — you'll be notified on acceptance.`);
      setSelectedMachine(null);
      setTab('requests');
      setReqTab('all');
      await loadBookings();
    } catch (e) {
      if (isKycError(e)) {
        setError('Complete your identity verification (KYC) to request equipment — see Profile.');
        setSelectedMachine(null);
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setSending(false);
    }
  };

  const submitCancel = async () => {
    if (!cancelTarget) return;
    setBusyId(cancelTarget.id);
    setError(null);
    try {
      await equipment.cancelBookingWithReason(cancelTarget.id, cancelReason);
      setNotice('Request cancelled — the owner is notified.');
      setCancelTarget(null);
      setCancelReason('');
      await loadBookings();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const submitRating = async (stars: number, review: string) => {
    if (!rateTarget) return;
    await ratings.submit({
      bookingKind: 'equipment',
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
          <Wrench className="w-7 h-7 text-emerald-600" />
          Find Equipment
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Find tractors, rotavators, harvesters and more near you. Send a request — after the owner accepts,
          contacts unlock and you coordinate directly. Agrovercity never holds money.
        </p>
      </div>

      {!kycVerified && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Complete identity verification (KYC) to request equipment.
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

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
          {[
            { id: 'browse', label: 'Find Equipment' },
            { id: 'requests', label: `My Requests (${myBookings.length})` },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as 'browse' | 'requests')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setDpModalOpen(true)}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
        >
          <Wrench className="w-3.5 h-3.5" /> Request Equipment
        </button>
      </div>

      {tab === 'browse' && (
        <>
          <div className="bg-white rounded-3xl p-4 border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search machine or type…"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300"
                />
              </div>
              <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-700">
                <option value="">All types</option>
                {typeOptions.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select value={operatorFilter} onChange={(e) => setOperatorFilter(e.target.value)} className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-700">
                <option value="">Any operator option</option>
                <option value="withOperator">With operator</option>
                <option value="withoutOperator">Without operator</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100">
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District / area"
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 w-40"
              />
              <input
                type="date"
                value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-xl border border-slate-300"
                title="Required date"
              />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="ml-auto px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white">
                <option value="latest">Latest</option>
                <option value="rateAsc">Rate: low → high</option>
                <option value="rateDesc">Rate: high → low</option>
                <option value="available">Next available</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading equipment…</div>
          ) : visibleMachines.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              No equipment matches these filters. Try widening the area or date.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleMachines.map((m) => (
                <div key={m.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3 flex flex-col justify-between">
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                            {m.type}
                          </span>
                          <UserVerificationBadge verified={m.ownerVerified} label="Verified Owner" />
                          {m.equipmentVerified && (
                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                              <BadgeCheck className="w-2.5 h-2.5" /> Equipment Verified
                            </span>
                          )}
                        </div>
                        <h3 className="font-extrabold text-base text-slate-900 mt-1">{m.name}</h3>
                        <p className="text-xs text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" /> {m.location || '—'} · by {m.ownerName || 'Owner'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-lg font-black text-emerald-700">{formatCurrency(m.hourlyRate)}</span>
                        <span className="text-xs text-slate-500">
                          {m.pricingUnit === 'perDay' && m.ratePerDay ? '/day' : m.pricingUnit === 'perAcre' ? '/acre' : '/hr'}
                        </span>
                      </div>
                    </div>

                    {m.photos && m.photos.length > 0 && (
                      <div className="h-28 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                        <img
                          src={m.photos[0]}
                          alt={m.name}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Operator</span>
                        <span className="font-extrabold text-slate-800">{OPERATOR_LABEL[m.operatorOption || 'withoutOperator']}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Next Available</span>
                        <span className="font-extrabold text-slate-800 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-emerald-600" /> {m.nextAvailableDate || 'Ask owner'}
                        </span>
                      </div>
                      {m.capacity ? (
                        <div className="col-span-2 pt-1 border-t border-slate-200/60 text-[11px] text-slate-500">
                          {m.capacity}
                          {m.fuelIncluded === false ? ' · fuel excluded' : m.fuelIncluded ? ' · fuel included' : ''}
                          {m.travelCharge ? ` · ${m.travelCharge}` : ''}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                    <button onClick={() => setDetailMachine(m)} className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs">
                      View Details
                    </button>
                    <button
                      onClick={() => openRequest(m)}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                    >
                      Request Equipment
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
          {/* My posted equipment requests (the demand board) with owner quotes */}
          {myDemandPosts.length > 0 && (
            <div className="space-y-3">
              {myDemandPosts.map((p) => {
                const quotes = (Array.isArray(p.quotes) ? p.quotes : []) as Record<string, unknown>[];
                const open = p.status === 'open';
                return (
                  <div key={String(p.id)} className="bg-amber-50/60 rounded-3xl p-5 border border-amber-200/70 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-extrabold text-sm text-slate-900">{String(p.machineType ?? 'Machine')}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${open ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : 'text-slate-500 bg-slate-100 border-slate-200'}`}>
                            {open ? 'Open — visible to owners' : 'Closed'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 flex items-center gap-1 flex-wrap">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          {String(p.dateFrom ?? '')} → {String(p.dateTo ?? '')}
                          {Number(p.acres) > 0 ? ` · ${String(p.acres)} acres` : ''}
                          {p.village ? ` · ${String(p.village)}` : ''}
                          {Number(p.budgetPerHourRupees) > 0 ? ` · budget ${formatCurrency(Number(p.budgetPerHourRupees))}/hr` : ''}
                        </p>
                      </div>
                      {open && (
                        <button
                          onClick={() => void closeDemandPost(String(p.id))}
                          className="px-3 py-2 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold text-[10px]"
                        >
                          Close
                        </button>
                      )}
                    </div>
                    {quotes.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Owner Quotes ({quotes.length})</p>
                        {quotes.map((q) => (
                          <div key={String(q.id)} className="bg-white rounded-2xl p-3 border border-slate-200 flex items-start justify-between gap-3">
                            <div className="space-y-1">
                              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5 flex-wrap">
                                {String(q.ownerName || 'Owner')}
                                {q.ownerVerified ? (
                                  <span className="text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                                    <BadgeCheck className="w-2.5 h-2.5" /> Verified
                                  </span>
                                ) : null}
                              </p>
                              <p className="text-[11px] text-slate-600">
                                {Number(q.rateRupees) > 0 ? `${formatCurrency(Number(q.rateRupees))}/hr · ` : ''}
                                {q.availableFrom ? `available ${String(q.availableFrom)} → ${String(q.availableTo ?? '')}` : ''}
                              </p>
                              {q.message ? <p className="text-[11px] text-slate-500 italic">“{String(q.message)}”</p> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
            {(
              [
                ['all', 'All'],
                ['pending', 'Pending'],
                ['upcoming', 'Accepted / Upcoming'],
                ['completed', 'Completed'],
                ['closed', 'Declined / Cancelled'],
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

          {groupedBookings.length === 0 ? (
            <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
              {reqTab === 'all'
                ? 'No requests yet — find equipment and send one.'
                : `No ${reqTab} requests right now.`}
            </div>
          ) : (
            <div className="space-y-3">
              {groupedBookings.map((b) => (
                <div key={b.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-xl">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-extrabold text-sm text-slate-900">{b.machineName ?? 'Equipment'}</span>
                      <UserVerificationBadge verified={b.ownerVerified} label="Verified Owner" />
                      <StatusBadge status={b.status === 'booked' ? 'accepted' : b.status === 'rejected' ? 'declined' : b.status} />
                    </div>
                    <p className="text-xs text-slate-600 flex items-center gap-1 flex-wrap">
                      <Clock className="w-3.5 h-3.5 text-slate-400" /> {b.date} · {b.slotName}
                      {b.workQuantity ? ` · ${b.workQuantity} ${b.workUnit ?? ''}` : ''}
                      {b.workType ? ` · ${b.workType}` : ''}
                    </p>
                    <p className="text-[10px] text-slate-400">
                      Listed rate {b.priceRupees ? formatCurrency(b.priceRupees) : '—'} (indicative — final terms are agreed directly)
                    </p>
                    {b.cancellationReason && (
                      <p className="text-[10px] text-rose-600">Cancelled: {b.cancellationReason}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                    {b.ownerContact && <ContactActions contact={b.ownerContact} chatRoomId={b.chatRoomId} />}
                    {b.status === 'pending' && (
                      <button
                        onClick={() => setCancelTarget(b)}
                        disabled={busyId === b.id}
                        className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                      >
                        <XCircle className="w-3 h-3" /> Cancel
                      </button>
                    )}
                    {b.status === 'completed' && (
                      <>
                        <button
                          onClick={() => setRateTarget(b)}
                          className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center gap-1"
                        >
                          <Star className="w-3 h-3" /> Rate owner
                        </button>
                        <button
                          onClick={() => setReportTarget(b)}
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

      {/* Create Request modal — post the machine the farm needs so owners quote */}
      <ModalSheet
        isOpen={dpModalOpen}
        onClose={() => setDpModalOpen(false)}
        title="Request Equipment"
        description="Post what your farm needs — equipment owners with a matching machine see it and quote their rate."
        maxWidth="md"
      >
        <div className="space-y-4">
          {savedAddrs.length > 0 && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Location from saved address</label>
              <select
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
                value=""
                onChange={(e) => {
                  const a = savedAddrs.find((x) => x.id === e.target.value);
                  if (!a) return;
                  setDpForm((f) => ({
                    ...f,
                    village: [a.line1, a.village].filter(Boolean).join(', ') || f.village,
                  }));
                }}
              >
                <option value="">Select a saved address…</option>
                {savedAddrs.map((a) => (
                  <option key={a.id} value={a.id}>
                    {addressLabel(a)} — {addressSummary(a)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Machine Type *</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                value={dpForm.machineType}
                onChange={(e) => setDpForm({ ...dpForm, machineType: e.target.value })}
                placeholder="e.g. Tractor + Rotavator, Thresher"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Area (acres)</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                value={dpForm.acres || ''}
                onChange={(e) => setDpForm({ ...dpForm, acres: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Needed From *</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                value={dpForm.dateFrom}
                onChange={(e) => setDpForm({ ...dpForm, dateFrom: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Needed Until *</label>
              <input
                type="date"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                value={dpForm.dateTo}
                onChange={(e) => setDpForm({ ...dpForm, dateTo: e.target.value })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Village / Area</label>
              <input
                type="text"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                value={dpForm.village}
                onChange={(e) => setDpForm({ ...dpForm, village: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Budget (₹/hr)</label>
              <input
                type="number"
                min={0}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                value={dpForm.budgetPerHourRupees || ''}
                onChange={(e) => setDpForm({ ...dpForm, budgetPerHourRupees: Number(e.target.value) })}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              value={dpForm.notes}
              onChange={(e) => setDpForm({ ...dpForm, notes: e.target.value })}
              placeholder="Soil type, water, transport access…"
            />
          </div>
          <button
            onClick={() => void submitDemandPost()}
            disabled={
              dpBusy ||
              !dpForm.machineType.trim() ||
              !dpForm.dateFrom ||
              !dpForm.dateTo ||
              dpForm.dateTo < dpForm.dateFrom
            }
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {dpBusy ? 'Posting…' : 'Post Equipment Request'}
          </button>
        </div>
      </ModalSheet>

      {/* Details modal */}
      <ModalSheet
        isOpen={Boolean(detailMachine)}
        onClose={() => setDetailMachine(null)}
        title={detailMachine?.name ?? ''}
        description={detailMachine ? `${detailMachine.type} · ${detailMachine.location || 'operating area on request'}` : undefined}
        maxWidth="sm"
      >
        {detailMachine && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <UserVerificationBadge verified={detailMachine.ownerVerified} label="Verified Owner" size="sm" />
              {detailMachine.equipmentVerified && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> Equipment Verified
                </span>
              )}
            </div>
            {detailMachine.photos && detailMachine.photos.length > 0 && (
              <div className="h-40 w-full rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
                <img src={detailMachine.photos[0]} alt={detailMachine.name} className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Rate</span>
                <span className="font-extrabold text-slate-800">{formatCurrency(detailMachine.hourlyRate)} / {detailMachine.pricingUnit === 'perDay' ? 'day' : detailMachine.pricingUnit === 'perAcre' ? 'acre' : 'hour'}</span></div>
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Operator</span>
                <span className="font-extrabold text-slate-800">{OPERATOR_LABEL[detailMachine.operatorOption || 'withoutOperator']}</span></div>
              {detailMachine.capacity && <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Capacity</span>
                <span className="font-extrabold text-slate-800">{detailMachine.capacity}</span></div>}
              <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Next Available</span>
                <span className="font-extrabold text-slate-800">{detailMachine.nextAvailableDate || 'Ask owner'}</span></div>
              {detailMachine.minBookingQty ? <div><span className="text-[10px] font-bold text-slate-400 uppercase block">Min. Booking</span>
                <span className="font-extrabold text-slate-800">{detailMachine.minBookingQty}</span></div> : null}
            </div>
            {detailMachine.notes && <p className="text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">{detailMachine.notes}</p>}
            <p className="text-[10px] text-slate-400 leading-relaxed">{EQUIPMENT_DIRECT_CONNECT_TERMS}</p>
            <button
              onClick={() => { setDetailMachine(null); openRequest(detailMachine); }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
            >
              Request Equipment
            </button>
          </div>
        )}
      </ModalSheet>

      {/* Request modal */}
      <ModalSheet
        isOpen={Boolean(selectedMachine)}
        onClose={() => setSelectedMachine(null)}
        title={`Request ${selectedMachine?.name ?? ''}`}
        description="The listed rate is indicative — fuel, travel, minimums and the actual quantity are agreed directly with the owner."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Required Date *</label>
              <input
                type="date"
                value={requestDate}
                onChange={(e) => {
                  setRequestDate(e.target.value);
                  if (selectedMachine) void loadSlots(selectedMachine.id, e.target.value);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Work Type *</label>
              <input
                type="text"
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                placeholder="e.g. Ploughing, spraying"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-slate-700 mb-2">Preferred Time Window *</span>
            {slotsLoading ? (
              <div className="py-4 text-center text-xs font-bold text-slate-400 animate-pulse">Checking availability…</div>
            ) : slots.length === 0 ? (
              <div className="py-4 text-center text-xs font-semibold text-slate-400">No slots for this date — try another.</div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {slots.map((slot) => {
                  const available = slot.status === 'available';
                  return (
                    <button
                      key={slot.id}
                      type="button"
                      disabled={!available}
                      onClick={() => setPickedSlot(slot.id)}
                      className={`w-full p-3 rounded-2xl border text-left text-xs transition-all ${
                        pickedSlot === slot.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : available
                            ? 'border-slate-200 bg-white hover:border-emerald-300'
                            : 'border-slate-100 bg-slate-50 opacity-60 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-bold text-slate-900 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400" /> {slot.label}
                        <span className="ml-auto font-extrabold text-emerald-800">{slot.price ? formatCurrency(slot.price) : ''}</span>
                      </span>
                      <span className="text-[10px] text-slate-400 capitalize">{available ? 'Available' : slot.status.replace(/_/g, ' ')}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Work Quantity *</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={workQuantity}
                onChange={(e) => setWorkQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Unit *</label>
              <select value={workUnit} onChange={(e) => setWorkUnit(e.target.value as typeof workUnit)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white">
                <option value="acres">Acres</option>
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Farm Location *</label>
              <input
                type="text"
                value={workLocation}
                onChange={(e) => setWorkLocation(e.target.value)}
                placeholder="Village, taluka"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Notes (optional)</label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>

          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-emerald-600" />
            <span className="text-[11px] text-slate-600 leading-relaxed">{EQUIPMENT_DIRECT_CONNECT_TERMS}</span>
          </label>

          <button
            onClick={() => void submitRequest()}
            disabled={!pickedSlot || !workType.trim() || !workLocation.trim() || workQuantity <= 0 || !termsAccepted || sending}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {sending ? 'Sending…' : 'Send Request'}
          </button>
          <p className="text-[10px] text-slate-400 text-center">No advance, no deposit, no platform payment — you settle directly with the owner.</p>
        </div>
      </ModalSheet>

      {/* Cancel modal */}
      <ModalSheet isOpen={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title="Cancel Request" maxWidth="sm"
        description="This releases your hold on the schedule and notifies the owner.">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason (optional)</label>
            <textarea rows={2} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" />
          </div>
          <button onClick={() => void submitCancel()} disabled={busyId === cancelTarget?.id}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-50">
            Confirm Cancellation
          </button>
        </div>
      </ModalSheet>

      <RateUserModal
        open={Boolean(rateTarget)}
        onClose={() => setRateTarget(null)}
        title="Rate the equipment owner"
        subtitle={rateTarget ? `${rateTarget.machineName ?? 'Equipment'} · ${rateTarget.date ?? ''} — one rating per booking` : undefined}
        submitLabel="Submit Rating"
        onSubmit={submitRating}
      />

      <ReportIssueModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetUserId={reportTarget?.ownerId ?? ''}
        bookingId={reportTarget?.id}
        onReported={() => setNotice('Issue reported — moderation will review it.')}
      />
    </div>
  );
};
