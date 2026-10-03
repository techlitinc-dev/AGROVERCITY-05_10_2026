import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../../components/trade/ToolShell';
import { useEnsureProfile } from '../../../components/trade/useEnsureProfile';
import { toast } from '../../../components/toast';
import { fmtINR, fmtL, getDailyReport, getPlReport, type DailyReport, type PlReport } from '../../../lib/api/dairy';
import { downloadCsv } from '../../../lib/csv';
import { useT } from '../../../lib/i18n';
import '../../../lib/i18n/locales/en.dairy-sales';
import '../../../lib/i18n/locales/hi.dairy-sales';
import '../../../theme/dairy-sales.css';
import DairyStatCard from '../components/DairyStatCard';
import EmptyState from '../components/EmptyState';

const todayStr = (): string => new Date().toLocaleDateString('en-CA');

const currentMonthStr = (): string => todayStr().slice(0, 7);

/**
 * Reports (P6) — daily procurement-vs-sales report with closing stock, and
 * the monthly P&L ("is my center profitable") screen.
 */
export default function ReportsPage() {
  const t = useT();
  useEnsureProfile('dairyManager');

  const [date, setDate] = useState(todayStr());
  const [month, setMonth] = useState(currentMonthStr());
  const [daily, setDaily] = useState<DailyReport | null>(null);
  const [pl, setPl] = useState<PlReport | null>(null);
  const [dailyFailed, setDailyFailed] = useState(false);
  const [plFailed, setPlFailed] = useState(false);

  const loadDaily = useCallback(() => {
    setDailyFailed(false);
    getDailyReport(date)
      .then(setDaily)
      .catch(() => setDailyFailed(true));
  }, [date]);

  const loadPl = useCallback(() => {
    setPlFailed(false);
    getPlReport(month)
      .then(setPl)
      .catch(() => setPlFailed(true));
  }, [month]);

  useEffect(loadDaily, [loadDaily]);
  useEffect(loadPl, [loadPl]);

  /** P11 — daily report: collections row + sales row. */
  const exportDailyCsv = useCallback(() => {
    if (!daily) return;
    downloadCsv(
      `daily-report-${date}.csv`,
      [t('dairyCsvSection'), t('dairyCsvCount'), t('dairyFormLiters'), t('dairyCsvAmount')],
      [
        [t('dairyStatCollections'), daily.collections.count, daily.collections.liters, daily.collections.amount],
        [t('dairyReportsSales'), daily.sales.orders, daily.sales.liters, daily.sales.amount],
      ]
    );
    toast(t('dairyCsvDone'));
  }, [daily, date, t]);

  /** P11 — P&L: single summary row for the selected month. */
  const exportPlCsv = useCallback(() => {
    if (!pl) return;
    downloadCsv(
      `pl-report-${pl.month}.csv`,
      [
        t('dairyCsvMonth'),
        t('dairyReportProcurementCost'),
        t('dairyReportSalesIncome'),
        t('dairyReportGrossProfit'),
        t('dairyStatCollections'),
        t('dairySalesOrders'),
      ],
      [[pl.month, pl.procurementCost, pl.salesIncome, pl.grossProfit, pl.collectionsCount, pl.ordersCount]]
    );
    toast(t('dairyCsvDone'));
  }, [pl, t]);

  return (
    <ToolShell toolId="dairyConsole" backTo="/dairy/console">
      <div className="dairy-wrap">
        <div className="dairy-section">
          <div className="dairy-card-row">
            <span className="dairy-section-title">📅 {t('dairyReportsDailyTitle')}</span>
            {daily ? (
              <button type="button" className="av-btn av-btn-ghost" onClick={exportDailyCsv}>
                ⬇ {t('dairyCsvExport')}
              </button>
            ) : null}
          </div>
          <div className="dairy-sales-picker">
            <div className="av-field">
              <label className="av-label">{t('dairyDate')}</label>
              <input className="av-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
          </div>

          {dailyFailed ? (
            <EmptyState
              icon="📡"
              titleKey="dairyLoadFailed"
              action={
                <button type="button" className="av-btn av-btn-ghost" onClick={loadDaily}>
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}

          {!daily && !dailyFailed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

          {daily ? (
            <>
              <div className="dairy-section-title" style={{ marginTop: 8 }}>
                🥛 {t('dairyStatCollections')}
              </div>
              <div className="dairy-stats-grid" style={{ marginTop: 4 }}>
                <DairyStatCard label={t('dairyStatCollections')} value={String(daily.collections.count)} />
                <DairyStatCard
                  label={t('dairySalesLiters')}
                  value={fmtL(daily.collections.liters)}
                  unit={t('dairyLiters')}
                />
                <DairyStatCard label={t('dairyAmount')} value={fmtINR(daily.collections.amount)} />
              </div>

              <div className="dairy-section-title" style={{ marginTop: 12 }}>
                🏪 {t('dairyReportsSales')}
              </div>
              <div className="dairy-stats-grid" style={{ marginTop: 4 }}>
                <DairyStatCard label={t('dairySalesOrders')} value={String(daily.sales.orders)} />
                <DairyStatCard
                  label={t('dairySalesLiters')}
                  value={fmtL(daily.sales.liters)}
                  unit={t('dairyLiters')}
                />
                <DairyStatCard label={t('dairyAmount')} value={fmtINR(daily.sales.amount)} />
              </div>

              <div className="dairy-section-title" style={{ marginTop: 12 }}>
                🥣 {t('dairyReportClosingStock')}
              </div>
              {daily.closingStock.length === 0 ? (
                <p className="dairy-hint">{t('dairyReportNoStock')}</p>
              ) : (
                <div className="dairy-list" style={{ marginTop: 4 }}>
                  {daily.closingStock.map((s) => (
                    <div key={s.id} className="dairy-card">
                      <div className="dairy-card-row">
                        <span className="dairy-card-title">{s.name}</span>
                        <span className="dairy-card-amount">
                          {s.stockQty} {s.unit || ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>

        <div className="dairy-section">
          <div className="dairy-card-row">
            <span className="dairy-section-title">📈 {t('dairyReportsPlTitle')}</span>
            {pl ? (
              <button type="button" className="av-btn av-btn-ghost" onClick={exportPlCsv}>
                ⬇ {t('dairyCsvExport')}
              </button>
            ) : null}
          </div>
          <div className="dairy-sales-picker">
            <div className="av-field">
              <label className="av-label">{t('dairyMonthLabel')}</label>
              <input
                className="av-input"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
            </div>
          </div>

          {plFailed ? (
            <EmptyState
              icon="📡"
              titleKey="dairyLoadFailed"
              action={
                <button type="button" className="av-btn av-btn-ghost" onClick={loadPl}>
                  ↻ {t('retry')}
                </button>
              }
            />
          ) : null}

          {!pl && !plFailed ? <p className="dairy-hint">{t('commonLoading')}</p> : null}

          {pl ? (
            <>
              <div className="dairy-stat" style={{ marginTop: 4 }}>
                <div className="dairy-stat-label">{t('dairyReportGrossProfit')}</div>
                <div className={`dairy-sales-pl-value ${pl.grossProfit >= 0 ? 'pos' : 'neg'}`}>
                  {pl.grossProfit >= 0 ? '' : '−'}
                  {fmtINR(Math.abs(pl.grossProfit))}
                </div>
                <div className="dairy-stat-sub">
                  {t('dairyReportSalesIncome')}: {fmtINR(pl.salesIncome)} · {t('dairyReportProcurementCost')}:{' '}
                  {fmtINR(pl.procurementCost)}
                </div>
              </div>

              <div className="dairy-stats-grid">
                <DairyStatCard
                  label={t('dairyReportProcurementCost')}
                  value={fmtINR(pl.procurementCost)}
                  sub={t('dairyReportXCollections', { count: pl.collectionsCount })}
                />
                <DairyStatCard
                  label={t('dairyReportSalesIncome')}
                  value={fmtINR(pl.salesIncome)}
                  sub={t('dairyReportXOrders', { count: pl.ordersCount })}
                />
                <DairyStatCard
                  label={t('dairySalesOrders')}
                  value={String(pl.ordersCount)}
                  sub={`${t('dairyReportXCollections', { count: pl.collectionsCount })}`}
                />
              </div>
            </>
          ) : null}
        </div>
      </div>
    </ToolShell>
  );
}
