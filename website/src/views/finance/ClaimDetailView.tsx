import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ShieldAlert,
  ArrowLeft,
  MapPin,
  Camera,
  CalendarDays,
  Check,
  X,
  Banknote,
  FileText,
  ClipboardCheck,
  Flag,
  RefreshCw,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { insurance, apiErrorMessage, post } from '../../lib/api';
import { StatusBadge } from '../../components/common/StatusBadge';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency, formatDate } from '../../lib/utils';
import { str, num, arr, type Row } from './loanTypes';

type ClaimRow = Row;

const Section: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  icon,
  children,
  action,
}) => (
  <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
      <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
        <span className="text-emerald-600">{icon}</span>
        {title}
      </h3>
      {action}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Field: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
    <div className="text-sm font-semibold text-slate-800 mt-0.5">{value || '—'}</div>
  </div>
);

const PAYOUT_SIGNOFF_RUPEES = 50000;

/** Full claim case file — survey → assess → review → dual sign-off ( >₹50k ) → DBT. */
export const ClaimDetailView: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  const [claim, setClaim] = useState<ClaimRow | null>(null);
  const [surveyors, setSurveyors] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [surveyOpen, setSurveyOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [disburseOpen, setDisburseOpen] = useState(false);

  const [surveyorId, setSurveyorId] = useState('');
  const [visitDate, setVisitDate] = useState('');
  const [surveyNotes, setSurveyNotes] = useState('');
  const [assessedPct, setAssessedPct] = useState('');
  const [cropStageVerified, setCropStageVerified] = useState('');
  const [reportNotes, setReportNotes] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'reject'>('approve');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [dbtRef, setDbtRef] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      setClaim((await insurance.providerClaim(id)) as unknown as ClaimRow);
      try {
        setSurveyors(arr((await insurance.surveyors()) as unknown) as Row[]);
      } catch {
        setSurveyors([]);
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      setNotice(success);
      await load();
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!id) return null;

  const status = str(claim?.status, '');
  const timeline = arr(claim?.timeline);
  const photos = arr(claim?.damagePhotos);
  const triage = (claim?.triage ?? null) as Row | null;
  const requested = num(claim?.requestedAmount);
  const approved = num(claim?.approvedAmount);
  const needsSignoff = str(claim?.payoutApprovalStatus) === 'pending_second_signoff' || approved > PAYOUT_SIGNOFF_RUPEES;
  const defaultApproval = Math.round(requested * (num(claim?.assessedLossPercent ?? claim?.estimatedLossPercent, 100) / 100) * 100) / 100;

  const selectedSurveyor = surveyors.find((s) => str(s.id) === surveyorId);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link to="/insuranceProvider" className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-600 mb-2">
            <ArrowLeft className="w-4 h-4" /> Back to claims desk
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-3 flex-wrap">
            <ShieldAlert className="w-7 h-7 text-emerald-600" />
            Claim {str(claim?.claimNumber, id)}
            <StatusBadge status={status} />
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {str(claim?.farmerName, 'Unknown farmer')} · {str(claim?.village, '—')} · intimated {formatDate(str(claim?.submittedAt))}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {status === 'intimated' && (
            <button onClick={() => setSurveyOpen(true)}
              className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs">
              <UserCheck className="w-4 h-4" /> Schedule Survey
            </button>
          )}
          {status === 'surveyorAssigned' && (
            <button onClick={() => {
              setAssessedPct(String(num(claim?.estimatedLossPercent)));
              setReportOpen(true);
            }}
              className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs">
              <ClipboardCheck className="w-4 h-4" /> Submit Survey Report
            </button>
          )}
          {status === 'fieldAssessed' && (
            <button onClick={() => {
              setReviewAction('approve');
              setApprovedAmount(String(defaultApproval || requested));
              setReviewOpen(true);
            }}
              className="inline-flex items-center gap-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs">
              <Check className="w-4 h-4" /> Review Claim
            </button>
          )}
          {status === 'dbtApproved' && (
            <button onClick={() => {
              setDbtRef(`DBT${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${id.slice(-4).toUpperCase()}`);
              setDisburseOpen(true);
            }}
              className="inline-flex items-center gap-1 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs rounded-xl shadow-xs">
              <Banknote className="w-4 h-4" /> Disburse DBT
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3">{error}</div>
      )}
      {notice && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold rounded-2xl px-4 py-3">{notice}</div>
      )}
      {num(claim?.appealCount) > 0 && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-2xl px-4 py-3 flex items-center gap-2">
          <Flag className="w-4 h-4 shrink-0" />
          Farmer has appealed this claim {num(claim?.appealCount)}× — review the rejection reason and survey evidence carefully.
        </div>
      )}
      {claim?.fraudFlag ? (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl px-4 py-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          AI triage flagged this claim (fraud signal {num(triage?.fraudSignal)}). Field verification is mandatory before any payout.
        </div>
      ) : null}
      {needsSignoff && status !== 'disbursed' && status !== 'rejected' && (
        <div className="bg-sky-50 border border-sky-200 text-sky-800 text-xs font-semibold rounded-2xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <span className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            Payout above ₹{PAYOUT_SIGNOFF_RUPEES.toLocaleString('en-IN')} requires a second admin sign-off (SOP-15 §6.3)
            {str(claim?.payoutApprovalId) ? ` — approval ${str(claim?.payoutApprovalId)}` : ''}.
          </span>
          {approved > 0 && str(claim?.payoutApprovalStatus) !== 'pending_second_signoff' && (
            <button
              onClick={() => run(() => post(`/insurance/provider/claims/${id}/payout-approval-request`, { notes: reviewNotes || 'Second sign-off requested from console' }) as Promise<unknown>, 'Payout approval request sent to admin.')}
              disabled={busy}
              className="px-3.5 py-1.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold text-xs rounded-xl"
            >
              Request Payout Approval
            </button>
          )}
        </div>
      )}

      {loading && !claim ? (
        <div className="min-h-[30vh] flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-emerald-600 animate-spin" />
        </div>
      ) : claim ? (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Section title="Case File" icon={<FileText className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Crop" value={str(claim.cropName)} />
                <Field label="Calamity" value={str(claim.calamityType)} />
                <Field label="Date of Damage" value={formatDate(str(claim.dateOfDamage))} />
                <Field label="Crop Stage" value={str(claim.cropStage)} />
                <Field label="Estimated Loss" value={`${num(claim.estimatedLossPercent)}%`} />
                <Field label="Requested Amount" value={formatCurrency(requested)} />
                <Field label="Assessed Loss" value={claim.assessedLossPercent !== undefined ? `${num(claim.assessedLossPercent)}%` : '—'} />
                <Field label="Approved Amount" value={approved ? formatCurrency(approved) : '—'} />
                <Field label="Policy" value={str(claim.policyId)} />
                <Field
                  label="Location"
                  value={
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      {str(claim.village)}
                      {str(claim.gpsCoordinates) ? ` · ${str(claim.gpsCoordinates)}` : ''}
                    </span>
                  }
                />
                {status === 'disbursed' && (
                  <>
                    <Field label="DBT Ref" value={str(claim.dbtTransactionId)} />
                    <Field label="Disbursed At" value={formatDate(str(claim.disbursedAt))} />
                  </>
                )}
                {status === 'rejected' && <Field label="Rejection Reason" value={str(claim.rejectionReason)} />}
              </div>
              {str(claim.bankAccountLast4) && (
                <p className="mt-3 text-[11px] font-semibold text-slate-500">
                  Beneficiary account •••• {str(claim.bankAccountLast4)}
                </p>
              )}
            </Section>

            <Section title="Survey" icon={<UserCheck className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Surveyor" value={str(claim.surveyorName, '—')} />
                <Field label="Phone" value={str(claim.surveyorPhone, '—')} />
                <Field label="Visit Date" value={formatDate(str(claim.surveyorVisitDate))} />
                <Field label="Crop Stage Verified" value={str(claim.cropStageVerified, '—')} />
              </div>
              {surveyors.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Provider Roster ({surveyors.length})</span>
                  <div className="mt-1.5 space-y-1">
                    {surveyors.slice(0, 5).map((s) => (
                      <div key={str(s.id)} className="flex items-center justify-between text-xs bg-slate-50 rounded-xl px-3 py-1.5">
                        <span className="font-bold text-slate-700">{str(s.name)}</span>
                        <span className="text-slate-400 font-mono">{str(s.phone)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Section>

            <Section title={`Damage Photos (${photos.length})`} icon={<Camera className="w-4 h-4" />}>
              {photos.length === 0 ? (
                <p className="text-xs text-slate-400">No photos attached to this claim.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {photos.map((p, i) => {
                    const src = str(p);
                    const renderable = src.startsWith('http') || src.startsWith('data:');
                    return renderable ? (
                      <a key={i} href={src} target="_blank" rel="noopener noreferrer">
                        <img src={src} alt={`Damage ${i + 1}`} className="w-full h-28 object-cover rounded-xl border border-slate-200" />
                      </a>
                    ) : (
                      <div key={i} className="w-full h-28 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center text-[10px] font-mono text-slate-400 px-2 break-all overflow-hidden">
                        {src.slice(0, 42)}
                      </div>
                    );
                  })}
                </div>
              )}
            </Section>
          </div>

          <Section title="Claim Timeline" icon={<CalendarDays className="w-4 h-4" />}>
            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400">No timeline entries yet.</p>
            ) : (
              <div className="space-y-2">
                {timeline.map((t, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-800">{str(t.status)}</span>
                      <span className="text-slate-400 ml-2">{formatDate(str(t.at ?? t.timestamp))}</span>
                      {str(t.note) && <p className="text-slate-500">{str(t.note)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </>
      ) : (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm font-semibold rounded-2xl px-4 py-3">
          {error ?? 'Claim not found.'}
        </div>
      )}

      {/* Schedule survey modal */}
      <ModalSheet isOpen={surveyOpen} onClose={() => setSurveyOpen(false)} title="Schedule Field Survey" description="The farmer is notified with surveyor name, phone and visit date." maxWidth="md">
        <div className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Surveyor from roster
            <select value={surveyorId} onChange={(e) => setSurveyorId(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-emerald-200">
              <option value="">— pick a surveyor —</option>
              {surveyors.map((s) => (
                <option key={str(s.id)} value={str(s.id)}>{str(s.name)} · {str(s.phone)}</option>
              ))}
            </select>
          </label>
          {selectedSurveyor && (
            <div className="bg-slate-50 rounded-xl px-3 py-2 text-xs text-slate-600">
              Districts: {arr(selectedSurveyor.districts).map((d) => str(d)).join(', ') || '—'}
            </div>
          )}
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Visit Date
            <input value={visitDate} onChange={(e) => setVisitDate(e.target.value)} type="date" required
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Notes
            <textarea value={surveyNotes} onChange={(e) => setSurveyNotes(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <button
            disabled={busy || !selectedSurveyor || !visitDate}
            onClick={() =>
              run(
                () =>
                  insurance.scheduleSurvey(id, {
                    surveyorName: str(selectedSurveyor?.name),
                    surveyorPhone: str(selectedSurveyor?.phone),
                    surveyorVisitDate: visitDate,
                    notes: surveyNotes || undefined,
                  }) as Promise<unknown>,
                'Surveyor assigned — farmer notified.'
              ).then(() => {
                setSurveyOpen(false);
                setSurveyorId('');
                setSurveyNotes('');
              })
            }
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            Assign Surveyor
          </button>
        </div>
      </ModalSheet>

      {/* Survey report modal */}
      <ModalSheet isOpen={reportOpen} onClose={() => setReportOpen(false)} title="Submit Survey Report" description="Field assessment advances the claim to review." maxWidth="md">
        <div className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Assessed Loss %
            <input value={assessedPct} onChange={(e) => setAssessedPct(e.target.value)} type="number" min="0" max="100" step="0.1" required
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Crop Stage Verified
            <input value={cropStageVerified} onChange={(e) => setCropStageVerified(e.target.value)} placeholder="e.g. Flowering"
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Surveyor Notes
            <textarea value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} rows={3}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <button
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  insurance.submitSurveyReport(id, {
                    assessedLossPercent: Number(assessedPct),
                    cropStageVerified: cropStageVerified || undefined,
                    surveyorNotes: reportNotes || undefined,
                  }) as Promise<unknown>,
                'Survey report submitted — claim ready for review.'
              ).then(() => setReportOpen(false))
            }
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            Submit Report
          </button>
        </div>
      </ModalSheet>

      {/* Review modal */}
      <ModalSheet isOpen={reviewOpen} onClose={() => setReviewOpen(false)} title="Review Claim" description="Approve moves the claim to DBT (or dual sign-off above ₹50,000); reject notifies the farmer." maxWidth="md">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setReviewAction('approve')}
              className={`py-2 rounded-xl font-bold text-xs border ${reviewAction === 'approve' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-500 border-slate-200'}`}>
              <Check className="w-3.5 h-3.5 inline mr-1" /> Approve
            </button>
            <button onClick={() => setReviewAction('reject')}
              className={`py-2 rounded-xl font-bold text-xs border ${reviewAction === 'reject' ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-500 border-slate-200'}`}>
              <X className="w-3.5 h-3.5 inline mr-1" /> Reject
            </button>
          </div>
          {reviewAction === 'approve' ? (
            <>
              <label className="block text-[10px] font-bold text-slate-500 uppercase">
                Approved Amount ₹
                <input value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} type="number" min="1" required
                  className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
              </label>
              {Number(approvedAmount) > PAYOUT_SIGNOFF_RUPEES && (
                <p className="text-[11px] font-semibold text-sky-700 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2">
                  Above ₹{PAYOUT_SIGNOFF_RUPEES.toLocaleString('en-IN')} — approval routes to a second admin sign-off instead of instant DBT.
                </p>
              )}
            </>
          ) : (
            <label className="block text-[10px] font-bold text-slate-500 uppercase">
              Rejection Reason
              <textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} rows={2} required
                className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-200" />
            </label>
          )}
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            Notes
            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} rows={2}
              className="mt-1 w-full px-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-200" />
          </label>
          <button
            disabled={busy || (reviewAction === 'approve' ? !Number(approvedAmount) : !rejectionReason.trim())}
            onClick={() =>
              run(
                () =>
                  insurance.reviewClaim(id, {
                    action: reviewAction,
                    approvedAmount: reviewAction === 'approve' ? Number(approvedAmount) : undefined,
                    rejectionReason: reviewAction === 'reject' ? rejectionReason : undefined,
                    notes: reviewNotes || undefined,
                  }) as Promise<unknown>,
                reviewAction === 'approve' ? 'Claim approved.' : 'Claim rejected — farmer notified.'
              ).then(() => setReviewOpen(false))
            }
            className={`w-full py-2.5 font-bold text-sm rounded-xl text-white disabled:opacity-60 ${reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}>
            {busy ? 'Saving…' : reviewAction === 'approve' ? 'Approve Claim' : 'Reject Claim'}
          </button>
        </div>
      </ModalSheet>

      {/* Disburse modal */}
      <ModalSheet isOpen={disburseOpen} onClose={() => setDisburseOpen(false)} title="Disburse via DBT" description={`Releases ${formatCurrency(approved)} to the farmer's linked account.`} maxWidth="sm">
        <div className="space-y-3">
          <label className="block text-[10px] font-bold text-slate-500 uppercase">
            DBT Transaction Reference
            <input value={dbtRef} onChange={(e) => setDbtRef(e.target.value)}
              className="mt-1 w-full px-3 py-2 text-sm font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-200" />
          </label>
          <button
            disabled={busy || !dbtRef.trim()}
            onClick={() =>
              run(
                () => insurance.disburseClaim(id, { dbtTransactionId: dbtRef.trim(), notes: 'DBT released from provider console' }) as Promise<unknown>,
                'DBT disbursed — farmer notified.'
              ).then(() => setDisburseOpen(false))
            }
            className="w-full py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-60 text-white font-bold text-sm rounded-xl">
            {busy ? 'Disbursing…' : `Release ${formatCurrency(approved)}`}
          </button>
        </div>
      </ModalSheet>
    </div>
  );
};
