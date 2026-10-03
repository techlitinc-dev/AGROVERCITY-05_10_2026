import { ZERO } from '../../lib/numDefaults';
import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { pnlDashboard, type PnlCashflowMonth, type PnlDashboard } from '../../lib/api/pnl';
import { inr } from '../../lib/api/trade';
import { categoryLabel } from '../../lib/cashbook-catalog';
import { downloadCsv } from '../../lib/csv';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Farm P&L ("Finance CEO") — full profit & loss + cash-flow analysis over the
 * user's cashbook: executive summary with period deltas, a P&L statement,
 * paired monthly bars + cumulative cash-position line, category deep-dive,
 * a category × month matrix, counterparties, crop P&L, highlights and CSV
 * exports. Data comes from `/pnl/dashboard` (lib/api/pnl).
 */

const GREEN = 'var(--av-success)';
const RED = 'var(--av-error)';

const PERIODS: Array<{ months: number; key: string }> = [
  { months: 6, key: 'pnlLast6' },
  { months: 12, key: 'pnlLast12' },
  { months: 24, key: 'pnlLast24' },
];

const monthShort = (key: string): string => {
  const d = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString('en-IN', { month: 'short' });
};

/**
 * ▲/▼ delta chip. `inverted` = an increase is bad (costs) → ▲ red, ▼ green;
 * default = an increase is good (revenue/net) → ▲ green, ▼ red.
 */
function DeltaChip({ value, inverted }: { value: number; inverted?: boolean }) {
  const t = useT();
  const up = value >= 0;
  const good = inverted ? !up : up;
  return (
    <span className={good ? 'trade-delta-down' : 'trade-delta-up'}>
      {t(up ? 'pnlUp' : 'pnlDown', { pct: Math.abs(value).toFixed(1) })}
    </span>
  );
}

/** Hand-rolled SVG line for the cumulative net cash position. */
function CumulativeChart({ points }: { points: PnlCashflowMonth[] }) {
  const t = useT();
  const W = 320;
  const H = 120;
  const PAD = 10;
  const values = points.map((p) => p.cumulativeNet);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(max - min, 1);
  const stepX = (W - PAD * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => ({
    x: PAD + i * stepX,
    y: H - PAD - ((p.cumulativeNet - min) / span) * (H - PAD * 2),
  }));
  return (
    <div className="trade-card" style={{ cursor: 'default' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block' }}
        role="img"
        aria-label={t('pnlCumulativeNet')}
      >
        <polyline
          points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
          fill="none"
          stroke="var(--av-green-dark)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <circle key={points[i].month} cx={c.x} cy={c.y} r="3" fill="var(--av-green-dark)" />
        ))}
      </svg>
      <div className="trade-card-row" style={{ padding: '0 4px 4px' }}>
        <span className="trade-card-sub">{monthShort(points[0].month)}</span>
        <span className="trade-card-sub">
          {inr(min)} – {inr(max)}
        </span>
        <span className="trade-card-sub">{monthShort(points[points.length - 1].month)}</span>
      </div>
    </div>
  );
}

export default function FarmCeoPage() {
  const t = useT();
  const navigate = useNavigate();

  const [months, setMonths] = useState(12);
  const [dashboard, setDashboard] = useState<PnlDashboard | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    pnlDashboard(months)
      .then(setDashboard)
      .catch(() => setFailed(true));
  }, [months]);

  useEffect(() => {
    load();
  }, [load]);

  if (dashboard === null && !failed) {
    return (
      <ToolShell toolId="profitLoss">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  if (failed || dashboard === null) {
    return (
      <ToolShell toolId="profitLoss">
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  const d = dashboard;

  if (d.summary.income === 0 && d.summary.expense === 0) {
    return (
      <ToolShell toolId="profitLoss">
        <EmptyState
          icon="📒"
          titleKey="pnlNoData"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              style={{ width: '100%' }}
              onClick={() => navigate('/dashboard/p/farmDiary')}
            >
              {t('pnlGoCashbook')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  const s = d.summary;
  const chartMax = Math.max(1, ...d.cashflow.flatMap((m) => [m.income, m.expense]));
  const expensesFirst = [...d.categoryDeepDive].sort((a, b) =>
    a.type === b.type ? 0 : a.type === 'expense' ? -1 : 1
  );
  const deepDive = expensesFirst.slice(0, 6);
  const matrixCats = expensesFirst.filter((c) => c.type === 'expense').slice(0, 5);
  const hasStatement = d.statement.income.length + d.statement.expense.length > 0;
  const h = d.highlights;

  const exportStatement = () => {
    downloadCsv(
      'pnl-statement.csv',
      ['section', 'category', 'type', 'amount', 'sharePct', 'count'],
      [
        ...d.statement.income.map((l) => [
          t('pnlIncomeLines'),
          categoryLabel(l.category),
          l.type,
          l.amount,
          l.sharePct,
          l.count,
        ]),
        ...d.statement.expense.map((l) => [
          t('pnlExpenseLines'),
          categoryLabel(l.category),
          l.type,
          l.amount,
          l.sharePct,
          l.count,
        ]),
      ]
    );
  };

  const exportCashflow = () => {
    downloadCsv(
      'pnl-cashflow.csv',
      ['month', 'income', 'expense', 'net', 'cumulativeNet', 'savingsRate'],
      d.cashflow.map((m) => [m.month, m.income, m.expense, m.net, m.cumulativeNet, m.savingsRate])
    );
  };

  const thCell: CSSProperties = {
    padding: 6,
    textAlign: 'right',
    fontWeight: 800,
    color: 'var(--av-title)',
    whiteSpace: 'nowrap',
    position: 'sticky',
    top: 0,
    background: '#fff',
    borderBottom: '1.5px solid var(--av-border-grey-soft)',
  };
  const tdCell: CSSProperties = { padding: 6, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--av-slate-4)' };

  return (
    <ToolShell toolId="profitLoss">
      {/* ---- A) Period ---- */}
      <div className="trade-filter-row">
        {PERIODS.map((p) => (
          <button
            key={p.months}
            type="button"
            className={`av-chip${months === p.months ? ' selected' : ''}`}
            onClick={() => setMonths(p.months)}
          >
            {t(p.key)}
          </button>
        ))}
      </div>
      <p className="trade-hint">{t('pnlWindowLabel', { from: d.window.from, to: d.window.to })}</p>

      {/* ---- B) Executive summary ---- */}
      <div className="trade-stats-grid">
        <div className="trade-stat">
          <p className="trade-stat-label">{t('pnlRevenue')}</p>
          <p className="trade-stat-value" style={{ color: GREEN }}>{inr(s.income)}</p>
          {s.prevIncome !== 0 ? (
            <p className="trade-hint" style={{ marginTop: 2 }}><DeltaChip value={s.incomeDeltaPct} /></p>
          ) : null}
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('pnlCosts')}</p>
          <p className="trade-stat-value" style={{ color: RED }}>{inr(s.expense)}</p>
          {s.prevExpense !== 0 ? (
            <p className="trade-hint" style={{ marginTop: 2 }}><DeltaChip value={s.expenseDeltaPct} inverted /></p>
          ) : null}
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('pnlNetProfit')}</p>
          <p className="trade-stat-value" style={{ fontSize: 22, color: s.net >= 0 ? GREEN : RED }}>
            {inr(s.net)}
          </p>
          {s.prevNet !== 0 ? (
            <p className="trade-hint" style={{ marginTop: 2 }}><DeltaChip value={s.netDeltaPct} /></p>
          ) : null}
          <p className="trade-hint" style={{ marginTop: 2 }}>
            {t('pnlMargin')} {s.marginPct.toFixed(1)}%
          </p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('pnlSavingsRate')}</p>
          <p className="trade-stat-value">{s.savingsRate.toFixed(1)}%</p>
          {s.prevSavingsRate !== 0 ? (
            <p className="trade-hint" style={{ marginTop: 2 }}>
              {t('pnlVsPrev', { months })} · {s.prevSavingsRate.toFixed(1)}%
            </p>
          ) : null}
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('pnlExpenseRatio')}</p>
          <p className="trade-stat-value">{s.expenseRatioPct.toFixed(1)}%</p>
        </div>
      </div>

      {/* ---- C) P&L statement ---- */}
      <p className="trade-section-title">{t('pnlStatementTitle')}</p>
      <div className="trade-invoice-box" style={{ marginTop: 0 }}>
        <div className="trade-invoice-row" style={{ fontWeight: 800, color: 'var(--av-title)' }}>
          <span>{t('pnlIncomeLines')}</span>
          <span />
        </div>
        {d.statement.income.map((l) => (
          <div key={l.category} className="trade-invoice-row">
            <span>{categoryLabel(l.category)}</span>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ color: GREEN, fontWeight: 700 }}>{inr(l.amount)}</span>
              <span style={{ width: 46, textAlign: 'right', color: 'var(--av-slate-2)' }}>
                {l.sharePct.toFixed(1)}%
              </span>
            </span>
          </div>
        ))}
        <div className="trade-invoice-row" style={{ fontWeight: 800, color: 'var(--av-title)' }}>
          <span>{t('pnlTotalIncome')}</span>
          <span>{inr(s.income)}</span>
        </div>
        <div style={{ height: 6 }} aria-hidden />
        <div className="trade-invoice-row" style={{ fontWeight: 800, color: 'var(--av-title)' }}>
          <span>{t('pnlExpenseLines')}</span>
          <span />
        </div>
        {d.statement.expense.map((l) => (
          <div key={l.category} className="trade-invoice-row">
            <span>{categoryLabel(l.category)}</span>
            <span style={{ display: 'inline-flex', gap: 8, alignItems: 'baseline' }}>
              <span style={{ color: RED, fontWeight: 700 }}>−{inr(l.amount)}</span>
              <span style={{ width: 46, textAlign: 'right', color: 'var(--av-slate-2)' }}>
                {l.sharePct.toFixed(1)}%
              </span>
            </span>
          </div>
        ))}
        <div className="trade-invoice-row" style={{ fontWeight: 800, color: 'var(--av-title)' }}>
          <span>{t('pnlTotalExpense')}</span>
          <span>{inr(s.expense)}</span>
        </div>
        <div className="trade-invoice-row trade-invoice-total">
          <span>{t('pnlNetProfit')}</span>
          <span style={{ color: s.net >= 0 ? GREEN : RED }}>{inr(s.net)}</span>
        </div>
      </div>
      <p className="trade-hint">
        {t('pnlGrossMarginNote', { amount: `₹${(s.marginPct / 100).toFixed(2)}` })}
      </p>

      {/* ---- D) Cash flow + cumulative position ---- */}
      <p className="trade-section-title">{t('pnlCashflowTitle')}</p>
      <div className="cb-chart" role="img" aria-label={t('pnlCashflowTitle')}>
        {d.cashflow.map((m) => (
          <div key={m.month} className="cb-col">
            <div className="cb-bars">
              <div
                className="cb-bar-in"
                style={{ height: `${Math.max(2, (m.income / chartMax) * 100)}%` }}
                title={`${monthShort(m.month)}: ${inr(m.income)}`}
              />
              <div
                className="cb-bar-out"
                style={{ height: `${Math.max(2, (m.expense / chartMax) * 100)}%` }}
                title={`${monthShort(m.month)}: ${inr(m.expense)}`}
              />
            </div>
            <span className="cb-month">{monthShort(m.month)}</span>
          </div>
        ))}
      </div>
      <p className="trade-hint">{t('pnlCumulativeNet')}</p>
      {d.cashflow.length > 1 ? <CumulativeChart points={d.cashflow} /> : null}

      {/* ---- E) Deep dive ---- */}
      {deepDive.length > 0 ? (
        <>
          <p className="trade-section-title">{t('pnlDeepDiveTitle')}</p>
          <div className="trade-list" style={{ marginTop: 0 }}>
            {deepDive.map((c) => (
              <div key={`${c.type}-${c.category}`} className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span
                    className="trade-card-title"
                    style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                  >
                    {categoryLabel(c.category)}
                  </span>
                  {c.spike ? (
                    <span
                      className="trade-pill"
                      style={{ borderColor: 'var(--av-gold-text)', color: 'var(--av-gold-text)' }}
                    >
                      {t('pnlSpikeBadge')}
                    </span>
                  ) : null}
                </div>
                <div className="trade-bar-row" style={{ padding: '8px 10px' }}>
                  <span className="trade-card-sub">
                    {t('pnlShareOfSpend', {
                      pct: c.sharePct.toFixed(1),
                      type: t(c.type === 'expense' ? 'pnlSpend' : 'pnlEarnings'),
                    })}
                  </span>
                  <div className="trade-bar-track">
                    <div className="trade-bar-fill" style={{ width: `${Math.min(100, c.sharePct)}%` }} />
                  </div>
                  <span className="trade-bar-count">{c.count}</span>
                </div>
                <p className="trade-card-sub">
                  {t('pnlAvgMonth', { amount: inr(Math.round(c.avgPerMonth)) })} ·{' '}
                  {t('pnlPeak', { month: monthShort(c.maxMonth.month) })}
                </p>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* ---- F) Category × month matrix ---- */}
      {matrixCats.length > 0 ? (
        <>
          <p className="trade-section-title">{t('pnlMatrixTitle')}</p>
          <p className="trade-hint" style={{ marginTop: -2 }}>{t('pnlMatrixHint')}</p>
          <div className="trade-card" style={{ cursor: 'default', padding: '10px 12px' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ ...thCell, textAlign: 'left' }} />
                    {d.cashflow.map((m) => (
                      <th key={m.month} style={thCell}>{monthShort(m.month)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrixCats.map((cat) => (
                    <tr key={cat.category} style={{ borderBottom: '1px solid var(--av-border-grey-soft)' }}>
                      <td style={{ ...tdCell, textAlign: 'left', fontWeight: 700, color: 'var(--av-title)' }}>
                        {categoryLabel(cat.category)}
                      </td>
                      {d.cashflow.map((m) => {
                        const amt = cat.monthly.find((x) => x.month === m.month)?.amount ?? ZERO;
                        const isPeak = amt > 0 && m.month === cat.maxMonth.month;
                        return (
                          <td
                            key={m.month}
                            style={{
                              ...tdCell,
                              fontWeight: isPeak ? 900 : 500,
                              color: isPeak ? RED : tdCell.color,
                            }}
                          >
                            {amt > 0 ? inr(amt) : '·'}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* ---- G) Counterparties ---- */}
      <p className="trade-section-title">{t('pnlPartiesTitle')}</p>
      {d.parties.length === 0 ? (
        <p className="trade-hint">{t('pnlEmptyParties')}</p>
      ) : (
        <div className="trade-list" style={{ marginTop: 0 }}>
          {d.parties.slice(0, 8).map((p) => (
            <div key={p.party} className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">{p.party}</span>
                <span style={{ display: 'flex', flexDirection: 'column', textAlign: 'right', gap: 2 }}>
                  <span className="trade-card-sub" style={{ color: GREEN }}>
                    +{inr(p.inflow)} {t('pnlPartyIn')}
                  </span>
                  <span className="trade-card-sub" style={{ color: RED }}>
                    −{inr(p.outflow)} {t('pnlPartyOut')}
                  </span>
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- H) Crop / activity P&L ---- */}
      {d.crops.length > 0 ? (
        <>
          <p className="trade-section-title">{t('pnlCropsTitle')}</p>
          <div className="trade-invoice-box" style={{ marginTop: 0 }}>
            <div
              className="trade-invoice-row"
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 1fr 1fr 1fr 0.8fr',
                fontWeight: 800,
                color: 'var(--av-title)',
              }}
            >
              <span>{t('cbCropCol')}</span>
              <span style={{ textAlign: 'right' }}>{t('cbInShort')}</span>
              <span style={{ textAlign: 'right' }}>{t('cbOutShort')}</span>
              <span style={{ textAlign: 'right' }}>{t('pnlNetProfit')}</span>
              <span style={{ textAlign: 'right' }}>{t('pnlMarginCol')}</span>
            </div>
            {d.crops.map((c) => (
              <div
                key={c.cropName}
                className="trade-invoice-row"
                style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr 0.8fr' }}
              >
                <span>{c.cropName}</span>
                <span style={{ textAlign: 'right', color: GREEN }}>{inr(c.income)}</span>
                <span style={{ textAlign: 'right', color: RED }}>{inr(c.expense)}</span>
                <span style={{ textAlign: 'right', fontWeight: 800, color: c.net >= 0 ? GREEN : RED }}>
                  {inr(c.net)}
                </span>
                <span
                  style={{ textAlign: 'right' }}
                  className={c.marginPct >= 50 ? 'trade-delta-up' : c.marginPct < 0 ? 'trade-delta-down' : undefined}
                >
                  {c.marginPct.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* ---- I) CEO highlights ---- */}
      <p className="trade-section-title">{t('pnlHighlightsTitle')}</p>
      <div className="trade-stats-grid">
        {h.bestMonth ? (
          <div className="trade-stat">
            <p className="trade-stat-label">{t('pnlBestMonth')}</p>
            <p className="trade-stat-value">{monthShort(h.bestMonth.month)}</p>
            <p className="trade-hint" style={{ marginTop: 2, color: GREEN }}>{inr(h.bestMonth.net)}</p>
          </div>
        ) : null}
        {h.worstMonth ? (
          <div className="trade-stat">
            <p className="trade-stat-label">{t('pnlWorstMonth')}</p>
            <p className="trade-stat-value">{monthShort(h.worstMonth.month)}</p>
            <p className="trade-hint" style={{ marginTop: 2, color: RED }}>{inr(h.worstMonth.net)}</p>
          </div>
        ) : null}
        {h.biggestExpense ? (
          <div className="trade-stat">
            <p className="trade-stat-label">{t('pnlBiggestExpense')}</p>
            <p className="trade-stat-value" style={{ fontSize: 16 }}>{inr(h.biggestExpense.amount)}</p>
            <p className="trade-hint" style={{ marginTop: 2 }}>
              {categoryLabel(h.biggestExpense.category)} · {h.biggestExpense.sharePct.toFixed(1)}%
            </p>
          </div>
        ) : null}
        {h.topParty ? (
          <div className="trade-stat">
            <p className="trade-stat-label">{t('pnlTopParty')}</p>
            <p className="trade-stat-value" style={{ fontSize: 16 }}>
              {inr(Math.max(h.topParty.inflow, h.topParty.outflow))}
            </p>
            <p className="trade-hint" style={{ marginTop: 2 }}>{h.topParty.party}</p>
          </div>
        ) : null}
      </div>

      {/* ---- J) Export + cashbook CTA ---- */}
      <div className="trade-actions-row" style={{ marginTop: 18 }}>
        <button
          type="button"
          className="av-btn av-btn-ghost"
          onClick={exportStatement}
          disabled={!hasStatement}
        >
          ⬇ {t('pnlExportStatement')}
        </button>
        <button
          type="button"
          className="av-btn av-btn-ghost"
          onClick={exportCashflow}
          disabled={d.cashflow.length === 0}
        >
          ⬇ {t('pnlExportCashflow')}
        </button>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => navigate('/dashboard/p/farmDiary')}
        >
          {t('pnlGoCashbook')}
        </button>
      </div>
    </ToolShell>
  );
}
