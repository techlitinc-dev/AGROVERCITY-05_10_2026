import React, { useCallback, useEffect, useState } from 'react';
import { Briefcase, Play, CheckCircle2, Star, Flag, RefreshCw, Clock } from 'lucide-react';
import { equipment, equipmentOwner, ratings, apiErrorMessage } from '../../lib/api';
import type { EquipmentContact } from '../../lib/api/equipment';
import { StatusBadge } from '../../components/common/StatusBadge';
import { RateUserModal } from '../../components/common/RateUserModal';
import { UserVerificationBadge } from '../../components/common/UserVerificationBadge';
import { formatCurrency } from '../../lib/utils';
import { ContactActions, ReportIssueModal } from './shared';

interface OwnerJob {
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
  equipmentName?: string;
  farmerContact?: EquipmentContact | null;
  chatRoomId?: string;
  userId?: string;
}

type JobTab = 'upcoming' | 'completed';

/** My Jobs — accepted & completed work (spec §4/§12): start/complete, contact
 * & chat after unlock, rate the farmer, report issues. */
export const EquipmentJobsView: React.FC = () => {
  const [jobs, setJobs] = useState<OwnerJob[]>([]);
  const [tab, setTab] = useState<JobTab>('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rateTarget, setRateTarget] = useState<OwnerJob | null>(null);
  const [reportTarget, setReportTarget] = useState<OwnerJob | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await equipmentOwner.ownerRequests(tab);
      setJobs(rows as unknown as OwnerJob[]);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    void load();
  }, [load]);

  const setExecution = async (job: OwnerJob, jobStatus: string) => {
    setBusyId(job.id);
    setError(null);
    try {
      await equipment.updateExecution(job.id, { jobStatus });
      setNotice(jobStatus === 'completed' ? 'Work marked completed — rate the farmer.' : 'Work started.');
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
      bookingKind: 'equipment',
      bookingId: rateTarget.id,
      stars,
      ...(review ? { comment: review } : {}),
    });
    setRateTarget(null);
    setNotice('Thanks! Your rating was recorded.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-emerald-600" />
            My Jobs
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Upcoming accepted work and completed history — contact farmers, track status, rate and report.
          </p>
        </div>
        <button onClick={() => void load()} disabled={loading} className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 self-start sm:self-auto">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      <div className="flex bg-slate-100 p-1 rounded-2xl overflow-x-auto no-scrollbar gap-1 self-start">
        {(
          [
            ['upcoming', 'Upcoming'],
            ['completed', 'Completed'],
          ] as [JobTab, string][]
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
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">Loading jobs…</div>
      ) : jobs.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200 space-y-2">
          <Briefcase className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-bold">{tab === 'upcoming' ? 'No upcoming jobs' : 'No completed jobs yet'}</p>
          <p className="text-xs text-slate-400">
            {tab === 'upcoming' ? 'Accepted requests appear here.' : 'Completed work appears here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <div key={j.id} className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5 max-w-xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-sm text-slate-900">{j.farmerName || 'Farmer'}</span>
                  <UserVerificationBadge verified={j.farmerVerified} label="Verified Farmer" />
                  <StatusBadge status={j.status === 'booked' ? 'accepted' : j.status} />
                </div>
                <p className="text-xs text-slate-700">
                  <strong>{j.equipmentName}</strong> · {j.workType || 'Farm work'}
                  {j.workQuantity ? ` · ${j.workQuantity} ${j.workUnit ?? ''}` : ''}
                </p>
                <p className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> {j.date} · {j.slotName}
                  {j.priceRupees ? ` · listed ${formatCurrency(j.priceRupees)} (indicative)` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 self-end md:self-center flex-wrap">
                {j.farmerContact && <ContactActions contact={j.farmerContact} chatRoomId={j.chatRoomId} />}
                {j.status === 'booked' && (
                  <button
                    onClick={() => void setExecution(j, 'work_started')}
                    disabled={busyId === j.id}
                    className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                  >
                    <Play className="w-3 h-3" /> Start Work
                  </button>
                )}
                {j.status === 'in_progress' && (
                  <button
                    onClick={() => void setExecution(j, 'completed')}
                    disabled={busyId === j.id}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-3 h-3" /> Complete Work
                  </button>
                )}
                {j.status === 'completed' && (
                  <>
                    <button
                      onClick={() => setRateTarget(j)}
                      className="px-3 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] flex items-center gap-1"
                    >
                      <Star className="w-3 h-3" /> Rate farmer
                    </button>
                    <button
                      onClick={() => setReportTarget(j)}
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

      <RateUserModal
        open={Boolean(rateTarget)}
        onClose={() => setRateTarget(null)}
        title="Rate the farmer"
        subtitle={rateTarget ? `${rateTarget.farmerName ?? 'Farmer'} · ${rateTarget.date ?? ''}` : undefined}
        submitLabel="Submit Rating"
        onSubmit={submitRating}
      />
      <ReportIssueModal
        open={Boolean(reportTarget)}
        onClose={() => setReportTarget(null)}
        targetUserId={reportTarget?.userId ?? ''}
        bookingId={reportTarget?.id}
        onReported={() => setNotice('Issue reported — moderation will review it.')}
      />
    </div>
  );
};
