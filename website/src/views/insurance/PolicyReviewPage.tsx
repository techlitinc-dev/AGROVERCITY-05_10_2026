import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  fmtRupees,
  getProviderPolicies,
  reviewPolicy,
  type CropInsurancePolicy,
} from '../../lib/api/insurance';
import { useT } from '../../lib/i18n';
import InsEmptyState from './components/InsEmptyState';
import InsStatusChip from './components/InsStatusChip';
import './insurance.css';

/**
 * Policy review queue (insurancePolicyReview tool) — pending crop-insurance
 * applications with an approve / reject action on
 * POST /insurance/provider/policies/{id}/review. Reject requires a typed
 * reason (backend-enforced); approve accepts underwriting notes.
 */
export default function PolicyReviewPage() {
  const t = useT();
  useEnsureProfile('insuranceProvider');

  const [policies, setPolicies] = useState<CropInsurancePolicy[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    getProviderPolicies({ status: 'pending_approval', pageSize: 100 })
      .then((res) => setPolicies(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const decide = async (policy: CropInsurancePolicy, action: 'approve' | 'reject') => {
    const note = (notes[policy.id] ?? '').trim();
    if (action === 'reject' && note.length < 3) {
      toast(t('insRejectReasonRequired'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await reviewPolicy(policy.id, {
        action,
        underwriterNotes: note || undefined,
        rejectionReason: action === 'reject' ? note : undefined,
      });
      setPolicies((prev) => (prev ?? []).filter((p) => p.id !== policy.id));
      toast(action === 'approve' ? t('insPolicyApproved') : t('insPolicyRejected'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="insurancePolicyReview" backTo="/insurance/console">
      <div className="ins-wrap">
        <div className="ins-section">
          <span className="ins-section-title">📋 {t('insPolicyQueueTitle')}</span>
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
          {policies === null && !failed ? <p className="ins-hint">{t('commonLoading')}</p> : null}
          {policies !== null && policies.length === 0 ? (
            <InsEmptyState icon="✅" titleKey="insPolicyQueueEmpty" bodyKey="insPolicyQueueEmptyBody" />
          ) : null}

          <div className="ins-list">
            {(policies ?? []).map((policy) => (
              <div key={policy.id} className="ins-card">
                <div className="ins-card-row">
                  <span className="ins-card-title">{policy.policyNumber}</span>
                  <InsStatusChip status={policy.status} kind="policy" />
                </div>
                <span className="ins-card-sub">
                  {policy.farmerName || t('insFarmer')} · {policy.cropName} · {policy.season}
                </span>
                <span className="ins-card-sub">
                  {t('insSumInsured')}: {fmtRupees(policy.sumInsured)} · {t('insPremium')}:{' '}
                  {fmtRupees(policy.farmerPremium)}
                </span>
                {policy.riskCategory ? (
                  <span className="ins-card-sub">
                    {t('insRisk')}: {policy.riskCategory}
                  </span>
                ) : null}
                <div className="av-field">
                  <label className="av-label">{t('insUnderwriterNotes')}</label>
                  <input
                    className="av-input"
                    value={notes[policy.id] ?? ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [policy.id]: e.target.value }))}
                  />
                </div>
                <div className="ins-actions-row">
                  <button
                    type="button"
                    className="av-btn av-btn-primary"
                    disabled={busy}
                    onClick={() => void decide(policy, 'approve')}
                  >
                    {t('insApprovePolicy')}
                  </button>
                  <button
                    type="button"
                    className="av-btn av-btn-ghost"
                    disabled={busy}
                    onClick={() => void decide(policy, 'reject')}
                  >
                    {t('insRejectPolicy')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
