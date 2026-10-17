import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Warehouse,
  PackageOpen,
  Users,
  IndianRupee,
  Percent,
  CalendarClock,
  ArrowRight,
  RefreshCw,
  Building2,
  ShieldCheck,
  ScrollText,
  Check,
  X,
} from 'lucide-react';
import { postHarvest, apiErrorMessage } from '../../../lib/api';
import { StatCard } from '../../../components/common/StatCard';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ModalSheet } from '../../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { str, num, arr, type Row, type BookingRow, type FacilityRow, bookingId } from './types';

/** Cold-storage provider console home — occupancy KPIs, pending bookings queue with inline review, facility summary. */
export const ColdStorageProviderConsole: React.FC = () => {
  const [stats, setStats] = useState<Row | null>(null);
  const [pending, setPending] = useState<BookingRow[]>([]);
  const [releaseRequests, setReleaseRequests] = useState<BookingRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [reviewTarget, setReviewTarget] = useState<BookingRow | null>(null);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, p, r, f] = await Promise.all([
        postHarvest.provider.stats() as Promise<unknown>,
        postHarvest.provider.bookings({ status: 'pending', pageSize: 10 }) as Promise<unknown>,
        postHarvest.provider.bookings({ status: 'release_requested', pageSize: 10 }) as Promise<unknown>,
        postHarvest.provider.facilities() as Promise<unknown>,
      ]);
      setStats(s as Row);
      const pRows = arr((p as Row)?.data ?? p) as BookingRow[];
      setPending(pRows);
      setReleaseRequests(arr((r as Row)?.data ?? r) as BookingRow[]);
      setFacilities(arr((f as Row)?.data ?? f) as FacilityRow[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const occupancy = num(stats?.occupancyPercent);

  const openReview = (b: BookingRow) => {
    setReviewTarget(b);
    setReviewAction('approve');
    setReviewNotes('');
    setRejectionReason('');
    setError(null);
    setNotice(null);
  };

  const submitReview = async () => {
    if (!reviewTarget) return;
    const id = bookingId(reviewTarget);
    setBusy(true);
    setError(null);
    try {
      await postHarvest.provider.reviewBooking(id, {
        action: reviewAction,
        notes: reviewNotes || undefined,
        rejectionReason: reviewAction === 'reject' ? rejectionReason : undefined,
      });
      setNotice(
        reviewAction === 'approve'
          ? `${str(reviewTarget.farmerName, 'Reservation')} approved — farmer notified to bring produce. Chamber allocation happens at inward.`
          : `${str(reviewTarget.farmerName, 'Reservation')} rejected — capacity restored.`
      );
      setReviewTarget(null);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Warehouse className="w-7 h-7 text-emerald-600" />
            Cold Storage Provider Console
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            WDRA-registered warehouse operations — reservations, gate inward, e-NWR receipts, releases and fees
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/coldStorageProvider/facilities"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs">
            <Building2 className="w-4 h-4 text-emerald-600" /> Facilities
          </Link>
          <Link to="/coldStorageProvider/bookings"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs">
            <PackageOpen className="w-4 h-4 text-emerald-600" /> Bookings
          </Link>
          <Link to="/coldStorageProvider/fees"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-700 font-bold text-xs rounded-xl shadow-xs">
            <ScrollText className="w-4 h-4 text-emerald-600" /> Fees
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Occupancy"
          value={stats ? `${num(stats.occupiedMT)} / ${num(stats.totalCapacityMT)} MT` : '—'}
          subtitle={stats ? `${occupancy}% full · ${num(stats.availableMT)} MT free` : 'Loading…'}
          icon={Percent}
          colorScheme="blue"
        />
        <StatCard
          title="Pending Reservations"
          value={stats ? String(num(stats.pendingBookingsCount)) : '—'}
          subtitle={`${releaseRequests.length} release requests waiting`}
          icon={CalendarClock}
          colorScheme="amber"
        />
        <StatCard
          title="Stored Lots"
          value={stats ? String(num(stats.activeStoredLotsCount)) : '—'}
          subtitle={stats ? `${num(stats.totalFarmersCount)} farmers served` : ''}
          icon={PackageOpen}
          colorScheme="green"
        />
        <StatCard
          title="Accrued Rent / Valuation"
          value={stats ? formatCurrency(num(stats.totalAccruedRent)) : '—'}
          subtitle={stats ? `Stock value ${formatCurrency(num(stats.totalValuationStored))}` : ''}
          icon={IndianRupee}
          colorScheme="purple"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <PackageOpen className="w-4 h-4 text-emerald-600" />
              Pending Reservations ({pending.length})
            </h3>
            <Link to="/coldStorageProvider/bookings" className="text-[11px] font-bold text-emerald-700 hover:underline">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {pending.map((b) => (
              <div key={bookingId(b)} className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-slate-50/60">
                <Link
                  to={`/coldStorageProvider/bookings/${encodeURIComponent(bookingId(b))}`}
                  className="min-w-0"
                >
                  <span className="text-xs font-bold text-slate-900">{str(b.farmerName, 'Farmer')}</span>
                  <span className="text-[11px] text-slate-500 block">
                    {str(b.cropName)} · {num(b.quantityQuintals)} q · {str(b.facilityName)} · {formatDate(str(b.bookedAt ?? b.expectedDate))}
                  </span>
                </Link>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={str(b.status, 'pending')} />
                  <button
                    onClick={() => openReview(b)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl"
                  >
                    <Check className="w-3.5 h-3.5" /> Review
                  </button>
                </div>
              </div>
            ))}
            {pending.length === 0 && !loading && (
              <p className="py-8 text-center text-slate-400 font-semibold text-xs">No pending reservations — queue is clear.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-emerald-600" />
              Facility Summary ({facilities.length})
            </h3>
            <div className="flex items-center gap-2">
              <button onClick={load} className="p-1.5 text-slate-400 hover:text-emerald-600 rounded-xl hover:bg-slate-100" title="Refresh">
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <Link to="/coldStorageProvider/facilities" className="text-[11px] font-bold text-emerald-700 hover:underline">
                Manage →
              </Link>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {facilities.slice(0, 5).map((f) => {
              const capacity = num(f.totalCapacityMT, num(f.availableMT));
              const booked = num(f.bookedQuintals) / 10;
              const pct = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0;
              return (
                <div key={str(f.id)} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      {str(f.name, 'Facility')}
                      {f.wdraRegistered && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400">{num(f.chambers ? arr(f.chambers).length : 0)} chambers</span>
                  </div>
                  <div className="mt-1.5 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-slate-500 font-semibold">
                    {pct}% occupied · {formatCurrency(num(f.ratePerQuintalMonth))}/q/month · {str(f.district)}
                  </span>
                </div>
              );
            })}
            {facilities.length === 0 && !loading && (
              <div className="py-8 text-center">
                <p className="text-slate-400 font-semibold text-xs">No facilities yet.</p>
                <Link to="/coldStorageProvider/facilities"
                  className="inline-flex items-center gap-1 mt-2 text-[11px] font-bold text-emerald-700 hover:underline">
                  Register your first warehouse <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {releaseRequests.length > 0 && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-amber-600" />
              Farmer Release Requests ({releaseRequests.length})
            </h3>
          </div>
          <div className="divide-y divide-slate-100">
            {releaseRequests.map((b) => (
              <Link
                key={bookingId(b)}
                to={`/coldStorageProvider/bookings/${encodeURIComponent(bookingId(b))}`}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-slate-50/60"
              >
                <div>
                  <span className="text-xs font-bold text-slate-900">{str(b.farmerName)}</span>
                  <span className="text-[11px] text-slate-500 block">
                    {str(b.cropName)} · e-NWR {str(b.receiptNumber, '—')} · {num(b.remainingQuintals ?? b.quantityQuintals)} q stored
                  </span>
                </div>
                <span className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] rounded-xl">
                  Issue Gate Pass
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Inline reservation review — approve/reject without leaving the queue */}
      <ModalSheet
        isOpen={!!reviewTarget}
        onClose={() => setReviewTarget(null)}
        title={`Review Reservation — ${str(reviewTarget?.farmerName, 'Farmer')}`}
        description={`${str(reviewTarget?.cropName)} · ${num(reviewTarget?.quantityQuintals)} q · ${str(reviewTarget?.facilityName)}`}
        maxWidth="md"
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setReviewAction('approve')}
              className={`py-2 rounded-xl font-bold text-xs border ${reviewAction === 'approve' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200'}`}>
              <Check className="w-3.5 h-3.5 inline mr-1" /> Approve
            </button>
            <button onClick={() => setReviewAction('reject')}
              className={`py-2 rounded-xl font-bold text-xs border ${reviewAction === 'reject' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200'}`}>
              <X className="w-3.5 h-3.5 inline mr-1" /> Reject
            </button>
          </div>
          {reviewAction === 'reject' && (
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Rejection Reason
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} required
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200" />
            </label>
          )}
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Notes to Farmer
            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2}
              placeholder={reviewAction === 'approve' ? 'e.g. गुरुवारी सकाळी ९ ते ५ येणे' : undefined}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <p className="text-[10px] text-slate-400">
            Approval locks the booked capacity atomically; chamber allocation is confirmed at gate inward.
          </p>
          <button
            disabled={busy || (reviewAction === 'reject' && !rejectionReason.trim())}
            onClick={submitReview}
            className={`w-full py-2.5 font-bold text-sm rounded-xl text-white disabled:opacity-60 ${reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
            {busy ? 'Saving…' : reviewAction === 'approve' ? 'Approve Reservation' : 'Reject Reservation'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
