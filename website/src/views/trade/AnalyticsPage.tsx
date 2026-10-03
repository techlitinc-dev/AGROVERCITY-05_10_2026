import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import StatusPill from '../../components/trade/StatusPill';
import ToolShell from '../../components/trade/ToolShell';
import { useEnsureProfile } from '../../components/trade/useEnsureProfile';
import { buyerAnalytics, type BuyerAnalytics } from '../../lib/api/discovery';
import { mandiList, mandiPriceHistory, type MandiInfo } from '../../lib/api/mandi';
import { myPurchases, type Purchase } from '../../lib/api/purchases';
import {
  listProcurement,
  listSales,
  type ProcurementLot,
  type SaleEntry,
} from '../../lib/api/seller';
import { inr } from '../../lib/api/trade';
import { csvDate, downloadCsv } from '../../lib/csv';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const pct = (rate: number): string => `${Math.round(rate * 100)}%`;

const monthLabel = (key: string): string => {
  const d = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
};

const monthShort = (key: string): string => {
  const d = new Date(`${key}-01T00:00:00`);
  return Number.isNaN(d.getTime()) ? key : d.toLocaleDateString('en-IN', { month: 'short' });
};

interface ExtraData {
  sales: SaleEntry[];
  purchases: Purchase[];
  procurement: ProcurementLot[];
}

/**
 * Procurement analytics (vyapari / direct buyer) — the professional control
 * tower: headline KPIs, P&L summary (procurement vs POS vs commission),
 * booking-status funnel, 12-month spend chart, crop mix benchmarked against
 * mandi modal with deltas, mandi price trend, supplier network, and one-tap
 * CSV exports. All data comes from existing endpoints.
 */
export default function AnalyticsPage() {
  const t = useT();
  const navigate = useNavigate();
  useEnsureProfile('seller');

  const [analytics, setAnalytics] = useState<BuyerAnalytics | null>(null);
  const [extra, setExtra] = useState<ExtraData | null>(null);
  const [failed, setFailed] = useState(false);

  // Price-trend mini state
  const [mandis, setMandis] = useState<MandiInfo[]>([]);
  const [trendCrop, setTrendCrop] = useState('');
  const [trendMandi, setTrendMandi] = useState('');
  const [trendPoints, setTrendPoints] = useState<Array<{ date: string; modalPrice: number }>>([]);

  const load = useCallback(() => {
    setFailed(false);
    buyerAnalytics()
      .then((a) => {
        setAnalytics(a);
        if (!trendCrop && a.cropBreakdown.length > 0) setTrendCrop(a.cropBreakdown[0].crop);
      })
      .catch(() => setFailed(true));
    Promise.allSettled([listSales(), myPurchases('buyer', 100), listProcurement()]).then(
      ([sales, purchases, procurement]) => {
        setExtra({
          sales: sales.status === 'fulfilled' ? sales.value.data : [],
          purchases: purchases.status === 'fulfilled' ? purchases.value.data : [],
          procurement: procurement.status === 'fulfilled' ? procurement.value.data : [],
        });
      }
    );
    mandiList()
      .then((res) => setMandis(res.data))
      .catch(() => setMandis([]));
  }, [trendCrop]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  // Price trend fetch (crop/mandi selection)
  useEffect(() => {
    if (!trendCrop || !trendMandi) return;
    let live = true;
    mandiPriceHistory({ crop: trendCrop, mandi: trendMandi, months: 6 })
      .then((res) => live && setTrendPoints(res.data))
      .catch(() => live && setTrendPoints([]));
    return () => {
      live = false;
    };
  }, [trendCrop, trendMandi]);

  const commissionPaid = useMemo(
    () =>
      (extra?.purchases ?? []).reduce(
        (sum, p) => sum + (p.escrow?.status === 'released' ? (p.escrow.commission ?? 0) : 0),
        0
      ),
    [extra]
  );
  const posRevenue = useMemo(
    () => (extra?.sales ?? []).reduce((sum, s) => sum + (s.netAmount || 0), 0),
    [extra]
  );

  if (analytics === null && !failed) {
    return (
      <ToolShell toolId="analytics">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  if (failed || analytics === null) {
    return (
      <ToolShell toolId="analytics">
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

  const a = analytics;
  const noData = a.totalSpend === 0 && a.totalVolume === 0 && a.cropBreakdown.length === 0;
  const months = a.monthlyProcurement;
  const maxSpend = Math.max(...months.map((m) => m.spend), 1);
  const statusEntries = Object.entries(a.purchasesByStatus).sort((x, y) => y[1] - x[1]);

  if (noData) {
    return (
      <ToolShell toolId="analytics">
        <EmptyState
          icon="📊"
          titleKey="analyticsNoData"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => navigate('/dashboard/p/demands')}
            >
              ＋ {t('demandsNew')}
            </button>
          }
        />
      </ToolShell>
    );
  }

  const exportPurchases = () => {
    if (!extra) return;
    downloadCsv(
      'purchases.csv',
      ['id', 'crop', 'quantity', 'unit', 'ratePerUnit', 'total', 'final', 'status', 'farmer', 'date'],
      extra.purchases.map((p) => [
        p.id, p.crop, p.quantity, p.unit, p.agreedPricePerUnit, p.totalAmount,
        p.finalAmount ?? '', p.status, p.farmerName, csvDate(p.createdAt),
      ])
    );
  };
  const exportSales = () => {
    if (!extra) return;
    downloadCsv(
      'pos-sales.csv',
      ['bill', 'item', 'quantity', 'unit', 'rate', 'net', 'paid', 'balance', 'status', 'buyer', 'date'],
      extra.sales.map((s) => [
        s.billNumber ?? s.id, s.item, s.quantity, s.unit, s.ratePerUnit, s.netAmount,
        s.amountPaid, s.balanceDue, s.status, s.buyerName, csvDate(s.createdAt),
      ])
    );
  };
  const exportProcurement = () => {
    if (!extra) return;
    downloadCsv(
      'procurement.csv',
      ['jForm', 'farmer', 'crop', 'netQuintals', 'rate', 'final', 'paymentStatus', 'date'],
      extra.procurement.map((l) => [
        l.jFormNumber, l.farmerName, l.crop, l.netWeightQuintals, l.ratePerQuintal,
        l.finalAmount, l.paymentStatus, csvDate(l.createdAt),
      ])
    );
  };

  const grossMargin = posRevenue - a.totalSpend;

  return (
    <ToolShell toolId="analytics">
      {/* ---- Headline KPIs ---- */}
      <div className="trade-stats-grid">
        <div className="trade-stat">
          <p className="trade-stat-label">{t('analyticsSpend')}</p>
          <p className="trade-stat-value">{inr(a.totalSpend)}</p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('analyticsVolume')}</p>
          <p className="trade-stat-value">{a.totalVolume}</p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('analyticsPending')}</p>
          <p className="trade-stat-value">{inr(a.pendingBalance)}</p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('analyticsCompletion')}</p>
          <p className="trade-stat-value">{pct(a.completionRate)}</p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('analyticsQc')}</p>
          <p className="trade-stat-value">{pct(a.qcRejectionRate)}</p>
        </div>
        <div className="trade-stat">
          <p className="trade-stat-label">{t('analyticsOpenOffers')}</p>
          <p className="trade-stat-value">{a.openOffers}</p>
        </div>
      </div>

      {/* ---- P&L summary ---- */}
      <p className="trade-section-title">{t('anPnL')}</p>
      <div className="trade-invoice-box" style={{ marginTop: 0 }}>
        <div className="trade-invoice-row">
          <span>{t('anPosRevenue')}</span>
          <span>{inr(posRevenue)}</span>
        </div>
        <div className="trade-invoice-row">
          <span>{t('anProcSpend')}</span>
          <span>{inr(a.totalSpend)}</span>
        </div>
        <div className="trade-invoice-row">
          <span>{t('anCommissionPaid')}</span>
          <span>{inr(commissionPaid)}</span>
        </div>
        <div className="trade-invoice-row trade-invoice-total">
          <span>{t('anGrossMargin')}</span>
          <span style={{ color: grossMargin >= 0 ? 'var(--av-success)' : 'var(--av-error)' }}>
            {inr(grossMargin)}
          </span>
        </div>
      </div>

      {/* ---- Booking status funnel ---- */}
      {statusEntries.length > 0 ? (
        <>
          <p className="trade-section-title">{t('anStatusBreakdown')}</p>
          <div className="trade-list" style={{ marginTop: 0 }}>
            {statusEntries.map(([status, count]) => (
              <div key={status} className="trade-bar-row">
                <StatusPill status={status} />
                <div className="trade-bar-track">
                  <div
                    className="trade-bar-fill"
                    style={{ width: `${Math.max(4, (count / (extra?.purchases.length || 1)) * 100)}%` }}
                  />
                </div>
                <span className="trade-bar-count">{count}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* ---- 12-month spend chart ---- */}
      <p className="trade-section-title">{t('analyticsMonthly')}</p>
      <div className="trade-chart" role="img" aria-label={t('analyticsMonthly')}>
        {months.map((m) => (
          <div key={m.month} className="trade-chart-col">
            <div className="trade-chart-bar-wrap">
              <div
                className="trade-chart-bar"
                style={{ height: `${Math.max(2, (m.spend / maxSpend) * 100)}%` }}
                title={`${monthLabel(m.month)}: ${inr(m.spend)}`}
              />
            </div>
            <span className="trade-chart-label">{monthShort(m.month)}</span>
            <span className="trade-chart-value">{m.spend > 0 ? inr(m.spend) : ''}</span>
          </div>
        ))}
      </div>

      {/* ---- Crop mix benchmarked to mandi modal ---- */}
      {a.cropBreakdown.length > 0 ? (
        <>
          <p className="trade-section-title">{t('analyticsCrops')}</p>
          <div className="trade-list" style={{ marginTop: 0 }}>
            {a.cropBreakdown.map((c) => {
              const bench = a.avgPriceVsMandi.find((r) => r.crop === c.crop);
              const delta =
                bench && bench.mandiModalPrice
                  ? ((c.avgPrice - bench.mandiModalPrice) / bench.mandiModalPrice) * 100
                  : null;
              return (
                <div key={c.crop} className="trade-card" style={{ cursor: 'default' }}>
                  <div className="trade-card-row">
                    <span className="trade-card-title">{c.crop}</span>
                    <span className="trade-card-amount">{inr(c.spend)}</span>
                  </div>
                  <div className="trade-card-row">
                    <span className="trade-card-sub">
                      {`${c.volume} ${t('unitQuintalShort')} · ${t('analyticsAvgPrice')} ${inr(c.avgPrice)}`}
                    </span>
                    {delta !== null ? (
                      <span className={delta <= 0 ? 'trade-delta-down' : 'trade-delta-up'}>
                        {delta <= 0 ? '▼' : '▲'} {Math.abs(delta).toFixed(1)}%
                      </span>
                    ) : (
                      <span className="trade-card-sub">{t('commonNotAvailable')}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {/* ---- Mandi price trend ---- */}
      <p className="trade-section-title">{t('anTrendTitle')}</p>
      <div className="trade-filter-row">
        {a.cropBreakdown.map((c) => (
          <button
            key={c.crop}
            type="button"
            className={`av-chip${trendCrop === c.crop ? ' selected' : ''}`}
            onClick={() => setTrendCrop(c.crop)}
          >
            {c.crop}
          </button>
        ))}
      </div>
      {mandis.length > 0 ? (
        <select
          className="av-input"
          style={{ marginBottom: 10 }}
          value={trendMandi}
          aria-label={t('anSelectMandi')}
          onChange={(e) => setTrendMandi(e.target.value)}
        >
          <option value="">{t('anSelectMandi')}</option>
          {mandis.map((m) => (
            <option key={m.id} value={m.name}>
              {m.name} — {m.district}
            </option>
          ))}
        </select>
      ) : null}
      {trendCrop && trendMandi ? (
        trendPoints.length > 1 ? (
          <TrendChart points={trendPoints} />
        ) : (
          <p className="trade-hint">{t('mandiEmpty')}</p>
        )
      ) : (
        <p className="trade-hint">{t('anTrendHint')}</p>
      )}

      {/* ---- Suppliers ---- */}
      {a.topSuppliers.length > 0 ? (
        <>
          <p className="trade-section-title">{t('analyticsSuppliers')}</p>
          <div className="trade-invoice-box" style={{ marginTop: 0 }}>
            {a.topSuppliers.map((s) => (
              <div key={s.farmerId || s.farmerName} className="trade-invoice-row">
                <span>{s.farmerName}</span>
                <span>
                  {inr(s.spend)} · {t('anDeals', { count: s.purchases })}
                </span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {/* ---- CSV exports ---- */}
      <p className="trade-section-title">{t('anExportTitle')}</p>
      <div className="trade-actions-row" style={{ marginTop: 0 }}>
        <button type="button" className="av-btn av-btn-ghost" onClick={exportPurchases} disabled={!extra}>
          ⬇ {t('anExportPurchases')}
        </button>
        <button type="button" className="av-btn av-btn-ghost" onClick={exportSales} disabled={!extra}>
          ⬇ {t('anExportSales')}
        </button>
        <button type="button" className="av-btn av-btn-ghost" onClick={exportProcurement} disabled={!extra}>
          ⬇ {t('anExportProcurement')}
        </button>
      </div>
    </ToolShell>
  );
}

/** Minimal dependency-free SVG line chart for mandi modal-price history. */
function TrendChart({ points }: { points: Array<{ date: string; modalPrice: number }> }) {
  const t = useT();
  const W = 320;
  const H = 120;
  const PAD = 8;
  const prices = points.map((p) => p.modalPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(max - min, 1);
  const stepX = (W - PAD * 2) / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => {
    const x = PAD + i * stepX;
    const y = H - PAD - ((p.modalPrice - min) / span) * (H - PAD * 2);
    return `${x},${y}`;
  });
  return (
    <div className="trade-card" style={{ cursor: 'default' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }} role="img" aria-label={t('anTrendTitle')}>
        <polyline
          points={coords.join(' ')}
          fill="none"
          stroke="var(--av-primary)"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.map((p, i) => {
          const [x, y] = coords[i].split(',').map(Number);
          return <circle key={p.date} cx={x} cy={y} r="3" fill="var(--av-green-dark)" />;
        })}
      </svg>
      <div className="trade-card-row" style={{ padding: '0 4px 4px' }}>
        <span className="trade-card-sub">{csvDate(points[0].date)}</span>
        <span className="trade-card-sub">
          {t('analyticsAvgPrice')} {inr(min)}–{inr(max)}
        </span>
        <span className="trade-card-sub">{csvDate(points[points.length - 1].date)}</span>
      </div>
    </div>
  );
}
