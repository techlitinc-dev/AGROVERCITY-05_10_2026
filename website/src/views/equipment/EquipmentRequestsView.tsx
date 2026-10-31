import React, { useCallback, useEffect, useState } from 'react';
import { FileCheck, CheckCircle2, XCircle, Clock, MapPin, User as UserIcon, RefreshCw, BadgeCheck } from 'lucide-react';
import { equipmentOwner, users, apiErrorMessage } from '../../lib/api';
import type { EquipmentContact } from '../../lib/api/equipment';
import { isKycError, isMpinError } from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { UserVerificationBadge } from '../../components/common/UserVerificationBadge';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { EQUIPMENT_DIRECT_CONNECT_TERMS, ContactActions } from './shared';

interface OwnerRequest {
  id: string;
  status: string;
  farmerName?: string;
  farmerVerified?: boolean;
  date?: string;
  slotName?: string;
  priceRupees?: number;
  workLocation?: string;
  workType?: string;
  workQuantity?: number;
  workUnit?: string;
  notes?: string;
  createdAt?: string;
  equipmentId?: string;
  equipmentName?: string;
  equipmentType?: string;
  farmerContact?: EquipmentContact | null;
  ownerContact?: EquipmentContact | null;
  chatRoomId?: string;
}

/** Booking Requests — the owner accepts (terms + MPIN → contact unlock) or
 * declines with a safe reason (spec §8/§9). No counteroffers. */
export const EquipmentRequestsView: React.FC = () => {
  const [requests, setRequests] = useState<OwnerRequest[]>([]);
  const [hasMpin, setHasMpin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [acceptTarget, setAcceptTarget] = useState<OwnerRequest | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mpin, setMpin] = useState('');
  const [contactCard, setContactCard] = useState<OwnerRequest | null>(null);
  const [declineTarget, setDeclineTarget] = useState<OwnerRequest | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, me] = await Promise.all([
        equipmentOwner.ownerRequests('pending'),
        users.getMe().catch(() => ({})),
      ]);
      setRequests(rows as unknown as OwnerRequest[]);
      setHasMpin(Boolean((me as { hasMpin?: boolean }).hasMpin));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const confirmAccept = async () => {
    if (!acceptTarget) return;
    setBusyId(acceptTarget.id);
    setError(null);
    try {
      const updated = (await equipmentOwner.approveBooking(acceptTarget.id, {
        termsAccepted,
        mpin: mpin.trim() || undefined,
      })) as unknown as OwnerRequest;
      setRequests((prev) => prev.filter((r) => r.id !== updated.id));
      setAcceptTarget(null);
      setContactCard({ ...acceptTarget, ...updated });
      setNotice('Request accepted — contacts unlocked, chat is open.');
    } catch (err) {
      if (isMpinError(err)) {
        setError('Incorrect MPIN — try again.');
      } else if (isKycError(err)) {
        setError(apiErrorMessage(err));
        setAcceptTarget(null);
      } else {
        setError(apiErrorMessage(err));
        setAcceptTarget(null);
      }
    } finally {
      setBusyId(null);
    }
  };

  const confirmDecline = async () => {
    if (!declineTarget) return;
    setBusyId(declineTarget.id);
    setError(null);
    try {
      await equipmentOwner.rejectBooking(declineTarget.id, declineReason || 'Not available');
      setRequests((prev) => prev.filter((r) => r.id !== declineTarget.id));
      setDeclineTarget(null);
      setDeclineReason('');
      setNotice('Request declined — the farmer is notified and can request other equipment.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileCheck className="w-7 h-7 text-emerald-600" />
            Booking Requests
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Accept with your MPIN to share contacts, or decline with a reason. Everything after that is
            settled directly between you and the farmer.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 self-start sm:self-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="flex items-center justify-between p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold">No pending requests</p>
          <p className="text-xs text-slate-400">New farmer requests appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((r) => (
            <div key={r.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-slate-900">{r.farmerName || 'Farmer'}</span>
                  <UserVerificationBadge verified={r.farmerVerified} label="Verified Farmer" />
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700">Requested</span>
                </div>
                <p className="text-xs text-slate-700">
                  <strong>{r.equipmentName}</strong> · {r.workType || 'Farm work'}
                  {r.workQuantity ? ` · ${r.workQuantity} ${r.workUnit ?? ''}` : ''}
                  {r.priceRupees ? ` · listed ${formatCurrency(r.priceRupees)} (indicative)` : ''}
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> {r.date} · {r.slotName}
                  {r.workLocation ? <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {r.workLocation}</span> : null}
                </p>
                {r.notes && <p className="text-[11px] text-slate-500 italic">“{r.notes}”</p>}
                <p className="text-[10px] text-slate-400">{formatDateTime(r.createdAt ?? '')}</p>
              </div>
              <div className="flex items-center gap-2 self-end lg:self-center">
                <button
                  onClick={() => { setAcceptTarget(r); setTermsAccepted(false); setMpin(''); }}
                  disabled={busyId === r.id}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accept
                </button>
                <button
                  onClick={() => { setDeclineTarget(r); setDeclineReason(''); }}
                  disabled={busyId === r.id}
                  className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs flex items-center gap-1 disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" /> Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Accept — terms + MPIN, then contact card */}
      <ModalSheet
        isOpen={Boolean(acceptTarget)}
        onClose={() => setAcceptTarget(null)}
        title="Accept & Connect Directly"
        description={acceptTarget ? `${acceptTarget.farmerName} · ${acceptTarget.equipmentName} · ${acceptTarget.date} ${acceptTarget.slotName}` : undefined}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            {EQUIPMENT_DIRECT_CONNECT_TERMS}
          </div>
          <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="mt-0.5 accent-emerald-600" />
            I have read and accept the direct-connect terms.
          </label>
          {hasMpin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Enter your MPIN to confirm it's you</label>
              <input
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={4}
                value={mpin}
                onChange={(e) => setMpin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="4-digit MPIN"
                className="w-full px-3 py-2.5 text-base font-bold tracking-[0.5em] rounded-xl border border-slate-300"
              />
            </div>
          )}
          <button
            onClick={() => void confirmAccept()}
            disabled={!termsAccepted || busyId === acceptTarget?.id || (hasMpin && mpin.length !== 4)}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {busyId === acceptTarget?.id ? 'Verifying…' : 'Accept & Show Contact'}
          </button>
        </div>
      </ModalSheet>

      {/* Contact card after unlock */}
      <ModalSheet
        isOpen={Boolean(contactCard)}
        onClose={() => setContactCard(null)}
        title="Farmer Contact Unlocked"
        description="Call, WhatsApp or chat — coordinate schedule, fuel and payment directly"
        maxWidth="sm"
      >
        {contactCard && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-1.5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto">
                <UserIcon className="w-6 h-6 text-emerald-700" />
              </div>
              <p className="text-base font-black text-slate-900">{contactCard.farmerName || 'Farmer'}</p>
              {contactCard.farmerVerified && (
                <p className="text-[10px] font-bold text-sky-700 flex items-center justify-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> Identity verified
                </p>
              )}
              <p className="text-xs font-bold text-emerald-700">
                {contactCard.equipmentName} · {contactCard.date} {contactCard.slotName}
              </p>
              {contactCard.farmerContact?.phone && (
                <p className="text-sm font-black text-slate-800">{contactCard.farmerContact.phone}</p>
              )}
            </div>
            <div className="flex justify-center">
              <ContactActions contact={contactCard.farmerContact} chatRoomId={contactCard.chatRoomId} />
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Agrovercity does not intermediate — price, fuel, travel, damage responsibility and payment are between you two.
            </p>
          </div>
        )}
      </ModalSheet>

      {/* Decline */}
      <ModalSheet
        isOpen={Boolean(declineTarget)}
        onClose={() => setDeclineTarget(null)}
        title="Decline Request"
        description={declineTarget ? `Declining only affects this request — ${declineTarget.farmerName} is notified.` : undefined}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason (optional but helpful)</label>
            <textarea
              rows={2}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Machine in service / schedule conflict"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={() => void confirmDecline()}
            disabled={busyId === declineTarget?.id}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
          >
            Confirm Decline
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
