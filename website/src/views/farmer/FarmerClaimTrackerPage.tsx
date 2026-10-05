import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  appealClaim,
  fmtRupees,
  getMyClaim,
  getMyClaims,
  type InsuranceClaim,
} from '../../lib/api/insurance';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.insurance';
import '../../lib/i18n/locales/hi.insurance';
import InsEmptyState from '../insurance/components/InsEmptyState';
import InsStatusChip from '../insurance/components/InsStatusChip';
import '../insurance/insurance.css';

/**
 * Farmer claim tracker (F15) — a courier-style multi-stage timeline
 * (intimated → surveyorAssigned → fieldAssessed → dbtApproved → disbursed,
 * rejected shown as a side state) with timestamps, plus the appeal/resubmit
 * form that appears only on a rejected claim. Without a :claimId it renders
 * the farmer's claim list with a "file a new claim" entry.
 */

const STAGES = ['intimated', 'surveyorAssigned', 'fieldAssessed', 'dbtApproved', 'disbursed'];

const fmtTs = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN');
};

export default function FarmerClaimTrackerPage() {
  const t = useT();
  const navigate = useNavigate();
  const { claimId } = useParams<{ claimId: string }>();
  useEnsureProfile('farmer');

  const [claims, setClaims] = useState<InsuranceClaim[] | null>(null);
  const [claim, setClaim] = useState<InsuranceClaim | null>(null);
  const [failed, setFailed] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    if (claimId) {
      getMyClaim(claimId)
        .then(setClaim)
        .catch((e) => {
          if (isApiError(e) && (e.status === 404 || e.code === 'CLAIM_NOT_FOUND')) setNotFound(true);
          else setFailed(true);
        });
    } else {
      getMyClaims()
        .then((res) => setClaims(res.data))
        .catch(() => setFailed(true));
    }
  }, [claimId]);

  useEffect(load, [load]);

  const submitAppeal = async () => {
    if (!claimId) return;
    if (reason.trim().length < 10) {
      toast(t('insAppealReasonShort'), { error: true });
      return;
    }
    setBusy(true);
    try {
      const updated = await appealClaim(claimId, { reason });
      setClaim(updated);
      setReason('');
      toast(t('insAppealSubmitted'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <ToolShell toolId="cropInsurance" backTo="/insurance/my-claims">
        <div className="ins-wrap">
          <InsEmptyState
            icon="🔍"
            titleKey="insClaimNotFound"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/insurance/my-claims')}>
                ← {t('insMyClaims')}
              </button>
            }
          />
        </div>
      </ToolShell>
    );
  }

  // ---- List mode ----
  if (!claimId) {
    return (
      <ToolShell toolId="cropInsurance" backTo="/dashboard">
        <div className="ins-wrap">
          <div className="ins-section">
            <span className="ins-section-title">🛡️ {t('insMyClaims')}</span>
            <Link className="av-btn av-btn-primary" to="/insurance/claims/new">
              ➕ {t('insFileNewClaim')}
            </Link>
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
            {claims === null && !failed ? <p className="ins-hint">{t('commonLoading')}</p> : null}
            {claims !== null && claims.length === 0 ? (
              <InsEmptyState icon="🛡️" titleKey="insNoClaims" bodyKey="insNoClaimsBody" />
            ) : null}
            <div className="ins-list">
              {(claims ?? []).map((item) => (
                <Link key={item.id} to={`/insurance/my-claims/${item.id}`} className="ins-card">
                  <div className="ins-card-row">
                    <span className="ins-card-title">{item.claimNumber}</span>
                    <InsStatusChip status={item.status} />
                  </div>
                  <span className="ins-card-sub">
                    {item.cropName} · {item.calamityType} · {fmtTs(item.submittedAt)}
                  </span>
                  <span className="ins-card-sub">
                    {t('insRequestedAmount')}: {fmtRupees(item.requestedAmount)}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </ToolShell>
    );
  }

  // ---- Detail mode ----
  const timelineAt = (status: string): { at: string; note: string } | null => {
    if (!claim) return null;
    const entry = [...claim.timeline].reverse().find((step) => step.status === status);
    return entry ? { at: entry.at, note: entry.note } : null;
  };

  return (
    <ToolShell toolId="cropInsurance" backTo="/insurance/my-claims">
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
                {claim.cropName} · {claim.calamityType} · {claim.village}
              </span>
              <span className="ins-card-sub">
                {t('insRequestedAmount')}: {fmtRupees(claim.requestedAmount)}
              </span>
              {claim.approvedAmount ? (
                <span className="ins-card-amount">
                  {t('insApprovedAmount')}: {fmtRupees(claim.approvedAmount)}
                </span>
              ) : null}
              {claim.dbtTransactionId ? (
                <span className="ins-card-sub">
                  {t('insDbtRef')}: {claim.dbtTransactionId}
                </span>
              ) : null}
            </div>

            <div className="ins-section">
              <span className="ins-section-title">🚚 {t('insTrackerTitle')}</span>
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
                    {claim.rejectionReason ? (
                      <div className="ins-timeline-note">{claim.rejectionReason}</div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            {claim.status === 'rejected' ? (
              <div className="ins-section">
                <span className="ins-section-title">📝 {t('insAppealTitle')}</span>
                <p className="ins-hint">{t('insAppealHint')}</p>
                <div className="ins-form">
                  <div className="av-field">
                    <label className="av-label">{t('insAppealReason')}</label>
                    <textarea className="av-input" rows={4} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </div>
                  <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void submitAppeal()}>
                    {busy ? <span className="av-spinner" /> : t('insAppealSubmit')}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
