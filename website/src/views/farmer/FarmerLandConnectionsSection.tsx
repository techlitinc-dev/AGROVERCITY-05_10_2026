import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Clock,
  Flag,
  Megaphone,
  MessageSquare,
  Mountain,
  RefreshCw,
  Star,
  XCircle,
} from 'lucide-react';
import { land, ratings, apiErrorMessage } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RateUserModal } from '../../components/common/RateUserModal';
import { UserVerificationBadge } from '../../components/common/UserVerificationBadge';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import {
  LandContact,
  LandContactActions,
  LandOutcomeModal,
  LandReportModal,
  NegotiationChecklist,
} from '../land/shared';

interface LeaseRequestRow {
  id: string;
  status: string;
  listingId?: string;
  listingVillage?: string;
  listingDistrict?: string;
  listingAreaAcres?: number;
  durationMonths?: number;
  proposedStartDate?: string | null;
  intendedCrop?: string;
  offeredRentRupees?: number | null;
  offeredRentUnit?: string;
  counterRentRupees?: number | null;
  landlordNotes?: string;
  message?: string;
  createdAt?: string;
  landlordId?: string;
  landlordName?: string;
  landlordVerified?: boolean;
  landVerified?: boolean;
  landlordContact?: LandContact | null;
  chatRoomId?: string;
  outcome?: { outcome?: string; finalRentRupees?: number | null } | null;
  reason?: string;
}

interface RequirementResponse {
  id: string;
  landlordId?: string;
  landlordName?: string;
  landlordVerified?: boolean;
  message?: string;
  chatRoomId?: string;
  createdAt?: string;
}

interface RequirementRow {
  id: string;
  status?: string;
  areaAcres?: number;
  district?: string;
  durationMonths?: number;
  intendedCrop?: string;
  maxRentPerAcrePerYear?: number;
  neededFrom?: string;
  createdAt?: string;
  responses?: RequirementResponse[];
}

const STATUS_LABEL: Record<string, string> = {
  pending: 'Requested',
  contacted: 'In contact',
  countered: 'Landlord countered',
  dealDone: 'Lease completed',
  dismissed: 'Did not happen',
  withdrawn: 'Withdrawn',
  rejected: 'Declined',
};

/** Farm-land connections shown inside the farmer's My Connections page —
 * interest requests sent on landlord listings plus landlord responses to the
 * farmer's posted land requirements. Mirrors the landlord-side
 * "My Connections / Leases" view (LandlordConnectionsView). Renders nothing
 * when the farmer has no land activity so the page is unchanged for everyone
 * else. */
export const FarmerLandConnectionsSection: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<LeaseRequestRow[]>([]);
  const [requirements, setRequirements] = useState<RequirementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [outcomeTarget, setOutcomeTarget] = useState<LeaseRequestRow | null>(null);
  const [rateTarget, setRateTarget] = useState<LeaseRequestRow | null>(null);
  const [reportTarget, setReportTarget] = useState<LeaseRequestRow | null>(null);

  const respondedRequirements = requirements.filter((q) => (q.responses ?? []).length > 0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, reqs] = await Promise.all([land.myLeaseRequests(), land.myRequirements()]);
      setRequests((mine as unknown as LeaseRequestRow[]) ?? []);
      setRequirements((reqs as unknown as RequirementRow[]) ?? []);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!loading && !error && requests.length === 0 && respondedRequirements.length === 0) {
    return null;
  }

  const withdraw = async (r: LeaseRequestRow) => {
    setBusyId(r.id);
    setError(null);
    try {
      await land.recordOutcome(r.id, { outcome: 'withdrawn' });
      setNotice('Interest request withdrawn.');
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Mountain className="w-4 h-4 text-emerald-600" /> Farm Land / जमीन भाडे
        </h2>
        <button
          onClick={() => void load()}
          className="p-1.5 rounded-xl border border-slate-200 hover:bg-slate-50"
          title="Refresh land connections"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {notice && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading land connections…
        </div>
      ) : (
        <div className="space-y-3">
          {/* Landlord responses to the farmer's posted land requirements. */}
          {respondedRequirements.map((q) =>
            (q.responses ?? []).map((resp) => (
              <div
                key={resp.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5 max-w-xl">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-extrabold text-sm text-slate-900">
                      {resp.landlordName || 'Landlord'}
                    </span>
                    {resp.landlordVerified ? (
                      <span className="text-[9px] font-bold text-sky-700 bg-sky-50 border border-sky-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                        <BadgeCheck className="w-2.5 h-2.5" /> Verified
                      </span>
                    ) : null}
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-amber-50 border-amber-200 text-amber-700">
                      Responded to your request
                    </span>
                  </div>
                  <p className="text-xs text-slate-600">
                    <Megaphone className="w-3 h-3 inline mr-1 text-slate-400" />
                    You need {q.areaAcres ?? '—'} acres · {q.district || '—'}
                    {q.durationMonths ? ` · ${q.durationMonths} months` : ''}
                    {q.intendedCrop ? ` · ${q.intendedCrop}` : ''}
                  </p>
                  {resp.message ? (
                    <p className="text-[11px] text-slate-500 italic">“{resp.message}”</p>
                  ) : null}
                  <p className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {formatDateTime(resp.createdAt ?? '')}
                  </p>
                </div>
                {resp.chatRoomId ? (
                  <button
                    onClick={() => navigate(`/chat?room=${encodeURIComponent(resp.chatRoomId!)}`)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 self-start md:self-center"
                  >
                    <MessageSquare className="w-3 h-3" /> Chat with landlord
                  </button>
                ) : null}
              </div>
            )),
          )}

          {/* Interest requests the farmer sent on landlord listings. */}
          {requests.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-slate-900">
                    {r.listingAreaAcres ? `${r.listingAreaAcres} acres · ` : ''}
                    {r.listingVillage || 'Farmland'}
                  </span>
                  {r.landlordName ? (
                    <span className="text-xs font-semibold text-slate-500">— {r.landlordName}</span>
                  ) : null}
                  <UserVerificationBadge verified={r.landlordVerified} label="Verified Landlord" />
                  {r.landVerified && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5">
                      <BadgeCheck className="w-2.5 h-2.5" /> Land Docs Verified
                    </span>
                  )}
                  <StatusBadge status={STATUS_LABEL[r.status] ?? r.status} />
                </div>
                <p className="text-xs text-slate-600 flex items-center gap-1 flex-wrap">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {r.durationMonths ? `${r.durationMonths} months` : ''}
                  {r.proposedStartDate ? ` · from ${r.proposedStartDate}` : ''}
                  {r.intendedCrop ? ` · ${r.intendedCrop}` : ''}
                  {r.offeredRentRupees ? ` · offered ${formatCurrency(r.offeredRentRupees)}` : ''}
                </p>
                {r.status === 'countered' && r.counterRentRupees ? (
                  <p className="text-[11px] text-sky-700 font-bold">
                    Landlord proposed {formatCurrency(r.counterRentRupees)}
                    {r.landlordNotes ? ` — “${r.landlordNotes}”` : ''}
                  </p>
                ) : null}
                {r.message && <p className="text-[11px] text-slate-500 italic">“{r.message}”</p>}
                {r.outcome?.finalRentRupees ? (
                  <p className="text-[10px] text-emerald-700 font-bold">
                    Reported closed at {formatCurrency(r.outcome.finalRentRupees)}
                    {r.offeredRentUnit === 'totalPerYear' ? '/year total' : '/acre/year'} (user-reported)
                  </p>
                ) : null}
                {r.reason ? <p className="text-[10px] text-rose-600">Declined: {r.reason}</p> : null}
                <p className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {formatDateTime(r.createdAt ?? '')}
                </p>
              </div>
              <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                {r.landlordContact && (
                  <LandContactActions contact={r.landlordContact} chatRoomId={r.chatRoomId} />
                )}
                {r.status === 'pending' && (
                  <button
                    onClick={() => void withdraw(r)}
                    disabled={busyId === r.id}
                    className="px-3 py-2 rounded-xl border border-rose-200 text-rose-600 hover:bg-rose-50 font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                  >
                    <XCircle className="w-3 h-3" /> Withdraw
                  </button>
                )}
                {(r.status === 'contacted' || r.status === 'dealDone' || r.status === 'dismissed') && (
                  <button
                    onClick={() => setOutcomeTarget(r)}
                    className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-[10px]"
                  >
                    Update Outcome
                  </button>
                )}
                {r.status === 'dealDone' && (
                  <>
                    <button
                      onClick={() => setRateTarget(r)}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" /> Rate landlord
                    </button>
                    <button
                      onClick={() => setReportTarget(r)}
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

      <LandOutcomeModal
        open={Boolean(outcomeTarget)}
        onClose={() => setOutcomeTarget(null)}
        requestId={outcomeTarget?.id ?? null}
        allowWithdraw
        onSaved={() => {
          setNotice('Outcome updated.');
          void load();
        }}
      />
      <RateUserModal
        open={Boolean(rateTarget)}
        onClose={() => setRateTarget(null)}
        title="Rate the landlord"
        subtitle={
          rateTarget ? `${rateTarget.listingVillage ?? 'Farmland'} — one rating per connection` : undefined
        }
        submitLabel="Submit Rating"
        onSubmit={submitRating}
      />
      <LandReportModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetUserId={reportTarget?.landlordId ?? ''}
        requestId={reportTarget?.id}
        onReported={() => setNotice('Issue reported — moderation will review it.')}
      />
    </div>
  );
};
