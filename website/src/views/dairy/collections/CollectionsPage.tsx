import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import { api } from '../../../lib/api/client';
import {
  fmtINR,
  fmtL,
  getProcurementSummary,
  listCollections,
  type CollectionShift,
  type MilkCollection,
  type ProcurementSummary,
} from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import DairyStatCard from '../components/DairyStatCard';
import EmptyState from '../components/EmptyState';
import SlipCard from '../components/SlipCard';
import '../../../theme/dairy-ops.css';
import '../../../lib/i18n/locales/en.dairy-ops';
import '../../../lib/i18n/locales/hi.dairy-ops';

const todayStr = (): string => new Date().toLocaleDateString('en-CA');

const SHIFT_FILTERS: { value: CollectionShift | 'all'; labelKey: string }[] = [
  { value: 'all', labelKey: 'commonAll' },
  { value: 'morning', labelKey: 'dairyShift_morning' },
  { value: 'evening', labelKey: 'dairyShift_evening' },
];

/** dairy.adulteration.v1 + flag-review annotation (WS-07 M17) — optional on the doc. */
interface AdulterationAnnotation {
  anomaly?: boolean;
  confidence?: number;
  baseline?: { fatAvg?: number; snfAvg?: number; windowDays?: number };
  decisionId?: string;
}
type FlaggedCollection = MilkCollection & {
  adulteration?: AdulterationAnnotation;
  flagReview?: { action?: 'confirm' | 'dismiss'; outcome?: string; at?: string };
};

/** Day ledger (P4) — date picker + AM/PM/All chips, day summary stats, slip cards. */
export default function CollectionsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [date, setDate] = useState(todayStr());
  const [shift, setShift] = useState<CollectionShift | 'all'>('all');
  const [summary, setSummary] = useState<ProcurementSummary | null>(null);
  const [slips, setSlips] = useState<MilkCollection[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reviewing, setReviewing] = useState<string | null>(null);

  const load = useCallback((day: string) => {
    setFailed(false);
    Promise.all([getProcurementSummary(day), listCollections({ date: day, pageSize: 500 })])
      .then(([sumRes, slipsRes]) => {
        setSummary(sumRes);
        setSlips(slipsRes.data);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => load(date), [load, date]);

  /** WS-07 M17 — manager confirms/dismisses an AI adulteration flag (advisory only). */
  const reviewFlag = useCallback(
    async (collectionId: string, action: 'confirm' | 'dismiss') => {
      setReviewing(collectionId);
      try {
        await api.post(`/dairy-manager/collections/${collectionId}/flag-review`, { action });
        toast(t(action === 'confirm' ? 'dairyFlagConfirmed' : 'dairyFlagDismissed'));
        load(date);
      } catch {
        toast(t('dairyActionFailed'), { error: true });
      } finally {
        setReviewing(null);
      }
    },
    [date, load, t]
  );

  const visible = useMemo(
    () => (slips ?? []).filter((s) => shift === 'all' || s.shift === shift),
    [slips, shift]
  );

  const newCollectionBtn = (
    <button
      type="button"
      className="av-btn av-btn-primary"
      onClick={() => navigate('/dairy/console/collections/new')}
    >
      ＋ {t('dairyQaNewCollection')}
    </button>
  );

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console">
      <div className="dairy-wrap">
        <div className="av-field" style={{ marginTop: 4 }}>
          <label className="av-label">{t('dairyOpsLedgerDate')}</label>
          <input
            className="av-input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayStr())}
          />
        </div>

        <div className="dairy-chip-row">
          {SHIFT_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`av-chip${shift === f.value ? ' selected' : ''}`}
              onClick={() => setShift(f.value)}
            >
              {t(f.labelKey)}
            </button>
          ))}
        </div>

        <div className="dairy-actions" style={{ marginTop: 0 }}>
          {newCollectionBtn}
        </div>

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="dairyLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={() => load(date)}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {!failed ? (
          <div className="dairy-stats-grid">
            <DairyStatCard
              label={t('dairyTotalsLiters')}
              value={summary ? fmtL(summary.totalLiters) : '—'}
              unit={t('dairyLiters')}
            />
            <DairyStatCard
              label={t('dairyStatLitersAM')}
              value={summary ? fmtL(summary.totalMorningLiters) : '—'}
              unit={t('dairyLiters')}
            />
            <DairyStatCard
              label={t('dairyStatLitersPM')}
              value={summary ? fmtL(summary.totalEveningLiters) : '—'}
              unit={t('dairyLiters')}
            />
            <DairyStatCard
              label={t('dairyStatPayoutDue')}
              value={summary ? fmtINR(summary.totalPayoutAmount) : '—'}
            />
            <DairyStatCard
              label={t('dairyStatCollections')}
              value={summary ? String(summary.collectionsCount) : '—'}
            />
          </div>
        ) : null}

        {slips === null && !failed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

        {slips !== null && !failed ? (
          visible.length === 0 ? (
            <EmptyState
              icon="🧾"
              titleKey="dairyOpsLedgerEmpty"
              bodyKey="dairyOpsLedgerEmptyBody"
              action={newCollectionBtn}
            />
          ) : (
            <div className="dairy-list">
              {visible.map((slip) => {
                const flagged = slip as FlaggedCollection;
                const isAnomaly = flagged.adulteration?.anomaly === true;
                const reviewed = flagged.flagReview?.action;
                return (
                  <div key={slip.id} className="dairy-slip-wrap">
                    {isAnomaly ? (
                      <div className="dairy-flag" role="status">
                        <span className="dairy-flag-badge">⚠ {t('dairyAdulterationFlag')}</span>
                        <span className="dairy-flag-note">{t('dairyAdulterationFlagNote')}</span>
                        {reviewed ? (
                          <span className="dairy-flag-reviewed">
                            {reviewed === 'confirm' ? t('dairyFlagConfirmed') : t('dairyFlagDismissed')}
                          </span>
                        ) : (
                          <div className="dairy-actions-row">
                            <button
                              type="button"
                              className="av-btn av-btn-ghost"
                              disabled={reviewing === slip.id}
                              onClick={() => void reviewFlag(slip.id, 'confirm')}
                            >
                              ✓ {t('dairyFlagConfirm')}
                            </button>
                            <button
                              type="button"
                              className="av-btn av-btn-ghost"
                              disabled={reviewing === slip.id}
                              onClick={() => void reviewFlag(slip.id, 'dismiss')}
                            >
                              ✕ {t('dairyFlagDismiss')}
                            </button>
                          </div>
                        )}
                      </div>
                    ) : null}
                    <SlipCard slip={slip} />
                  </div>
                );
              })}
            </div>
          )
        ) : null}
      </div>
    </ToolShell>
  );
}
