import React, { useState } from 'react';
import { Phone, MessageSquare, Star, Flag, ShieldAlert, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ModalSheet } from '../../components/common/ModalSheet';
import { MpinPad } from '../../components/common/MpinPad';
import { apiErrorMessage } from '../../lib/api';
import { rateLeadConnection, recordLeadOutcome, unlockLead, type Lead, type LeadContact, type LeadOutcome } from '../../lib/api/leads';
import { DIRECT_CONNECT_TERMS, ISSUE_CATEGORIES, LEAD_STATUS_LABEL } from './directConnect';

export const contactTel = (c: LeadContact | null): string | null =>
  c?.phoneDigits ? `tel:+${c.phoneDigits}` : null;
export const contactWa = (c: LeadContact | null): string | null =>
  c?.whatsappDigits ? `https://wa.me/${c.whatsappDigits}` : null;

/** Call / WhatsApp / Chat actions for an unlocked connection (spec §9). */
export const ContactActions: React.FC<{ contact: LeadContact | null; chatRoomId?: string; compact?: boolean }> = ({
  contact,
  chatRoomId,
  compact,
}) => {
  const tel = contactTel(contact);
  const wa = contactWa(contact);
  const cls = compact
    ? 'p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600'
    : 'px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-1.5';
  if (!contact) return null;
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      {tel && (
        <a href={tel} className={cls} title={`Call ${contact.phone}`}>
          <Phone className="w-3.5 h-3.5" /> {!compact && (contact.phone || 'Call')}
        </a>
      )}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className={
            compact
              ? 'p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5'
          }
          title="WhatsApp"
        >
          <MessageSquare className="w-3.5 h-3.5" /> {!compact && 'WhatsApp'}
        </a>
      )}
      {chatRoomId && (
        <Link to={`/chat?room=${encodeURIComponent(chatRoomId)}`} className={cls} title="Chat">
          <MessageSquare className="w-3.5 h-3.5" /> {!compact && 'Chat'}
        </Link>
      )}
    </span>
  );
};

interface OutcomeModalProps {
  lead: Lead | null;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
}

/** User-reported outcome (spec §11) — never a payment/contract/delivery record. */
export const OutcomeModal: React.FC<OutcomeModalProps> = ({ lead, onClose, onSaved }) => {
  const [choice, setChoice] = useState<LeadOutcome>('still_in_contact');
  const [finalQuantity, setFinalQuantity] = useState<number | ''>('');
  const [finalPrice, setFinalPrice] = useState<number | ''>('');
  const [supplyStartDate, setSupplyStartDate] = useState('');
  const [arrangementType, setArrangementType] = useState<'oneTime' | 'recurring'>('oneTime');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (lead) {
      setChoice(
        lead.status === 'dealDone'
          ? 'deal_done_offline'
          : lead.status === 'dismissed'
            ? 'did_not_happen'
            : lead.status === 'withdrawn'
              ? 'withdrawn'
              : 'still_in_contact'
      );
      setFinalQuantity(lead.dealDetails?.finalQuantity ?? '');
      setFinalPrice(lead.dealDetails?.finalPrice ?? '');
      setSupplyStartDate(lead.dealDetails?.supplyStartDate ?? '');
      setArrangementType(lead.dealDetails?.arrangementType ?? 'oneTime');
      setError(null);
    }
  }, [lead]);

  const save = async () => {
    if (!lead) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await recordLeadOutcome(lead.id, choice, {
        finalQuantity: choice === 'deal_done_offline' && finalQuantity !== '' ? Number(finalQuantity) : undefined,
        finalUnit: lead.unit || 'quintal',
        finalPrice: choice === 'deal_done_offline' && finalPrice !== '' ? Number(finalPrice) : undefined,
        finalPriceUnit: lead.unit || 'quintal',
        supplyStartDate: choice === 'deal_done_offline' ? supplyStartDate : undefined,
        arrangementType: choice === 'deal_done_offline' ? arrangementType : undefined,
      });
      onSaved(updated);
      onClose();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const OPTIONS: { value: LeadOutcome; label: string; hint: string }[] = [
    { value: 'still_in_contact', label: 'Still in contact', hint: 'We are still talking' },
    { value: 'deal_done_offline', label: 'Supply arrangement completed offline', hint: 'We agreed supply directly' },
    { value: 'did_not_happen', label: 'Did not happen', hint: 'The deal did not work out' },
    { value: 'withdrawn', label: 'Withdrawn', hint: 'I am stepping away' },
  ];

  return (
    <ModalSheet
      isOpen={Boolean(lead)}
      onClose={onClose}
      title="Update Outcome"
      description="Your own report of what happened — Agrovercity does not verify or process any payment, delivery or contract for it."
      maxWidth="sm"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-2">
          {OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer text-xs font-bold transition-all ${
                choice === opt.value
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <input
                type="radio"
                name="outcome"
                checked={choice === opt.value}
                onChange={() => setChoice(opt.value)}
                className="accent-emerald-600 mt-0.5"
              />
              <span>
                {opt.label}
                <span className="block text-[10px] font-semibold text-slate-400">{opt.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {choice === 'deal_done_offline' && (
          <div className="p-3 bg-slate-50 rounded-2xl space-y-3">
            <p className="text-[10px] text-slate-500">
              Optional details — a personal record only. Not platform-verified payment, quality, contract or delivery
              evidence.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Final quantity</label>
                <input
                  type="number"
                  min={0}
                  value={finalQuantity}
                  onChange={(e) => setFinalQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Final price (₹)</label>
                <input
                  type="number"
                  min={0}
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Supply start</label>
                <input
                  type="date"
                  value={supplyStartDate}
                  onChange={(e) => setSupplyStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300"
                />
              </div>
              <div>
                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Arrangement</label>
                <select
                  value={arrangementType}
                  onChange={(e) => setArrangementType(e.target.value as 'oneTime' | 'recurring')}
                  className="w-full px-3 py-2 text-sm font-bold rounded-xl border border-slate-300 bg-white"
                >
                  <option value="oneTime">One-time</option>
                  <option value="recurring">Recurring</option>
                </select>
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
            {error}
          </div>
        )}
        <button
          onClick={() => void save()}
          disabled={busy}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
        >
          Save Outcome
        </button>
      </div>
    </ModalSheet>
  );
};

interface RateModalProps {
  lead: Lead | null;
  onClose: () => void;
}

/** Rate the other party on an unlocked lead connection (spec §16). */
export const RateConnectionModal: React.FC<RateModalProps> = ({ lead, onClose }) => {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!lead) return;
    setBusy(true);
    setError(null);
    try {
      await rateLeadConnection(lead.id, stars, comment);
      setDone(true);
      setTimeout(onClose, 1200);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet isOpen={Boolean(lead)} onClose={onClose} title="Rate this connection" maxWidth="sm">
      {done ? (
        <div className="py-8 text-center text-sm font-bold text-emerald-700">Thanks — your rating was recorded.</div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setStars(n)}
                className={`p-2 rounded-xl transition-all ${n <= stars ? 'text-amber-500' : 'text-slate-300'}`}
              >
                <Star className={`w-7 h-7 ${n <= stars ? 'fill-amber-400' : ''}`} />
              </button>
            ))}
          </div>
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Short, honest review (optional)"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
          />
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}
          <button
            onClick={() => void save()}
            disabled={busy}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            Submit Rating
          </button>
        </div>
      )}
    </ModalSheet>
  );
};

interface IssueModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
}

/** Issue reporting (spec §16) — informational only; never freezes payments or
 * decides legal liability. */
export const ReportIssueModal: React.FC<IssueModalProps> = ({ open, onClose, title = 'Report an issue' }) => {
  const [category, setCategory] = useState(ISSUE_CATEGORIES[0]);
  const [details, setDetails] = useState('');
  const [done, setDone] = useState(false);
  return (
    <ModalSheet isOpen={open} onClose={onClose} title={title} maxWidth="sm">
      {done ? (
        <div className="py-6 space-y-2 text-center">
          <ShieldAlert className="w-8 h-8 text-emerald-600 mx-auto" />
          <p className="text-sm font-bold text-slate-900">Report received</p>
          <p className="text-xs text-slate-500">
            Our team will review it. Agrovercity does not hold payments, and this report does not freeze, refund or
            settle any transaction between the parties.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 bg-white"
            >
              {ISSUE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">What happened?</label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={() => setDone(true)}
            disabled={!details.trim()}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Flag className="w-3.5 h-3.5" /> Submit Report
          </button>
        </div>
      )}
    </ModalSheet>
  );
};

/** Buyer-side "Contact Farmer" unlock — terms + MPIN (spec §9). Idempotent;
 * accepting contact never accepts the quote or creates orders/contracts. */
export const UnlockConnectionModal: React.FC<{
  lead: Lead | null;
  onClose: () => void;
  onUnlocked: (lead: Lead) => void;
}> = ({ lead, onClose, onUnlocked }) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step, setStep] = useState<'terms' | 'mpin'>('terms');
  const [mpinKey, setMpinKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (lead) {
      setTermsAccepted(false);
      setStep('terms');
      setError(null);
      setMpinKey((k) => k + 1);
    }
  }, [lead]);

  const submit = async (mpin: string) => {
    if (!lead) return;
    setError(null);
    try {
      const updated = await unlockLead(lead.id, true, mpin);
      onUnlocked(updated);
      onClose();
    } catch (e) {
      const msg = apiErrorMessage(e);
      setError(msg);
      setMpinKey((k) => k + 1);
    }
  };

  return (
    <ModalSheet
      isOpen={Boolean(lead)}
      onClose={onClose}
      title="Contact Farmer"
      description={
        lead
          ? `Unlock contact details for ${lead.farmerContact?.fullName || 'this farmer'} (${lead.demandCrop || lead.lotCrop}).`
          : undefined
      }
      maxWidth="sm"
    >
      {!lead ? null : step === 'terms' ? (
        <div className="space-y-4">
          <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
            <p className="flex justify-between">
              <span className="text-slate-500">Offered:</span>
              <span className="font-bold text-slate-900">
                {lead.quantity} {lead.unit || 'q'} @ {lead.pricePerUnit ? `₹${lead.pricePerUnit}/${lead.unit || 'q'}` : '—'}
              </span>
            </p>
            <p className="flex justify-between">
              <span className="text-slate-500">Supply basis:</span>
              <span className="font-bold text-slate-900">{lead.supplyBasis || 'farmGate'}</span>
            </p>
          </div>
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-600"
            />
            <span className="text-[11px] text-slate-600 leading-relaxed">{DIRECT_CONNECT_TERMS}</span>
          </label>
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}
          <button
            disabled={!termsAccepted}
            onClick={() => {
              setError(null);
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
          <MpinPad
            key={mpinKey}
            onSuccess={(mpin) => void submit(mpin)}
            title="Verify MPIN to Unlock Contact"
            subtitle="Confirms your identity and shares contact details both ways"
          />
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">
              {error}
            </div>
          )}
          <button onClick={() => setStep('terms')} className="w-full text-xs font-bold text-emerald-700 hover:underline">
            Back to terms
          </button>
        </div>
      )}
    </ModalSheet>
  );
};

export const statusLabel = (status: string): string => LEAD_STATUS_LABEL[status] ?? status;
