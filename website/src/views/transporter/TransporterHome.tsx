import React, { useState } from 'react';
import {
  Truck,
  Layers,
  MapPin,
  Clock,
  DollarSign,
  FileText,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Play,
  Square,
  Upload,
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';

export const TransporterHome: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'loads' | 'trips' | 'bilty' | 'settlements'>('loads');

  // Load Board State
  const [loads, setLoads] = useState([
    {
      id: 'load_101',
      crop: 'Soybean',
      weightQuintal: 20,
      pickup: 'Pimpalgaon Baswant, Nashik',
      drop: 'Vashi APMC Yard, Navi Mumbai',
      distanceKm: 170,
      pickupDate: 'Tomorrow, 06:00 AM',
      estFare: 3920,
      currentBid: 3850,
      hasBidded: false,
    },
    {
      id: 'load_102',
      crop: 'Red Onion',
      weightQuintal: 40,
      pickup: 'Lasalgaon Mandi Yard, Nashik',
      drop: 'Gultekdi APMC, Pune',
      distanceKm: 210,
      pickupDate: '19 Oct, 08:00 AM',
      estFare: 5800,
      currentBid: 5600,
      hasBidded: false,
    },
  ]);

  // Active Trip State (FT-2 Waiting charges & milestones)
  const [waitingTimerActive, setWaitingTimerActive] = useState(false);
  const [waitingMinutes, setWaitingMinutes] = useState(75);
  const [tripStatus, setTripStatus] = useState<'inTransit' | 'delivered' | 'completed'>('inTransit');
  const [biltyModalOpen, setBiltyModalOpen] = useState(false);

  const handlePlaceBid = (id: string, amount: number) => {
    setLoads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, currentBid: amount, hasBidded: true } : l))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Truck className="w-7 h-7 text-emerald-600" />
            Transporter Logistics Cockpit (FT Desk)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Freight load auction board, milestone execution, automated detention fees (FT-2), digital bilty, and net settlements
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'loads', label: 'Load Board (Auction)' },
            { id: 'trips', label: 'Active Trips' },
            { id: 'bilty', label: 'Bilty Generator' },
            { id: 'settlements', label: 'P&L / Settlements' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                activeTab === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Active Vehicle Fleet"
          value="2 Vehicles"
          subtitle="MH 15 GV 3012 • MH 15 DK 7744"
          icon={Truck}
          colorScheme="blue"
        />
        <StatCard
          title="Trips This Month"
          value="18 Trips"
          subtitle="3,240 km logged"
          icon={Layers}
          colorScheme="green"
        />
        <StatCard
          title="Gross Revenue"
          value={formatCurrency(74200)}
          subtitle="Net after 10% commission"
          icon={DollarSign}
          colorScheme="amber"
        />
        <StatCard
          title="Detention Charges Earned"
          value={formatCurrency(2450)}
          subtitle="FT-2 waiting fee credited"
          icon={Clock}
          colorScheme="purple"
        />
      </div>

      {/* Tab 1: Load Board Auction */}
      {activeTab === 'loads' && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Live Freight Load Board (Auction Bids)</h3>
          <div className="space-y-4">
            {loads.map((load) => (
              <div
                key={load.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6"
              >
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-xl bg-sky-50 text-sky-700">
                      <Truck className="w-4 h-4" />
                    </span>
                    <h4 className="font-bold text-base text-slate-900">
                      {load.crop} Cargo ({formatWeight(load.weightQuintal)})
                    </h4>
                    <span className="text-xs font-mono text-slate-400">#{load.id}</span>
                  </div>

                  <p className="text-xs text-slate-600 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                    {load.pickup} → {load.drop} ({load.distanceKm} km)
                  </p>

                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" /> Pickup: {load.pickupDate}
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-end justify-between gap-3">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Current Lowest Bid</span>
                    <span className="text-xl font-black text-emerald-700">
                      {formatCurrency(load.currentBid)}
                    </span>
                  </div>

                  {load.hasBidded ? (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
                      ✓ Bid Placed ({formatCurrency(load.currentBid)})
                    </span>
                  ) : (
                    <button
                      onClick={() => handlePlaceBid(load.id, load.currentBid - 50)}
                      className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                    >
                      Bid ₹{load.currentBid - 50} (Undercut)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Active Trips & FT-2 Detention Waiting */}
      {activeTab === 'trips' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-extrabold text-base text-slate-900">
                  Trip #tb_502: Nashik → Vashi APMC (Soybean 20q)
                </h4>
                <p className="text-xs text-slate-400">Driver: Rahul Shinde • Vehicle: MH 15 GV 3012</p>
              </div>
              <StatusBadge status={tripStatus} />
            </div>

            {/* FT-2 Waiting Charge Recorder */}
            <div className="p-4 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-700" />
                  <div>
                    <h5 className="font-bold text-xs text-amber-950">Loading Detention Recorder (FT-2)</h5>
                    <p className="text-[10px] text-amber-800">
                      60 mins free. Beyond 60 mins: ₹150 per 30-min slab (Cap: ₹2,000)
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setWaitingTimerActive(!waitingTimerActive)}
                  className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-xs transition-colors ${
                    waitingTimerActive
                      ? 'bg-rose-600 text-white hover:bg-rose-700'
                      : 'bg-amber-600 text-white hover:bg-amber-700'
                  }`}
                >
                  {waitingTimerActive ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{waitingTimerActive ? 'Stop Detention Timer' : 'Start Loading Timer'}</span>
                </button>
              </div>

              <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-amber-200/60">
                <span>Recorded Detention: {waitingMinutes} minutes</span>
                <span className="text-amber-900">
                  Billable Slab: 1 Slab (+{formatCurrency(150)})
                </span>
              </div>
            </div>

            {/* Trip Milestones */}
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={() => setTripStatus('delivered')}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
              >
                Mark Arrived at Unloading Bay
              </button>
              <button
                onClick={() => setTripStatus('completed')}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
              >
                Upload POD & Complete Trip
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Bilty Generator */}
      {activeTab === 'bilty' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm space-y-6 max-w-2xl mx-auto font-mono text-xs text-slate-800">
          <div className="text-center border-b border-slate-300 pb-4 space-y-1">
            <h2 className="text-lg font-black text-slate-900 tracking-wider">GAJANAN AGRO LOGISTICS</h2>
            <p className="text-[11px] text-slate-500">Registered Goods Transport Operator • RTO MH-15</p>
            <h3 className="font-extrabold text-sm uppercase text-emerald-800 pt-1">
              CONSIGNMENT NOTE (BILTY) — #BLT-2026-0941
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-4 border-b border-slate-200 pb-4">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Consignor (Sender)</span>
              <p className="font-bold">Ramesh Tukaram Patil</p>
              <p className="text-slate-500">Pimpalgaon Baswant, Nashik</p>
              <p className="text-slate-500">+91 9876543210</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Consignee (Receiver)</span>
              <p className="font-bold">Shree Foods Pvt Ltd</p>
              <p className="text-slate-500">Vashi APMC Yard, Navi Mumbai</p>
              <p className="text-slate-500">GST: 27AAACS1234F1Z5</p>
            </div>
          </div>

          <div className="space-y-2 border-b border-slate-200 pb-4">
            <div className="flex justify-between">
              <span>Vehicle Reg:</span>
              <span className="font-bold">MH 15 GV 3012 (Pickup 1.5T)</span>
            </div>
            <div className="flex justify-between">
              <span>Cargo Description:</span>
              <span className="font-bold">Soybean (Yellow Grade A) — 40 Gunny Bags</span>
            </div>
            <div className="flex justify-between">
              <span>Charged Weight:</span>
              <span className="font-bold">20.00 Quintals (2,000 kg)</span>
            </div>
            <div className="flex justify-between">
              <span>Transit Insurance (FT-6):</span>
              <span className="font-bold text-emerald-700">Covered up to ₹1,00,000</span>
            </div>
          </div>

          <div className="flex justify-between items-center text-sm font-black pt-2">
            <span>Freight Agreed:</span>
            <span>₹3,920.00</span>
          </div>

          <button
            onClick={() => window.print()}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold font-sans text-xs shadow-md no-print"
          >
            Print / Save Formal Bilty PDF
          </button>
        </div>
      )}

      {/* Tab 4: Settlements & Commission */}
      {activeTab === 'settlements' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <h3 className="font-bold text-sm text-slate-900">Transporter Settlements & Platform Deductions (10%)</h3>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
            <div className="flex justify-between">
              <span>Gross Trip Fare (BLT-0941):</span>
              <span className="font-bold text-slate-900">₹3,920</span>
            </div>
            <div className="flex justify-between text-rose-700">
              <span>Agrovercity 10% Platform Fee:</span>
              <span>-₹392</span>
            </div>
            <div className="flex justify-between text-emerald-700 font-bold border-t border-slate-200 pt-2 text-sm">
              <span>Net Payout Disbursed:</span>
              <span>₹3,528</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
