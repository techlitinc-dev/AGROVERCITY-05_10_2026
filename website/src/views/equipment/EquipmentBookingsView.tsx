import React, { useEffect, useState } from 'react';
import {
  FileCheck,
  CheckCircle2,
  XCircle,
  Clock,
  DollarSign,
  AlertCircle,
  KeyRound,
  MessageSquare,
  RefreshCw,
  User,
  Calendar,
} from 'lucide-react';
import { equipmentOwner, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';

interface BookingItem {
  id: string;
  equipmentId?: string;
  machineName?: string;
  farmerName?: string;
  farmerPhone?: string;
  bookingDate?: string;
  slotDurationHours?: number;
  totalAmountRupees?: number;
  status: string;
  acreage?: number;
}

export const EquipmentBookingsView: React.FC = () => {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Counter Modal
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<BookingItem | null>(null);
  const [counterRate, setCounterRate] = useState(1100);
  const [counterNote, setCounterNote] = useState('Diesel rate adjusted for deep ploughing.');

  // Check-In Pin Modal
  const [checkInModalOpen, setCheckInModalOpen] = useState(false);
  const [checkInPin, setCheckInPin] = useState('');

  const loadBookings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await equipmentOwner.pendingBookings();
      const mapped: BookingItem[] = (data as Record<string, unknown>[]).map((b, idx) => ({
        id: String(b.id || `bk_${idx}`),
        equipmentId: String(b.equipmentId || ''),
        machineName: String(b.machineName || 'Mahindra 575 DI + Rotavator'),
        farmerName: String(b.farmerName || 'Ramesh Patil'),
        farmerPhone: String(b.farmerPhone || '+91 9876543210'),
        bookingDate: String(b.bookingDate || b.date || '2026-10-19'),
        slotDurationHours: Number(b.slotDurationHours || 4),
        totalAmountRupees: Number(b.totalAmountRupees || b.total || 3800),
        status: String(b.status || 'pending'),
        acreage: Number(b.acreage || 3.5),
      }));
      setBookings(mapped);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadBookings();
  }, []);

  const handleApprove = async (id: string) => {
    try {
      await equipmentOwner.approveBooking(id);
      setNotice('Booking approved! Driver dispatch notification sent to farmer.');
      await loadBookings();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Specify rejection reason (e.g. Schedule conflict / maintenance):');
    if (!reason) return;
    try {
      await equipmentOwner.rejectBooking(id, reason);
      setNotice('Booking rejected and slot released back to calendar.');
      await loadBookings();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleCounter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    try {
      await equipmentOwner.counterBooking(selectedBooking.id, {
        pricePerHour: counterRate,
        notes: counterNote,
      });
      setCounterModalOpen(false);
      setNotice('Counter-offer sent to farmer for approval.');
      await loadBookings();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    try {
      await equipmentOwner.checkIn(selectedBooking.id, { pin: checkInPin });
      setCheckInModalOpen(false);
      setNotice('Gate check-in verified! Hourly rental timer started.');
      await loadBookings();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-7 h-7 text-emerald-600" />
            Equipment Booking Adjudication & Dispatch
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Review incoming rental requests, negotiate customized rates, and verify gate check-in security PINs
          </p>
        </div>

        <button
          onClick={() => void loadBookings()}
          disabled={loading}
          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Bookings</span>
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs animate-slide-down">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{notice}</span>
          </div>
          <button onClick={() => setNotice(null)} className="font-bold text-emerald-700">Dismiss</button>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
          <AlertCircle className="w-4 h-4 text-rose-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Bookings List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-32 rounded-2xl shimmer-bg border border-slate-100" />
          ))
        ) : bookings.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
            <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold">No incoming booking requests</p>
            <p className="text-xs text-slate-400">All machine rental requests have been adjudicated.</p>
          </div>
        ) : (
          bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover-lift flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900 text-sm">{booking.machineName}</span>
                  <StatusBadge status={booking.status} />
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1 font-semibold text-slate-800">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    {booking.farmerName} ({booking.farmerPhone})
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {booking.bookingDate} ({booking.slotDurationHours} Hours)
                  </span>
                  <span>Est. Coverage: <strong>{booking.acreage} Acres</strong></span>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <div className="text-right mr-2">
                  <span className="text-base font-black text-slate-900">
                    {formatCurrency(booking.totalAmountRupees || 0)}
                  </span>
                  <p className="text-[10px] text-slate-400">Total Rental</p>
                </div>

                {booking.status === 'pending' && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleApprove(booking.id)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedBooking(booking);
                        setCounterModalOpen(true);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold text-xs flex items-center gap-1"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Counter</span>
                    </button>
                    <button
                      onClick={() => handleReject(booking.id)}
                      className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}

                {booking.status === 'confirmed' && (
                  <button
                    onClick={() => {
                      setSelectedBooking(booking);
                      setCheckInPin('');
                      setCheckInModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs flex items-center gap-1"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>Verify Gate PIN</span>
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Counter Offer Modal */}
      <ModalSheet
        isOpen={counterModalOpen}
        onClose={() => setCounterModalOpen(false)}
        title="Propose Counter-Offer to Farmer"
        description="Adjust hourly rate based on soil condition, diesel prices, or implement requirements"
      >
        <form onSubmit={handleCounter} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Proposed Hourly Rate (₹)</label>
            <input
              type="number"
              required
              value={counterRate}
              onChange={(e) => setCounterRate(Number(e.target.value))}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Counter Note / Rationale</label>
            <textarea
              rows={2}
              required
              value={counterNote}
              onChange={(e) => setCounterNote(e.target.value)}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCounterModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md"
            >
              Send Counter Offer
            </button>
          </div>
        </form>
      </ModalSheet>

      {/* Gate Check-In PIN Modal */}
      <ModalSheet
        isOpen={checkInModalOpen}
        onClose={() => setCheckInModalOpen(false)}
        title="Verify Gate Check-In PIN"
        description="Enter the 4-digit security PIN provided by the farmer upon machine arrival at field"
      >
        <form onSubmit={handleCheckIn} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Farmer Gate PIN (4 Digits)</label>
            <input
              type="text"
              maxLength={4}
              required
              placeholder="e.g. 5812"
              value={checkInPin}
              onChange={(e) => setCheckInPin(e.target.value)}
              className="w-full mt-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono font-bold tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setCheckInModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md"
            >
              Confirm Check-In
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
};
