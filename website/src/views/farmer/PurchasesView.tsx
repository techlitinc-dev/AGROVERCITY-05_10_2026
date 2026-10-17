import React, { useState } from 'react';
import {
  FileCheck,
  QrCode,
  Truck,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Star,
  MapPin,
  Calendar,
  Building2,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { MOCK_PURCHASES } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { GateOtpModal } from '../../components/common/GateOtpModal';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatWeight, formatDate } from '../../lib/utils';
import type { PurchaseOrder } from '../../types';

export const PurchasesView: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseOrder[]>(MOCK_PURCHASES);
  const [selectedOtpPurchase, setSelectedOtpPurchase] = useState<PurchaseOrder | null>(null);
  const [ratingModalPurchase, setRatingModalPurchase] = useState<PurchaseOrder | null>(null);
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [ratedSuccess, setRatedSuccess] = useState<boolean>(false);

  // Status Machine Progression for Testing / Demo
  const advanceStatus = (purchaseId: string) => {
    setPurchases((prev) =>
      prev.map((p) => {
        if (p.id !== purchaseId) return p;
        if (p.status === 'confirmed') return { ...p, status: 'advancePaid', advancePaid: true };
        if (p.status === 'advancePaid') return { ...p, status: 'pickupScheduled', pickupDate: '2026-10-18' };
        if (p.status === 'pickupScheduled') return { ...p, status: 'inTransit' };
        if (p.status === 'inTransit') return { ...p, status: 'delivered' };
        if (p.status === 'delivered') return { ...p, status: 'completed' };
        return p;
      })
    );
  };

  const handleRateBuyer = () => {
    if (!ratingModalPurchase) return;
    setPurchases((prev) =>
      prev.map((p) => (p.id === ratingModalPurchase.id ? { ...p, ratedBuyer: true } : p))
    );
    setRatedSuccess(true);
    setTimeout(() => {
      setRatedSuccess(false);
      setRatingModalPurchase(null);
    }, 800);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <FileCheck className="w-7 h-7 text-emerald-600" />
          My B2B Produce Orders & Purchase Pipeline
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Track lifecycle from confirmed contract to advance escrow, gate handover OTP, QC inspection, and final settlement
        </p>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {purchases.map((po) => (
          <div
            key={po.id}
            className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5"
          >
            {/* Top row: ID, Buyer, and Status */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-2xl bg-emerald-50 text-emerald-700">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-slate-900">{po.crop} Procurement</h3>
                    <span className="font-mono text-xs text-slate-400">#{po.id}</span>
                  </div>
                  <p className="text-xs text-slate-500">Buyer: <strong>{po.buyerName}</strong></p>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end sm:self-auto">
                <StatusBadge status={po.status} />
                {po.invoiceNumber && (
                  <span className="text-[11px] font-mono bg-slate-100 text-slate-700 px-2.5 py-1 rounded-xl font-bold">
                    {po.invoiceNumber}
                  </span>
                )}
              </div>
            </div>

            {/* Lifecycle Stepper */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 overflow-x-auto pb-1 gap-2">
                {[
                  { key: 'confirmed', label: '1. Confirmed' },
                  { key: 'advancePaid', label: '2. Advance Paid' },
                  { key: 'pickupScheduled', label: '3. Pickup Scheduled' },
                  { key: 'inTransit', label: '4. In Transit' },
                  { key: 'delivered', label: '5. Delivered' },
                  { key: 'completed', label: '6. Completed' },
                ].map((step, idx) => {
                  const isCurrent = po.status === step.key;
                  return (
                    <div
                      key={step.key}
                      className={`flex items-center gap-1.5 whitespace-nowrap px-2.5 py-1 rounded-xl ${
                        isCurrent
                          ? 'bg-emerald-600 text-white font-black shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      <span>{step.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Metric Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Quantity</span>
                <p className="font-bold text-slate-900 mt-0.5">{formatWeight(po.quantityQuintal)}</p>
              </div>

              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Agreed Rate</span>
                <p className="font-bold text-slate-900 mt-0.5">{formatCurrency(po.agreedPricePerQuintal)} /q</p>
              </div>

              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Total Value</span>
                <p className="font-black text-emerald-700 mt-0.5">{formatCurrency(po.totalAmount)}</p>
              </div>

              <div className="p-3 bg-slate-50/70 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Advance Escrow</span>
                <p className="font-bold text-slate-900 mt-0.5 flex items-center gap-1">
                  {formatCurrency(po.advanceAmount)}
                  {po.advancePaid && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />}
                </p>
              </div>
            </div>

            {/* Action Buttons: Handover OTP, Advance Lifecycle, Rate Buyer */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex gap-2">
                {po.handoverOtp && (
                  <button
                    onClick={() => setSelectedOtpPurchase(po)}
                    className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Show Gate Handover OTP ({po.handoverOtp})</span>
                  </button>
                )}

                <button
                  onClick={() => advanceStatus(po.id)}
                  className="px-3.5 py-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs"
                >
                  Simulate Next Step →
                </button>
              </div>

              {po.status === 'completed' && !po.ratedBuyer && (
                <button
                  onClick={() => setRatingModalPurchase(po)}
                  className="px-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs"
                >
                  <Star className="w-4 h-4" />
                  <span>Rate Buyer</span>
                </button>
              )}

              {po.status === 'completed' && po.ratedBuyer && (
                <span className="text-xs font-bold text-amber-600 flex items-center gap-1">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" /> Buyer Rated
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Handover OTP Modal */}
      {selectedOtpPurchase && (
        <GateOtpModal
          isOpen={Boolean(selectedOtpPurchase)}
          onClose={() => setSelectedOtpPurchase(null)}
          orderId={selectedOtpPurchase.id}
          cropName={selectedOtpPurchase.crop}
          quantityQuintal={selectedOtpPurchase.quantityQuintal}
          otpCode={selectedOtpPurchase.handoverOtp || '8492'}
        />
      )}

      {/* Rate Buyer Modal */}
      <ModalSheet
        isOpen={Boolean(ratingModalPurchase)}
        onClose={() => setRatingModalPurchase(null)}
        title="Rate Buyer Partner"
        description="Provide feedback on payment timeliness, QC fairness, and communication"
        maxWidth="sm"
      >
        <div className="space-y-4 text-center">
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRatingScore(star)}
                className="p-1 hover:scale-110 transition-transform"
              >
                <Star
                  className={`w-8 h-8 ${
                    star <= ratingScore
                      ? 'fill-amber-400 text-amber-400'
                      : 'text-slate-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <p className="text-xs font-bold text-slate-700">
            {ratingScore === 5 ? 'Excellent Partner (5/5)' : `${ratingScore} Stars`}
          </p>

          <button
            onClick={handleRateBuyer}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5"
          >
            {ratedSuccess ? <Check className="w-4 h-4" /> : 'Submit Rating'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
