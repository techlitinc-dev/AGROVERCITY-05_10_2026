import React, { useState } from 'react';
import {
  Truck,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  Share2,
  Check,
  Copy,
  AlertCircle,
  FileText,
  DollarSign,
  ArrowRight,
} from 'lucide-react';
import { MOCK_VEHICLES, MOCK_TRANSPORT_BOOKINGS, api } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { TransportVehicle, TransportBooking } from '../../types';

export const TransportBookingView: React.FC = () => {
  const [vehicles, setVehicles] = useState<TransportVehicle[]>(MOCK_VEHICLES);
  const [bookings, setBookings] = useState<TransportBooking[]>(MOCK_TRANSPORT_BOOKINGS);
  const [bookModalOpen, setBookModalOpen] = useState(false);
  const [shareModalBooking, setShareModalBooking] = useState<TransportBooking | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  // Booking Form State
  const [selectedVehicle, setSelectedVehicle] = useState('Pickup 1.5T');
  const [pickupAddr, setPickupAddr] = useState('Pimpalgaon Baswant Farm Gate, Nashik');
  const [dropAddr, setDropAddr] = useState('Vashi APMC Yard, Navi Mumbai');
  const [distanceKm, setDistanceKm] = useState(170);
  const [cargoCrop, setCargoCrop] = useState('Soybean');
  const [cargoWeight, setCargoWeight] = useState(20);
  const [pickupTime, setPickupTime] = useState('2026-10-18T06:00');
  const [timeWindow, setTimeWindow] = useState(120);
  const [insuranceOptIn, setInsuranceOptIn] = useState(true);
  const [declaredValue, setDeclaredValue] = useState(100000); // ₹1,00,000

  // Calculation for Fare & FT-6 Transit Insurance
  // Premium = ceil(declaredValue * 0.8%) = ₹800
  const insurancePremium = insuranceOptIn ? Math.ceil(declaredValue * 0.008) : 0;
  const estimatedBaseFare = 1200 + distanceKm * 16;
  const totalEstimatedCost = estimatedBaseFare + insurancePremium;

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    const newBooking: TransportBooking = {
      id: 'tb_' + Date.now().toString().slice(-4),
      farmerId: 'usr_farmer_ramesh',
      farmerName: 'Ramesh Patil',
      farmerPhone: '9876543210',
      transporterName: 'Rahul Shinde (Gajanan Transport)',
      vehicleType: selectedVehicle,
      pickupAddress: pickupAddr,
      dropAddress: dropAddr,
      distanceKm,
      cargoCrop,
      cargoWeightQuintal: cargoWeight,
      pickupTime,
      timeWindowMinutes: timeWindow,
      insuranceOptIn,
      declaredValuePaisa: declaredValue * 100,
      insurancePremiumPaisa: insurancePremium * 100,
      estimatedFare: estimatedBaseFare,
      waitingHours: 0,
      waitingChargePaisa: 0,
      status: 'pending',
      shareToken: 'tr_live_' + Math.random().toString(36).substring(2, 9),
      biltyNumber: 'BLT-' + Math.floor(1000 + Math.random() * 9000),
      createdAt: new Date().toISOString(),
    };
    setBookings([newBooking, ...bookings]);
    setBookModalOpen(false);
  };

  const copyShareLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/track/${token}`);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Book Gadi / Transport (FT-1 to FT-8 Protocol)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Book agricultural transport with verified drivers, guaranteed transit insurance, detention timers, and live trip tracking
          </p>
        </div>

        <button
          onClick={() => setBookModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Truck className="w-4 h-4" />
          <span>Book Gadi Now</span>
        </button>
      </div>

      {/* Available Vehicles Grid */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900">Standard Vehicle Fleets & Rates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {vehicles.map((v) => (
            <div
              key={v.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-sky-50 text-sky-700">
                  <Truck className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{v.vehicleType}</h4>
                  <p className="text-xs text-slate-500">{v.transporterName}</p>
                  <span className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md mt-1 inline-block">
                    {v.registrationNumber} • {v.capacityTons}T Payload
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xs text-slate-400 block font-semibold">Standard Rate</span>
                <span className="text-sm font-extrabold text-slate-900">
                  ₹{v.baseFare} base + ₹{v.ratePerKm}/km
                </span>
                <button
                  onClick={() => {
                    setSelectedVehicle(v.vehicleType);
                    setBookModalOpen(true);
                  }}
                  className="mt-2 block px-3 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl transition-colors"
                >
                  Book This
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active & Scheduled Bookings */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="font-bold text-sm text-slate-900">My Transport Trips</h3>

        <div className="space-y-4">
          {bookings.map((booking) => (
            <div
              key={booking.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700">
                    <Truck className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-slate-900">
                      {booking.cargoCrop} ({formatWeight(booking.cargoWeightQuintal)}) • {booking.vehicleType}
                    </h4>
                    <p className="text-xs text-slate-500">
                      Transporter: <strong>{booking.transporterName}</strong>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <StatusBadge status={booking.status} />
                  <span className="text-xs font-mono text-slate-400">#{booking.id}</span>
                </div>
              </div>

              {/* Route & Details */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" /> Route & Distance
                  </span>
                  <p className="font-bold text-slate-900">{booking.pickupAddress.split(',')[0]} → {booking.dropAddress.split(',')[0]}</p>
                  <p className="text-slate-500">{booking.distanceKm} km</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-sky-600" /> Pickup Window (FT-1)
                  </span>
                  <p className="font-bold text-slate-900">
                    {new Date(booking.pickupTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                  <p className="text-slate-500">±{booking.timeWindowMinutes} mins window</p>
                </div>

                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold flex items-center gap-1">
                    <DollarSign className="w-3.5 h-3.5 text-amber-600" /> Fare & Insurance (FT-6)
                  </span>
                  <p className="font-bold text-slate-900">
                    {formatCurrency(booking.estimatedFare)}
                    {booking.insuranceOptIn && (
                      <span className="text-[10px] text-emerald-700 ml-1 font-semibold">
                        (+{formatCurrency(booking.insurancePremiumPaisa ? booking.insurancePremiumPaisa / 100 : 800)} Ins.)
                      </span>
                    )}
                  </p>
                  <p className="text-slate-500">60m free loading, then ₹150/slab</p>
                </div>
              </div>

              {/* Bottom Actions: Share Trip (FT-7) & View Bilty */}
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShareModalBooking(booking)}
                    className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Live Trip (48h Token)</span>
                  </button>

                  {booking.biltyNumber && (
                    <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
                      Bilty: {booking.biltyNumber}
                    </span>
                  )}
                </div>

                <span className="text-xs font-semibold text-slate-400">Driver Contact unlocked on trip start</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Book Gadi Modal */}
      <ModalSheet
        isOpen={bookModalOpen}
        onClose={() => setBookModalOpen(false)}
        title="Book Transport Vehicle (FT-1 / FT-6)"
        description="Calculate fare, select vehicle, and attach transit insurance"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateBooking} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Vehicle Type</label>
              <select
                value={selectedVehicle}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Pickup 1.5T">Pickup 1.5T (Max 1.5 Ton)</option>
                <option value="Tata Ace (1T)">Tata Ace 1T</option>
                <option value="Eicher 14ft (4T)">Eicher 14ft (4T)</option>
                <option value="Reefer / Cold Truck">Reefer / Cold Truck</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Cargo Crop</label>
              <input
                type="text"
                value={cargoCrop}
                onChange={(e) => setCargoCrop(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Address</label>
              <input
                type="text"
                value={pickupAddr}
                onChange={(e) => setPickupAddr(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Destination Address</label>
              <input
                type="text"
                value={dropAddr}
                onChange={(e) => setDropAddr(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Distance (km)</label>
              <input
                type="number"
                value={distanceKm}
                onChange={(e) => setDistanceKm(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Weight (q)</label>
              <input
                type="number"
                value={cargoWeight}
                onChange={(e) => setCargoWeight(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Pickup Date & Time</label>
              <input
                type="datetime-local"
                value={pickupTime}
                onChange={(e) => setPickupTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          {/* Transit Insurance Add-on (FT-6) */}
          <div className="p-3.5 bg-emerald-50 rounded-2xl border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
                <div>
                  <h5 className="font-bold text-xs text-slate-900">Transit Cargo Insurance (FT-6)</h5>
                  <p className="text-[10px] text-slate-500">Covers theft, accident, overturn & weather spoilage</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={insuranceOptIn}
                onChange={(e) => setInsuranceOptIn(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600"
              />
            </div>

            {insuranceOptIn && (
              <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs">
                <span>Declared Cargo Value: ₹{declaredValue.toLocaleString()}</span>
                <span className="font-bold text-emerald-800">
                  Premium: {formatCurrency(insurancePremium)} (0.8%)
                </span>
              </div>
            )}
          </div>

          {/* Summary Box */}
          <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs font-bold text-slate-800">
            <span>Estimated Total:</span>
            <span className="text-base font-black text-emerald-700">{formatCurrency(totalEstimatedCost)}</span>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Confirm Transport Booking
          </button>
        </form>
      </ModalSheet>

      {/* Share Live Trip Modal (FT-7) */}
      <ModalSheet
        isOpen={Boolean(shareModalBooking)}
        onClose={() => setShareModalBooking(null)}
        title="Share Live Trip Tracking (FT-7)"
        description="Login-free, sanitized public link with 48h TTL (no phone or fares revealed)"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs font-mono break-all border border-slate-200">
            {window.location.origin}/track/{shareModalBooking?.shareToken}
          </div>

          <button
            onClick={() => shareModalBooking && copyShareLink(shareModalBooking.shareToken || '')}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
          >
            {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Shareable Link'}</span>
          </button>

          <p className="text-[11px] text-slate-400 text-center">
            Family members or buyers can view live movement without needing an Agrovercity account.
          </p>
        </div>
      </ModalSheet>
    </div>
  );
};
