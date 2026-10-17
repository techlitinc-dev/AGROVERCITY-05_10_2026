import React, { useState } from 'react';
import { Building2, Layers, Plus, Check, Award, FileText, CheckCircle2, AlertTriangle, QrCode } from 'lucide-react';
import { MOCK_BUYER_DEMANDS, MOCK_PURCHASES } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { BuyerDemand, PurchaseOrder } from '../../types';

export const DirectBuyerHome: React.FC = () => {
  const [demands, setDemands] = useState<BuyerDemand[]>(MOCK_BUYER_DEMANDS);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>(MOCK_PURCHASES);
  const [createDemandModal, setCreateDemandModal] = useState(false);
  const [qcModalPurchase, setQcModalPurchase] = useState<PurchaseOrder | null>(null);
  const [qcGrade, setQcGrade] = useState<'A' | 'B' | 'C' | 'Rejected'>('A');

  // New demand form
  const [crop, setCrop] = useState('Soybean');
  const [qty, setQty] = useState(100);
  const [maxPrice, setMaxPrice] = useState(4850);
  const [specs, setSpecs] = useState('Moisture <10%, Impurity <2%, Cleaned seed');

  const handleCreateDemand = (e: React.FormEvent) => {
    e.preventDefault();
    const newDemand: BuyerDemand = {
      id: 'dmd_' + Date.now().toString().slice(-4),
      buyerId: 'usr_buyer_shreefoods',
      buyerName: 'Vijay Singhania',
      companyName: 'Shree Foods Pvt Ltd',
      crop,
      requiredQuantityQuintal: qty,
      maxPricePerQuintal: maxPrice,
      deliveryLocation: 'Vashi APMC Yard, Navi Mumbai',
      state: 'Maharashtra',
      district: 'Thane',
      qualitySpecs: specs,
      status: 'open',
      validUntil: '2026-10-31',
      createdAt: new Date().toISOString().split('T')[0],
    };
    setDemands([newDemand, ...demands]);
    setCreateDemandModal(false);
  };

  const handleSaveQc = () => {
    if (!qcModalPurchase) return;
    setPurchases((prev) =>
      prev.map((p) =>
        p.id === qcModalPurchase.id
          ? { ...p, qcGrade, status: qcGrade === 'Rejected' ? 'qcDisputed' : 'completed' }
          : p
      )
    );
    setQcModalPurchase(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-emerald-600" />
            Direct Buyer B2B Procurement Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Publish institutional crop demands, review farmer quotes, inspect arrivals with QC grading, and disburse balances
          </p>
        </div>

        <button
          onClick={() => setCreateDemandModal(true)}
          className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Post Bulk Crop Demand</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Active Procurement Demands"
          value={`${demands.length} Demands`}
          subtitle="Soybean, Wheat, Maize"
          icon={Layers}
          colorScheme="blue"
        />
        <StatCard
          title="Incoming Shipments"
          value="1 Order"
          subtitle="Pickup scheduled tomorrow"
          icon={Building2}
          colorScheme="green"
        />
        <StatCard
          title="Escrow Funded Balance"
          value={formatCurrency(95000)}
          subtitle="Protected B2B procurement"
          icon={Award}
          colorScheme="amber"
        />
      </div>

      {/* Incoming Produce Deliveries & Gate Handover */}
      <div className="space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Incoming Deliveries & QC Inspection Desk</h3>
        <div className="space-y-3">
          {purchases.map((po) => (
            <div
              key={po.id}
              className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-bold text-base text-slate-900">
                    {po.crop} ({formatWeight(po.quantityQuintal)}) from {po.farmerName}
                  </h4>
                  <p className="text-xs text-slate-400">Order #{po.id} • Agreed Price: ₹{po.agreedPricePerQuintal}/q</p>
                </div>
                <StatusBadge status={po.status} />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Total Order Value</span>
                  <span className="font-black text-emerald-800 text-base">{formatCurrency(po.totalAmount)}</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Advance Funded</span>
                  <span className="font-bold text-slate-800 text-base">{formatCurrency(po.advanceAmount)} (Paid)</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Gate Handover OTP</span>
                  <span className="font-mono font-bold text-slate-800 text-base">{po.handoverOtp || '8492'}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button
                  onClick={() => setQcModalPurchase(po)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
                >
                  <Award className="w-4 h-4" />
                  <span>Execute QC Inspection</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Demand Modal */}
      <ModalSheet
        isOpen={createDemandModal}
        onClose={() => setCreateDemandModal(false)}
        title="Post Institutional Crop Demand"
        description="Specify bulk volume and target ceiling price for farmer supply"
        maxWidth="md"
      >
        <form onSubmit={handleCreateDemand} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop</label>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Soybean">Soybean (High Oil)</option>
                <option value="Wheat">Wheat (Lokwan Grade-1)</option>
                <option value="Maize">Yellow Maize (Poultry grade)</option>
                <option value="Cotton">Cotton (Medium Staple)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Volume (Quintals)</label>
              <input
                type="number"
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Max Ceiling Price (₹/q)</label>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 text-emerald-800"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Quality Specifications</label>
            <textarea
              rows={3}
              value={specs}
              onChange={(e) => setSpecs(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
          >
            Publish Bulk Demand
          </button>
        </form>
      </ModalSheet>

      {/* QC Inspection Modal */}
      <ModalSheet
        isOpen={Boolean(qcModalPurchase)}
        onClose={() => setQcModalPurchase(null)}
        title="Produce Quality Inspection (QC)"
        description={`Record physical inspection grade for #${qcModalPurchase?.id}`}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Assigned Grade</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'A', label: 'Grade A (Full Pay)' },
                { id: 'B', label: 'Grade B (-2% penalty)' },
                { id: 'C', label: 'Grade C (-5% penalty)' },
                { id: 'Rejected', label: 'Reject / Dispute' },
              ].map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setQcGrade(g.id as any)}
                  className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all ${
                    qcGrade === g.id
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-900'
                      : 'border-slate-200 text-slate-700'
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleSaveQc}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
          >
            Confirm Inspection & Release Balance
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
