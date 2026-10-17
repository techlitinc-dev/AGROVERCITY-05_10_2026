import React, { useEffect, useState } from 'react';
import {
  Snowflake,
  MapPin,
  Thermometer,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  FileText,
  Scale,
} from 'lucide-react';
import { apiErrorMessage, postHarvest } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { cn, formatCurrency, formatDateTime, formatNumber } from '../../lib/utils';
import { asRecord, asRecords, pick, pickNum, pickStr, str } from '../shared/records';

export const ColdStorageView: React.FC = () => {
  const [facilities, setFacilities] = useState<Record<string, unknown>[]>([]);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [receipts, setReceipts] = useState<Record<string, unknown>[]>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [bookingFacility, setBookingFacility] = useState<Record<string, unknown> | null>(null);
  const [commodity, setCommodity] = useState('');
  const [quantity, setQuantity] = useState('100');
  const [durationDays, setDurationDays] = useState('30');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [f, r] = await Promise.all([
        postHarvest.coldStorages().catch(() => []),
        postHarvest.receipts().catch(() => []),
      ]);
      if (!alive) return;
      setFacilities(asRecords(f));
      setReceipts(asRecords(r));
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const openDetail = async (facilityId: string) => {
    try {
      const res = await postHarvest.facility(facilityId);
      setDetail(asRecord(res));
    } catch {
      const found = facilities.find((f) => pickStr(f, 'id', 'facilityId') === facilityId);
      setDetail(found ? asRecord(found) : null);
    }
  };

  const openBook = (facility: Record<string, unknown>) => {
    setBookingFacility(facility);
    setBookOpen(true);
  };

  const handleBook = async () => {
    const facilityId = bookingFacility && pickStr(bookingFacility, 'id', 'facilityId');
    if (!facilityId || busy) return;
    setBusy(true);
    try {
      await postHarvest.book(facilityId, {
        commodity: commodity.trim() || undefined,
        quantityQuintal: Number(quantity) || undefined,
        durationDays: Number(durationDays) || undefined,
      });
      flash('ok', 'Storage chamber booked! The facility will confirm inwarding slot on your registered mobile.');
      setBookOpen(false);
      setCommodity('');
      const r = await postHarvest.receipts().catch(() => []);
      setReceipts(asRecords(r));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRequestRelease = async (bookingId: string, label: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await postHarvest.requestRelease(bookingId);
      flash('ok', `Release requested for ${label}. The facility will settle rent dues and confirm dispatch.`);
      const r = await postHarvest.receipts().catch(() => []);
      setReceipts(asRecords(r));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleGrade = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await postHarvest.gradeCommodity({
        commodity: commodity.trim() || 'Onion',
        quantityQuintal: Number(quantity) || 100,
      });
      const rec = asRecord(res);
      flash(
        'ok',
        `Grade report: ${pickStr(rec, 'grade', 'result') || 'A'} — ${pickStr(rec, 'summary', 'notes') || 'quality assessment complete'}.`
      );
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Snowflake className="w-7 h-7 text-sky-600" />
          Cold Storage & e-NWR Warehouse Receipts
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Locate certified cold storage facilities, monitor live chamber temperatures, and get pledge financing via electronic Negotiable Warehouse Receipts (e-NWR)
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {facilities.length === 0 && (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center md:col-span-2">
            No certified facilities listed in your district yet.
          </p>
        )}
        {facilities.map((s, i) => {
          const id = pickStr(s, 'id', 'facilityId') || String(i);
          const enwr = Boolean(pick(s, 'enwrSupported', 'wdrCertified', 'enwr')) !== false;
          return (
            <div
              key={id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4 flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h3 className="font-extrabold text-base text-slate-900">
                      {pickStr(s, 'name') || 'Cold storage facility'}
                    </h3>
                    <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />{' '}
                      {pickStr(s, 'location', 'address') ||
                        `${pickStr(s, 'district') || ''} ${pickStr(s, 'state') || ''}`.trim() ||
                        '—'}
                    </p>
                  </div>
                  {enwr && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> e-NWR WDRA Certified
                    </span>
                  )}
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">Telemetry</span>
                    <span className="font-bold text-sky-700 flex items-center gap-1 mt-0.5">
                      <Thermometer className="w-3.5 h-3.5" />{' '}
                      {pickStr(s, 'chamberTemp', 'temperatureRange') ||
                        `${pickNum(s, 'temperatureCelsius')}°C`}
                    </span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-2xl">
                    <span className="text-slate-400 font-semibold block text-[10px] uppercase">
                      Available Capacity
                    </span>
                    <span className="font-bold text-slate-900 mt-0.5 block">
                      {formatNumber(pickNum(s, 'availableTons', 'availableCapacityTons'))} /{' '}
                      {formatNumber(pickNum(s, 'capacityTons', 'totalCapacityTons'))} Tons
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 mt-2">
                  Crops handled: {pickStr(s, 'crops', 'commodities') || 'Multi-commodity'}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-800">
                  {pickStr(s, 'ratePerMonth', 'rateText') ||
                    (pickNum(s, 'ratePerQuintalMonth')
                      ? `${formatCurrency(pickNum(s, 'ratePerQuintalMonth'))} / quintal / month`
                      : 'Rate on request')}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => void openDetail(id)}
                    className="px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors"
                  >
                    Details
                  </button>
                  <button
                    onClick={() => openBook(asRecord(s))}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                  >
                    Book Storage Chamber
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* My e-NWR receipts / bookings */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <FileText className="w-4 h-4 text-slate-400" /> My Warehouse Receipts (e-NWR)
        </h3>
        {receipts.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
            No stored lots yet — book a chamber above to generate an e-NWR pledge receipt.
          </p>
        ) : (
          <div className="space-y-2">
            {receipts.map((r, i) => {
              const bookingId = pickStr(r, 'bookingId');
              const receiptNo = pickStr(r, 'receiptNumber', 'number', 'id') || `Receipt ${i + 1}`;
              const status = pickStr(r, 'status') || 'active';
              return (
                <div
                  key={receiptNo}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <p className="font-bold text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 text-emerald-600" /> {receiptNo}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {pickStr(r, 'commodity') || 'Commodity'} ·{' '}
                      {formatNumber(pickNum(r, 'quantityQuintal', 'quantity'))} q · Issued{' '}
                      {formatDateTime(pickStr(r, 'issueDate', 'createdAt')) || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={status} />
                    {bookingId && (
                      <button
                        onClick={() => void handleRequestRelease(bookingId, receiptNo)}
                        disabled={busy || status !== 'active'}
                        className="px-3 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold rounded-xl transition-colors"
                      >
                        Request Release
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Commodity grade check */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
          <Scale className="w-4 h-4 text-sky-600" /> Instant Commodity Grade Check
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="text"
            value={commodity}
            onChange={(e) => setCommodity(e.target.value)}
            placeholder="Commodity (e.g. Onion)"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-sky-600"
          />
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="Quantity (quintal)"
            className="px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-sky-600"
          />
          <button
            onClick={() => void handleGrade()}
            disabled={busy}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            Get Grade Estimate
          </button>
        </div>
      </div>

      {/* Detail sheet */}
      <ModalSheet
        isOpen={!!detail}
        onClose={() => setDetail(null)}
        title={pickStr(detail ?? {}, 'name') || 'Facility details'}
        description={pickStr(detail ?? {}, 'location', 'address')}
        maxWidth="lg"
      >
        {detail && (
          <div className="space-y-3 text-xs">
            {[
              ['Operator', pickStr(detail, 'operator', 'ownerName')],
              ['Contact', pickStr(detail, 'contactPhone', 'phone')],
              ['Chambers', str(pick(detail, 'chambersCount', 'chambers'))],
              ['Certifications', pickStr(detail, 'certifications') || 'WDRA e-NWR'],
              ['Distance', pickStr(detail, 'distanceKm') ? `${pickStr(detail, 'distanceKm')} km away` : '—'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-semibold">{label}</span>
                <span className="font-bold text-slate-800">{value || '—'}</span>
              </div>
            ))}
            <button
              onClick={() => {
                setDetail(null);
                openBook(detail);
              }}
              className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs mt-2"
            >
              Book This Facility
            </button>
          </div>
        )}
      </ModalSheet>

      {/* Booking sheet */}
      <ModalSheet
        isOpen={bookOpen}
        onClose={() => setBookOpen(false)}
        title={`Book — ${pickStr(bookingFacility ?? {}, 'name') || 'Facility'}`}
        description="The facility confirms the inwarding slot after booking."
        maxWidth="md"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Commodity</label>
            <input
              type="text"
              value={commodity}
              onChange={(e) => setCommodity(e.target.value)}
              placeholder="e.g. Red Onion"
              className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity (quintal)</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Duration (days)</label>
              <input
                type="number"
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value)}
                className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
          <button
            onClick={() => void handleBook()}
            disabled={busy}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs"
          >
            {busy ? 'Booking…' : 'Confirm Booking'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
