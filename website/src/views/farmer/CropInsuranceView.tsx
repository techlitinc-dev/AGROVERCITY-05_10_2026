import React, { useState } from 'react';
import { ShieldAlert, AlertTriangle, Camera, Check, Clock, Plus, UploadCloud } from 'lucide-react';
import { MOCK_INSURANCE_CLAIMS } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { CropInsuranceClaim } from '../../types';

export const CropInsuranceView: React.FC = () => {
  const [claims, setClaims] = useState<CropInsuranceClaim[]>(MOCK_INSURANCE_CLAIMS);
  const [intimateModalOpen, setIntimateModalOpen] = useState(false);

  // Form State
  const [crop, setCrop] = useState('Soybean');
  const [calamity, setCalamity] = useState<CropInsuranceClaim['calamityType']>('Excess Rainfall / Flood');
  const [calamityDate, setCalamityDate] = useState('2026-10-15');
  const [damagePercent, setDamagePercent] = useState(40);
  const [estLoss, setEstLoss] = useState(28000);
  const [photosUploaded, setPhotosUploaded] = useState(false);

  const handleIntimate = (e: React.FormEvent) => {
    e.preventDefault();
    const newClaim: CropInsuranceClaim = {
      id: 'clm_' + Date.now().toString().slice(-4),
      farmerId: 'usr_farmer_ramesh',
      farmerName: 'Ramesh Patil',
      policyNumber: 'PMFBY-MH-KHARIF-2026-' + Math.floor(1000 + Math.random() * 9000),
      crop,
      surveyNumber: 'Gat No. 312',
      calamityType: calamity,
      calamityDate,
      damagePercentage: damagePercent,
      estimatedLossAmount: estLoss,
      status: 'intimated',
      photos: ['https://images.unsplash.com/photo-1595855759920-86582396756a?auto=format&fit=crop&w=600&q=80'],
      createdAt: new Date().toISOString().split('T')[0],
    };
    setClaims([newClaim, ...claims]);
    setIntimateModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-emerald-600" />
            PMFBY Crop Insurance & Claim Desk
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Pradhan Mantri Fasal Bima Yojana — 72-hour crop loss intimation, surveyor tracking, and Direct Benefit Transfer (DBT)
          </p>
        </div>

        <button
          onClick={() => setIntimateModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all"
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Intimate Crop Loss (72h)</span>
        </button>
      </div>

      {/* Claims Timeline List */}
      <div className="space-y-4">
        {claims.map((claim) => (
          <div
            key={claim.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-base text-slate-900">{claim.crop} Damage Claim</h4>
                  <span className="font-mono text-xs text-slate-400">#{claim.id}</span>
                </div>
                <p className="text-xs text-slate-500">
                  Policy: <strong>{claim.policyNumber}</strong> • {claim.surveyNumber}
                </p>
              </div>
              <StatusBadge status={claim.status} />
            </div>

            {/* Claim details */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Calamity Type</span>
                <span className="font-bold text-slate-900">{claim.calamityType}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Incident Date</span>
                <span className="font-bold text-slate-900">{formatDate(claim.calamityDate)}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Damage Assessed</span>
                <span className="font-bold text-rose-700">{claim.damagePercentage}% Area Lost</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl">
                <span className="text-slate-400 font-semibold block text-[10px] uppercase">Estimated DBT</span>
                <span className="font-black text-emerald-700">{formatCurrency(claim.estimatedLossAmount)}</span>
              </div>
            </div>

            {/* Photos */}
            {claim.photos.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-400 font-medium">Geo-Tagged Field Photos:</span>
                <div className="flex gap-2">
                  {claim.photos.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt="Crop damage proof"
                      className="w-14 h-14 rounded-xl object-cover border border-slate-200"
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Intimate Claim Modal */}
      <ModalSheet
        isOpen={intimateModalOpen}
        onClose={() => setIntimateModalOpen(false)}
        title="Intimate Crop Damage (72h Deadline)"
        description="Notify insurance nodal officer and surveyor within 72 hours of weather calamity"
        maxWidth="md"
      >
        <form onSubmit={handleIntimate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Affected Crop</label>
              <select
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Soybean">Soybean (Kharif)</option>
                <option value="Wheat">Wheat (Rabi)</option>
                <option value="Onion">Onion</option>
                <option value="Cotton">Cotton</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Calamity Cause</label>
              <select
                value={calamity}
                onChange={(e) => setCalamity(e.target.value as any)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              >
                <option value="Excess Rainfall / Flood">Excess Rainfall / Inundation</option>
                <option value="Drought">Severe Drought / Dry Spell</option>
                <option value="Hailstorm">Hailstorm (Olavrushti)</option>
                <option value="Pest Attack">Widespread Pest Attack</option>
                <option value="Unseasonal Frost">Unseasonal Cold / Frost</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Calamity Date</label>
              <input
                type="date"
                value={calamityDate}
                onChange={(e) => setCalamityDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Damage Est (%)</label>
              <input
                type="number"
                value={damagePercent}
                onChange={(e) => setDamagePercent(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Loss Value (₹)</label>
              <input
                type="number"
                value={estLoss}
                onChange={(e) => setEstLoss(Number(e.target.value))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-rose-700"
                required
              />
            </div>
          </div>

          {/* Photo Upload Simulation */}
          <div className="p-4 border-2 border-dashed border-slate-300 rounded-2xl text-center space-y-2">
            <Camera className="w-8 h-8 text-slate-400 mx-auto" />
            <div className="text-xs text-slate-600">
              <span className="font-bold text-emerald-700">Upload Geo-Tagged Photos</span> of flooded/damaged plot
            </div>
            <button
              type="button"
              onClick={() => setPhotosUploaded(true)}
              className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg transition-colors"
            >
              {photosUploaded ? '✓ 2 Photos Attached (GPS lat/lng tagged)' : 'Attach Field Camera Photos'}
            </button>
          </div>

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all"
          >
            Submit Loss Intimation to Insurance Desk
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
