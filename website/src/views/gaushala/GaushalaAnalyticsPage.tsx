import { useCallback, useEffect, useMemo, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { fmtINR, getGaushalaAnalytics, type GaushalaAnalytics } from '../../lib/api/gaushala';
import { useT } from '../../lib/i18n';
import '../../lib/i18n/locales/en.gaushala';
import '../../lib/i18n/locales/hi.gaushala';
import '../../theme/gaushala.css';
import GaushalaBarChart from './GaushalaBarChart';

const STATUS_COLORS: Record<string, string> = {
  'in-shelter': '#16A34A',
  'adopted-out': '#0D9488',
  deceased: '#DC2626',
  transferred: '#D97706',
};

const currentMonth = (): string => new Date().toLocaleDateString('en-CA').slice(0, 7);

/** '2026-06' → 'Jun 26' */
const monthShort = (ym: string): string => {
  const d = new Date(`${ym}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return ym;
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
};

/** Analytics (P8) — 6-month expenses/donations bar chart, month summary, category + status breakdowns. */
export default function GaushalaAnalyticsPage() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [month, setMonth] = useState(currentMonth());
  const [analytics, setAnalytics] = useState<GaushalaAnalytics | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    getGaushalaAnalytics(month)
      .then(setAnalytics)
      .catch(() => setFailed(true));
  }, [month]);

  useEffect(load, [load]);

  const selected = useMemo(() => {
    if (!analytics) return null;
    return analytics.monthly.find((m) => m.month === analytics.month) ?? null;
  }, [analytics]);

  const chartData = useMemo(
    () =>
      (analytics?.monthly ?? []).map((m) => ({
        label: monthShort(m.month),
        expenses: m.expenses,
        donations: m.donations,
      })),
    [analytics]
  );

  const maxCategory = Math.max(1, ...Object.values(analytics?.expenseByCategory ?? {}));
  const allZero = (analytics?.monthly ?? []).every((m) => m.expenses === 0 && m.donations === 0);

  return (
    <ToolShell toolId="gaushalaConsole" backTo="/gaushala/console">
      <div className="gaushala-wrap">
        <div className="av-field" style={{ marginTop: 4 }}>
          <label className="av-label">{t('gaushalaAnalyticsMonth')}</label>
          <input className="av-input" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>

        {analytics === null && !failed ? <p className="gaushala-hint">{t('commonLoading')}</p> : null}

        {failed ? (
          <div className="gaushala-empty">
            <span className="gaushala-empty-icon" aria-hidden>
              📡
            </span>
            <p className="gaushala-empty-title">{t('gaushalaLoadFailed')}</p>
            <div className="gaushala-empty-action">
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            </div>
          </div>
        ) : null}

        {analytics ? (
          <>
            <GaushalaBarChart
              data={chartData}
              expensesLabel={t('gaushalaAnalyticsExpenses')}
              donationsLabel={t('gaushalaAnalyticsDonations')}
            />

            {allZero ? <p className="gaushala-hint">{t('gaushalaAnZero')}</p> : null}

            <div className="gaushala-section">
              <span className="gaushala-section-title">
                {t('gaushalaAnalyticsTitle')} · {monthShort(analytics.month)}
              </span>
              <div className="gaushala-stats-grid">
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaAnExpenses')}</div>
                  <div className="gaushala-stat-value">{fmtINR(selected?.expenses ?? 0)}</div>
                </div>
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaAnDonations')}</div>
                  <div className="gaushala-stat-value">{fmtINR(selected?.donations ?? 0)}</div>
                </div>
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaAnNet')}</div>
                  <div
                    className="gaushala-stat-value"
                    style={{
                      color:
                        (selected?.donations ?? 0) - (selected?.expenses ?? 0) >= 0
                          ? 'var(--av-green-dark)'
                          : 'var(--av-error)',
                    }}
                  >
                    {fmtINR((selected?.donations ?? 0) - (selected?.expenses ?? 0))}
                  </div>
                  <div className="gaushala-stat-sub">
                    {(selected?.donations ?? 0) - (selected?.expenses ?? 0) >= 0
                      ? t('gaushalaAnNetSurplus', {
                          amount: fmtINR((selected?.donations ?? 0) - (selected?.expenses ?? 0)),
                        })
                      : t('gaushalaAnNetBurn', {
                          amount: fmtINR((selected?.expenses ?? 0) - (selected?.donations ?? 0)),
                        })}
                  </div>
                </div>
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaAnAdoptions')}</div>
                  <div className="gaushala-stat-value">{selected?.adoptions ?? 0}</div>
                  <div className="gaushala-stat-sub">
                    {t('gaushalaAnAdoptionAmount')}: {fmtINR(selected?.adoptionAmount ?? 0)}
                  </div>
                </div>
                <div className="gaushala-stat">
                  <div className="gaushala-stat-label">{t('gaushalaAnIntakes')}</div>
                  <div className="gaushala-stat-value">{selected?.intakes ?? 0}</div>
                </div>
              </div>
            </div>

            <div className="gaushala-section">
              <span className="gaushala-section-title">{t('gaushalaAnByCategory')}</span>
              {Object.keys(analytics.expenseByCategory).length > 0 ? (
                Object.entries(analytics.expenseByCategory).map(([cat, amt]) => (
                  <div key={cat} className="gaushala-hbar-row">
                    <div className="gaushala-hbar-head">
                      <span>
                        {t(`gaushalaExp_${cat}`) !== `gaushalaExp_${cat}` ? t(`gaushalaExp_${cat}`) : cat}
                      </span>
                      <span>{fmtINR(amt)}</span>
                    </div>
                    <div className="gaushala-hbar-track">
                      <div
                        className="gaushala-hbar-fill"
                        style={{ width: `${Math.max(2, (amt / maxCategory) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="gaushala-hint" style={{ marginTop: 0 }}>
                  {fmtINR(0)}
                </p>
              )}
            </div>

            <div className="gaushala-section">
              <span className="gaushala-section-title">{t('gaushalaAnByStatus')}</span>
              {Object.keys(analytics.cattleByStatus).length > 0 ? (
                <div className="gaushala-chip-row" style={{ marginTop: 0 }}>
                  {Object.entries(analytics.cattleByStatus).map(([st, count]) => {
                    const color = STATUS_COLORS[st] ?? '#64748B';
                    const label =
                      t(`gaushala_status_${st}`) !== `gaushala_status_${st}` ? t(`gaushala_status_${st}`) : st;
                    return (
                      <span
                        key={st}
                        className="gaushala-pill"
                        style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                      >
                        {label} · {count}
                      </span>
                    );
                  })}
                </div>
              ) : (
                <p className="gaushala-hint" style={{ marginTop: 0 }}>
                  {t('gaushalaDashCategoriesEmpty')}
                </p>
              )}
            </div>
          </>
        ) : null}
      </div>
    </ToolShell>
  );
}
