import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageSquare, Flag, ShieldAlert } from 'lucide-react';
import { land, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';

/** Direct-connect terms (spec §11) — identical wording in both journeys. */
export const LAND_DIRECT_CONNECT_TERMS =
  'Agrovercity only connects farmers and farm landlords. Land ownership and document checks, physical inspection, final rent, deposits, payment, lease terms, possession, land condition, legal documentation, and disputes are handled directly between the parties. Agrovercity does not hold payments and does not guarantee ownership, title, land quality, lease validity, payment, or possession. After confirmation, my contact details will be shared with the other party and their contact details will be shared with me.';

export interface LandContact {
  name?: string;
  fullName?: string;
  village?: string;
  district?: string;
  phone?: string;
  phoneDigits?: string | null;
  whatsappDigits?: string | null;
  verified?: boolean;
}

export const contactTel = (c: LandContact | null | undefined): string | null =>
  c?.phoneDigits ? `tel:+${c.phoneDigits}` : null;
export const contactWa = (c: LandContact | null | undefined): string | null =>
  c?.whatsappDigits ? `https://wa.me/${c.whatsappDigits}` : null;

/** Call / WhatsApp / Chat actions after contact unlock. */
export const LandContactActions: React.FC<{ contact: LandContact | null | undefined; chatRoomId?: string }> = ({
  contact,
  chatRoomId,
}) => {
  const navigate = useNavigate();
  const tel = contactTel(contact);
  const wa = contactWa(contact);
  return (
    <div className="flex items-center gap-2">
      {tel && (
        <a href={tel} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600" title="Call">
          <Phone className="w-4 h-4" />
        </a>
      )}
      {wa && (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
          title="WhatsApp"
        >
          <MessageSquare className="w-4 h-4" />
        </a>
      )}
      {chatRoomId && (
        <button
          onClick={() => navigate(`/chat?room=${encodeURIComponent(chatRoomId)}`)}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
          title="Chat"
        >
          <MessageSquare className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

/** Lightweight post-unlock guidance (spec §14) — guidance only; the platform
 * does NOT perform or guarantee any of these checks. */
export const INSPECTION_CHECKLIST = [
  'Visit and inspect the land',
  'Verify ownership and land records independently',
  'Confirm actual boundaries and area',
  'Check soil, water, and existing third-party rights',
  'Agree on rent, deposit, duration, and payment schedule',
  'Document permitted crops and responsibilities',
  'Complete legal/stamp/registration steps where applicable',
];

export const NegotiationChecklist: React.FC = () => (
  <div className="p-3 bg-sky-50 rounded-2xl border border-sky-200 space-y-1.5">
    <p className="text-[10px] font-black uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
      <ShieldAlert className="w-3.5 h-3.5" /> Before you agree — do these yourselves
    </p>
    <ul className="text-[11px] text-sky-900 space-y-0.5 list-disc pl-4">
      {INSPECTION_CHECKLIST.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  </div>
);

const ISSUE_CATEGORIES = [
  { id: 'falseListing', label: 'Suspected false listing' },
  { id: 'ownershipConcern', label: 'Ownership / document concern' },
  { id: 'conduct', label: 'Landlord / farmer conduct' },
  { id: 'paymentDispute', label: 'Payment dispute (user-reported)' },
  { id: 'landCondition', label: 'Land-condition concern' },
  { id: 'other', label: 'Other' },
] as const;

/** Issue reporting — never freezes escrow, refunds, or decides liability. */
export const LandReportModal: React.FC<{
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  requestId?: string;
  onReported?: () => void;
}> = ({ open, onClose, targetUserId, requestId, onReported }) => {
  const [category, setCategory] = useState<(typeof ISSUE_CATEGORIES)[number]['id']>('other');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await land.reportIssue({ targetUserId, requestId, category, details });
      setDetails('');
      onReported?.();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet
      isOpen={open}
      onClose={onClose}
      title="Report an Issue"
      maxWidth="sm"
      description="Moderation reviews reports — this does not freeze payments, decide ownership, or determine liability."
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="space-y-2">
          {ISSUE_CATEGORIES.map((c) => (
            <label
              key={c.id}
              className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer text-xs font-bold transition-all ${
                category === c.id
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <input
                type="radio"
                name="landIssueCategory"
                checked={category === c.id}
                onChange={() => setCategory(c.id)}
                className="accent-emerald-600"
              />
              {c.label}
            </label>
          ))}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Details (optional)</label>
          <textarea
            rows={3}
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            value={details}
            onChange={(e) => setDetails(e.target.value)}
          />
        </div>
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">{error}</div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
        >
          {busy ? 'Submitting…' : 'Submit Report'}
        </button>
      </form>
    </ModalSheet>
  );
};

export const FlagIcon: React.FC = () => <Flag className="w-3 h-3" />;

const OUTCOME_CHOICES = [
  { id: 'stillInContact', label: 'Still in contact' },
  { id: 'dealDone', label: 'Lease completed offline' },
  { id: 'didNotHappen', label: 'Did not happen' },
  { id: 'withdrawn', label: 'Withdrawn' },
] as const;

/** User-reported lease outcome (spec §12) — optional dealDone details are
 * never platform-verified payment or legal proof. */
export const LandOutcomeModal: React.FC<{
  open: boolean;
  onClose: () => void;
  requestId: string | null;
  allowWithdraw: boolean;
  onSaved?: () => void;
}> = ({ open, onClose, requestId, allowWithdraw, onSaved }) => {
  const [choice, setChoice] = useState<(typeof OUTCOME_CHOICES)[number]['id']>('stillInContact');
  const [notes, setNotes] = useState('');
  const [finalStartDate, setFinalStartDate] = useState('');
  const [finalEndDate, setFinalEndDate] = useState('');
  const [finalRent, setFinalRent] = useState<number>(0);
  const [finalRentUnit, setFinalRentUnit] = useState('perAcrePerYear');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestId) return;
    setBusy(true);
    setError(null);
    try {
      await land.recordOutcome(requestId, {
        outcome: choice,
        notes,
        ...(choice === 'dealDone'
          ? {
              finalStartDate: finalStartDate || undefined,
              finalEndDate: finalEndDate || undefined,
              finalRentRupees: finalRent > 0 ? finalRent : undefined,
              finalRentUnit,
            }
          : {}),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalSheet
      isOpen={open}
      onClose={onClose}
      title="Update Lease Outcome"
      maxWidth="sm"
      description="Your own report of what happened — never a payment record or legal proof."
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="space-y-2">
          {OUTCOME_CHOICES.filter((c) => allowWithdraw || c.id !== 'withdrawn').map((c) => (
            <label
              key={c.id}
              className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer text-xs font-bold transition-all ${
                choice === c.id
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <input
                type="radio"
                name="landOutcome"
                checked={choice === c.id}
                onChange={() => setChoice(c.id)}
                className="accent-emerald-600"
              />
              {c.label}
            </label>
          ))}
        </div>
        {choice === 'dealDone' && (
          <div className="space-y-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
            <p className="text-[10px] font-bold text-slate-500">Optional — user-reported only</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Lease start</label>
                <input type="date" className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300" value={finalStartDate} onChange={(e) => setFinalStartDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Lease end</label>
                <input type="date" className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300" value={finalEndDate} onChange={(e) => setFinalEndDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Final rent (₹)</label>
                <input type="number" min={0} className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 font-bold" value={finalRent || ''} onChange={(e) => setFinalRent(Number(e.target.value))} />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 mb-1">Unit</label>
                <select className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-300 bg-white" value={finalRentUnit} onChange={(e) => setFinalRentUnit(e.target.value)}>
                  <option value="perAcrePerYear">Per acre / year</option>
                  <option value="totalPerYear">Total / year</option>
                </select>
              </div>
            </div>
          </div>
        )}
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Notes (optional)</label>
          <textarea rows={2} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">{error}</div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
        >
          {busy ? 'Saving…' : 'Save Outcome'}
        </button>
      </form>
    </ModalSheet>
  );
};
