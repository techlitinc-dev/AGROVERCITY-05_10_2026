import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Megaphone,
  MapPin,
  Calendar,
  Phone,
  MessageSquare,
  BadgeCheck,
  RotateCcw,
  RefreshCcw,
  User as UserIcon,
  Layers,
} from 'lucide-react';
import { demands, users, apiErrorMessage } from '../../lib/api';
import {
  getMyLeads,
  updateLeadStatus,
  unlockLead,
  isMpinError,
  isKycError,
  type Lead,
  type LeadContact,
} from '../../lib/api/leads';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { DIRECT_CONNECT_TERMS } from '../trade/MyConnectionsView';

/**
 * Post Requirement — the Vyapari's requirement desk (spec §6, Journey B).
 *
 * Post a buying requirement (crop / quantity / area), manage open & closed
 * requirements, and review farmer applications. Contacting an applicant uses
 * the same protected flow as Find Produce: terms + MPIN, idempotent, with
 * Call / WhatsApp / Chat afterwards. No offers, no counter-rounds, no deal
 * agreement, no purchase orders — those legacy flows were removed.
 */
export const SellerDemandsManager: React.FC = () => {
  const navigate = useNavigate();
  const [myDemands, setMyDemands] = useState<Record<string, unknown>[]>([]);
  const [applications, setApplications] = useState<Lead[]>([]);
  const [hasMpin, setHasMpin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Post / edit requirement form
  const [reqModal, setReqModal] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Record<string, unknown> | null>(null);
  const [dmCrop, setDmCrop] = useState('');
  const [dmVariety, setDmVariety] = useState('');
  const [dmQuantity, setDmQuantity] = useState(20);
  const [dmMaxPrice, setDmMaxPrice] = useState(0);
  const [dmLocation, setDmLocation] = useState('');
  const [dmNeededBy, setDmNeededBy] = useState('');
  const [dmGrade, setDmGrade] = useState('A');
  const [dmNotes, setDmNotes] = useState('');
  const [posting, setPosting] = useState(false);

  // Contact-unlock flow for an application
  const [unlockLeadState, setUnlockLeadState] = useState<Lead | null>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [mpin, setMpin] = useState('');
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [contactCard, setContactCard] = useState<Lead | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, apps, me] = await Promise.all([
        demands.list({ status: 'all' }),
        getMyLeads('sent', undefined, 'demand'),
        users.getMe().catch(() => ({})),
      ]);
      setMyDemands(rows as unknown as Record<string, unknown>[]);
      setApplications(apps);
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

  const appsFor = (demandId: string): Lead[] => applications.filter((a) => a.demandId === demandId);

  const openPostModal = () => {
    setEditingDemand(null);
    setDmCrop('');
    setDmVariety('');
    setDmQuantity(20);
    setDmMaxPrice(0);
    setDmLocation('');
    setDmNeededBy('');
    setDmGrade('A');
    setDmNotes('');
    setReqModal(true);
  };

  const openEditModal = (d: Record<string, unknown>) => {
    setEditingDemand(d);
    setDmCrop(String(d.crop ?? ''));
    setDmVariety(String(d.variety ?? ''));
    setDmQuantity(Number(d.quantity ?? 20));
    setDmMaxPrice(Number(d.maxPrice ?? 0));
    setDmLocation(String(d.deliveryLocation ?? ''));
    setDmNeededBy(String(d.neededBy ?? ''));
    setDmGrade(String(d.qualityGrade ?? 'A'));
    setDmNotes(String(d.notes ?? ''));
    setReqModal(true);
  };

  const submitRequirement = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setError(null);
    try {
      const payload = {
        crop: dmCrop.trim(),
        variety: dmVariety.trim(),
        quantity: dmQuantity,
        unit: 'quintal',
        qualityGrade: dmGrade as 'A' | 'B' | 'C',
        maxPrice: dmMaxPrice || 0,
        deliveryLocation: dmLocation.trim(),
        neededBy: dmNeededBy,
        notes: dmNotes.trim(),
      };
      if (editingDemand) {
        await demands.update(String(editingDemand.id), payload);
        setNotice('Requirement updated.');
      } else {
        await demands.create(payload);
        setNotice('Requirement posted — farmers can now apply.');
      }
      setReqModal(false);
      await load();
    } catch (err) {
      if (isKycError(err)) {
        setError('Complete your identity verification (KYC) before posting requirements — see Profile & Verification.');
      } else {
        setError(apiErrorMessage(err));
      }
    } finally {
      setPosting(false);
    }
  };

  const closeRequirement = async (d: Record<string, unknown>) => {
    setBusyId(String(d.id));
    setError(null);
    try {
      await demands.close(String(d.id));
      setNotice('Requirement closed — applicants are notified.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const reopenRequirement = async (d: Record<string, unknown>) => {
    setBusyId(String(d.id));
    setError(null);
    try {
      await demands.reopen(String(d.id));
      setNotice('Requirement reopened.');
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const dismissApplication = async (lead: Lead) => {
    setBusyId(lead.id);
    setError(null);
    try {
      await updateLeadStatus(lead.id, 'dismissed');
      setApplications((prev) => prev.map((a) => (a.id === lead.id ? { ...a, status: 'dismissed' } : a)));
      setNotice('Application dismissed.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const openUnlock = (lead: Lead) => {
    setUnlockLeadState(lead);
    setTermsAccepted(false);
    setMpin('');
  };

  const confirmUnlock = async () => {
    if (!unlockLeadState) return;
    setUnlockBusy(true);
    setError(null);
    try {
      const updated = await unlockLead(unlockLeadState.id, termsAccepted, mpin.trim() || undefined);
      setApplications((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setUnlockLeadState(null);
      setContactCard(updated);
      setNotice('Contact unlocked — call, WhatsApp or chat with the farmer directly.');
    } catch (err) {
      if (isMpinError(err)) {
        setError('Incorrect MPIN — try again.');
      } else if (isKycError(err)) {
        setError('Complete identity verification (KYC) for both parties to unlock contacts.');
        setUnlockLeadState(null);
      } else {
        setError(apiErrorMessage(err));
        setUnlockLeadState(null);
      }
    } finally {
      setUnlockBusy(false);
    }
  };

  const telLink = (c: LeadContact | null): string | null => (c?.phoneDigits ? `tel:+${c.phoneDigits}` : null);
  const waLink = (c: LeadContact | null): string | null =>
    c?.whatsappDigits ? `https://wa.me/${c.whatsappDigits}` : null;

  const openDemands = myDemands.filter((d) => d.status === 'open');
  const closedDemands = myDemands.filter((d) => d.status !== 'open');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-emerald-600" />
            Post Requirement
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Tell farmers what you want to buy. Farmers apply with their quantity and price — you contact them
            directly and settle the deal between yourselves.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={openPostModal} className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md flex items-center gap-2">
            <Megaphone className="w-4 h-4" /> New Requirement
          </button>
          <button onClick={() => void load()} className="p-2.5 rounded-2xl border border-slate-200 hover:bg-slate-50" title="Refresh">
            <RefreshCcw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading your requirements…</div>
      ) : (
        <div className="space-y-6">
          {/* Open requirements */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Open Requirements ({openDemands.length})</h3>
            {openDemands.length === 0 ? (
              <div className="py-8 text-center text-xs font-semibold text-slate-400 bg-white rounded-3xl border border-slate-200/80">
                No open requirements. Post one — farmers apply with their quotes.
              </div>
            ) : (
              openDemands.map((d) => {
                const apps = appsFor(String(d.id));
                return (
                  <div key={String(d.id)} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h4 className="font-extrabold text-sm text-slate-900">
                          {String(d.crop)} {d.variety ? `(${String(d.variety)})` : ''}
                        </h4>
                        <p className="text-[11px] text-slate-400 flex items-center gap-1.5 flex-wrap">
                          <span>{Number(d.quantity)} {String(d.unit || 'quintal')}</span>
                          {Number(d.maxPrice) > 0 && <span>· up to {formatCurrency(Number(d.maxPrice))}/q</span>}
                          {d.deliveryLocation ? (
                            <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" /> {String(d.deliveryLocation)}</span>
                          ) : null}
                          {d.neededBy ? (
                            <span className="flex items-center gap-0.5"><Calendar className="w-3 h-3" /> needed by {String(d.neededBy)}</span>
                          ) : null}
                        </p>
                      </div>
                      <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700">
                        {apps.length} application{apps.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {/* Applications on this requirement */}
                    {apps.length > 0 && (
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        {apps.map((a) => (
                          <div key={a.id} className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <div className="text-xs min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900">{a.farmerContact?.fullName || 'Farmer'}</span>
                                {a.farmerContact?.verified !== false && a.status !== 'dismissed' && (
                                  <span className="text-[10px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                                    <BadgeCheck className="w-3 h-3" /> Verified
                                  </span>
                                )}
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize border-slate-200 bg-white text-slate-600">
                                  {a.status === 'dealDone' ? 'deal completed' : a.status}
                                </span>
                              </div>
                              <p className="text-slate-600 mt-0.5">
                                Offers <strong>{formatCurrency(a.pricePerUnit ?? 0)}/q</strong> · {a.quantity} q
                                {a.message ? ` · “${a.message}”` : ''}
                              </p>
                              <p className="text-[10px] text-slate-400">{formatDateTime(a.createdAt)}</p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {a.status !== 'dismissed' && a.status !== 'dealDone' ? (
                                <>
                                  <button
                                    onClick={() => openUnlock(a)}
                                    disabled={busyId === a.id}
                                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs disabled:opacity-50"
                                  >
                                    Contact Farmer
                                  </button>
                                  <button
                                    onClick={() => void dismissApplication(a)}
                                    disabled={busyId === a.id}
                                    className="px-2.5 py-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-bold text-[10px] disabled:opacity-50"
                                  >
                                    Dismiss
                                  </button>
                                </>
                              ) : (
                                <button
                                  onClick={() => openUnlock(a)}
                                  className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-[10px]"
                                >
                                  View Contact Again
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1">
                      <button
                        onClick={() => openEditModal(d)}
                        disabled={busyId === String(d.id)}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-[10px] disabled:opacity-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => void closeRequirement(d)}
                        disabled={busyId === String(d.id)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[10px] disabled:opacity-50"
                      >
                        Close Requirement
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Closed requirements */}
          {closedDemands.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-bold text-sm text-slate-500">Closed ({closedDemands.length})</h3>
              {closedDemands.map((d) => (
                <div key={String(d.id)} className="bg-white rounded-3xl p-4 border border-slate-200/60 opacity-75 flex items-center justify-between gap-3">
                  <div className="text-xs">
                    <span className="font-bold text-slate-700">{String(d.crop)}</span>
                    <span className="text-slate-400"> · {Number(d.quantity)} {String(d.unit || 'quintal')} · {appsFor(String(d.id)).length} applications</span>
                  </div>
                  <button
                    onClick={() => void reopenRequirement(d)}
                    disabled={busyId === String(d.id)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" /> Reopen
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Post / edit requirement modal — short form, no payment/procurement fields */}
      <ModalSheet
        isOpen={reqModal}
        onClose={() => setReqModal(false)}
        title={editingDemand ? 'Edit Requirement' : 'Post a Requirement'}
        description="Farmers near your delivery area see it and apply with their quantity and price."
        maxWidth="md"
      >
        <form onSubmit={(e) => void submitRequirement(e)} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop *</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={dmCrop} onChange={(e) => setDmCrop(e.target.value)} placeholder="e.g. Soybean, Onion" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Variety</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={dmVariety} onChange={(e) => setDmVariety(e.target.value)} placeholder="Any / optional" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Quantity (q) *</label>
              <input type="number" min={1} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold" value={dmQuantity} onChange={(e) => setDmQuantity(Number(e.target.value))} required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Max Price (₹/q)</label>
              <input type="number" min={0} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-bold text-emerald-800" value={dmMaxPrice || ''} onChange={(e) => setDmMaxPrice(Number(e.target.value))} placeholder="Optional" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Grade</label>
              <select className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white" value={dmGrade} onChange={(e) => setDmGrade(e.target.value)}>
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Delivery / Pickup Area *</label>
              <input className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={dmLocation} onChange={(e) => setDmLocation(e.target.value)} placeholder="e.g. Nashik APMC" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Needed By</label>
              <input type="date" className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={dmNeededBy} onChange={(e) => setDmNeededBy(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Quality Notes / Message</label>
            <textarea rows={2} className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300" value={dmNotes} onChange={(e) => setDmNotes(e.target.value)} placeholder="Optional — moisture, packaging, cleaning…" />
          </div>
          <p className="text-[10px] text-slate-400">
            No advance, no escrow, no platform payment — you and the farmer settle everything directly.
          </p>
          <button type="submit" disabled={posting} className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50">
            {posting ? 'Saving…' : editingDemand ? 'Save Changes' : 'Post Requirement'}
          </button>
        </form>
      </ModalSheet>

      {/* Terms + MPIN — protects the contact unlock (idempotent) */}
      <ModalSheet
        isOpen={Boolean(unlockLeadState)}
        onClose={() => setUnlockLeadState(null)}
        title="Connect Directly with the Farmer"
        description={
          unlockLeadState
            ? `${unlockLeadState.farmerContact?.fullName || 'Farmer'} · ${unlockLeadState.demandCrop} · ${unlockLeadState.quantity} q @ ${formatCurrency(unlockLeadState.pricePerUnit ?? 0)}/q`
            : undefined
        }
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
            {DIRECT_CONNECT_TERMS}
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
            onClick={() => void confirmUnlock()}
            disabled={!termsAccepted || unlockBusy || (hasMpin && mpin.length !== 4)}
            className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-all disabled:opacity-50"
          >
            {unlockBusy ? 'Verifying…' : 'Accept & Show Contact'}
          </button>
        </div>
      </ModalSheet>

      {/* Contact card — after unlock */}
      <ModalSheet
        isOpen={Boolean(contactCard)}
        onClose={() => setContactCard(null)}
        title="Farmer Contact Unlocked"
        description="Call, WhatsApp or chat — finalize the deal directly"
        maxWidth="sm"
      >
        {contactCard && (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-1.5">
              <div className="w-12 h-12 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center mx-auto">
                <UserIcon className="w-6 h-6 text-emerald-700" />
              </div>
              <p className="text-base font-black text-slate-900">{contactCard.farmerContact?.fullName || 'Farmer'}</p>
              {contactCard.farmerContact?.verified && (
                <p className="text-[10px] font-bold text-sky-700 flex items-center justify-center gap-1">
                  <BadgeCheck className="w-3 h-3" /> Identity verified
                </p>
              )}
              <p className="text-xs font-bold text-emerald-700">
                {contactCard.demandCrop} · {contactCard.quantity} q @ {formatCurrency(contactCard.pricePerUnit ?? 0)}/q
              </p>
              {contactCard.farmerContact?.phone && (
                <p className="text-sm font-black text-slate-800">{contactCard.farmerContact.phone}</p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2">
              <a
                href={telLink(contactCard.farmerContact) ?? '#'}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 ${!telLink(contactCard.farmerContact) ? 'pointer-events-none opacity-40' : ''}`}
              >
                <Phone className="w-4 h-4" /> Call
              </a>
              <a
                href={waLink(contactCard.farmerContact) ?? '#'}
                target="_blank"
                rel="noreferrer"
                className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 ${!waLink(contactCard.farmerContact) ? 'pointer-events-none opacity-40' : ''}`}
              >
                <MessageSquare className="w-4 h-4" /> WhatsApp
              </a>
              <button
                onClick={() => {
                  if (contactCard.chatRoomId) navigate(`/chat?room=${encodeURIComponent(contactCard.chatRoomId)}`);
                }}
                className={`flex flex-col items-center gap-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 ${!contactCard.chatRoomId ? 'pointer-events-none opacity-40' : ''}`}
              >
                <MessageSquare className="w-4 h-4" /> Chat
              </button>
            </div>
            <p className="text-[10px] text-slate-400 text-center">
              Agrovercity does not intermediate the deal — price, payment, pickup and quality are between you two.
            </p>
          </div>
        )}
      </ModalSheet>

      <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1.5">
        <Layers className="w-3.5 h-3.5" />
        Requirements stay open while you review applications — close one manually when you have enough suppliers.
      </p>
    </div>
  );
};
