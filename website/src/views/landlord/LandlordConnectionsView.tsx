import React, { useCallback, useEffect, useState } from 'react';
import { Handshake, Star, Flag, RefreshCw, Clock, BadgeCheck, Home } from 'lucide-react';
import { land, ratings, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RateUserModal } from '../../components/common/RateUserModal';
import { UserVerificationBadge } from '../../components/common/UserVerificationBadge';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { LandContactActions, LandContact, LandOutcomeModal, LandReportModal, NegotiationChecklist } from '../land/shared';

interface ConnectionRow {
  id: string;
  status: string;
  farmerName?: string;
  farmerId?: string;
  farmerVerified?: boolean;
  listingId?: string;
  listingVillage?: string;
  listingAreaAcres?: number;
  durationMonths?: number;
  proposedStartDate?: string | null;
  intendedCrop?: string;
  offeredRentRupees?: number | null;
  offeredRentUnit?: string;
  createdAt?: string;
  contactRevealedAt?: string | null;
  farmerContact?: LandContact | null;
  chatRoomId?: string;
  outcome?: { outcome?: string; finalRentRupees?: number | null; reportedAt?: string } | null;
}

type ConnTab = 'contacted' | 'dealDone' | 'closed' | 'all';
const GROUPS: Record<Exclude<ConnTab, 'all'>, string[]> = {
  contacted: ['contacted'],
  dealDone: ['dealDone'],
  closed: ['dismissed', 'withdrawn', 'rejected'],
};

const STATUS_LABEL: Record<string, string> = {
  contacted: 'In contact',
  dealDone: 'Lease completed',
  dismissed: 'Did not happen',
  withdrawn: 'Withdrawn',
  rejected: 'Declined',
};

/** My Connections / Leases — contacted farmers, outcomes, ratings, issues,
 * and the landlord-only "mark leased" action (spec §4/§12/§13). */
export const LandlordConnectionsView: React.FC = () => {
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [listings, setListings] = useState<{ id: string; village: string; status: string }[]>([]);
  const [tab, setTab] = useState<ConnTab>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [outcomeTarget, setOutcomeTarget] = useState<ConnectionRow | null>(null);
  const [rateTarget, setRateTarget] = useState<ConnectionRow | null>(null);
  const [reportTarget, setReportTarget] = useState<ConnectionRow | null>(null);
  const [leaseTarget, setLeaseTarget] = useState<{ listingId: string; village: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rows, mine] = await Promise.all([land.leaseRequests(), land.myListings().catch(() => [])]);
      const all = rows as unknown as ConnectionRow[];
      all.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setConnections(all);
      setListings(
        ((mine as unknown as { id: string; village: string; status: string }[]) ?? []).map((l) => ({
          id: l.id,
          village: l.village,
          status: l.status,
        })),
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

  const grouped = tab === 'all' ? connections : connections.filter((c) => GROUPS[tab].includes(c.status));

  const markLeased = async () => {
    if (!leaseTarget) return;
    setBusyId(leaseTarget.listingId);
    setError(null);
    try {
      await land.updateListing(leaseTarget.listingId, { status: 'leased' } as never);
      setNotice(`${leaseTarget.village} marked leased — new interest is closed.`);
      setLeaseTarget(null);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const submitRating = async (stars: number, review: string) => {
    if (!rateTarget) return;
    await ratings.submit({
      bookingKind: 'land_lease',
      bookingId: rateTarget.id,
      stars,
      ...(review ? { comment: review } : {}),
    });
    setRateTarget(null);
    setNotice('Thanks! Your rating was recorded.');
  };

  const openListings = listings.filter((l) => l.status === 'open');

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Handshake className="w-7 h-7 text-emerald-600" />
            My Connections / Leases
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Farmers you are in touch with, user-reported outcomes, and the controls to close a listing after
            you finalize directly.
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          {openListings.length > 0 && (
            <button
              onClick={() => setLeaseTarget({ listingId: openListings[0].id, village: openListings[0].village })}
              className="px-3.5 py-2 rounded-xl border border-sky-200 text-sky-700 hover:bg-sky-50 font-bold text-xs flex items-center gap-1.5"
            >
              <Home className="w-3.5 h-3.5" /> Mark Land Leased
            </button>
          )}
          <button onClick={() => void load()} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50" title="Refresh">
            <RefreshCw className={`w-4 h-4 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {(
          [
            ['all', 'All'],
            ['contacted', 'Contacted'],
            ['dealDone', 'Deal Completed'],
            ['closed', 'Closed'],
          ] as [ConnTab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              tab === id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
            }`}
          >
            {label}
          </button>
        ))}
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
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading connections…</div>
      ) : grouped.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
          <Handshake className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold">No connections yet</p>
          <p className="text-xs text-slate-400">Accept a contact request from Interest Requests to start connecting.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {grouped.map((c) => (
            <div key={c.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-slate-900">{c.farmerName || 'Farmer'}</span>
                  <UserVerificationBadge verified={c.farmerVerified} label="Verified Farmer" />
                  <StatusBadge status={STATUS_LABEL[c.status] ?? c.status} />
                </div>
                <p className="text-xs text-slate-600">
                  <strong>{c.listingAreaAcres ? `${c.listingAreaAcres} acres · ` : ''}{c.listingVillage || 'Farmland'}</strong>
                  {' · '}{c.durationMonths ? `${c.durationMonths} months` : ''}
                  {c.intendedCrop ? ` · ${c.intendedCrop}` : ''}
                  {c.offeredRentRupees ? ` · offered ${formatCurrency(c.offeredRentRupees)}` : ''}
                </p>
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDateTime(c.createdAt ?? '')}
                </p>
                {c.outcome?.finalRentRupees ? (
                  <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                    <BadgeCheck className="w-3 h-3" /> Reported closed at {formatCurrency(c.outcome.finalRentRupees)} (user-reported)
                  </p>
                ) : null}
              </div>
              <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                {c.farmerContact && <LandContactActions contact={c.farmerContact} chatRoomId={c.chatRoomId} />}
                {(c.status === 'contacted' || c.status === 'dealDone' || c.status === 'dismissed') && (
                  <button
                    onClick={() => setOutcomeTarget(c)}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px]"
                  >
                    Update Outcome
                  </button>
                )}
                {c.status === 'dealDone' && (
                  <>
                    <button
                      onClick={() => setRateTarget(c)}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" /> Rate farmer
                    </button>
                    <button
                      onClick={() => setReportTarget(c)}
                      className="px-2.5 py-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 font-bold text-[10px] flex items-center gap-1"
                    >
                      <Flag className="w-3 h-3" /> Report
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <NegotiationChecklist />

      {/* Mark leased — landlord-only */}
      <LandOutcomeModal
        open={Boolean(outcomeTarget)}
        onClose={() => setOutcomeTarget(null)}
        requestId={outcomeTarget?.id ?? null}
        allowWithdraw={false}
        onSaved={() => {
          setNotice('Outcome updated.');
          void load();
        }}
      />
      <RateUserModal
        open={Boolean(rateTarget)}
        onClose={() => setRateTarget(null)}
        title="Rate the farmer"
        subtitle={rateTarget ? `${rateTarget.farmerName ?? 'Farmer'} · ${rateTarget.listingVillage ?? ''}` : undefined}
        submitLabel="Submit Rating"
        onSubmit={submitRating}
      />
      <LandReportModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetUserId={reportTarget?.farmerId ?? ''}
        requestId={reportTarget?.id}
        onReported={() => setNotice('Issue reported — moderation will review it.')}
      />

      {/* Lease-target picker */}
      {/* (uses first open listing via header button; simple single-step flow) */}
      {leaseTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => setLeaseTarget(null)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-black text-slate-900">Mark land leased</h3>
            <p className="text-xs text-slate-500">
              Choose the listing that is leased. New interest closes; existing connections stay in this page.
            </p>
            <select
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              value={leaseTarget.listingId}
              onChange={(e) => {
                const l = openListings.find((x) => x.id === e.target.value);
                if (l) setLeaseTarget({ listingId: l.id, village: l.village });
              }}
            >
              {openListings.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.village} ({l.status})
                </option>
              ))}
            </select>
            <button
              onClick={() => void markLeased()}
              disabled={busyId === leaseTarget.listingId}
              className="w-full py-3 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
            >
              {busyId === leaseTarget.listingId ? 'Saving…' : 'Confirm — Mark Leased'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
