import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ShieldAlert,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Gavel,
  MapPin,
  Calendar,
} from 'lucide-react';
import { insurance, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { CropInsuranceClaim } from '../../types';

const CLAIM_STAGES = ['intimated', 'surveyor_assigned', 'survey_completed', 'dbt_approved', 'settled'];

export const ClaimTrackerView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [claim, setClaim] = useState<CropInsuranceClaim | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [appealModalOpen, setAppealModalOpen] = useState(false);
  const [appealReason, setAppealReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    setLoading(true);
    insurance
      .claim(id)
      .then((res) => active && setClaim(res))
      .catch((e) => active && setError(apiErrorMessage(e)))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  const handleAppeal = async () => {
    if (!id) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await insurance.appealClaim(id, { reason: appealReason });
      setClaim((prev) => (prev ? { ...prev, ...updated } : updated));
      setAppealModalOpen(false);
      setAppealReason('');
      setNotice('Appeal submitted. The nodal officer will re-verify your claim.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const currentIndex = claim ? CLAIM_STAGES.indexOf(claim.status) : -1;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/farmer/insurance')}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
            title="Back to insurance desk"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="w-7 h-7 text-emerald-600" />
              Claim Tracker #{id}
            </h1>
            <p className="text-xs text-slate-500 mt-1">PMFBY claim lifecycle, surveyor visits and DBT status</p>
          </div>
        </div>
        {claim && <StatusBadge status={claim.status} />}
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-semibold text-rose-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <span>{notice}</span>
          <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {loading || !claim ? (
        <div className="py-10 text-center text-xs font-bold text-slate-400 animate-pulse">
          Loading claim…
        </div>
      ) : (
        <>
          {/* Claim summary */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Crop</span>
                <p className="font-extrabold text-slate-900 mt-0.5">{claim.crop}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Calamity</span>
                <p className="font-extrabold text-slate-900 mt-0.5">{claim.calamityType}</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Damage</span>
                <p className="font-extrabold text-rose-700 mt-0.5">{claim.damagePercentage}%</p>
              </div>
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                <span className="text-slate-400 text-[10px] uppercase font-bold">Estimated DBT</span>
                <p className="font-extrabold text-emerald-700 mt-0.5">{formatCurrency(claim.estimatedLossAmount)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-500">
              <p className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-600" /> {claim.surveyNumber} • Policy {claim.policyNumber}
              </p>
              <p className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" /> Calamity on {formatDate(claim.calamityDate)} • Intimated {formatDate(claim.createdAt)}
              </p>
            </div>

            {claim.photos.length > 0 && (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-slate-400 font-medium">Field Photos:</span>
                <div className="flex gap-2">
                  {claim.photos.map((src, i) => (
                    <img key={i} src={src} alt="Crop damage" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-xs space-y-4">
            <h3 className="font-bold text-sm text-slate-900">Claim Timeline</h3>
            {claim.status === 'rejected' ? (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-900 space-y-3">
                <div className="flex items-center gap-2 font-bold">
                  <Gavel className="w-4 h-4 text-rose-600" /> Claim rejected at verification
                </div>
                <p>
                  If you disagree with the assessment, file an appeal with additional evidence. Escalation goes to the
                  district-level grievance officer.
                </p>
                <button
                  onClick={() => setAppealModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs"
                >
                  File Appeal
                </button>
              </div>
            ) : (
              <ol className="relative border-l border-slate-200 ml-3 space-y-6">
                {CLAIM_STAGES.map((stage, idx) => {
                  const reached = currentIndex >= idx;
                  const isCurrent = currentIndex === idx;
                  return (
                    <li key={stage} className="ml-6">
                      <span
                        className={`absolute flex items-center justify-center w-6 h-6 rounded-full -left-3 ring-4 ring-white ${
                          reached ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {reached ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3 h-3" />}
                      </span>
                      <div>
                        <h4 className={`text-xs font-extrabold capitalize ${reached ? 'text-slate-900' : 'text-slate-400'}`}>
                          {stage.replace(/_/g, ' ')}
                          {isCurrent && <span className="ml-2 text-[9px] font-black text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">CURRENT</span>}
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          {stage === 'intimated' && 'Loss intimation received within 72 hours.'}
                          {stage === 'surveyor_assigned' && 'State-appointed surveyor visits the plot.'}
                          {stage === 'survey_completed' && 'Joint survey report with damage photos uploaded.'}
                          {stage === 'dbt_approved' && 'Compensation approved; DBT initiated to your bank account.'}
                          {stage === 'settled' && 'Amount credited. Claim closed.'}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </>
      )}

      {/* Appeal modal */}
      <ModalSheet
        isOpen={appealModalOpen}
        onClose={() => setAppealModalOpen(false)}
        title="File Claim Appeal"
        description="Escalate to the district grievance officer with your reason"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Appeal Reason</label>
            <textarea
              rows={4}
              value={appealReason}
              onChange={(e) => setAppealReason(e.target.value)}
              placeholder="e.g. Actual damage is ~60% as per village sarpanch report; survey assessed only 25%…"
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            onClick={handleAppeal}
            disabled={busy || !appealReason.trim()}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {busy ? 'Submitting…' : 'Submit Appeal'}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
