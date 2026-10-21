import React, { useCallback, useEffect, useState } from 'react';
import { Wrench, MapPin, Check, Phone, Clock, XCircle, ListChecks, Search, Star } from 'lucide-react';
import { equipment, ratings, apiErrorMessage } from '../../lib/api';
import type { EquipmentMyBooking } from '../../lib/api/equipment';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RateUserModal } from '../../components/common/RateUserModal';
import { formatCurrency } from '../../lib/utils';
import type { EquipmentMachine } from '../../types';

const asRecord = (v: unknown): Record<string, unknown> =>
  v !== null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asStr = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);

interface SlotRow {
  id: string;
  label: string;
  status: string;
  price: number;
}

interface MyBooking {
  id: string;
  machineName: string;
  date: string;
  slotLabel: string;
  status: string;
}

const MACHINE_TYPES = [
  { value: '', label: 'All types' },
  { value: 'tractor', label: 'Tractor' },
  { value: 'rotavator', label: 'Rotavator' },
  { value: 'harvester', label: 'Harvester' },
  { value: 'thresher', label: 'Thresher' },
  { value: 'sprayer', label: 'Sprayer' },
  { value: 'seed_drill', label: 'Seed Drill' },
  { value: 'drone', label: 'Drone' },
];

// SR 5: a booking whose owner can be rated (booked = FPO auto-confirm,
// completed = owner-logged job completion)
const RATEABLE_STATUSES = ['booked', 'completed', 'delivered'];
const CANCELLABLE_STATUSES = ['pending', 'booked', 'countered'];

export const EquipmentRentalView: React.FC = () => {
  const [machines, setMachines] = useState<EquipmentMachine[]>([]);
  const [myBookings, setMyBookings] = useState<MyBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedMachine, setSelectedMachine] = useState<EquipmentMachine | null>(null);
  const [bookingDate, setBookingDate] = useState('2026-10-19');
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [farmerName, setFarmerName] = useState('Ramesh Patil');
  const [busySlotId, setBusySlotId] = useState<string | null>(null);
  const [busyBookingId, setBusyBookingId] = useState<string | null>(null);
  // SR 27: search/filter + server-backed bookings list
  const [tab, setTab] = useState<'browse' | 'bookings'>('browse');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [machineType, setMachineType] = useState('');
  const [serverBookings, setServerBookings] = useState<EquipmentMyBooking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [rateTarget, setRateTarget] = useState<EquipmentMyBooking | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    equipment
      .list({
        ...(debouncedSearch ? { q: debouncedSearch } : {}),
        ...(machineType ? { type: machineType } : {}),
      })
      .then((res) => active && setMachines(res))
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debouncedSearch, machineType]);

  const loadServerBookings = useCallback(async () => {
    setBookingsLoading(true);
    try {
      setServerBookings(await equipment.myBookings());
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBookingsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'bookings') loadServerBookings();
  }, [tab, loadServerBookings]);

  const loadSlots = async (machineId: string, date: string) => {
    setSlotsLoading(true);
    setError(null);
    try {
      const res = await equipment.slots(machineId, { date });
      const rows: SlotRow[] = asArray(res).map((s) => {
        const r = asRecord(s);
        return {
          id: asStr(r.id ?? r.slotId),
          label: asStr(r.slotName ?? r.label ?? r.timeSlot ?? r.startTime, 'Slot'),
          status: asStr(r.status, 'unknown'),
          price: typeof r.priceRupees === 'number' ? (r.priceRupees as number) : typeof r.price === 'number' ? (r.price as number) : 0,
        };
      });
      setSlots(rows);
      setSlotsLoaded(true);
    } catch (e) {
      setError(apiErrorMessage(e));
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  };

  const openBooking = (m: EquipmentMachine) => {
    setSelectedMachine(m);
    setSlots([]);
    setSlotsLoaded(false);
    loadSlots(m.id, bookingDate);
  };

  const handleBookSlot = async (slot: SlotRow) => {
    if (!selectedMachine) return;
    setBusySlotId(slot.id);
    setError(null);
    try {
      const res = (await equipment.bookSlot(slot.id, { farmerName })) as Record<string, unknown>;
      const booking = asRecord(res.booking ?? res);
      setMyBookings((prev) => [
        {
          id: asStr(booking.id, slot.id),
          machineName: selectedMachine.name,
          date: asStr(booking.date, bookingDate),
          slotLabel: slot.label,
          status: asStr(booking.status, 'pending'),
        },
        ...prev,
      ]);
      setNotice(`${selectedMachine.name} booked for ${slot.label}. Owner approval pending.`);
      setSelectedMachine(null);
      loadSlots(selectedMachine.id, bookingDate);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusySlotId(null);
    }
  };

  const handleWaitlist = async (slot: SlotRow) => {
    setBusySlotId(slot.id);
    setError(null);
    try {
      await equipment.waitlistSlot(slot.id);
      setNotice(`You are on the waitlist for ${slot.label}. We will notify you on cancellation.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusySlotId(null);
    }
  };

  const handleCancelBooking = async (id: string) => {
    setBusyBookingId(id);
    setError(null);
    try {
      await equipment.cancelBooking(id);
      setMyBookings((prev) => prev.filter((b) => b.id !== id));
      setNotice('Equipment booking cancelled.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyBookingId(null);
    }
  };

  const handleCancelServerBooking = async (id: string) => {
    setBusyBookingId(id);
    setError(null);
    try {
      await equipment.cancelBooking(id);
      setNotice('Equipment booking cancelled.');
      await loadServerBookings();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyBookingId(null);
    }
  };

  const submitOwnerRating = async (stars: number, review: string) => {
    if (!rateTarget) return;
    const target = rateTarget;
    await ratings.submit({
      bookingKind: 'equipment',
      bookingId: target.id,
      stars,
      ...(review ? { comment: review } : {}),
    });
    setRateTarget(null);
    setNotice(`Thanks! You rated the owner of ${target.machineName ?? 'the machine'}.`);
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Wrench className="w-7 h-7 text-emerald-600" />
          Rent Machinery & Yantra Slots
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Book verified tractors, rotavators, sprayers, and combine harvesters on hourly time-slots with experienced operators
        </p>
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

      {/* Tabs: browse fleet vs my bookings (SR 27) */}
      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {[
          { id: 'browse', label: 'Browse Machines' },
          { id: 'bookings', label: `My Bookings (${serverBookings.length})` },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id as 'browse' | 'bookings')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <div className="flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by machine, type or location…"
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <select
            value={machineType}
            onChange={(e) => setMachineType(e.target.value)}
            className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-700"
          >
            {MACHINE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {tab === 'bookings' ? (
        bookingsLoading ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading your bookings…
          </div>
        ) : serverBookings.length === 0 ? (
          <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No equipment bookings yet — browse machines and book a time slot.
          </div>
        ) : (
          <div className="space-y-2">
            {serverBookings.map((b) => (
              <div
                key={b.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs"
              >
                <div>
                  <p className="font-bold text-slate-900">{b.machineName ?? b.equipmentId ?? b.id}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {b.date ?? '—'} • {b.slotName ?? ''}
                    {typeof b.priceRupees === 'number' && ` • ${formatCurrency(b.priceRupees)}`}
                    {b.ownerName ? ` • ${b.ownerName}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={b.status} />
                  {CANCELLABLE_STATUSES.includes(b.status) && (
                    <button
                      onClick={() => handleCancelServerBooking(b.id)}
                      disabled={busyBookingId === b.id}
                      className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                    >
                      <XCircle className="w-3 h-3" /> Cancel
                    </button>
                  )}
                  {RATEABLE_STATUSES.includes(b.status) && (
                    <button
                      onClick={() => setRateTarget(b)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" /> Rate owner
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading equipment fleet…
        </div>
      ) : machines.length === 0 ? (
        <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
          No verified equipment listed in your area yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {machines.map((m) => (
            <div
              key={m.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      {m.type}
                    </span>
                    <h3 className="font-extrabold text-base text-slate-900 mt-1">{m.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> {m.location}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-emerald-700">{formatCurrency(m.ratePerHour)}</span>
                    <span className="text-xs text-slate-500"> /hr</span>
                  </div>
                </div>

                <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-2xl border border-slate-100 mt-3 leading-relaxed">
                  {m.specs}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-emerald-600" /> {m.ownerName}
                </span>
                <button
                  onClick={() => openBooking(m)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                >
                  Book Time Slot
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My bookings (created in this session) */}
      {tab === 'browse' && myBookings.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-slate-200">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-emerald-600" /> My Equipment Bookings ({myBookings.length})
          </h3>
          <div className="space-y-2">
            {myBookings.map((b) => (
              <div key={b.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center justify-between gap-3 text-xs">
                <div>
                  <p className="font-bold text-slate-900">{b.machineName}</p>
                  <p className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Clock className="w-3 h-3" /> {b.date} • {b.slotLabel}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={b.status} />
                  <button
                    onClick={() => handleCancelBooking(b.id)}
                    disabled={busyBookingId === b.id}
                    className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" /> Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rate owner modal (SR 5) */}
      <RateUserModal
        open={Boolean(rateTarget)}
        onClose={() => setRateTarget(null)}
        title="Rate the equipment owner"
        subtitle={rateTarget ? `${rateTarget.machineName ?? 'Machine'} · ${rateTarget.date ?? ''} — one rating per booking` : undefined}
        submitLabel="Submit Rating"
        onSubmit={submitOwnerRating}
      />

      {/* Booking Modal — real slot availability */}
      <ModalSheet
        isOpen={Boolean(selectedMachine)}
        onClose={() => setSelectedMachine(null)}
        title="Book Equipment Time-Slot"
        description={`Reserve ${selectedMachine?.name} for your farm`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => {
                  setBookingDate(e.target.value);
                  if (selectedMachine) loadSlots(selectedMachine.id, e.target.value);
                }}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Booking Farmer Name</label>
              <input
                type="text"
                value={farmerName}
                onChange={(e) => setFarmerName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-bold text-slate-700 mb-2">Available Slots</span>
            {slotsLoading ? (
              <div className="py-6 text-center text-xs font-bold text-slate-400 animate-pulse">
                Checking live slot availability…
              </div>
            ) : !slotsLoaded ? null : slots.length === 0 ? (
              <div className="py-6 text-center text-xs font-semibold text-slate-400">
                No slots published for this date. Try another date.
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {slots.map((slot) => {
                  const available = slot.status === 'available';
                  return (
                    <div
                      key={slot.id}
                      className={`p-3 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
                        available
                          ? 'bg-emerald-50/60 border-emerald-200'
                          : 'bg-slate-50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div>
                        <p className="font-bold text-slate-900 flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> {slot.label}
                        </p>
                        <p className="text-[10px] text-slate-500 capitalize">{slot.status.replace(/_/g, ' ')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-emerald-800">
                          {slot.price > 0 ? formatCurrency(slot.price) : ''}
                        </span>
                        {available ? (
                          <button
                            onClick={() => handleBookSlot(slot)}
                            disabled={busySlotId === slot.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] disabled:opacity-50"
                          >
                            {busySlotId === slot.id ? 'Booking…' : 'Book'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleWaitlist(slot)}
                            disabled={busySlotId === slot.id}
                            className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold text-[10px] disabled:opacity-50"
                          >
                            Waitlist
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 flex items-start gap-2">
            <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
            <span>
              Booking requests go to the owner for approval. Full slot cost is payable after owner confirmation;
              you earn Kisan Coins on every completed booking.
            </span>
          </div>
        </div>
      </ModalSheet>
    </div>
  );
};
