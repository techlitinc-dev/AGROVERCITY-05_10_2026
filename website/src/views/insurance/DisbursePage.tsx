import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  disburseClaim,
  fmtRupees,
  getProviderClaims,
  getProviderStats,
  type InsuranceClaim,
  type InsuranceProviderStats,
} from '../../lib/api/insurance';
import { useT } from '../../lib/i18n';
import InsEmptyState from './components/InsEmptyState';
import InsStatCard from './components/InsStatCard';
import './insurance.css';

/**
 * DBT execution desk — claims approved for DBT (dbtApproved) with a disburse
 * action, plus disbursement totals from GET /insurance/provider/stats. The
 * endpoint accepts a note, so every disburse requires a typed reason here.
 */
export default function DisbursePage() {
  const t = useT();
  useEnsureProfile('insuranceProvider');

  const [claims, setClaims] = useState<InsuranceClaim[] | null>(null);
  const [stats, setStats] = useState<InsuranceProviderStats | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [notes, setNotes] = useState<Record<string, string>>({});
  const [refs, setRefs] = useState<Record<string, string>>({});

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([getProviderClaims({ status: 'dbtApproved', pageSize: 100 }), getProviderStats()])
      .then(([claimsRes, statsRes]) => {
        setClaims(claimsRes.data);
        setStats(statsRes);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const dbtPendingCount: number | undefined = stats
    ? stats.byClaimStatus['dbtApproved'] === undefined
      ? 0
      : stats.byClaimStatus['dbtApproved']
    : undefined;

  const disburse = async (claim: InsuranceClaim) => {
    const note = (notes[claim.id] ?? '').trim();
    if (note.length < 3) {
      toast(t('insDisburseNoteRequired'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await disburseClaim(claim.id, {
        notes: note,
        dbtTransactionId: (refs[claim.id] ?? '').trim() || undefined,
      });
      setClaims((prev) => (prev ?? []).filter((c) => c.id !== claim.id));
      toast(t('insDisbursed'));
    } catch (e) {
      toast(isApiError(e) ? e.message : t('insActionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="insuranceProviderHome" backTo="/insurance/console">
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
        ) : (
          <>
            <div className="ins-section">
              <span className="ins-section-title">🏦 {t('insDisburseStats')}</span>
              <div className="ins-stats-grid">
                <InsStatCard
                  label={t('insStatDbtPending')}
                  value={dbtPendingCount === undefined ? '—' : String(dbtPendingCount)}
                />
                <InsStatCard
                  label={t('insStatDisbursedCount')}
                  value={stats ? String(stats.disbursedClaims) : '—'}
                />
                <InsStatCard
                  label={t('insStatTotalApproved')}
                  value={stats ? fmtRupees(stats.totalClaimApproved) : '—'}
                />
                <InsStatCard
                  label={t('insStatTotalDisbursed')}
                  value={stats ? fmtRupees(stats.totalClaimDisbursed) : '—'}
                />
              </div>
            </div>

            <div className="ins-section">
              <span className="ins-section-title">📤 {t('insDbtQueue')}</span>
              {claims === null ? <p className="ins-hint">{t('commonLoading')}</p> : null}
              {claims !== null && claims.length === 0 ? (
                <InsEmptyState icon="✅" titleKey="insDbtEmpty" bodyKey="insDbtEmptyBody" />
              ) : null}
              <div className="ins-list">
                {(claims ?? []).map((claim) => (
                  <div key={claim.id} className="ins-card">
                    <div className="ins-card-row">
                      <Link className="ins-card-title" to={`/insurance/console/claims/${claim.id}`}>
                        {claim.claimNumber}
                      </Link>
                      <span className="ins-card-amount">
                        {fmtRupees(claim.approvedAmount ?? claim.requestedAmount)}
                      </span>
                    </div>
                    <span className="ins-card-sub">
                      {claim.farmerName || t('insFarmer')} · {claim.cropName} · {claim.village}
                    </span>
                    {claim.bankAccountLast4 ? (
                      <span className="ins-card-sub">
                        {t('insBankLast4')}: ••••{claim.bankAccountLast4}
                      </span>
                    ) : null}
                    <div className="av-field">
                      <label className="av-label">{t('insDbtRef')}</label>
                      <input
                        className="av-input"
                        value={refs[claim.id] ?? ''}
                        onChange={(e) => setRefs((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                      />
                    </div>
                    <div className="av-field">
                      <label className="av-label">{t('insDisburseNote')}</label>
                      <input
                        className="av-input"
                        value={notes[claim.id] ?? ''}
                        onChange={(e) => setNotes((prev) => ({ ...prev, [claim.id]: e.target.value }))}
                      />
                    </div>
                    <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void disburse(claim)}>
                      {busy ? <span className="av-spinner" /> : t('insDisburseAction')}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
}
