import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageSquare, BadgeCheck, Building2, ShieldAlert, Loader2 } from 'lucide-react';
import { ModalSheet } from '../../components/common/ModalSheet';
import { MpinPad } from '../../components/common/MpinPad';
import { UserVerificationBadge } from '../../components/common/UserVerificationBadge';
import type { ExportApplication, ExportApplicationContact } from '../../types';
import { apiErrorMessage } from '../../lib/api';
import { isKycError, isMpinError } from '../../lib/api/leads';
import { exporter } from '../../lib/api/exporter';

/** Direct-connect + contact-sharing terms (spec §10) — identical everywhere. */
export const EXPORT_DIRECT_CONNECT_TERMS =
  'Agrovercity only connects farmers and exporters. Sampling, quality inspection, residue testing, certifications, aggregation, final price, currency, payment, packaging, domestic transport, export contracts, customs, freight, insurance, produce acceptance, and disputes are handled directly between the parties and their service providers. Agrovercity does not hold payments and does not guarantee quality, compliance, payment, export clearance, shipment, or delivery. After confirmation, my contact details will be shared with the other party and their contact details will be shared with me.';

export const EXPORT_STATUS_LABEL: Record<string, string> = {
  submitted: 'Submitted',
  pending: 'Submitted', // legacy seller quotes display as submitted
  contacted: 'Contacted',
  dealDone: 'Deal Completed',
  dismissed: 'Dismissed',
  withdrawn: 'Withdrawn',
  rejected: 'Rejected',
  accepted: 'Accepted (legacy)', // legacy accept ≠ deal completed
  open: 'Open',
  draft: 'Draft',
  paused: 'Paused',
  closed: 'Closed',
  fulfilled: 'Fulfilled',
};

export const EXPORT_STATUS_CLS: Record<string, string> = {
  submitted: 'text-sky-700 bg-sky-50 border-sky-200',
  pending: 'text-sky-700 bg-sky-50 border-sky-200',
  contacted: 'text-amber-700 bg-amber-50 border-amber-200',
  dealDone: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  dismissed: 'text-slate-500 bg-slate-100 border-slate-200',
  withdrawn: 'text-slate-500 bg-slate-100 border-slate-200',
  rejected: 'text-rose-700 bg-rose-50 border-rose-200',
  accepted: 'text-violet-700 bg-violet-50 border-violet-200',
  open: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  draft: 'text-slate-500 bg-slate-100 border-slate-200',
  paused: 'text-amber-700 bg-amber-50 border-amber-200',
  closed: 'text-slate-500 bg-slate-100 border-slate-200',
  fulfilled: 'text-emerald-700 bg-emerald-50 border-emerald-200',
};

export const ExportStatusBadge: React.FC<{ status?: string }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold border ${
      EXPORT_STATUS_CLS[status || ''] || 'text-slate-600 bg-slate-50 border-slate-200'
    }`}
  >
    {EXPORT_STATUS_LABEL[status || ''] || status || '—'}
  </span>
);

/**
 * Distinct verification badges (spec §13): identity (unified KYC) and, for
 * exporters, business (IEC/APEDA/GST actually reviewed). Never inferred from
 * each other, never inferred from uploads.
 */
export const VerificationBadges: React.FC<{
  identityVerified?: boolean;
  businessVerified?: boolean;
  compact?: boolean;
}> = ({ identityVerified, businessVerified, compact }) => (
  <span className="inline-flex items-center gap-1.5 flex-wrap">
    <UserVerificationBadge verified={!!identityVerified} size="sm" />
    {businessVerified !== undefined && (
      <span
        className={`inline-flex items-center gap-0.5 rounded-full font-bold border ${
          businessVerified
            ? 'text-violet-700 bg-violet-50 border-violet-200'
            : 'text-slate-400 bg-slate-50 border-slate-200'
        } ${compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'}`}
        title="Export Business Verified — exporter business documents (IEC/APEDA/GST) were reviewed"
      >
        <Building2 className={compact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        {businessVerified ? 'Export Business Verified' : 'Business Not Verified'}
      </span>
    )}
  </span>
);

export const contactTel = (c: ExportApplicationContact | null | undefined): string | null =>
  c?.phoneDigits ? `tel:+${c.phoneDigits}` : null;
export const contactWa = (c: ExportApplicationContact | null | undefined): string | null =>
  c?.whatsappDigits ? `https://wa.me/${c.whatsappDigits}` : null;

/** Call / WhatsApp / Chat actions shown only after contact unlock. */
export const ContactActions: React.FC<{
  contact: ExportApplicationContact | null | undefined;
  chatRoomId?: string;
  vertical?: boolean;
}> = ({ contact, chatRoomId, vertical }) => {
  const navigate = useNavigate();
  if (!contact) return null;
  const tel = contactTel(contact);
  const wa = contactWa(contact);
  const wrap = vertical ? 'flex flex-col gap-2 w-full' : 'flex flex-wrap gap-2';
  return (
    <div className={wrap}>
      <a
        href={tel ?? undefined}
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-sky-600 text-white text-xs font-bold px-3 py-2 hover:bg-sky-700 transition ${
          vertical ? 'w-full' : ''
        } ${!tel ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <Phone className="w-3.5 h-3.5" /> Call {contact.name}
      </a>
      <a
        href={wa ?? undefined}
        target="_blank"
        rel="noreferrer"
        className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold px-3 py-2 hover:bg-emerald-700 transition ${
          vertical ? 'w-full' : ''
        } ${!wa ? 'opacity-40 pointer-events-none' : ''}`}
      >
        <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
      </a>
      {chatRoomId && (
        <button
          type="button"
          onClick={() => navigate(`/chat?room=${encodeURIComponent(chatRoomId!)}`)}
          className={`inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 text-white text-xs font-bold px-3 py-2 hover:bg-slate-900 transition ${
            vertical ? 'w-full' : ''
          }`}
        >
          <BadgeCheck className="w-3.5 h-3.5" /> Chat
        </button>
      )}
    </div>
  );
};

/** Lightweight informational guidance after contact unlock (spec §14). */
export const NegotiationChecklist: React.FC<{ items?: string[] }> = ({ items }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5">
      <p className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wide mb-2">
        Direct negotiation checklist — between you and your counterparty
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item} className="text-xs text-slate-600 flex items-start gap-1.5">
            <span className="text-emerald-600 mt-0.5">•</span>
            {item}
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-slate-400 mt-2">
        Informational guidance only — each step happens directly between the parties and their
        chosen service providers.
      </p>
    </div>
  );
};

export type OutcomeChoice = 'stillInContact' | 'dealDoneOffline' | 'didNotHappen' | 'withdrawn';

export const OUTCOME_OPTIONS: { value: OutcomeChoice; label: string }[] = [
  { value: 'stillInContact', label: 'Still in contact' },
  { value: 'dealDoneOffline', label: 'Supply deal completed offline' },
  { value: 'didNotHappen', label: 'Did not happen' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

/** User-reported outcome (never platform-verified payment/shipment evidence). */
export const OutcomeModal: React.FC<{
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    outcome: OutcomeChoice;
    finalQuantity?: number;
    finalQuantityUnit?: string;
    finalPrice?: number;
    finalPriceUnit?: string;
    finalCurrency?: string;
    supplyDate?: string;
    collectionLocation?: string;
  }) => Promise<void>;
}> = ({ open, onClose, onSubmit }) => {
  const [choice, setChoice] = useState<OutcomeChoice>('stillInContact');
  const [finalQuantity, setFinalQuantity] = useState('');
  const [finalQuantityUnit, setFinalQuantityUnit] = useState('quintal');
  const [finalPrice, setFinalPrice] = useState('');
  const [finalPriceUnit, setFinalPriceUnit] = useState('quintal');
  const [finalCurrency, setFinalCurrency] = useState('INR');
  const [supplyDate, setSupplyDate] = useState('');
  const [collectionLocation, setCollectionLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSubmit({
        outcome: choice,
        finalQuantity: finalQuantity ? Number(finalQuantity) : undefined,
        finalQuantityUnit: finalQuantity ? finalQuantityUnit : undefined,
        finalPrice: finalPrice ? Number(finalPrice) : undefined,
        finalPriceUnit: finalPrice ? finalPriceUnit : undefined,
        finalCurrency: finalPrice ? finalCurrency : undefined,
        supplyDate: supplyDate || undefined,
        collectionLocation: collectionLocation || undefined,
      });
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet isOpen={open} onClose={onClose} title="Update Outcome" maxWidth="lg">
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          This outcome is a private record between the two parties. Agrovercity does not verify
          payment, quality, shipment, or delivery, and no payment or shipping step is created.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {OUTCOME_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setChoice(opt.value)}
              className={`text-left text-xs font-bold rounded-xl border px-3 py-2.5 transition ${
                choice === opt.value
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {choice === 'dealDoneOffline' && (
          <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-[11px] font-extrabold text-slate-600 uppercase">
              Optional deal details (not platform-verified)
            </p>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min="0"
                placeholder="Final quantity"
                value={finalQuantity}
                onChange={(e) => setFinalQuantity(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
              <input
                type="text"
                placeholder="Unit (quintal / MT)"
                value={finalQuantityUnit}
                onChange={(e) => setFinalQuantityUnit(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
              <input
                type="number"
                min="0"
                placeholder="Final price"
                value={finalPrice}
                onChange={(e) => setFinalPrice(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
              <input
                type="text"
                placeholder="Price unit"
                value={finalPriceUnit}
                onChange={(e) => setFinalPriceUnit(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
              <input
                type="text"
                placeholder="Currency (INR)"
                value={finalCurrency}
                onChange={(e) => setFinalCurrency(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
              <input
                type="date"
                value={supplyDate}
                onChange={(e) => setSupplyDate(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
              />
            </div>
            <input
              type="text"
              placeholder="Collection location"
              value={collectionLocation}
              onChange={(e) => setCollectionLocation(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
            />
          </div>
        )}
        {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="w-full rounded-xl bg-emerald-600 text-white text-sm font-bold py-2.5 hover:bg-emerald-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save Outcome
        </button>
      </div>
    </ModalSheet>
  );
};

const ISSUE_CATEGORIES: { value: string; label: string }[] = [
  { value: 'false_rfq', label: 'Suspected false RFQ' },
  { value: 'misrepresented_quantity_quality', label: 'Misrepresented quantity / quality' },
  { value: 'certificate_document_concern', label: 'Certificate / document concern' },
  { value: 'payment_contract_dispute', label: 'Payment / contract dispute (user-reported)' },
  { value: 'conduct', label: 'Farmer / exporter conduct' },
  { value: 'other', label: 'Other' },
];

/** Issue reporting — records the report only (spec §16). */
export const ReportIssueModal: React.FC<{
  application: ExportApplication | null;
  onClose: () => void;
  onReported: () => void;
}> = ({ application, onClose, onReported }) => {
  const [category, setCategory] = useState('conduct');
  const [summary, setSummary] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!application) return;
    setBusy(true);
    setError(null);
    try {
      await exporter.reportIssue(application.id, { category, summary });
      setDone(true);
      onReported();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet isOpen={!!application} onClose={onClose} title="Report an Issue" maxWidth="lg">
      {done ? (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800">
          Report recorded. Agrovercity reviews reports to keep the marketplace safe. Reports do not
          freeze payments, trigger refunds, or decide legal responsibility — payment and contract
          matters stay between the parties.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-start gap-2 text-[11px] text-slate-500">
            <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-500 shrink-0" />
            Issue reports never freeze escrow, trigger refunds, or determine legal liability, and they
            never imply platform payment or export protection.
          </div>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          >
            {ISSUE_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <textarea
            rows={4}
            minLength={10}
            placeholder="Describe what happened (minimum 10 characters)"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-2"
          />
          {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={busy || summary.trim().length < 10}
            className="w-full rounded-xl bg-rose-600 text-white text-sm font-bold py-2.5 hover:bg-rose-700 transition disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Submit Report
          </button>
        </div>
      )}
    </ModalSheet>
  );
};

/**
 * Exporter contact unlock — terms acknowledgement → MPIN (spec §9/§10).
 * KYC for both parties is enforced server-side and cannot be bypassed.
 * Unlocking is idempotent and never accepts the quote or creates an order.
 */
export const ContactUnlockModal: React.FC<{
  application: ExportApplication | null;
  onClose: () => void;
  onUnlocked: (updated: ExportApplication) => void;
}> = ({ application, onClose, onUnlocked }) => {
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [step, setStep] = useState<'terms' | 'mpin'>('terms');
  const [error, setError] = useState<string | null>(null);
  const [mpinKey, setMpinKey] = useState(0);
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTermsAccepted(false);
    setStep('terms');
    setError(null);
  };

  const submit = async (mpin?: string) => {
    if (!application) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await exporter.unlockContact(application.id, { termsAccepted: true, mpin });
      onUnlocked(updated);
      reset();
    } catch (err) {
      if (isMpinError(err)) {
        setError('Incorrect MPIN — try again.');
        setMpinKey((k) => k + 1);
      } else if (isKycError(err)) {
        setError('Complete your identity verification (KYC) before contacting farmers.');
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet
      isOpen={!!application}
      onClose={() => {
        reset();
        onClose();
      }}
      title={`Contact ${application?.farmer?.name || 'farmer'}${application?.rfq?.crop ? ` — ${application.rfq.crop}` : ''}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-500">
          Contact unlock shares phone and WhatsApp on both sides and opens one chat room. It does
          <strong> not</strong> accept the application, create an order, or fix any price — sampling,
          quality, payment, and the export contract happen directly between the parties.
        </p>
        {step === 'terms' ? (
          <>
            <label className="flex items-start gap-2 text-[11px] text-slate-500 leading-relaxed">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-0.5"
              />
              <span>{EXPORT_DIRECT_CONNECT_TERMS}</span>
            </label>
            {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
            <button
              type="button"
              disabled={!termsAccepted || busy}
              onClick={() => setStep('mpin')}
              className="w-full rounded-xl bg-emerald-600 text-white text-sm font-bold py-2.5 hover:bg-emerald-700 transition disabled:opacity-50"
            >
              Continue to MPIN
            </button>
          </>
        ) : (
          <>
            {error && <p className="text-xs font-semibold text-rose-700">{error}</p>}
            <MpinPad
              key={mpinKey}
              onSuccess={(mpin) => submit(mpin)}
              title="Verify MPIN to unlock contact"
              subtitle="Confirms it is really you sharing contact details"
            />
            <button
              type="button"
              onClick={() => setStep('terms')}
              className="w-full text-center text-[11px] font-bold text-slate-400 hover:text-slate-600"
            >
              Back to terms
            </button>
          </>
        )}
      </div>
    </ModalSheet>
  );
};
