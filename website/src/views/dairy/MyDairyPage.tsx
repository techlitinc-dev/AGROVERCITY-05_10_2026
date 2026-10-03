import { useCallback, useEffect, useMemo, useState } from 'react';
import SegmentedControl from '../../components/SegmentedControl';
import ToolShell from '../../components/trade/ToolShell';
import {
  fmtINR,
  fmtL,
  getActiveRateChart,
  getFarmerAnalytics,
  getFarmerPayments,
  getFarmerSlips,
  type DairySpecies,
  type FarmerAnalytics,
  type MilkCollection,
  type PaymentEntry,
  type RateChart,
} from '../../lib/api/dairy';
import { isApiError } from '../../lib/api/client';
import { useT } from '../../lib/i18n';
import { useDairyStore } from '../../stores/dairy';
import '../../theme/dairy-analytics.css';
import AnaBars from './analytics/AnaBars';
import EmptyState from './components/EmptyState';
import SlipCard, { fmtDate } from './components/SlipCard';
import SpeciesToggle from './components/SpeciesToggle';
import StatusChip from './components/StatusChip';
import DairyStatCard from './components/DairyStatCard';

/**
 * Farmer "My Dairy" face (P2) — read-only self-view: My Slips / My Payments
 * tabs + Today's Rate card. No member record → explainer empty state.
 */

type Tab = 'slips' | 'payments';

const monthKey = (date: string): string => date.slice(0, 7);

const monthLabel = (key: string): string =>
  new Date(`${key}-15T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const shortMonthLabel = (key: string): string =>
  new Date(`${key}-15T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });

export default function MyDairyPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>('slips');
  const slipsFilter = useDairyStore((s) => s.slipsFilter);
  const setSlipsFilter = useDairyStore((s) => s.setSlipsFilter);

  const [slips, setSlips] = useState<MilkCollection[] | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[] | null>(null);
  const [memberCode, setMemberCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [analytics, setAnalytics] = useState<FarmerAnalytics | null>(null);

  const [species, setSpecies] = useState<DairySpecies>('cow');
  const [rateRetry, setRateRetry] = useState(0);
  const [rate, setRate] = useState<RateChart | null | 'missing' | 'loading'>('loading');

  const load = useCallback(() => {
    setFailed(false);
    Promise.all([getFarmerSlips(), getFarmerPayments()])
      .then(([slipsRes, paymentsRes]) => {
        setSlips(slipsRes.data);
        setMemberCode(slipsRes.memberCode);
        setPayments(paymentsRes.data);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  // P11 — decorative 6-month trend; failures stay silent (tabs own their states).
  useEffect(() => {
    let stale = false;
    getFarmerAnalytics()
      .then((res) => {
        if (!stale) setAnalytics(res);
      })
      .catch(() => {});
    return () => {
      stale = true;
    };
  }, []);

  useEffect(() => {
    let stale = false;
    setRate('loading');
    getActiveRateChart(species)
      .then((chart) => {
        if (!stale) setRate(chart);
      })
      .catch((e) => {
        if (stale) return;
        if (isApiError(e) && e.code === 'RATE_CHART_NOT_FOUND') setRate('missing');
        else setRate(null);
      });
    return () => {
      stale = true;
    };
  }, [species, rateRetry]);

  const months = useMemo(() => {
    const keys = new Set((slips ?? []).map((s) => monthKey(s.date)));
    return [...keys].sort().reverse();
  }, [slips]);

  const month = slipsFilter.month && months.includes(slipsFilter.month) ? slipsFilter.month : '';
  const visibleSlips = useMemo(
    () => (slips ?? []).filter((s) => !month || monthKey(s.date) === month),
    [slips, month]
  );
  const totalsLiters = visibleSlips.reduce((sum, s) => sum + s.liters, 0);
  const totalsAmount = visibleSlips.reduce((sum, s) => sum + s.totalAmount, 0);

  const paymentsTotalNet = (payments ?? []).reduce((sum, p) => sum + p.netAmount, 0);

  const rateCard = (
    <div className="dairy-section">
      <div className="dairy-card-row">
        <span className="dairy-section-title">{t('dairyRateToday')}</span>
        <SpeciesToggle value={species} onChange={setSpecies} />
      </div>
      {rate === 'loading' ? <p className="dairy-hint">{t('commonLoading')}</p> : null}
      {rate === 'missing' ? (
        <EmptyState icon="📋" titleKey="dairyRateEmpty" bodyKey="dairyRateEmptyBody" />
      ) : null}
      {rate === null ? (
        <EmptyState
          icon="📡"
          titleKey="dairyLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => setRateRetry((n) => n + 1)}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}
      {rate && rate !== 'loading' && rate !== 'missing' ? (
        <div className="dairy-rate-card">
          <span className="dairy-rate-label">{t(`dairySpecies_${species}`)}</span>
          <span className="dairy-rate-value">
            {fmtINR(rate.baseRate)} <small style={{ fontSize: 14 }}>/ {t('dairyLiters')}</small>
          </span>
          <span className="dairy-rate-line">
            {t('dairyRateFatLine', { amount: fmtINR(rate.fatStep), base: rate.fatBase })}
          </span>
          <span className="dairy-rate-line">
            {t('dairyRateSnfLine', { amount: fmtINR(rate.snfStep), base: rate.snfBase })}
          </span>
          {rate.minRate > 0 ? (
            <span className="dairy-rate-line">{t('dairyRateMinLine', { amount: fmtINR(rate.minRate) })}</span>
          ) : null}
          <span className="dairy-rate-effective">
            {t('dairyRateEffectiveFrom', { date: fmtDate(rate.effectiveFrom) })}
          </span>
        </div>
      ) : null}
    </div>
  );

  return (
    <ToolShell toolId="livestockDairy">
      <div className="dairy-wrap">
        {rateCard}

        {analytics?.member ? (
          <div className="dairy-section">
            <span className="dairy-section-title">📊 {t('dairyMyTrendTitle')}</span>
            <div className="dairy-card dairy-ana-trend-card">
              <AnaBars
                data={analytics.monthly.map((m) => ({
                  label: shortMonthLabel(m.month),
                  value: m.liters,
                }))}
                color="#43a047"
                format={(v) => `${fmtL(v)} L`}
              />
              <p className="dairy-hint" style={{ marginTop: 6 }}>
                {t('dairyMyTrendBody')}
              </p>
            </div>
            <div className="dairy-stats-grid">
              <DairyStatCard
                label={t('dairyMyLifetimeLiters')}
                value={fmtL(analytics.totals.liters)}
                unit={t('dairyLiters')}
              />
              <DairyStatCard label={t('dairyMyLifetimeAmount')} value={fmtINR(analytics.totals.amount)} />
              <DairyStatCard label={t('dairyMyLifetimePaid')} value={fmtINR(analytics.totals.paid)} />
              <DairyStatCard label={t('dairyMyLifetimePending')} value={fmtINR(analytics.totals.pending)} />
            </div>
          </div>
        ) : null}

        <div className="dairy-section">
          <SegmentedControl<Tab>
            value={tab}
            onChange={setTab}
            options={[
              { value: 'slips', label: `🧾 ${t('dairyTabSlips')}` },
              { value: 'payments', label: `💸 ${t('dairyTabPayments')}` },
            ]}
          />

          {failed ? (
            <EmptyState
              icon="📡"
              titleKey="dairyLoadFailed"
              action={
                <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}

          {!failed && memberCode === '' && tab === 'slips' && (slips ?? []).length === 0 ? (
            <EmptyState icon="🐄" titleKey="dairyNoMemberTitle" bodyKey="dairyNoMemberBody" />
          ) : null}

          {!failed && memberCode === '' && tab === 'payments' ? (
            <EmptyState icon="🐄" titleKey="dairyNoMemberTitle" bodyKey="dairyNoMemberBody" />
          ) : null}

          {!failed && tab === 'slips' && (memberCode !== '' || (slips ?? []).length > 0) ? (
            <>
              {memberCode === '' ? (
                <EmptyState icon="🐄" titleKey="dairyNoMemberTitle" bodyKey="dairyNoMemberBody" />
              ) : null}
              <div className="dairy-card-row" style={{ marginTop: 4 }}>
                <label className="av-label" style={{ margin: 0 }}>
                  {t('dairyMonthLabel')}
                </label>
                <select
                  className="av-input"
                  style={{ width: 'auto', minWidth: 150, height: 42 }}
                  value={month}
                  onChange={(e) => setSlipsFilter({ month: e.target.value })}
                >
                  <option value="">{t('dairyMonthAll')}</option>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </div>

              {slips === null ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

              {slips !== null && visibleSlips.length === 0 ? (
                <EmptyState icon="🧾" titleKey="dairySlipsEmpty" bodyKey="dairySlipsEmptyBody" />
              ) : null}

              {visibleSlips.length > 0 ? (
                <div className="dairy-totals">
                  <div className="dairy-totals-item">
                    <div className="dairy-totals-label">{t('dairyTotalsLiters')}</div>
                    <div className="dairy-totals-value">{fmtL(totalsLiters)} L</div>
                  </div>
                  <div className="dairy-totals-item">
                    <div className="dairy-totals-label">{t('dairyTotalsAmount')}</div>
                    <div className="dairy-totals-value">{fmtINR(totalsAmount)}</div>
                  </div>
                </div>
              ) : null}

              <div className="dairy-list">
                {visibleSlips.map((slip) => (
                  <SlipCard key={slip.id} slip={slip} />
                ))}
              </div>
            </>
          ) : null}

          {!failed && tab === 'payments' && memberCode !== '' ? (
            <>
              {payments === null ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

              {payments !== null && payments.length === 0 ? (
                <EmptyState icon="💸" titleKey="dairyPaymentsEmpty" bodyKey="dairyPaymentsEmptyBody" />
              ) : null}

              {payments !== null && payments.length > 0 ? (
                <div className="dairy-totals">
                  <div className="dairy-totals-item">
                    <div className="dairy-totals-label">{t('dairyNet')}</div>
                    <div className="dairy-totals-value">{fmtINR(paymentsTotalNet)}</div>
                  </div>
                </div>
              ) : null}

              <div className="dairy-list">
                {(payments ?? []).map((entry) => (
                  <div key={entry.id} className="dairy-card">
                    <div className="dairy-card-row">
                      <span className="dairy-card-title">
                        {t('dairyPayPeriod')}: {fmtDate(entry.createdAt)}
                      </span>
                      <StatusChip status={entry.status} />
                    </div>
                    <div className="dairy-slip-grid">
                      <div>
                        <div className="dairy-slip-cell-label">{t('dairyLiters')}</div>
                        <div className="dairy-slip-cell-value">{fmtL(entry.liters)}</div>
                      </div>
                      <div>
                        <div className="dairy-slip-cell-label">{t('dairyPayGross')}</div>
                        <div className="dairy-slip-cell-value">{fmtINR(entry.amount)}</div>
                      </div>
                      <div>
                        <div className="dairy-slip-cell-label">{t('dairyDeduction')}</div>
                        <div className="dairy-slip-cell-value">
                          {entry.deduction > 0 ? `− ${fmtINR(entry.deduction)}` : '—'}
                        </div>
                      </div>
                    </div>
                    <div className="dairy-card-row">
                      <span className="dairy-card-amount">{t('dairyNet')}: {fmtINR(entry.netAmount)}</span>
                      {entry.payoutRef ? (
                        <span className="dairy-card-sub">
                          {t('dairyPayPayoutRef')}: {entry.payoutRef}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </ToolShell>
  );
}
