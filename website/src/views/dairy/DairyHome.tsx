import React, { useState } from 'react';
import { Milk, Building2, Plus, DollarSign, Users, Award, ShieldCheck, Check, Printer, FileText } from 'lucide-react';
import { MOCK_MILK_SLIPS } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import type { MilkCollectionSlip } from '../../types';

export const DairyHome: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'collection' | 'members' | 'batches' | 'gaushala'>('collection');
  const [slips, setSlips] = useState<MilkCollectionSlip[]>(MOCK_MILK_SLIPS);
  const [collectionModal, setCollectionModal] = useState(false);
  const [donationModal, setDonationModal] = useState(false);

  // New milk slip form
  const [memberName, setMemberName] = useState('Ramesh Patil');
  const [animalType, setAnimalType] = useState<'Cow' | 'Buffalo'>('Cow');
  const [quantity, setQuantity] = useState(12.5);
  const [fat, setFat] = useState(4.2);
  const [snf, setSnf] = useState(8.7);
  const [shift, setShift] = useState<'morning' | 'evening'>('morning');

  // Auto FAT/SNF pricing formula (Cow base: ₹30 + (FAT * 1.5) + (SNF * 0.5))
  const calculatedRate = +(30 + (fat - 3.5) * 6.5 + (snf - 8.5) * 3.5).toFixed(2);
  const calculatedTotal = +(quantity * calculatedRate).toFixed(2);

  const handleAddSlip = (e: React.FormEvent) => {
    e.preventDefault();
    const newSlip: MilkCollectionSlip = {
      id: 'ms_' + Date.now().toString().slice(-4),
      date: '2026-10-17',
      shift,
      memberId: 'mem_' + Math.floor(100 + Math.random() * 900),
      memberName,
      animalType,
      quantityLiters: quantity,
      fatPercent: fat,
      snfPercent: snf,
      ratePerLiter: calculatedRate,
      totalAmount: calculatedTotal,
      printedAt: 'Just now',
    };
    setSlips([newSlip, ...slips]);
    setCollectionModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Milk className="w-7 h-7 text-emerald-600" />
            Dudh Dairy Manager & Gaushala Trust Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Automated FAT/SNF milk chart pricing, member passbook payouts, cattle herd health, and 80G tax-exempt receipts
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto no-scrollbar">
          {[
            { id: 'collection', label: 'Milk Collection Desk' },
            { id: 'members', label: 'Member Passbook' },
            { id: 'batches', label: '10-Day Payouts' },
            { id: 'gaushala', label: 'Gaushala 80G Portal' },
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard
          title="Today's Collection"
          value="482 Liters"
          subtitle="Morning: 260L • Evening: 222L"
          icon={Milk}
          colorScheme="blue"
        />
        <StatCard
          title="Average FAT / SNF"
          value="4.15% / 8.65"
          subtitle="Grade A pure cow milk"
          icon={Award}
          colorScheme="green"
        />
        <StatCard
          title="Pending Payout Batch"
          value={formatCurrency(68450)}
          subtitle="Cycle 11–20 Oct (42 farmers)"
          icon={DollarSign}
          colorScheme="amber"
        />
        <StatCard
          title="Active Members"
          value="58 Dairy Farmers"
          subtitle="Passbooks synced"
          icon={Users}
          colorScheme="purple"
        />
      </div>

      {/* Tab 1: Collection Desk */}
      {activeTab === 'collection' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-900">Today's Milk Collection Slips</h3>
            <button
              onClick={() => setCollectionModal(true)}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Record Milk Entry
            </button>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-6">Member Name & ID</th>
                  <th className="py-3 px-4">Shift & Animal</th>
                  <th className="py-3 px-4">Volume (Liters)</th>
                  <th className="py-3 px-4">FAT / SNF %</th>
                  <th className="py-3 px-4">Calculated Rate</th>
                  <th className="py-3 px-6 text-right">Total Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slips.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="py-3.5 px-6 font-bold text-slate-900">
                      {s.memberName}
                      <span className="text-[10px] text-slate-400 block font-mono">#{s.id}</span>
                    </td>
                    <td className="py-3.5 px-4 font-semibold text-slate-600 capitalize">
                      {s.shift} • {s.animalType}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{s.quantityLiters} L</td>
                    <td className="py-3.5 px-4 font-mono text-emerald-800 font-bold">
                      {s.fatPercent}% FAT • {s.snfPercent}% SNF
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{formatCurrency(s.ratePerLiter)}/L</td>
                    <td className="py-3.5 px-6 text-right font-black text-emerald-800 text-sm">
                      {formatCurrency(s.totalAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Gaushala 80G Receipts */}
      {activeTab === 'gaushala' && (
        <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">Shree Krishna Gaushala Trust (80G Tax Exemption)</h3>
              <p className="text-xs text-slate-400">Reg No: MAH/1942/NSK • 100% Tax Deductible Donor Portal</p>
            </div>
            <button
              onClick={() => setDonationModal(true)}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs"
            >
              Issue 80G Receipt
            </button>
          </div>

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2">
            <div className="flex justify-between font-bold text-slate-900">
              <span>Receipt: 80G-2026-092</span>
              <span className="text-emerald-700">₹5,100 (Cattle Feed & Gau Gras)</span>
            </div>
            <p className="text-slate-600">Donor: <strong>Mahesh Agarwal (PAN: ABCPA1234F)</strong></p>
            <p className="text-[11px] text-slate-400">Section 80G digital certificate issued with QR audit trail.</p>
          </div>
        </div>
      )}

      {/* Milk Collection Entry Modal with Live Rate Calculator */}
      <ModalSheet
        isOpen={collectionModal}
        onClose={() => setCollectionModal(false)}
        title="Record Daily Milk Collection"
        description="Live chart pricing calculation based on measured FAT & SNF"
        maxWidth="md"
      >
        <form onSubmit={handleAddSlip} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Farmer Member Name</label>
              <input
                type="text"
                value={memberName}
                onChange={(e) => setMemberName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shift</label>
              <select
                value={shift}
                onChange={(e) => setShift(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="morning">Morning Shift (सकाळ)</option>
                <option value="evening">Evening Shift (संध्याकाळ)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Volume (Liters)</label>
              <input
                type="number"
                step="0.5"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">FAT (%)</label>
              <input
                type="number"
                step="0.1"
                value={fat}
                onChange={(e) => setFat(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 text-emerald-800"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">SNF (%)</label>
              <input
                type="number"
                step="0.1"
                value={snf}
                onChange={(e) => setSnf(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 text-emerald-800"
                required
              />
            </div>
          </div>

          {/* Dynamic Rate Calculation Preview Box */}
          <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200 flex justify-between items-center text-xs">
            <div>
              <span className="text-slate-500 block">Rate Calculated:</span>
              <span className="font-extrabold text-emerald-800 text-sm">₹{calculatedRate} / Liter</span>
            </div>
            <div className="text-right">
              <span className="text-slate-500 block">Total Payout:</span>
              <span className="font-black text-emerald-900 text-base">{formatCurrency(calculatedTotal)}</span>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
          >
            Print & Save Collection Slip
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
