import React, { useCallback, useEffect, useState } from 'react';
import { FileCheck, CheckCircle2, XCircle, Clock, MapPin, User as UserIcon, RefreshCw, BadgeCheck, Megaphone, Send } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { land, users, apiErrorMessage } from '../../lib/api';
import { isKycError, isMpinError } from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { UserVerificationBadge } from '../../components/common/UserVerificationBadge';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { LAND_DIRECT_CONNECT_TERMS, LandContactActions, LandContact, NegotiationChecklist } from '../land/shared';

interface InterestRow {
  id: string;
  status: string;
  farmerName?: string;
  farmerVerified?: boolean;
  listingId?: string;
  listingVillage?: string;
  listingAreaAcres?: number;
  durationMonths?: number;
  proposedStartDate?: string | null;
  intendedCrop?: string;
  offeredRentRupees?: number | null;
  offeredRentUnit?: string;
  message?: string;
  createdAt?: string;
  farmerContact?: LandContact | null;
  chatRoomId?: string;
}

/** Interest Requests — review farmer interest and ACCEPT THE CONTACT REQUEST
 * (terms + MPIN → contact unlock) or decline with a safe reason (spec §9).
 * "Accept Contact Request" never finalizes a lease or marks land leased. */
export const LandlordRequestsView: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<InterestRow[]>([]);
  const [hasMpin, setHasMpin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Farmers-posted "I need land" board — respond directly.
  const [board, setBoard] = useState<Record<string, unknown>[]>([]);
  const [boardLoading, setBoardLoading] = useState(true);
  const [respondTarget, setRespondTarget] = useState<Record<string, unknown> | null>(null);
  const [respondMessage, setRespondMessage] = useState('');
  const [respondTerms, setRespondTerms] = useState(false);
  const [respondBusy, setRespondBusy] = useState(false);

  const loadBoard = useCallback(async () => {
    setBoardLoading(true);
    try {
      const rows = (await land.browseRequirements()) as unknown as Record<string, unknown>[];
      setBoard(rows);
    } catch {
      setBoard([]);
    } finally {
      setBoardLoading(false);
    }
  }, []);

  const submitResponse = async () => {
    if (!respondTarget) return;
    setRespondBusy(true);
    setError(null);
    try {
      const res = (await land.respondToRequirement(String(respondTarget.id), {
        message: respondMessage.trim(),
        termsAccepted: respondTerms,
      })) as { chatRoomId?: string };
      setNotice('Response sent — the farmer is notified and a chat window is open.');
      setRespondTarget(null);
      setRespondMessage('');
      setRespondTerms(false);
      await loadBoard();
      if (res?.chatRoomId) navigate(`/chat?room=${encodeURIComponent(res.chatRoomId)}`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setRespondBusy(false);
    }
  };

  const [acceptTarget, setAcceptTarget] = useState<InterestRow | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mpin, setMpin] = useState('');
  const [contactCard, setContactCard] = useState<InterestRow | null>(null);
  const [declineTarget, setDeclineTarget] = useState<InterestRow | null>(null);
  const [declineReason, setDeclineReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, me] = await Promise.all([
        land.leaseRequests({ status: 'pending' }),
        users.getMe().catch(() => ({})),
      ]);
      setRequests(rows as unknown as InterestRow[]);
      setHasMpin(Boolean((me as { hasMpin?: boolean }).hasMpin));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    void loadBoard();
  }, [load, loadBoard]);

  const confirmAccept = async () => {
    if (!acceptTarget) return;
    setBusyId(acceptTarget.id);
    setError(null);
    try {
      const updated = (await land.acceptContact(acceptTarget.id, {
        termsAccepted,
        mpin: mpin.trim() || undefined,
      })) as unknown as InterestRow;
      setRequests((prev) => prev.filter((r) => r.id !== acceptTarget.id));
      setAcceptTarget(null);
      setContactCard({ ...acceptTarget, ...updated });
      setNotice('Contact request accepted — inspect and negotiate directly. The listing stays open.');
    } catch (err) {
      if (isMpinError(err)) {
        setError('Incorrect MPIN — try again.');
      } else {
        setError(apiErrorMessage(err));
        if (isKycError(err)) setAcceptTarget(null);
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
      await land.rejectLeaseRequest(declineTarget.id, declineReason);
      setRequests((prev) => prev.filter((r) => r.id !== declineTarget.id));
      setDeclineTarget(null);
      setDeclineReason('');
      setNotice('Request declined — the farmer is notified.');
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
            Interest Requests
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Accepting a contact request shares contacts so you can inspect and negotiate directly — it never
            finalizes a lease or marks your land leased.
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

      {/* Farmers Looking for Land — respond to farmer-posted requirements */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-black text-slate-900">Farmers Looking for Land</h2>
          <span className="text-[10px] font-bold text-slate-400">{boardLoading ? '…' : `${board.length} open`}</span>
        </div>
        {boardLoading ? (
          <div className="py-6 text-center text-xs font-bold text-slate-400 animate-pulse bg-white rounded-3xl border border-slate-200/80">
            Scanning farmer requests…
          </div>
        ) : board.length === 0 ? (
          <div className="py-6 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
            No open farmer requests right now — they appear here when a farmer posts the land they need.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {board.map((q) => (
              <div key={String(q.id)} className="bg-white rounded-3xl p-4 border border-slate-200/80 shadow-xs space-y-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-slate-900">
                    {String(q.areaAcres ?? '—')} acres · {String(q.district ?? '')}
                  </span>
                  {q.farmerVerified ? (
                    <span className="text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                      <BadgeCheck className="w-2.5 h-2.5" /> Verified Farmer
                    </span>
                  ) : null}
                </div>
                <p className="text-xs text-slate-600 flex items-center gap-1 flex-wrap">
                  <UserIcon className="w-3.5 h-3.5 text-slate-400" /> {String(q.farmerName || 'Farmer')}
                  <Clock className="w-3.5 h-3.5 text-slate-400 ml-1" />
                  {q.durationMonths ? `${String(q.durationMonths)} months` : ''}
                  {q.intendedCrop ? ` · ${String(q.intendedCrop)}` : ''}
                  {q.maxRentPerAcrePerYear ? ` · up to ${formatCurrency(Number(q.maxRentPerAcrePerYear))}/acre/yr` : ''}
                  {q.neededFrom ? ` · from ${String(q.neededFrom)}` : ''}
                </p>
                {q.irrigated === true && (
                  <p className="text-[10px] text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> Wants irrigated land</p>
                )}
                {q.notes ? <p className="text-[11px] text-slate-500 italic">“{String(q.notes)}”</p> : null}
                <button
                  onClick={() => { setRespondTarget(q); setRespondMessage(''); setRespondTerms(false); }}
                  className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1.5"
                >
                  <Send className="w-3 h-3" /> Respond — I have land
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 className="text-sm font-black text-slate-900 pt-2">Interest Requests</h2>
      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading requests…</div>
      ) : requests.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
          <FileCheck className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold">No pending interest requests</p>
          <p className="text-xs text-slate-400">Farmer interest in your listings appears here.</p>
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
                  <strong>{r.listingAreaAcres ? `${r.listingAreaAcres} acres · ` : ''}{r.listingVillage || 'Your land'}</strong>
                  {' · '}{r.durationMonths ? `${r.durationMonths} months` : ''}
                  {r.proposedStartDate ? ` from ${r.proposedStartDate}` : ''}
                  {r.intendedCrop ? ` · ${r.intendedCrop}` : ''}
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {r.offeredRentRupees ? `Offered ${formatCurrency(r.offeredRentRupees)} ${r.offeredRentUnit === 'totalPerYear' ? '/year total' : '/acre/year'} · ` : ''}
                  <MapPin className="w-3 h-3" /> {formatDateTime(r.createdAt ?? '')}
                </p>
                {r.message && <p className="text-[11px] text-slate-500 italic">“{r.message}”</p>}
              </div>
              <div className="flex items-center gap-2 self-end lg:self-center">
                <button
                  onClick={() => { setAcceptTarget(r); setTermsAccepted(false); setMpin(''); }}
                  disabled={busyId === r.id}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1 shadow-sm disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Accept Contact Request
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

      {/* Accept — terms + MPIN, then contact card + guidance */}
      <ModalSheet
        isOpen={Boolean(acceptTarget)}
        onClose={() => setAcceptTarget(null)}
        title="Accept Contact Request"
        description={acceptTarget ? `${acceptTarget.farmerName} · ${acceptTarget.listingVillage ?? 'your land'}` : undefined}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            {LAND_DIRECT_CONNECT_TERMS}
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
        description="Call, WhatsApp or chat — inspect the land and negotiate directly"
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
                {contactCard.listingVillage} land · {contactCard.durationMonths} months
              </p>
              {contactCard.farmerContact?.phone && (
                <p className="text-sm font-black text-slate-800">{contactCard.farmerContact.phone}</p>
              )}
            </div>
            <div className="flex justify-center">
              <LandContactActions contact={contactCard.farmerContact} chatRoomId={contactCard.chatRoomId} />
            </div>
            <NegotiationChecklist />
            <p className="text-[10px] text-slate-400 text-center">
              Accepting contact does not create a lease — mark the listing leased only after you finish directly.
            </p>
          </div>
        )}
      </ModalSheet>

      {/* Respond to a farmer-posted land requirement */}
      <ModalSheet
        isOpen={Boolean(respondTarget)}
        onClose={() => setRespondTarget(null)}
        title="Respond to Land Request"
        description={
          respondTarget
            ? `${String(respondTarget.areaAcres ?? '—')} acres needed in ${String(respondTarget.district ?? '')} · ${String(respondTarget.durationMonths ?? '')} months`
            : undefined
        }
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Your message to the farmer *</label>
            <textarea
              rows={3}
              value={respondMessage}
              onChange={(e) => setRespondMessage(e.target.value)}
              placeholder="e.g. I have 6 acres with borewell irrigation near Pimpalgaon — available from November."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-slate-50 border border-slate-200 cursor-pointer">
            <input
              type="checkbox"
              checked={respondTerms}
              onChange={(e) => setRespondTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-emerald-600"
            />
            <span className="text-[11px] text-slate-600 leading-relaxed">{LAND_DIRECT_CONNECT_TERMS}</span>
          </label>
          <button
            onClick={() => void submitResponse()}
            disabled={respondBusy || !respondMessage.trim() || !respondTerms}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {respondBusy ? 'Sending…' : 'Send Response & Open Chat'}
          </button>
          <p className="text-[10px] text-slate-400 text-center">
            The farmer is notified and a chat opens — negotiate rent, inspection and terms directly.
          </p>
        </div>
      </ModalSheet>

      {/* Decline */}
      <ModalSheet
        isOpen={Boolean(declineTarget)}
        onClose={() => setDeclineTarget(null)}
        title="Decline Interest"
        description={declineTarget ? `Declining affects only this request — ${declineTarget.farmerName} is notified.` : undefined}
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Reason (optional)</label>
            <textarea
              rows={2}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="e.g. Looking for a longer lease"
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
