import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Plus,
  AlertCircle,
  CheckCircle2,
  FileText,
  DollarSign,
  Camera,
  RefreshCw,
} from 'lucide-react';
import { equipmentOwner, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';

interface ClaimItem {
  id: string;
  machineId?: string;
  machineName?: string;
  renterName?: string;
  estimatedCostRupees?: number;
  status: string;
  description?: string;
  evidencePhotoUrl?: string;
  createdAt?: string;
}

export const EquipmentClaimsView: React.FC = () => {
  const [claims, setClaims] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // File Claim Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [claimForm, setClaimForm] = useState({
    bookingId: 'bk_801',
    machineName: 'Mahindra 575 DI + Rotavator',
    renterName: 'Anil Jadhav',
    estimatedCostRupees: 6500,
    description: 'Rotavator flange blade broken due to unmapped stone obstruction in field.',
    evidencePhotoUrl: 'https://agrovercity.io/claims/blade-damage-01.jpg',
  });

  const loadClaims = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await equipmentOwner.damageClaims();
      const mapped: ClaimItem[] = (data as Record<string, unknown>[]).map((c, idx) => ({
        id: String(c.id || `claim_${idx}`),
        machineId: String(c.machineId || ''),
        machineName: String(c.machineName || 'Rotavator Implement'),
        renterName: String(c.renterName || 'Farmer Renter'),
        estimatedCostRupees: Number(c.estimatedCostRupees || c.amount || 4500),
        status: String(c.status || 'open'),
        description: String(c.description || 'Implement damage reported upon return.'),
        evidencePhotoUrl: String(c.evidencePhotoUrl || ''),
        createdAt: String(c.createdAt || '2026-10-17'),
      }));
      setClaims(mapped);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClaims();
  }, []);

  const handleOpenClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await equipmentOwner.openDamageClaim({
        ...claimForm,
        estimatedCostRupees: Number(claimForm.estimatedCostRupees),
      });
      setModalOpen(false);
      setNotice('Damage claim registered and escrow hold requested from security deposit.');
      await loadClaims();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleConfirmEstimate = async (id: string) => {
    try {
      await equipmentOwner.confirmDamageEstimate(id);
      setNotice('Damage estimate validated with authorized service workshop.');
      await loadClaims();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const handleResolve = async (id: string) => {
    try {
      await equipmentOwner.resolveDamageClaim(id, { settlementAmountRupees: 5000 });
      setNotice('Claim resolved and security deposit settlement finalized.');
      await loadClaims();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-7 h-7 text-rose-600" />
            Equipment Damage Claims & Security Escrow
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            File damage reports with geo-tagged photographic evidence to deduct repairs from renter deposit escrow
          </p>
        </div>

        <button
          onClick={() => setModalOpen(true)}
          className="px-4 py-2.5 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md flex items-center gap-2 self-start sm:self-auto transition-all hover-lift"
        >
          <Plus className="w-4 h-4" />
          <span>Report Damage Claim</span>
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

      {/* Claims List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl shimmer-bg border border-slate-100" />
          ))
        ) : claims.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
            <ShieldAlert className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-bold">No machinery damage claims</p>
            <p className="text-xs text-slate-400">All machinery returned in good operational condition.</p>
          </div>
        ) : (
          claims.map((claim) => (
            <div
              key={claim.id}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs hover-lift flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-slate-900 text-sm">{claim.machineName}</span>
                  <StatusBadge status={claim.status} />
                  <span className="text-[10px] text-slate-400">Claim ID: {claim.id}</span>
                </div>
                <p className="text-xs text-slate-600 font-medium">{claim.description}</p>
                <p className="text-[11px] text-slate-400">
                  Renter: <strong>{claim.renterName}</strong> • Date: {claim.createdAt}
                </p>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-center">
                <div className="text-right mr-2">
                  <span className="text-base font-black text-rose-600">
                    {formatCurrency(claim.estimatedCostRupees || 0)}
                  </span>
                  <p className="text-[10px] text-slate-400">Estimated Repair</p>
                </div>

                {claim.status === 'open' && (
                  <button
                    onClick={() => handleConfirmEstimate(claim.id)}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs"
                  >
                    Confirm Estimate
                  </button>
                )}

                {claim.status !== 'resolved' && (
                  <button
                    onClick={() => handleResolve(claim.id)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                  >
                    Resolve Claim
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* File Damage Modal */}
      <ModalSheet
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Register Machinery Damage Claim"
        description="Submit inspection photos and repair estimate for security deposit deduction"
      >
        <form onSubmit={handleOpenClaim} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-slate-700">Machine & Implement</label>
            <input
              type="text"
              required
              value={claimForm.machineName}
              onChange={(e) => setClaimForm({ ...claimForm, machineName: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700">Renter / Farmer Name</label>
              <input
                type="text"
                required
                value={claimForm.renterName}
                onChange={(e) => setClaimForm({ ...claimForm, renterName: e.target.value })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-700">Estimated Repair Cost (₹)</label>
              <input
                type="number"
                required
                value={claimForm.estimatedCostRupees}
                onChange={(e) => setClaimForm({ ...claimForm, estimatedCostRupees: Number(e.target.value) })}
                className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Damage Description</label>
            <textarea
              rows={3}
              required
              value={claimForm.description}
              onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700">Inspection Photo URL</label>
            <input
              type="url"
              value={claimForm.evidencePhotoUrl}
              onChange={(e) => setClaimForm({ ...claimForm, evidencePhotoUrl: e.target.value })}
              className="w-full mt-1 px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md"
            >
              File Claim
            </button>
          </div>
        </form>
      </ModalSheet>
    </div>
  );
};
