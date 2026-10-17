import React, { useState } from 'react';
import {
  Building2,
  FileSpreadsheet,
  Plus,
  Layers,
  DollarSign,
  Check,
  ShieldCheck,
  Clock,
  Send,
  MapPin,
  Calendar,
} from 'lucide-react';
import { MOCK_LAND_LEASES } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency } from '../../lib/utils';
import type { LandLeaseListing, LeaseNegotiation } from '../../types';

export const LandlordHome: React.FC = () => {
  const [leases, setLeases] = useState<LandLeaseListing[]>(MOCK_LAND_LEASES);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [negotiations, setNegotiations] = useState<LeaseNegotiation[]>([
    {
      id: 'neg_1',
      listingId: 'lease_plot_312',
      landlordId: 'usr_farmer_ramesh',
      farmerId: 'usr_tenant_anil',
      farmerName: 'Anil Jadhav (Tenant Farmer)',
      offeredAnnualRent: 52000,
      proposedYears: 2,
      round: 2, // Max 5 rounds
      status: 'pending',
      lastMessage: 'Will install drip lines and maintain borewell motor. Requesting ₹52,000/yr.',
      updatedAt: 'Today, 10:30 AM',
    },
  ]);

  const [counterRound, setCounterRound] = useState(3);
  const [counterRent, setCounterRent] = useState(54000);
  const [counterModalOpen, setCounterModalOpen] = useState(false);
  const [dealLockedAlert, setDealLockedAlert] = useState(false);

  // New Lease Listing Form
  const [plotTitle, setPlotTitle] = useState('Gat 312 Fertile Soil with Borewell');
  const [acres, setAcres] = useState(3.5);
  const [annualRent, setAnnualRent] = useState(55000);
  const [tenureYears, setTenureYears] = useState(2);
  const [waterSource, setWaterSource] = useState<LandLeaseListing['waterSource']>('Borewell');

  const handleCreateListing = (e: React.FormEvent) => {
    e.preventDefault();
    const newListing: LandLeaseListing = {
      id: 'lease_' + Date.now(),
      landlordId: 'usr_farmer_ramesh',
      landlordName: 'Ramesh Patil',
      landlordPhone: '9876543210',
      title: plotTitle,
      surveyNumber: 'Gat 312',
      village: 'Pimpalgaon Baswant',
      district: 'Nashik',
      acres,
      soilType: 'Deep Black Cotton Soil',
      waterSource,
      annualRent,
      tenureYears,
      terms: 'Borewell electricity connected, road access available.',
      status: 'open',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setLeases([newListing, ...leases]);
    setCreateModalOpen(false);
  };

  const handleAcceptNegotiation = (id: string) => {
    setNegotiations((prev) =>
      prev.map((n) => (n.id === id ? { ...n, status: 'accepted' } : n))
    );
    setDealLockedAlert(true);
    setTimeout(() => setDealLockedAlert(false), 3000);
  };

  const handleSendCounter = () => {
    setNegotiations((prev) =>
      prev.map((n) =>
        n.id === 'neg_1'
          ? {
              ...n,
              offeredAnnualRent: counterRent,
              round: n.round + 1,
              status: 'countered',
              lastMessage: `Landlord countered at ₹${counterRent}/year.`,
            }
          : n
      )
    );
    setCounterModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Landlord Workspace & Agricultural Leases
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register farm plots, link 7/12 land records, negotiate digital leases (max 5 rounds), and collect escrow-protected rent
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>List Land for Lease</span>
        </button>
      </div>

      {dealLockedAlert && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-bold text-emerald-900 flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>Lease agreement accepted! Escrow payment milestone generated for tenant Anil Jadhav.</span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Registered Land Plots"
          value="1 Plot (Gat 312)"
          subtitle="4.5 Acres verified via 7/12"
          icon={FileSpreadsheet}
          colorScheme="green"
        />
        <StatCard
          title="Annual Lease Rent"
          value={formatCurrency(55000)}
          subtitle="Escrow protected rent schedule"
          icon={DollarSign}
          colorScheme="amber"
        />
        <StatCard
          title="Active Tenant Inquiries"
          value="1 Negotiation"
          subtitle="Round 2 of 5 in progress"
          icon={Layers}
          colorScheme="blue"
        />
      </div>

      {/* Listed Plots for Lease */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900">My Listed Farmland for Lease</h3>
        <div className="space-y-4">
          {leases.map((plot) => (
            <div
              key={plot.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">{plot.title}</h4>
                  <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" /> {plot.village}, {plot.district} ({plot.surveyNumber})
                  </p>
                </div>
                <StatusBadge status={plot.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Area</span>
                  <p className="font-bold text-slate-900">{plot.acres} Acres</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Annual Rent</span>
                  <p className="font-bold text-emerald-800">{formatCurrency(plot.annualRent)} /yr</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Water Source</span>
                  <p className="font-bold text-slate-900">{plot.waterSource}</p>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Tenure</span>
                  <p className="font-bold text-slate-900">{plot.tenureYears} Years</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Lease Negotiation Inbox (5 Rounds Rule from userflow.md) */}
      <div className="space-y-3 pt-4 border-t border-slate-200">
        <h3 className="font-bold text-sm text-slate-900">
          Lease Request Inbox & 5-Round Negotiation Desk
        </h3>

        <div className="space-y-4">
          {negotiations.map((neg) => (
            <div
              key={neg.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{neg.farmerName}</h4>
                  <p className="text-xs text-slate-400">Gat 312 Lease Proposal • {neg.updatedAt}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
                  Negotiation Round {neg.round} of 5
                </span>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-xs space-y-2">
                <div className="flex justify-between font-bold">
                  <span className="text-slate-600">Offered Rent:</span>
                  <span className="text-emerald-800 text-sm">{formatCurrency(neg.offeredAnnualRent)} / year</span>
                </div>
                <p className="italic text-slate-600">"{neg.lastMessage}"</p>
              </div>

              {neg.status !== 'accepted' && (
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setCounterModalOpen(true)}
                    className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                  >
                    Counter (Round {neg.round + 1})
                  </button>
                  <button
                    onClick={() => handleAcceptNegotiation(neg.id)}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    Accept & Lock Agreement
                  </button>
                </div>
              )}

              {neg.status === 'accepted' && (
                <div className="text-right text-xs font-bold text-emerald-700 flex items-center justify-end gap-1">
                  <Check className="w-4 h-4" /> Agreement Executed
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Create Lease Modal */}
      <ModalSheet
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        title="List Agricultural Plot for Lease"
        description="Specify tenure, rent terms, and water infrastructure for tenant farmers"
        maxWidth="md"
      >
        <form onSubmit={handleCreateListing} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Listing Title</label>
            <input
              type="text"
              value={plotTitle}
              onChange={(e) => setPlotTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Area (Acres)</label>
              <input
                type="number"
                step="0.1"
                value={acres}
                onChange={(e) => setAcres(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Annual Rent (₹/yr)</label>
              <input
                type="number"
                value={annualRent}
                onChange={(e) => setAnnualRent(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 font-mono text-emerald-800"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Water Source</label>
              <select
                value={waterSource}
                onChange={(e) => setWaterSource(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Borewell">Borewell with Motor</option>
                <option value="Canal">Canal Irrigation</option>
                <option value="Open Well">Open Well</option>
                <option value="Rainfed">Rainfed</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tenure (Years)</label>
              <select
                value={tenureYears}
                onChange={(e) => setTenureYears(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value={1}>1 Year</option>
                <option value={2}>2 Years</option>
                <option value={3}>3 Years</option>
                <option value={5}>5 Years</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Publish Land Listing
          </button>
        </form>
      </ModalSheet>

      {/* Counter Modal */}
      <ModalSheet
        isOpen={counterModalOpen}
        onClose={() => setCounterModalOpen(false)}
        title="Send Landlord Counter Offer"
        description="You have up to 5 negotiation rounds per lease inquiry"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Counter Annual Rent (₹/yr)</label>
            <input
              type="number"
              value={counterRent}
              onChange={(e) => setCounterRent(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-base font-bold rounded-xl border border-slate-300 text-emerald-800"
            />
          </div>

          <button
            onClick={handleSendCounter}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
          >
            Send Counter to Tenant
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
