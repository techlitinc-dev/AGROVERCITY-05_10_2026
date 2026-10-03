import { ZERO } from '../../../lib/numDefaults';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { fmtINR, fmtL, getDairyAnalytics, type DairyAnalytics } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import '../../../theme/dairy-analytics.css';
import DairyStatCard from '../components/DairyStatCard';
import EmptyState from '../components/EmptyState';
import StatusChip from '../components/StatusChip';
import AnaBars from './AnaBars';

const currentMonthStr = (): string => new Date().toLocaleDateString('en-CA').slice(0, 7);

function shiftMonth(month: string, delta: number): string {
  const d = new Date(`${month}-15T00:00:00`);
  d.setMonth(d.getMonth() + delta);
  return d.toLocaleDateString('en-CA').slice(0, 7);
}

const monthLabel = (key: string): string =>
  new Date(`${key}-15T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

const shortMonth = (key: string): string =>
  new Date(`${key}-15T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });

const GREEN = '#43a047';
const GREEN_DARK = '#2e7d32';
const TEAL = '#0d9488';
const COW = '#43a047';
const BUFFALO = '#8d6e63';
const AM = '#f59e0b';
const PM = '#6366f1';

/** ▲/▼ month-over-month badge; null when there is no usable baseline. */
function Delta({ cur, prev, prevMonth }: { cur: number; prev: number; prevMonth: string }) {
  const t = useT();
  if (prev <= 0) {
    return <span className="dairy-ana-delta flat">{t('dairyAnaNoPrev')}</span>;
  }
  const pct = ((cur - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <>
      <span className={`dairy-ana-delta ${up ? 'up' : 'down'}`}>
        {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%
      </span>{' '}
      <span className="dairy-ana-delta-vs">{t('dairyAnaVsPrev', { month: shortMonth(prevMonth) })}</span>
    </>
  );
}

/** Chart tile with a title; children = AnaBars or an empty state. */
function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="dairy-card dairy-ana-chart">
      <span className="dairy-ana-chart-title">{title}</span>
      {children}
    </div>
  );
}

function ChartEmpty() {
  const t = useT();
  return (
    <div className="dairy-ana-empty">
      <span aria-hidden>📉</span>
      <p>{t('dairyAnaNoData')}</p>
    </div>
  );
}

const MEDALS = ['🥇', '🥈', '🥉'];

/**
 * Dairy analytics cockpit (P11) — month navigator, KPI strip with
 * month-over-month deltas, hand-rolled SVG charts, top-members leaderboard
 * and sales-by-status chips. Manager-only (403 otherwise).
 */
export default function AnalyticsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('dairyManager');

  const [month, setMonth] = useState(currentMonthStr());
  const [data, setData] = useState<DairyAnalytics | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback((m: string) => {
    setFailed(false);
    getDairyAnalytics(m)
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => load(month), [load, month]);

  const prevMonth = shiftMonth(month, -1);
  const col = data?.collections;
  const sal = data?.sales;
  const dues = data?.dues;
  const prev = data?.previousMonth;

  const speciesData = [
    { label: t('dairyMilk_cow'), value: col?.bySpecies.cow?.liters ?? ZERO, color: COW },
    { label: t('dairyMilk_buffalo'), value: col?.bySpecies.buffalo?.liters ?? ZERO, color: BUFFALO },
  ];
  const shiftData = [
    { label: t('dairyShift_morning'), value: col?.byShift.morning?.liters ?? ZERO, color: AM },
    { label: t('dairyShift_evening'), value: col?.byShift.evening?.liters ?? ZERO, color: PM },
  ];
  const litersFmt = (v: number) => `${fmtL(v)} L`;

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console">
      <div className="dairy-wrap">
        <div className="dairy-ana-nav">
          <button
            type="button"
            className="av-btn av-btn-ghost dairy-ana-nav-btn"
            aria-label={t('dairyAnaPrevMonth')}
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            ‹
          </button>
          <span className="dairy-ana-nav-label">{monthLabel(month)}</span>
          <button
            type="button"
            className="av-btn av-btn-ghost dairy-ana-nav-btn"
            aria-label={t('dairyAnaNextMonth')}
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            ›
          </button>
          <input
            className="av-input dairy-ana-nav-input"
            type="month"
            value={month}
            aria-label={t('dairyAnaJumpMonth')}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </div>

        {failed ? (
          <EmptyState
            icon="📡"
            titleKey="dairyLoadFailed"
            action={
              <button type="button" className="av-btn av-btn-ghost" onClick={() => load(month)}>
                ↻ {t('retry')}
              </button>
            }
          />
        ) : null}

        {!failed && !data ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

        {data && col && sal && dues && prev ? (
          <>
            <div className="dairy-stats-grid">
              <DairyStatCard
                label={t('dairyAnaCollectedLiters')}
                value={fmtL(col.liters)}
                unit={t('dairyLiters')}
                sub={<Delta cur={col.liters} prev={prev.collections.liters} prevMonth={prevMonth} />}
              />
              <DairyStatCard
                label={t('dairyAnaCollectedAmount')}
                value={fmtINR(col.amount)}
                sub={<Delta cur={col.amount} prev={prev.collections.amount} prevMonth={prevMonth} />}
              />
              <DairyStatCard
                label={t('dairyAnaAvgFat')}
                value={col.count > 0 ? col.avgFat.toFixed(2) : '—'}
                unit="%"
                sub={t('dairyAnaXCollections', { count: col.count })}
              />
              <DairyStatCard
                label={t('dairyAnaAvgSnf')}
                value={col.count > 0 ? col.avgSnf.toFixed(2) : '—'}
                unit="%"
                sub={t('dairyAnaXCollections', { count: col.count })}
              />
              <DairyStatCard
                label={t('dairyAnaSalesAmount')}
                value={fmtINR(sal.amount)}
                sub={<Delta cur={sal.amount} prev={prev.sales.amount} prevMonth={prevMonth} />}
              />
            </div>

            <button
              type="button"
              className="dairy-ana-stat-warn"
              onClick={() => navigate('/dairy/console/payments')}
            >
              <span className="dairy-stat-label">{t('dairyAnaDuesPending')}</span>
              <span className="dairy-stat-value">{fmtINR(dues.pendingNet)}</span>
              <span className="dairy-stat-sub">
                {t('dairyAnaXPendingEntries', { count: dues.pendingEntries })} →
              </span>
            </button>

            <div className="dairy-ana-grid">
              <ChartCard title={`🥛 ${t('dairyAnaDailyLiters')}`}>
                {col.daily.length === 0 ? (
                  <ChartEmpty />
                ) : (
                  <AnaBars
                    data={col.daily.map((d) => ({ label: d.date.slice(8, 10), value: d.liters }))}
                    color={GREEN}
                    format={litersFmt}
                  />
                )}
              </ChartCard>

              <ChartCard title={`💰 ${t('dairyAnaDailyAmount')}`}>
                {col.daily.length === 0 ? (
                  <ChartEmpty />
                ) : (
                  <AnaBars
                    data={col.daily.map((d) => ({ label: d.date.slice(8, 10), value: d.amount }))}
                    color={GREEN_DARK}
                    format={fmtINR}
                  />
                )}
              </ChartCard>

              <ChartCard title={`🏪 ${t('dairyAnaDailySales')}`}>
                {sal.daily.length === 0 ? (
                  <ChartEmpty />
                ) : (
                  <AnaBars
                    data={sal.daily.map((d) => ({ label: d.date.slice(8, 10), value: d.amount }))}
                    color={TEAL}
                    format={fmtINR}
                  />
                )}
              </ChartCard>

              <ChartCard title={`🐄 ${t('dairyAnaSpeciesSplit')}`}>
                {speciesData.every((d) => d.value <= 0) ? (
                  <ChartEmpty />
                ) : (
                  <AnaBars data={speciesData} color={GREEN} format={litersFmt} horizontal />
                )}
              </ChartCard>

              <ChartCard title={`🌗 ${t('dairyAnaShiftSplit')}`}>
                {shiftData.every((d) => d.value <= 0) ? (
                  <ChartEmpty />
                ) : (
                  <AnaBars data={shiftData} color={AM} format={litersFmt} horizontal />
                )}
              </ChartCard>
            </div>

            <div className="dairy-section">
              <span className="dairy-section-title">🏆 {t('dairyAnaTopMembers')}</span>
              {col.topMembers.length === 0 ? (
                <ChartEmpty />
              ) : (
                <div className="dairy-table-wrap" style={{ marginTop: 0 }}>
                  <table className="dairy-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>{t('dairyTblMember')}</th>
                        <th>{t('dairyTblLiters')}</th>
                        <th>{t('dairyTblAmount')}</th>
                        <th>{t('dairyStatCollections')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {col.topMembers.map((m, i) => (
                        <tr key={m.memberId}>
                          <td>{i < 3 ? MEDALS[i] : `${i + 1}.`}</td>
                          <td>{m.name || m.memberId}</td>
                          <td className="dairy-table-num">{fmtL(m.liters)} L</td>
                          <td className="dairy-table-num">{fmtINR(m.amount)}</td>
                          <td className="dairy-table-num">{m.collections}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="dairy-section">
              <span className="dairy-section-title">🧾 {t('dairyAnaSalesByStatus')}</span>
              {Object.keys(sal.byStatus).length === 0 ? (
                <ChartEmpty />
              ) : (
                <div className="dairy-chip-row" style={{ marginTop: 0 }}>
                  {Object.entries(sal.byStatus).map(([status, count]) => (
                    <span key={status} className="dairy-ana-status-chip">
                      <StatusChip status={status} />
                      <span className="dairy-ana-status-count">×{count}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
