import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import {
  fmtRupees,
  getProviderClaims,
  type ClaimStatus,
  type InsuranceClaim,
} from '../../lib/api/insurance';
import { useT } from '../../lib/i18n';
import InsEmptyState from './components/InsEmptyState';
import InsStatusChip from './components/InsStatusChip';
import SlaClock from './components/SlaClock';
import './insurance.css';

/**
 * Claims queue — stage filter (intimated … disbursed / rejected) with an SLA
 * sort (oldest intimation first) over GET /insurance/provider/claims. Rows
 * deep-link to the claim detail page.
 */

type StageFilter = ClaimStatus | 'all';

const STAGE_FILTERS: StageFilter[] = [
  'all',
  'intimated',
  'surveyorAssigned',
  'fieldAssessed',
  'dbtApproved',
  'disbursed',
  'rejected',
];

export default function ClaimsQueuePage() {
  const t = useT();
  useEnsureProfile('insuranceProvider');

  const [claims, setClaims] = useState<InsuranceClaim[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [stage, setStage] = useState<StageFilter>('all');
  const [oldestFirst, setOldestFirst] = useState(true);
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    setFailed(false);
    getProviderClaims({ pageSize: 100 })
      .then((res) => setClaims(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = (claims ?? []).filter((claim) => {
      if (stage !== 'all' && claim.status !== stage) return false;
      if (!needle) return true;
      return (
        claim.claimNumber.toLowerCase().includes(needle) ||
        (claim.farmerName ?? '').toLowerCase().includes(needle) ||
        claim.cropName.toLowerCase().includes(needle) ||
        claim.village.toLowerCase().includes(needle)
      );
    });
    return filtered.sort((a, b) =>
      oldestFirst ? (a.submittedAt < b.submittedAt ? -1 : 1) : a.submittedAt < b.submittedAt ? 1 : -1
    );
  }, [claims, stage, q, oldestFirst]);

  return (
    <ToolShell toolId="insuranceProviderHome" backTo="/insurance/console">
      <div className="ins-wrap">
        <div className="ins-section">
          <span className="ins-section-title">⚖️ {t('insQueueTitle')}</span>

          <div className="ins-grid-2">
            <div className="av-field" style={{ marginBottom: 0 }}>
              <label className="av-label">{t('insQueueSearch')}</label>
              <input
                className="av-input"
                value={q}
                placeholder={t('insQueueSearchPlaceholder')}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <div className="av-field" style={{ marginBottom: 0 }}>
              <label className="av-label">{t('insQueueSort')}</label>
              <button
                type="button"
                className="av-btn av-btn-ghost"
                onClick={() => setOldestFirst((prev) => !prev)}
              >
                {oldestFirst ? `⬆ ${t('insSortOldestFirst')}` : `⬇ ${t('insSortNewestFirst')}`}
              </button>
            </div>
          </div>

          <div className="ins-chip-row">
            {STAGE_FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                className={stage === option ? 'av-btn av-btn-primary' : 'av-btn av-btn-ghost'}
                onClick={() => setStage(option)}
              >
                {option === 'all' ? t('insStageAll') : t(`ins_status_${option}`)}
              </button>
            ))}
          </div>
        </div>

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

        {claims !== null && rows.length === 0 ? (
          <InsEmptyState icon="🗂️" titleKey="insQueueEmpty" bodyKey="insQueueEmptyBody" />
        ) : null}

        <div className="ins-list">
          {rows.map((claim) => (
            <Link key={claim.id} to={`/insurance/console/claims/${claim.id}`} className="ins-card">
              <div className="ins-card-row">
                <span className="ins-card-title">{claim.claimNumber}</span>
                <InsStatusChip status={claim.status} />
              </div>
              <span className="ins-card-sub">
                {claim.farmerName || t('insFarmer')} · {claim.cropName} · {claim.village}
              </span>
              {claim.triage ? (
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
                  {claim.triage.triageReasons && claim.triage.triageReasons.length > 0 ? (
                    <span className="ins-pill">{claim.triage.triageReasons[0]}</span>
                  ) : null}
                  {claim.fraudFlag ? (
                    <span
                      className="ins-pill"
                      style={{ color: '#b91c1c', borderColor: '#fca5a5', background: '#fee2e2' }}
                    >
                      ⚠ {t('insTriageFraudFlag')}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <div className="ins-card-row">
                <SlaClock fromIso={claim.submittedAt} />
                <span className="ins-card-amount">{fmtRupees(claim.requestedAmount)}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </ToolShell>
  );
}
