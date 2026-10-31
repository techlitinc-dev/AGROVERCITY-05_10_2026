import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageSquare, Flag } from 'lucide-react';
import { equipment, apiErrorMessage } from '../../lib/api';
import type { EquipmentContact } from '../../lib/api/equipment';
import { ModalSheet } from '../../components/common/ModalSheet';

/** Direct-connect terms (spec §10) — identical wording in both journeys. */
export const EQUIPMENT_DIRECT_CONNECT_TERMS =
  'Agrovercity only connects farmers and equipment owners. Final price, payment, equipment condition, operator arrangements, fuel, equipment transportation, work quality, safety, damage, cancellation, security deposits, and disputes are handled directly between the parties. Agrovercity does not hold payments or guarantee the equipment, operator, work quality, payment, safety, or completion. After acceptance, my contact details will be shared with the other party and their contact details will be shared with me.';

export const contactTel = (c: EquipmentContact | null | undefined): string | null =>
  c?.phoneDigits ? `tel:+${c.phoneDigits}` : null;
export const contactWa = (c: EquipmentContact | null | undefined): string | null =>
  c?.whatsappDigits ? `https://wa.me/${c.whatsappDigits}` : null;

/** Call / WhatsApp / Chat actions shown after contact unlock. */
export const ContactActions: React.FC<{ contact: EquipmentContact | null | undefined; chatRoomId?: string }> = ({
  contact,
  chatRoomId,
}) => {
  const navigate = useNavigate();
  const tel = contactTel(contact);
  const wa = contactWa(contact);
  return (
    <div className="flex items-center gap-2">
      {tel && (
        <a
          href={tel}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
          title="Call"
        >
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

const ISSUE_CATEGORIES = [
  { id: 'workNotCompleted', label: 'Work not completed' },
  { id: 'equipmentIssue', label: 'Equipment / operator issue' },
  { id: 'conduct', label: 'Farmer / owner conduct' },
  { id: 'safety', label: 'Safety concern' },
  { id: 'other', label: 'Other' },
] as const;

/** Issue reporting — moderation reviews it; it never freezes payments or
 * determines liability (spec §13). */
export const ReportIssueModal: React.FC<{
  open: boolean;
  onClose: () => void;
  targetUserId: string;
  bookingId?: string;
  onReported?: () => void;
}> = ({ open, onClose, targetUserId, bookingId, onReported }) => {
  const [category, setCategory] = useState<(typeof ISSUE_CATEGORIES)[number]['id']>('other');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await equipment.reportIssue({ targetUserId, bookingId, category, details });
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
    <ModalSheet isOpen={open} onClose={onClose} title="Report an Issue" maxWidth="sm"
      description="Moderation reviews reports — this does not freeze payments, trigger refunds, or decide liability.">
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
              <input type="radio" name="issueCategory" checked={category === c.id} onChange={() => setCategory(c.id)} className="accent-emerald-600" />
              {c.label}
            </label>
          ))}
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">Details (optional)</label>
          <textarea rows={3} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={details} onChange={(e) => setDetails(e.target.value)} />
        </div>
        {error && <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800">{error}</div>}
        <button type="submit" disabled={busy} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50">
          {busy ? 'Submitting…' : 'Submit Report'}
        </button>
      </form>
    </ModalSheet>
  );
};

export const reportButtonCls =
  'px-2.5 py-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-bold text-[10px] flex items-center gap-1';
export const FlagIcon: React.FC = () => <Flag className="w-3 h-3" />;
