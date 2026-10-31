import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, MessageSquare, BadgeCheck, Handshake, CalendarDays, TrendingUp, ShieldAlert } from 'lucide-react';
import { getMyLeads, updateLeadStatus, type Lead, type LeadContact } from '../../lib/api/leads';
import { users, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDateTime } from '../../lib/utils';

/** Direct-connect terms (spec §8) — identical wording in both journeys. */
export const DIRECT_CONNECT_TERMS =
  'Agrovercity only connects farmers and Agri Vyaparis. Final price, produce quality, payment, pickup, delivery, and any disputes are handled directly between the parties. Agrovercity does not hold payments and does not guarantee the deal, produce quality, payment, pickup, or delivery. After confirmation, my contact details will be shared with the other party and their contact details will be shared with me.';

interface Props {
  persona: 'farmer' | 'seller';
}

const OUTCOME_LABEL: Record<string, string> = {
  new: 'New',
  contacted: 'In contact',
  sold: 'Deal completed',
  dismissed: 'Did not happen',
};

const OUTCOME_CLS: Record<string, string> = {
  new: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  contacted: 'text-amber-700 bg-amber-50 border-amber-200',
  sold: 'text-sky-700 bg-sky-50 border-sky-200',
  dismissed: 'text-slate-500 bg-slate-100 border-slate-200',
};

/** Spec outcome choices → existing backend lead statuses. */
type OutcomeChoice = 'dealDone' | 'didNotHappen' | 'stillInContact';
const OUTCOME_TO_STATUS: Record<OutcomeChoice, Lead['status']> = {
  dealDone: 'sold',
  didNotHappen: 'dismissed',
  stillInContact: 'contacted',
};

const contactTel = (c: LeadContact | null): string | null =>
  c?.phoneDigits ? `tel:+${c.phoneDigits}` : null;
const contactWa = (c: LeadContact | null): string | null =>
  c?.whatsappDigits ? `https://wa.me/${c.whatsappDigits}` : null;

export const MyConnectionsView: React.FC<Props> = ({ persona }) => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [myUid, setMyUid] = useState<string>('');
  const [verified, setVerified] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [outcomeLead, setOutcomeLead] = useState<Lead | null>(null);
  const [outcomeChoice, setOutcomeChoice] = useState<OutcomeChoice>('stillInContact');
  const [finalRate, setFinalRate] = useState<number>(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [me, received, sent] = await Promise.all([
        users.getMe(),
        getMyLeads('received'),
        getMyLeads('sent'),
      ]);
      setMyUid((me as { id?: string }).id ?? '');
      setVerified(
        Boolean(
          (me as { kycStatus?: string }).kycStatus === 'verified' ||
            (me as { vyapariVerified?: boolean }).vyapariVerified
        )
      );
      const merged = new Map<string, Lead>();
      for (const l of [...received, ...sent]) merged.set(l.id, l);
      setLeads(
        [...merged.values()].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openOutcome = (lead: Lead) => {
    setOutcomeLead(lead);
    setOutcomeChoice(
      lead.status === 'sold' ? 'dealDone' : lead.status === 'dismissed' ? 'didNotHappen' : 'stillInContact'
    );
    setFinalRate(lead.finalRate ?? lead.expectedRate ?? lead.pricePerUnit ?? 0);
  };

  const saveOutcome = async () => {
    if (!outcomeLead) return;
    setBusyId(outcomeLead.id);
    setError(null);
    try {
      const updated = await updateLeadStatus(
        outcomeLead.id,
        OUTCOME_TO_STATUS[outcomeChoice],
        outcomeChoice === 'dealDone' && finalRate > 0 ? finalRate : undefined
      );
      setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
      setOutcomeLead(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const otherParty = (lead: Lead): LeadContact | null =>
    myUid && lead.farmerId === myUid ? lead.buyerContact : lead.farmerContact;

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Handshake className="w-7 h-7 text-emerald-600" />
          My Connections
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          {persona === 'farmer'
            ? 'Vyaparis who contacted you about your lots, and the requirements you applied to. Call, WhatsApp or chat — deals close directly between you two.'
            : 'Farmers you contacted about their lots, and applications on your requirements. Call, WhatsApp or chat — deals close directly between you two.'}
        </p>
      </div>

      {!verified && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs font-semibold text-amber-800 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          Complete your identity verification (KYC) to contact the other party or post new listings.
        </div>
      )}
      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading your connections…
        </div>
      ) : leads.length === 0 ? (
        <div className="py-12 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
          No connections yet.{' '}
          {persona === 'farmer'
            ? 'Post a produce lot or apply to a buyer requirement to start connecting.'
            : 'Find produce or post a requirement to start connecting.'}
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => {
            const other = otherParty(lead);
            const crop = lead.lotCrop || lead.demandCrop || 'Produce';
            const ref = lead.lotId
              ? `Lot · ${lead.lotVariety || 'standard'}`
              : `Requirement · ${lead.demandVariety || 'any variety'}`;
            const qty = lead.quantityQuintals ?? lead.quantity;
            const price = lead.expectedRate ?? lead.pricePerUnit;
            const tel = contactTel(other);
            const wa = contactWa(other);
            return (
              <div
                key={lead.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900">
                      {other?.fullName || other?.name || (persona === 'farmer' ? 'Vyapari' : 'Farmer')}
                    </span>
                    {other?.verified && (
                      <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <BadgeCheck className="w-3 h-3" /> Verified
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${OUTCOME_CLS[lead.status] ?? OUTCOME_CLS.new}`}
                    >
                      {OUTCOME_LABEL[lead.status] ?? lead.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    <strong>{crop}</strong> — {ref}
                    {qty ? ` · ${qty} q` : ''}
                    {price ? ` · ${formatCurrency(price)}/q` : ''}
                  </p>
                  {lead.finalRate ? (
                    <p className="text-xs font-bold text-emerald-700">
                      Final rate reported: {formatCurrency(lead.finalRate)}/q
                    </p>
                  ) : null}
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <CalendarDays className="w-3 h-3" /> {formatDateTime(lead.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
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
                  {lead.chatRoomId && (
                    <button
                      onClick={() => navigate(`/chat?room=${encodeURIComponent(lead.chatRoomId!)}`)}
                      className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
                      title="Chat"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => openOutcome(lead)}
                    disabled={busyId === lead.id}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs disabled:opacity-50 flex items-center gap-1"
                  >
                    <TrendingUp className="w-3.5 h-3.5" /> Update Outcome
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Outcome update — user-reported only, never a payment record. */}
      <ModalSheet
        isOpen={Boolean(outcomeLead)}
        onClose={() => setOutcomeLead(null)}
        title="Update Outcome"
        description="This is your own report of what happened — Agrovercity does not verify or process any payment for it."
        maxWidth="sm"
      >
        {outcomeLead && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(OUTCOME_TO_STATUS) as OutcomeChoice[]).map((choice) => (
                <label
                  key={choice}
                  className={`flex items-center gap-2.5 p-3 rounded-2xl border cursor-pointer text-xs font-bold transition-all ${
                    outcomeChoice === choice
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="outcome"
                    checked={outcomeChoice === choice}
                    onChange={() => setOutcomeChoice(choice)}
                    className="accent-emerald-600"
                  />
                  {OUTCOME_LABEL[OUTCOME_TO_STATUS[choice]]}
                </label>
              ))}
            </div>
            {outcomeChoice === 'dealDone' && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Final rate (₹/q, optional)
                </label>
                <input
                  type="number"
                  min={0}
                  value={finalRate || ''}
                  onChange={(e) => setFinalRate(Number(e.target.value))}
                  className="w-full px-3 py-2.5 text-base font-bold rounded-xl border border-slate-300 text-emerald-800"
                  placeholder="Optional — only if you want it on record"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Your own note for record keeping. It is never a payment verification, invoice, or receipt.
                </p>
              </div>
            )}
            <button
              onClick={() => void saveOutcome()}
              disabled={busyId === outcomeLead.id}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
            >
              Save Outcome
            </button>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};
