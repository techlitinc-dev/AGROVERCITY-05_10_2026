import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import {
  fmtRupees,
  getProviderClaims,
  getProviderStats,
  type InsuranceClaim,
  type InsuranceProviderStats,
} from '../../lib/api/insurance';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.insurance';
import '../../lib/i18n/locales/hi.insurance';
import InsEmptyState from './components/InsEmptyState';
import InsStatCard from './components/InsStatCard';
import SlaClock from './components/SlaClock';
import './insurance.css';

/**
 * ClaimsDesk home — the provider's daily cockpit: new intimations with a live
 * 72-h SLA clock, surveys pending assignment, claims by stage, DBT pending and
 * rejection/appeal stats (all from GET /insurance/provider/stats + claims).
 */

const QUICK_ACTIONS = [
  { to: '/insurance/console/claims', icon: '⚖️', labelKey: 'insQaClaims' },
  { to: '/insurance/console/surveyors', icon: '🧭', labelKey: 'insQaSurveyors' },
  { to: '/insurance/console/disburse', icon: '🏦', labelKey: 'insQaDisburse' },
  { to: '/insurance/console/policies', icon: '📋', labelKey: 'insQaPolicies' },
  { to: '/insurance/console/rates', icon: '🏷️', labelKey: 'insQaRates' },
] as const;

const STAGE_ORDER = [
  'intimated',
  'surveyorAssigned',
  'fieldAssessed',
  'dbtApproved',
  'disbursed',
  'rejected',
];

export default function ClaimsDeskHome() {
  const t = useT();
  useEnsureProfile('insuranceProvider');

  const [stats, setStats] = useState<InsuranceProviderStats | null>(null);
  const [claims, setClaims] = useState<InsuranceClaim[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([getProviderStats(), getProviderClaims({ pageSize: 100 })])
      .then(([statsRes, claimsRes]) => {
        setStats(statsRes);
        setClaims(claimsRes.data);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const newIntimations = (claims ?? [])
    .filter((c) => c.status === 'intimated')
    .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));
  const surveysPending = (claims ?? []).filter((c) => c.status === 'intimated').length;
  const dbtPending = stats ? stats.byClaimStatus['dbtApproved'] : undefined;
  const rejected = stats ? stats.byClaimStatus['rejected'] : undefined;
  const totalAppeals = (claims ?? []).reduce((sum, c) => sum + c.appealCount, 0);
  const byStage: Record<string, number> = stats ? stats.byClaimStatus : {};
  const stageCount = (stage: string): number => {
    const count = byStage[stage];
    return count === undefined ? 0 : count;
  };

  return (
    <ToolShell toolId="insuranceProviderHome">
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
              <span className="ins-section-title">📊 {t('insTodaySnapshot')}</span>
              <div className="ins-stats-grid">
                <InsStatCard
                  label={t('insStatNewIntimations')}
                  value={String(newIntimations.length)}
                  sub={t('insStatSlaWindow')}
                />
                <InsStatCard
                  label={t('insStatSurveysPending')}
                  value={String(surveysPending)}
                  sub={t('insStatAwaitingSurveyor')}
                />
                <InsStatCard
                  label={t('insStatDbtPending')}
                  value={
                    dbtPending === undefined
                      ? '—'
                      : String(dbtPending)
                  }
                  sub={t('insStatReadyToDisburse')}
                />
                <InsStatCard
                  label={t('insStatRejected')}
                  value={rejected === undefined ? '—' : String(rejected)}
                  sub={t('insStatAppeals', { count: totalAppeals })}
                />
                <InsStatCard
                  label={t('insStatCycleTime')}
                  value={stats ? String(stats.avgCycleTimeHours) : '—'}
                  unit={t('insHoursUnit')}
                />
              </div>
            </div>

            <div className="ins-section">
              <span className="ins-section-title">🆕 {t('insNewIntimations')}</span>
              {claims === null ? <p className="ins-hint">{t('commonLoading')}</p> : null}
              {claims !== null && newIntimations.length === 0 ? (
                <InsEmptyState icon="✅" titleKey="insNoNewIntimations" bodyKey="insNoNewIntimationsBody" />
              ) : null}
              <div className="ins-list">
                {newIntimations.map((claim) => (
                  <Link key={claim.id} to={`/insurance/console/claims/${claim.id}`} className="ins-card">
                    <div className="ins-card-row">
                      <span className="ins-card-title">{claim.claimNumber}</span>
                      <SlaClock fromIso={claim.submittedAt} />
                    </div>
                    <span className="ins-card-sub">
                      {claim.farmerName || t('insFarmer')} · {claim.cropName} · {claim.village}
                    </span>
                    <span className="ins-card-sub">
                      {t('insRequestedAmount')}: {fmtRupees(claim.requestedAmount)}
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="ins-section">
              <span className="ins-section-title">🗂️ {t('insClaimsByStage')}</span>
              <div className="ins-chip-row">
                {STAGE_ORDER.map((stage) => (
                  <span key={stage} className="ins-pill" style={{ borderColor: '#cbd5e1', color: '#334155' }}>
                    {t(`ins_status_${stage}`)}: {stageCount(stage)}
                  </span>
                ))}
              </div>
            </div>

            <div className="ins-section">
              <span className="ins-section-title">⚡ {t('insQuickActions')}</span>
              <div className="ins-stats-grid">
                {QUICK_ACTIONS.map((qa) => (
                  <Link key={qa.to} to={qa.to} className="ins-card">
                    <div className="ins-card-row">
                      <span aria-hidden>{qa.icon}</span>
                      <span className="ins-card-title">{t(qa.labelKey)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </ToolShell>
  );
}
