import React, { useEffect, useState } from 'react';
import {
  Layers,
  Building2,
  MapPin,
  Calendar,
  Send,
  Check,
  ShieldCheck,
  Phone,
  Lock,
} from 'lucide-react';
import { demands, apiErrorMessage } from '../../lib/api';
import { applyToDemand, getMyLeads, isMpinError, type Lead } from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { MpinPad } from '../../components/common/MpinPad';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatWeight } from '../../lib/utils';
import type { BuyerDemand } from '../../types';

export const BuyerDemandsView: React.FC = () => {
  const [demandsList, setDemandsList] = useState<BuyerDemand[]>([]);
  const [myApplications, setMyApplications] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Apply modal state
  const [selectedDemand, setSelectedDemand] = useState<BuyerDemand | null>(null);
  const [offerPrice, setOfferPrice] = useState<number>(4760);
  const [offerQuantity, setOfferQuantity] = useState<number>(20);
  const [offerMessage, setOfferMessage] = useState<string>('');
  const [termsAccepted, setTermsAccepted] = useState<boolean>(false);
  const [step, setStep] = useState<'form' | 'mpin'>('form');
  const [sending, setSending] = useState<boolean>(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [applySuccess, setApplySuccess] = useState<boolean>(false);
  const [mpinKey, setMpinKey] = useState<number>(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      demands.browse({ status: 'open' }),
      getMyLeads('sent', undefined, 'demand').catch(() => [] as Lead[]),
    ])
      .then(([d, apps]) => {
        if (!active) return;
        setDemandsList(d);
        setMyApplications(apps);
      })
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const appFor = (demandId: string): Lead | undefined =>
    myApplications.find((l) => l.demandId === demandId && l.status !== 'dismissed');

  const openApply = (demand: BuyerDemand) => {
    const existing = appFor(demand.id);
    setSelectedDemand(demand);
    setOfferPrice(existing?.pricePerUnit ?? Math.max(1, demand.maxPricePerQuintal - 140));
    setOfferQuantity(existing?.quantity ?? Math.min(20, demand.requiredQuantityQuintal));
    setOfferMessage(existing?.message ?? '');
    setTermsAccepted(Boolean(existing));
    setStep(existing ? 'mpin' : 'form');
    setApplyError(null);
    setApplySuccess(Boolean(existing));
    setMpinKey((k) => k + 1);
  };

  const closeApply = () => {
    setSelectedDemand(null);
    setApplyError(null);
    setApplySuccess(false);
    setStep('form');
  };

  const handleMpinSuccess = async (mpin: string) => {
    if (!selectedDemand) return;
    setSending(true);
    setApplyError(null);
    try {
      const { lead } = await applyToDemand(selectedDemand.id, {
        pricePerUnit: offerPrice,
        quantity: offerQuantity,
        message: offerMessage,
        termsAccepted: true,
        mpin,
      });
      setMyApplications((prev) => [
        lead,
        ...prev.filter((l) => !(l.demandId === selectedDemand.id && l.status !== 'dismissed')),
      ]);
      setApplySuccess(true);
      setNotice(
        `Application sent to ${selectedDemand.companyName} — your contact was shared with MPIN verification. The buyer can call or WhatsApp you directly.`,
      );
      setTimeout(() => closeApply(), 1200);
    } catch (err) {
      if (isMpinError(err)) {
        setApplyError('Incorrect MPIN — try again.');
        setMpinKey((k) => k + 1);
      } else {
        setApplyError(apiErrorMessage(err));
      }
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Layers className="w-7 h-7 text-emerald-600" />
          Industry Buyer Demands (Reverse Marketplace)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Browse procurement demands posted by industrial buyers — food processors, exporters, and
          large traders. Apply with your quote; on accepting the terms and verifying your MPIN,
          your contact is shared with the buyer to connect directly.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between gap-4">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline shrink-0">Dismiss</button>
        </div>
      )}

      {/* Demands List */}
      <div className="space-y-4">
        {loading ? (
          <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
            Loading open buyer demands…
          </div>
        ) : demandsList.length === 0 ? (
          <div className="py-10 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No open demands right now. Check back soon — new procurement demands are posted daily.
          </div>
        ) : (
          demandsList.map((demand) => {
            const existing = appFor(demand.id);
            return (
              <div
                key={demand.id}
                className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-6"
              >
                <div className="space-y-2 max-w-2xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="p-2 rounded-xl bg-slate-100 text-slate-700">
                      <Building2 className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="font-extrabold text-base text-slate-900">{demand.companyName}</h4>
                      <p className="text-[11px] text-slate-400">Buyer: {demand.buyerName}</p>
                    </div>
                    <StatusBadge status={demand.status} />
                    {existing && (
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> Applied — contact shared
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-700 font-medium">
                    Crop Needed:{' '}
                    <strong className="text-slate-900">
                      {demand.crop} {demand.variety && `(${demand.variety})`}
                    </strong>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
                    <p>
                      <strong>Quality Specs:</strong> {demand.qualitySpecs}
                    </p>
                    <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" /> Delivery: {demand.deliveryLocation}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Valid Until: {demand.validUntil}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Demand Metrics & Action */}
                <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-end justify-between gap-3 flex-shrink-0">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Volume</span>
                    <span className="text-sm font-bold text-slate-800">{formatWeight(demand.requiredQuantityQuintal)}</span>
                    <div className="mt-1">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Max Budget Price</span>
                      <span className="text-xl font-black text-emerald-700">
                        {formatCurrency(demand.maxPricePerQuintal)}
                      </span>
                      <span className="text-xs text-slate-500"> /q</span>
                    </div>
                  </div>

                  <button
                    onClick={() => openApply(demand)}
                    className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
                  >
                    <span>{existing ? 'View Application' : 'Apply & Share Contact'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Apply modal: quote → terms → MPIN */}
      <ModalSheet
        isOpen={Boolean(selectedDemand)}
        onClose={closeApply}
        title={applySuccess ? 'Application Submitted' : 'Apply to Buyer Demand'}
        description={
          selectedDemand
            ? `Submit your quote to ${selectedDemand.companyName}. Terms acceptance + MPIN verify your identity and share your contact with the buyer.`
            : undefined
        }
        maxWidth="md"
      >
        {applySuccess ? (
          <div className="py-8 flex flex-col items-center gap-3 text-center">
            <span className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center">
              <Check className="w-8 h-8" />
            </span>
            <p className="text-sm font-bold text-slate-900">Application sent — contact shared</p>
            <p className="text-xs text-slate-500 max-w-sm">
              {selectedDemand?.companyName} can now see your contact number and will reach out
              directly. A chat thread has also been opened.
            </p>
          </div>
        ) : step === 'form' ? (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
              <div className="flex justify-between text-slate-600">
                <span>Required Crop:</span>
                <span className="font-bold text-slate-900">{selectedDemand?.crop}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Buyer Max Cap:</span>
                <span className="font-bold text-emerald-800">
                  {selectedDemand && formatCurrency(selectedDemand.maxPricePerQuintal)}/q
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Your Price (₹/q)</label>
                <input
                  type="number"
                  value={offerPrice}
                  onChange={(e) => setOfferPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 text-emerald-800"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Quantity Offered (q)</label>
                <input
                  type="number"
                  value={offerQuantity}
                  onChange={(e) => setOfferQuantity(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Produce Specs / Message</label>
              <textarea
                rows={3}
                value={offerMessage}
                onChange={(e) => setOfferMessage(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-emerald-600"
              />
              <span className="text-[11px] text-slate-600 leading-relaxed">
                I accept the platform <strong>terms & conditions</strong> and consent to sharing my
                contact number with <strong>{selectedDemand?.companyName}</strong> so they can reach
                me directly. The final deal — price, payment, pickup and quality — is settled
                directly between us; Agrovercity only connects the two parties.
              </span>
            </label>

            {applyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                {applyError}
              </div>
            )}

            <button
              type="button"
              disabled={!termsAccepted || offerPrice <= 0 || offerQuantity <= 0}
              onClick={() => {
                setApplyError(null);
                setMpinKey((k) => k + 1);
                setStep('mpin');
              }}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Lock className="w-4 h-4" /> Continue — Verify MPIN
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-600 flex items-center justify-between">
              <span>
                Quote: <strong className="text-slate-900">{offerQuantity} q</strong> @{' '}
                <strong className="text-emerald-800">{formatCurrency(offerPrice)}/q</strong>
              </span>
              <button
                type="button"
                onClick={() => setStep('form')}
                className="font-bold text-emerald-700 hover:underline"
              >
                Edit
              </button>
            </div>
            <MpinPad
              key={mpinKey}
              onSuccess={(mpin) => void handleMpinSuccess(mpin)}
              title="Verify MPIN to Share Contact"
              subtitle={`Confirms your identity and shares your number with ${selectedDemand?.companyName}`}
            />
            {applyError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
                {applyError}
              </div>
            )}
            {sending && (
              <div className="py-2 text-center text-xs font-bold text-slate-500 animate-pulse">
                Verifying & submitting application…
              </div>
            )}
          </div>
        )}
      </ModalSheet>

      {/* How it works strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { icon: Send, text: 'Apply with your price & quantity quote on any open demand' },
          { icon: Lock, text: 'Accept terms and verify your 4-digit MPIN to confirm identity' },
          { icon: Phone, text: 'Your contact is shared — the buyer calls or WhatsApps you directly' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 p-3.5 bg-white rounded-2xl border border-slate-200/80 text-xs font-semibold text-slate-700">
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-700 shrink-0">
              <s.icon className="w-4 h-4" />
            </span>
            {s.text}
          </div>
        ))}
      </div>
    </div>
  );
};
