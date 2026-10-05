import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  fmtRupees,
  getProviderClaim,
  reviewClaim,
  submitSurveyReport,
  type InsuranceClaim,
} from '../../lib/api/insurance';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import ClaimFarmMap from './components/ClaimFarmMap';
import InsEmptyState from './components/InsEmptyState';
import InsStatusChip from './components/InsStatusChip';
import SlaClock from './components/SlaClock';
import './insurance.css';

/**
 * Provider claim detail — courier-style timeline, farm map + crop-cycle
 * context, and the geo-tagged photo evidence viewer. Also hosts the human
 * decision actions the lifecycle needs: survey report, approve and reject.
 */

const STAGES = ['intimated', 'surveyorAssigned', 'fieldAssessed', 'dbtApproved', 'disbursed'];

export default function ClaimDetailPage() {
  const t = useT();
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId: string }>();
  const user = useSessionStore((s) => s.user);
  useEnsureProfile('insuranceProvider');

  const [claim, setClaim] = useState<InsuranceClaim | null>(null);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);

  const [lossPercent, setLossPercent] = useState('');
  const [surveyNotes, setSurveyNotes] = useState('');
  const [approvedAmount, setApprovedAmount] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(() => {
    if (!claimId) return;
    setFailed(false);
    getProviderClaim(claimId)
      .then(setClaim)
      .catch((e) => {
        if (isApiError(e) && (e.status === 404 || e.code === 'CLAIM_NOT_FOUND')) setNotFound(true);
        else setFailed(true);
      });
  }, [claimId]);

  useEffect(load, [load]);

  const act = async (fn: () => Promise<InsuranceClaim>, successKey: string) => {
    setBusy(true);
    try {
      const updated = await fn();
      setClaim(updated);
      toast(t(successKey));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const submitReport = () => {
    if (!claimId) return;
    const percent = Number(lossPercent);
    if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
      toast(t('insLossPercentInvalid'), { error: true });
      return;
    }
    void act(
      () =>
        submitSurveyReport(claimId, {
          assessedLossPercent: percent,
          surveyorNotes: surveyNotes || undefined,
        }),
      'insSurveyReportSaved'
    );
  };

  const approve = () => {
    if (!claimId) return;
    const amount = approvedAmount.trim() === '' ? undefined : Number(approvedAmount);
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0)) {
      toast(t('insAmountInvalid'), { error: true });
      return;
    }
    void act(() => reviewClaim(claimId, { action: 'approve', approvedAmount: amount, notes: reviewNotes || undefined }), 'insClaimApproved');
  };

  const reject = () => {
    if (!claimId) return;
    if (rejectReason.trim().length < 5) {
      toast(t('insRejectReasonRequired'), { error: true });
      return;
    }
    void act(() => reviewClaim(claimId, { action: 'reject', rejectionReason: rejectReason, notes: reviewNotes || undefined }), 'insClaimRejected');
  };

  if (notFound) {
    return (
      <ToolShell toolId="insuranceProviderHome" backTo="/insurance/console/claims">
        <InsEmptyState
          icon="🔍"
          titleKey="insClaimNotFound"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/insurance/console/claims')}>
              ← {t('insQaClaims')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  const timelineAt = (status: string): { at: string; note: string } | null => {
    if (!claim) return null;
    const entry = [...claim.timeline].reverse().find((step) => step.status === status);
    return entry ? { at: entry.at, note: entry.note } : null;
  };

  const fmtTs = (iso: string): string => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN');
  };

  const canAssess = claim?.status === 'surveyorAssigned';
  const canReview = claim?.status === 'intimated' || claim?.status === 'surveyorAssigned' || claim?.status === 'fieldAssessed';

  return (
    <ToolShell toolId="insuranceProviderHome" backTo="/insurance/console/claims">
      <div className="ins-wrap">
        {failed ? (
          <InsEmptyState
            icon="📡"
            titleKey="insLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {claim === null && !failed ? <p className="ins-hint">{t('commonLoading')}</p> : null}

        {claim ? (
          <>
            <div className="ins-card" style={{ marginTop: 12 }}>
              <div className="ins-card-row">
                <span className="ins-card-title">{claim.claimNumber}</span>
                <InsStatusChip status={claim.status} />
              </div>
              <span className="ins-card-sub">
                {claim.farmerName || t('insFarmer')} · {claim.farmerDistrict || claim.village}
              </span>
              {claim.farmerPhone ? <span className="ins-card-sub">{claim.farmerPhone}</span> : null}
              <div className="ins-card-row">
                <span className="ins-card-sub">
                  {t('insRequestedAmount')}: {fmtRupees(claim.requestedAmount)}
                </span>
                <SlaClock fromIso={claim.submittedAt} />
              </div>
              {claim.approvedAmount ? (
                <span className="ins-card-amount">
                  {t('insApprovedAmount')}: {fmtRupees(claim.approvedAmount)}
                </span>
              ) : null}
              {claim.rejectionReason ? (
                <span className="ins-card-sub">❌ {claim.rejectionReason}</span>
              ) : null}
            </div>

            {claim.triage ? (
              <div className="ins-section">
                <span className="ins-section-title">🤖 {t('insTriageTitle')}</span>
                <div className="ins-chip-row">
                  <span className="ins-pill">
                    {t('insTriageCompleteness')}: {Math.round((claim.triage.completeness || 0) * 100)}%
                  </span>
                  <span
                    className="ins-pill"
                    style={
                      claim.triage.photoQuality === 'poor'
                        ? { color: '#b45309', borderColor: '#fcd34d', background: '#fef3c7' }
                        : { color: '#15803d', borderColor: '#86efac', background: '#dcfce7' }
                    }
                  >
                    {claim.triage.photoQuality === 'poor' ? t('insTriagePoor') : t('insTriageOk')}
                  </span>
                  {claim.fraudFlag ? (
                    <span
                      className="ins-pill"
                      style={{ color: '#b91c1c', borderColor: '#fca5a5', background: '#fee2e2' }}
                    >
                      ⚠ {t('insTriageFraudFlag')}
                    </span>
                  ) : null}
                </div>
                {claim.triage.triageReasons && claim.triage.triageReasons.length > 0 ? (
                  <ul className="ins-overlay-list">
                    {claim.triage.triageReasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="ins-hint">
                  {t('insTriageSuggestedSurveyor')}:{' '}
                  {claim.triage.suggestedSurveyor || t('insTriageNoSuggestion')}
                </p>
              </div>
            ) : null}

            <div className="ins-section">
              <span className="ins-section-title">🌾 {t('insCropContext')}</span>
              <div className="ins-stats-grid">
                <div className="ins-stat">
                  <div className="ins-stat-label">{t('insCrop')}</div>
                  <div className="ins-stat-value" style={{ fontSize: 16 }}>
                    {claim.cropName}
                  </div>
                </div>
                <div className="ins-stat">
                  <div className="ins-stat-label">{t('insCropStage')}</div>
                  <div className="ins-stat-value" style={{ fontSize: 16 }}>
                    {claim.cropStage}
                  </div>
                </div>
                <div className="ins-stat">
                  <div className="ins-stat-label">{t('insCalamity')}</div>
                  <div className="ins-stat-value" style={{ fontSize: 16 }}>
                    {claim.calamityType}
                  </div>
                </div>
                <div className="ins-stat">
                  <div className="ins-stat-label">{t('insDateOfDamage')}</div>
                  <div className="ins-stat-value" style={{ fontSize: 16 }}>
                    {claim.dateOfDamage}
                  </div>
                </div>
              </div>
              {typeof claim.assessedLossPercent === 'number' ? (
                <p className="ins-hint">
                  {t('insAssessedLoss')}: {claim.assessedLossPercent}%
                </p>
              ) : null}
              <div className="ins-chip-row">
                <span className="ins-coords-chip">📍 {claim.gpsCoordinates}</span>
                <span className="ins-coords-chip">🗺️ {claim.village}</span>
              </div>
              <ClaimFarmMap gpsCoordinates={claim.gpsCoordinates} boundaryPoints={user?.farmBoundaryPoints ?? []} />
            </div>

            <div className="ins-section">
              <span className="ins-section-title">🛰️ {t('insPhotoEvidence')}</span>
              {claim.damagePhotos.length === 0 ? (
                <InsEmptyState icon="📷" titleKey="insNoPhotos" />
              ) : (
                <div className="ins-photo-grid">
                  {claim.damagePhotos.map((photo) => (
                    <figure key={photo} className="ins-photo">
                      <img src={photo} alt={t('insPhotoEvidence')} loading="lazy" />
                      <figcaption className="ins-photo-meta">
                        <span className="ins-coords-chip">📍 {claim.gpsCoordinates}</span>
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </div>

            <div className="ins-section">
              <span className="ins-section-title">🚚 {t('insTimeline')}</span>
              <div className="ins-timeline">
                {STAGES.map((stage, index) => {
                  const hit = timelineAt(stage);
                  const done = hit !== null;
                  const isCurrent = !done && claim.status === stage;
                  const stateClass = done ? 'done' : isCurrent ? 'current' : 'pending';
                  return (
                    <div key={stage} className="ins-timeline-step">
                      <div className="ins-timeline-rail">
                        <span className={`ins-timeline-dot ${done ? 'done' : isCurrent ? 'current' : ''}`} />
                        {index < STAGES.length - 1 ? (
                          <span className={`ins-timeline-line ${done ? 'done' : ''}`} />
                        ) : null}
                      </div>
                      <div className={`ins-timeline-body ${stateClass}`}>
                        <div className="ins-timeline-title">{t(`ins_status_${stage}`)}</div>
                        <div className="ins-timeline-time">{hit ? fmtTs(hit.at) : t('insStagePending')}</div>
                        {hit && hit.note ? <div className="ins-timeline-note">{hit.note}</div> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              {claim.status === 'rejected' ? (
                <div className="ins-timeline-step">
                  <div className="ins-timeline-rail">
                    <span className="ins-timeline-dot rejected" />
                  </div>
                  <div className="ins-timeline-body">
                    <div className="ins-timeline-title" style={{ color: 'var(--av-error, #dc2626)' }}>
                      {t('ins_status_rejected')}
                    </div>
                    {timelineAt('rejected') ? (
                      <div className="ins-timeline-time">{fmtTs(timelineAt('rejected')?.at ?? '')}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {canAssess ? (
              <div className="ins-section">
                <span className="ins-section-title">📝 {t('insSurveyReport')}</span>
                <div className="ins-form">
                  <div className="av-field">
                    <label className="av-label">{t('insAssessedLossPercent')}</label>
                    <input
                      className="av-input"
                      type="number"
                      min={0}
                      max={100}
                      value={lossPercent}
                      onChange={(e) => setLossPercent(e.target.value)}
                    />
                  </div>
                  <div className="av-field">
                    <label className="av-label">{t('insSurveyNotes')}</label>
                    <textarea
                      className="av-input"
                      rows={3}
                      value={surveyNotes}
                      onChange={(e) => setSurveyNotes(e.target.value)}
                    />
                  </div>
                  <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={submitReport}>
                    {busy ? <span className="av-spinner" /> : t('insSaveSurveyReport')}
                  </button>
                </div>
              </div>
            ) : null}

            {canReview ? (
              <div className="ins-section">
                <span className="ins-section-title">✅ {t('insDecision')}</span>
                <div className="ins-form">
                  <div className="av-field">
                    <label className="av-label">{t('insApprovedAmountOptional')}</label>
                    <input
                      className="av-input"
                      type="number"
                      min={0}
                      value={approvedAmount}
                      onChange={(e) => setApprovedAmount(e.target.value)}
                    />
                  </div>
                  <div className="av-field">
                    <label className="av-label">{t('insReviewNotes')}</label>
                    <textarea
                      className="av-input"
                      rows={2}
                      value={reviewNotes}
                      onChange={(e) => setReviewNotes(e.target.value)}
                    />
                  </div>
                  <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={approve}>
                    {t('insApproveClaim')}
                  </button>
                  <div className="av-field">
                    <label className="av-label">{t('insRejectReason')}</label>
                    <input
                      className="av-input"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                    />
                  </div>
                  <button type="button" className="av-btn av-btn-ghost" disabled={busy} onClick={reject}>
                    {t('insRejectClaim')}
                  </button>
                </div>
              </div>
            ) : null}

            {claim.status === 'dbtApproved' ? (
              <div className="ins-section">
                <Link className="av-btn av-btn-primary" to="/insurance/console/disburse">
                  🏦 {t('insGoToDisburse')}
                </Link>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
