import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  PackageOpen,
  Check,
  X,
  Scale,
  Truck,
  FileText,
  RefreshCw,
  CalendarClock,
  ScrollText,
  ArrowRight,
  Search,
} from 'lucide-react';
import { postHarvest, apiErrorMessage } from '../../../lib/api';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { ModalSheet } from '../../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { str, num, arr, type Row, type BookingRow, type FacilityRow } from './types';

const QC_GRADES = ['Grade A', 'Grade B', 'Grade C', 'FAQ'];

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="text-sm font-semibold text-slate-800 mt-0.5">{value || '—'}</div>
  </div>
);

/** Booking detail — review reservation, gate inward (weights + QC + e-NWR), release with gate pass. */
export const BookingDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [booking, setBooking] = useState<BookingRow | null>(null);
  const [facility, setFacility] = useState<FacilityRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [chamberId, setChamberId] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const [inwardOpen, setInwardOpen] = useState(false);
  const [grossWeightKg, setGrossWeightKg] = useState('');
  const [tareWeightKg, setTareWeightKg] = useState('');
  const [actualBags, setActualBags] = useState('');
  const [moisturePercent, setMoisturePercent] = useState('');
  const [qcGrade, setQcGrade] = useState('Grade A');
  const [valuation, setValuation] = useState('');
  const [lotNumber, setLotNumber] = useState('');

  const [releaseOpen, setReleaseOpen] = useState(false);
  const [releaseQuintals, setReleaseQuintals] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [driverName, setDriverName] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [gatePassRemarks, setGatePassRemarks] = useState('');

  const [gatePass, setGatePass] = useState<Row | null>(null);

  // Receipt lookup — verify any e-NWR number (own lots or farmer-presented).
  const [lookupNo, setLookupNo] = useState('');
  const [lookupResult, setLookupResult] = useState<Row | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const lookupReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupResult(null);
    setLookupError(null);
    try {
      setLookupResult((await postHarvest.receipt(lookupNo.trim())) as Row);
    } catch (err) {
      setLookupError(apiErrorMessage(err));
    }
  };

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const b = (await postHarvest.provider.booking(id)) as BookingRow;
      setBooking(b);
      if (b.facilityId) {
        try {
          setFacility((await postHarvest.facility(str(b.facilityId))) as FacilityRow);
        } catch {
          setFacility(null);
        }
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const chambers = useMemo(() => arr(facility?.chambers), [facility]);
  const netQuintals = useMemo(() => {
    const gross = Number(grossWeightKg) || 0;
    const tare = Number(tareWeightKg) || 0;
    return Math.max(0, (gross - tare) / 100);
  }, [grossWeightKg, tareWeightKg]);

  const status = str(booking?.status);
  const timeline = arr(booking?.timeline);
  const storedNet = num(booking?.inwardNetQuintals ?? booking?.quantityQuintals);
  const alreadyReleased = num(booking?.outwardReleasedQuintals);
  const remaining = booking?.remainingQuintals !== undefined ? num(booking.remainingQuintals) : storedNet - alreadyReleased;
  const canRelease = ['inwarded', 'release_requested', 'partially_released'].includes(status) && remaining > 0;

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      if (success) setNotice(success);
      await load();
      return result;
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submitReview = () =>
    run(
      () =>
        postHarvest.provider.reviewBooking(id!, {
          action: reviewAction,
          allocatedChamberId: reviewAction === 'approve' ? chamberId || undefined : undefined,
          notes: reviewNotes || undefined,
          rejectionReason: reviewAction === 'reject' ? rejectionReason : undefined,
        }),
      reviewAction === 'approve' ? 'Reservation approved — farmer notified to bring produce.' : 'Reservation rejected — capacity restored.'
    ).then(() => {
      setReviewOpen(false);
      setReviewNotes('');
      setRejectionReason('');
    });

  const submitInward = () =>
    run(
      () =>
        postHarvest.provider.inward(id!, {
          chamberId: chamberId || undefined,
          lotNumber: lotNumber.trim() || undefined,
          grossWeightKg: Number(grossWeightKg),
          tareWeightKg: Number(tareWeightKg) || 0,
          netQuintals: Number(netQuintals.toFixed(2)),
          actualBags: Number(actualBags),
          moisturePercent: moisturePercent ? Number(moisturePercent) : undefined,
          qcGrade,
          valuationRupees: valuation ? Number(valuation) : undefined,
        }),
      ''
    ).then((res) => {
      const receipt = (res as Row | undefined)?.receipt as Row | undefined;
      setNotice(
        receipt?.receiptNumber
          ? `Gate inward done — e-NWR ${str(receipt.receiptNumber)} issued.`
          : 'Gate inward recorded — e-NWR issued.'
      );
      setInwardOpen(false);
      setGrossWeightKg('');
      setTareWeightKg('');
      setActualBags('');
      setMoisturePercent('');
      setValuation('');
      setLotNumber('');
    });

  const submitRelease = () =>
    run(
      async () => {
        const res = (await postHarvest.provider.release(id!, {
          releaseQuintals: Number(releaseQuintals),
          vehicleNumber: vehicleNumber.trim() || undefined,
          driverName: driverName.trim() || undefined,
          amountPaid: amountPaid ? Number(amountPaid) : 0,
          gatePassRemarks: gatePassRemarks || undefined,
        })) as Row;
        setGatePass(res);
      },
      'Gate pass issued.'
    ).then(() => {
      setReleaseOpen(false);
      setReleaseQuintals('');
      setVehicleNumber('');
      setDriverName('');
      setAmountPaid('');
      setGatePassRemarks('');
    });

  if (loading && !booking) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/coldStorageProvider/bookings" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to bookings
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 flex-wrap">
            <PackageOpen className="w-7 h-7 text-emerald-600" />
            Booking {id}
            <StatusBadge status={status} />
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {str(booking?.farmerName)} · {str(booking?.cropName)} · {num(booking?.quantityQuintals)} q · {str(booking?.facilityName)}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {['pending', 'booked'].includes(status) && (
            <button onClick={() => setReviewOpen(true)}
              className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs">
              <Check className="w-4 h-4" /> Review Reservation
            </button>
          )}
          {status === 'approved' && (
            <button onClick={() => setInwardOpen(true)}
              className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs">
              <Scale className="w-4 h-4" /> Gate Inward
            </button>
          )}
          {canRelease && (
            <button onClick={() => {
              setReleaseQuintals(String(remaining));
              setReleaseOpen(true);
            }}
              className="inline-flex items-center gap-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs">
              <Truck className="w-4 h-4" /> {status === 'release_requested' ? 'Issue Gate Pass' : 'Release Stock'}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}

      {booking && (
        <>
          {gatePass?.gatePassNumber && (
            <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
              <div>
                <span className="text-xs font-bold text-sky-800">Gate pass {str(gatePass.gatePassNumber)} issued</span>
                <span className="text-[11px] text-sky-700 block">
                  Released {num(gatePass.releasedQuintals)} q · remaining {num(gatePass.remainingQuintals)} q
                </span>
              </div>
              <StatusBadge status={num(gatePass.remainingQuintals) === 0 ? 'released' : 'partially_released'} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600" /> Reservation
                </h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <Field label="Farmer" value={str(booking.farmerName)} />
                <Field label="Phone" value={str(booking.farmerPhone)} />
                <Field label="Crop" value={`${str(booking.cropName)}${booking.variety ? ` · ${str(booking.variety)}` : ''}`} />
                <Field label="Booked Qty" value={`${num(booking.quantityQuintals)} q`} />
                <Field label="Bags (booked)" value={booking.bagsCount !== undefined ? String(num(booking.bagsCount)) : '—'} />
                <Field label="Expected Date" value={formatDate(str(booking.expectedDate ?? booking.bookedAt))} />
                <Field label="Estimated Rent" value={formatCurrency(num(booking.totalEstimatedRent))} />
                <Field label="Duration" value={booking.durationMonths !== undefined ? `${num(booking.durationMonths)} months` : '—'} />
                {booking.rejectionReason !== undefined && <Field label="Rejection Reason" value={str(booking.rejectionReason)} />}
                {booking.providerNotes !== undefined && <Field label="Provider Notes" value={str(booking.providerNotes)} />}
              </div>
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-emerald-600" /> Inward & Stock
                </h3>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                <Field label="Chamber" value={str(booking.allocatedChamberName ?? booking.chamberId)} />
                <Field label="Lot Number" value={str(booking.lotNumber)} />
                <Field label="Gross / Tare" value={booking.inwardGrossWeightKg !== undefined ? `${num(booking.inwardGrossWeightKg)} / ${num(booking.inwardTareWeightKg)} kg` : '—'} />
                <Field label="Net Inwarded" value={booking.inwardNetQuintals !== undefined ? `${num(booking.inwardNetQuintals)} q (${num(booking.inwardBags)} bags)` : '—'} />
                <Field label="Moisture" value={booking.moisturePercent !== undefined ? `${num(booking.moisturePercent)}%` : '—'} />
                <Field label="QC Grade" value={str(booking.qcGrade)} />
                <Field label="Valuation" value={booking.valuationRupees !== undefined ? formatCurrency(num(booking.valuationRupees)) : '—'} />
                <Field label="Inward Date" value={formatDate(str(booking.inwardDate))} />
                <Field label="Released" value={`${alreadyReleased} q`} />
                <Field label="Remaining" value={`${remaining} q`} />
                <Field label="Rent Paid" value={formatCurrency(num(booking.rentPaid))} />
                <Field label="Payment" value={<span className="capitalize">{str(booking.paymentStatus, '—').replace(/_/g, ' ')}</span>} />
              </div>
              {booking.receiptNumber && (
                <div className="mx-4 mb-4 bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-emerald-600">e-NWR Issued</span>
                    <span className="text-xs font-mono font-bold text-emerald-800 block">{str(booking.receiptNumber)}</span>
                  </div>
                  <Link to={`/coldStorageProvider/receipts/${encodeURIComponent(str(booking.receiptNumber))}`}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl">
                    View Receipt <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
              {booking.gatePassNumber && (
                <div className="mx-4 mb-4 bg-sky-50 border border-sky-100 rounded-2xl p-3">
                  <span className="text-[10px] font-bold uppercase text-sky-600">Latest Gate Pass</span>
                  <span className="text-xs font-mono font-bold text-sky-800 block">{str(booking.gatePassNumber)}</span>
                </div>
              )}
            </div>

            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="p-4 border-b border-slate-100">
                <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-emerald-600" /> Timeline
                </h3>
              </div>
              <div className="p-4 space-y-2.5">
                {timeline.length === 0 && <p className="text-xs text-slate-400">No events yet.</p>}
                {timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800">{str(t.title ?? t.status)}</span>
                      <span className="text-slate-400 ml-2">{formatDate(str(t.timestamp ?? t.at))}</span>
                      {str(t.description ?? t.note) && <p className="text-slate-500">{str(t.description ?? t.note)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Receipt lookup — verify an e-NWR by number (pledge collateral checks) */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
                <ScrollText className="w-4 h-4 text-emerald-600" /> e-NWR Receipt Lookup
              </h3>
            </div>
            <div className="p-4 space-y-3">
              <form onSubmit={lookupReceipt} className="flex items-center gap-2">
                <input
                  value={lookupNo}
                  onChange={(e) => setLookupNo(e.target.value)}
                  placeholder="NWR-2026-…"
                  className="flex-1 px-3 py-2 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
                <button type="submit" className="inline-flex items-center gap-1 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl">
                  <Search className="w-3.5 h-3.5" /> Verify
                </button>
                {booking.receiptNumber && (
                  <button
                    type="button"
                    onClick={() => {
                      setLookupNo(str(booking.receiptNumber));
                      setLookupResult(null);
                      setLookupError(null);
                    }}
                    className="px-3 py-2 bg-white border border-slate-200 hover:border-emerald-300 text-slate-600 font-bold text-[11px] rounded-xl"
                  >
                    Use this booking's e-NWR
                  </button>
                )}
              </form>
              {lookupError && <p className="text-[11px] font-semibold text-rose-600">{lookupError}</p>}
              {lookupResult && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-emerald-900">
                    <span>Depositor: <b>{str(lookupResult.depositorName)}</b></span>
                    <span>Commodity: <b>{str(lookupResult.cropName)}</b></span>
                    <span>Net: <b>{num(lookupResult.netQuintals)} q</b> · {str(lookupResult.qcGrade)}</span>
                    <span>Valuation: <b>{formatCurrency(num(lookupResult.valuationRupees))}</b></span>
                  </div>
                  <Link
                    to={`/coldStorageProvider/receipts/${encodeURIComponent(str(lookupResult.receiptNumber ?? lookupNo))}`}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] rounded-xl"
                  >
                    Full Receipt <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Review modal */}
          <ModalSheet isOpen={reviewOpen} onClose={() => setReviewOpen(false)} title="Review Reservation" description="Approve allocates a chamber; reject restores booked capacity." maxWidth="md">
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
              {reviewAction === 'approve' ? (
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  Allocate Chamber
                  <select value={chamberId} onChange={(e) => setChamberId(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
                    <option value="">— auto-allocate —</option>
                    {chambers.map((c) => {
                      const ch = c as Row;
                      return (
                        <option key={str(ch.id)} value={str(ch.id)}>
                          {str(ch.name, str(ch.id))} · {num(ch.currentOccupancyMT)}/{num(ch.capacityMT)} MT
                        </option>
                      );
                    })}
                  </select>
                </label>
              ) : (
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  Rejection Reason
                  <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} required
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200" />
                </label>
              )}
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Notes to Farmer
                <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <button
                disabled={busy || (reviewAction === 'reject' && !rejectionReason.trim())}
                onClick={submitReview}
                className={`w-full py-2.5 font-bold text-sm rounded-xl text-white disabled:opacity-60 ${reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
                {busy ? 'Saving…' : reviewAction === 'approve' ? 'Approve Reservation' : 'Reject Reservation'}
              </button>
            </div>
          </ModalSheet>

          {/* Gate inward modal */}
          <ModalSheet isOpen={inwardOpen} onClose={() => setInwardOpen(false)} title="Gate Inward — Weighbridge & QC" description="Issues the e-NWR warehouse receipt on submit." maxWidth="2xl">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Gross Weight (kg)
                <input value={grossWeightKg} onChange={(e) => setGrossWeightKg(e.target.value)} type="number" min="0" required
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Tare Weight (kg)
                <input value={tareWeightKg} onChange={(e) => setTareWeightKg(e.target.value)} type="number" min="0"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs">
                <span className="text-[9px] font-bold uppercase text-emerald-600">Net Weight</span>
                <div className="text-lg font-black text-emerald-800">{netQuintals.toFixed(2)} q</div>
              </div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Actual Bags
                <input value={actualBags} onChange={(e) => setActualBags(e.target.value)} type="number" min="1" required
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Moisture %
                <input value={moisturePercent} onChange={(e) => setMoisturePercent(e.target.value)} type="number" min="0" max="100" step="0.1"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                QC Grade
                <select value={qcGrade} onChange={(e) => setQcGrade(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  {QC_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Valuation ₹ (blank = auto @ ₹2,200/q)
                <input value={valuation} onChange={(e) => setValuation(e.target.value)} type="number" min="0"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Lot Number (blank = auto)
                <input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} placeholder={`LOT-${new Date().getFullYear()}-…`}
                  className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Chamber
                <select value={chamberId} onChange={(e) => setChamberId(e.target.value)}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
                  <option value="">— allocated chamber —</option>
                  {chambers.map((c) => {
                    const ch = c as Row;
                    return (
                      <option key={str(ch.id)} value={str(ch.id)}>{str(ch.name, str(ch.id))}</option>
                    );
                  })}
                </select>
              </label>
              <button
                disabled={busy || !grossWeightKg || !actualBags || netQuintals <= 0}
                onClick={submitInward}
                className="md:col-span-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
                {busy ? 'Recording…' : `Record Inward & Issue e-NWR (${netQuintals.toFixed(2)} q)`}
              </button>
            </div>
          </ModalSheet>

          {/* Release modal */}
          <ModalSheet isOpen={releaseOpen} onClose={() => setReleaseOpen(false)} title="Release Stock — Gate Pass" description={`Stored: ${storedNet} q · already released: ${alreadyReleased} q · remaining: ${remaining} q`} maxWidth="md">
            <div className="space-y-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Release Quantity (q)
                <input value={releaseQuintals} onChange={(e) => setReleaseQuintals(e.target.value)} type="number" min="0.01" max={remaining} step="0.01" required
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  Vehicle Number
                  <input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="MH-15-AB-1234"
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200" />
                </label>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">
                  Driver Name
                  <input value={driverName} onChange={(e) => setDriverName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200" />
                </label>
              </div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Rent Collected ₹ (optional)
                <input value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} type="number" min="0"
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200" />
              </label>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Gate Pass Remarks
                <textarea value={gatePassRemarks} onChange={(e) => setGatePassRemarks(e.target.value)} rows={2}
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200" />
              </label>
              <button
                disabled={busy || !releaseQuintals || Number(releaseQuintals) > remaining}
                onClick={submitRelease}
                className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
                {busy ? 'Issuing…' : 'Issue Gate Pass'}
              </button>
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <ScrollText className="w-3.5 h-3.5" /> A ₹50/booking platform fee is ledgered on release (see Fees page).
              </p>
            </div>
          </ModalSheet>
        </>
      )}
    </div>
  );
};
