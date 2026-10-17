import React, { useState } from 'react';
import {
  FileText,
  ShieldCheck,
  Check,
  X,
  Calendar,
  Building2,
  Clock,
  ArrowRight,
  FileCheck2,
} from 'lucide-react';
import { MOCK_SUPPLY_CONTRACTS } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { MpinPad } from '../../components/common/MpinPad';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { SupplyContract } from '../../types';

export const BuyerContractsView: React.FC = () => {
  const [contracts, setContracts] = useState<SupplyContract[]>(MOCK_SUPPLY_CONTRACTS);
  const [signingContract, setSigningContract] = useState<SupplyContract | null>(null);
  const [signedSuccess, setSignedSuccess] = useState(false);

  const handleMpinSignSuccess = (mpin: string) => {
    if (!signingContract) return;
    setContracts((prev) =>
      prev.map((c) =>
        c.id === signingContract.id
          ? {
              ...c,
              status: 'active',
              signedByFarmer: true,
              signedAt: new Date().toISOString(),
            }
          : c
      )
    );
    setSignedSuccess(true);
    setTimeout(() => {
      setSignedSuccess(false);
      setSigningContract(null);
    }, 900);
  };

  const handleDecline = (id: string) => {
    setContracts((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: 'declined' } : c))
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <FileText className="w-7 h-7 text-emerald-600" />
          Buyer Supply Contracts (E-Hastakshar)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Lock assured prices and guaranteed procurement with institutional buyers via MPIN-gated digital contract signing
        </p>
      </div>

      {/* Contracts List */}
      <div className="space-y-4">
        {contracts.map((contract) => (
          <div
            key={contract.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-amber-50 text-amber-700">
                  <FileCheck2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-slate-900">
                    {contract.crop} Supply Contract
                  </h4>
                  <p className="text-xs text-slate-500">
                    Buyer Partner: <strong>{contract.buyerName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                <StatusBadge status={contract.status} />
                <span className="text-xs font-mono text-slate-400">#{contract.id}</span>
              </div>
            </div>

            {/* Terms Matrix */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Commitment</span>
                <p className="font-extrabold text-slate-900 mt-0.5">
                  {formatWeight(contract.totalQuantityQuintal)}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Pricing Model</span>
                <p className="font-extrabold text-emerald-700 mt-0.5 capitalize">
                  {contract.pricingType} ({formatCurrency(contract.baseRatePerQuintal)}/q)
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Delivery Cadence</span>
                <p className="font-extrabold text-slate-900 mt-0.5 capitalize">{contract.frequency}</p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Payment Window</span>
                <p className="font-extrabold text-slate-900 mt-0.5">{contract.paymentTermsDays} Days Post QC</p>
              </div>
            </div>

            {/* Signature & Action Controls */}
            <div className="pt-2 flex items-center justify-between">
              {contract.signedByFarmer ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-50 px-3.5 py-2 rounded-2xl border border-emerald-200">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>MPIN E-Signed & Legally Enforceable</span>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDecline(contract.id)}
                    className="px-4 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-xs"
                  >
                    Decline
                  </button>
                  <button
                    onClick={() => setSigningContract(contract)}
                    className="px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>E-Sign Contract (MPIN)</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* MPIN E-Signing Modal */}
      <ModalSheet
        isOpen={Boolean(signingContract)}
        onClose={() => setSigningContract(null)}
        title="MPIN E-Sign Contract Authorization"
        description="Enter your 4-digit MPIN to execute digital signature and lock supply terms"
        maxWidth="sm"
      >
        <div className="space-y-4">
          {signedSuccess ? (
            <div className="p-6 text-center space-y-2">
              <Check className="w-12 h-12 text-emerald-600 mx-auto animate-bounce" />
              <h4 className="font-bold text-base text-slate-900">Contract Signed Successfully!</h4>
              <p className="text-xs text-slate-500">
                Contract is now active. Purchase orders will auto-trigger on every delivery slot.
              </p>
            </div>
          ) : (
            <MpinPad
              onSuccess={handleMpinSignSuccess}
              title="Enter 4-Digit MPIN to Sign"
              subtitle="Secured by Agrovercity Legal Protocol"
            />
          )}
        </div>
      </ModalSheet>
    </div>
  );
};
