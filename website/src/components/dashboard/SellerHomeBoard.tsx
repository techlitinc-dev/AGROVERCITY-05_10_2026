import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import StatusPill from '../trade/StatusPill';
import InsightsPanel from '../intelligence/InsightsPanel';
import { buyerAnalytics, type BuyerAnalytics } from '../../lib/api/discovery';
import { myPurchases, type Purchase } from '../../lib/api/purchases';
import { getSellerForecast, listLedgers, listProcurement, listSales, type KhataResponse, type ProcurementLot, type ProcurementSuggestion, type SaleEntry } from '../../lib/api/seller';
import { browseLots, inr, type Lot } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

interface ValidatedSellerForecast {
  suggested_procurement: ProcurementSuggestion[];
}

function isValidForecast(data: unknown): data is ValidatedSellerForecast {
  if (!data || typeof data !== 'object') return false;
  const d = data as ValidatedSellerForecast;
  if (!Array.isArray(d.suggested_procurement)) return false;
  if (d.suggested_procurement.length === 0) return false;
  return d.suggested_procurement.every(
    (item) =>
      typeof item?.crop === 'string' &&
      typeof item?.qty_quintal === 'number' &&
      item.qty_quintal > 0 &&
      typeof item?.reason === 'string' &&
      item.reason.trim().length > 0
  );
}

interface BoardData {
  sales: { today: number; outstanding: number; recent: SaleEntry[] };
  khataOutstanding: number;
  khataDebtors: number;
  procPending: number;
  analytics: BuyerAnalytics | null;
  recentPurchases: Purchase[];
  freshLots: Lot[];
}

/**
 * Seller / Vyapari home board — a real-data command center rendered at the
 * top of the seller dashboard: today's turnover, credit outstanding,
 * procurement pending, open offers, plus recent purchases and sales with
 * drill-down into the full tools.
 */
export default function SellerHomeBoard() {
  const t = useT();
  const navigate = useNavigate();
  const [data, setData] = useState<BoardData | null>(null);
  const [forecast, setForecast] = useState<ValidatedSellerForecast | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const [salesRes, khata, proc, analytics, purchases, lots, forecastRes] = await Promise.all([
          listSales(),
          listLedgers(),
          listProcurement(),
          buyerAnalytics().catch(() => null),
          myPurchases('buyer').catch(() => ({ data: [], page: 1, pageSize: 5, total: 0 })),
          browseLots({ sort: 'newest', pageSize: 4 }).catch(() => ({
            data: [],
            page: 1,
            pageSize: 4,
            total: 0,
          })),
          getSellerForecast().catch(() => null),
        ]);
        if (!live) return;
        const todayIso = new Date().toISOString().slice(0, 10);
        const today = salesRes.data
          .filter((s) => (s.createdAt || '').startsWith(todayIso))
          .reduce((sum, s) => sum + (s.netAmount || 0), 0);
        setData({
          sales: {
            today,
            outstanding: salesRes.stats.totalOutstanding,
            recent: salesRes.data.slice(0, 4),
          },
          khataOutstanding: khata.totalCreditOutstanding,
          khataDebtors: khata.totalDebtors,
          procPending: proc.stats.pendingPayouts,
          analytics,
          recentPurchases: (purchases.data ?? []).slice(0, 4),
          freshLots: lots.data,
        });
        if (isValidForecast(forecastRes)) {
          setForecast(forecastRes);
        } else {
          setForecast(null);
        }
      } catch {
        if (live) setFailed(true);
      }
    };
    void load();
    return () => {
      live = false;
    };
  }, []);

  if (failed) return null; // board is an enhancement — never block the home page

  return (
    <section className="dash-section" style={{ marginTop: 14 }}>
      <div className="trade-stats-grid">
        <button type="button" className="trade-stat" style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => navigate('/dashboard/p/pos')}>
          <div className="trade-stat-label">{t('sbTodayTurnover')}</div>
          <div className="trade-stat-value">{data ? inr(data.sales.today) : '…'}</div>
        </button>
        <button type="button" className="trade-stat" style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => navigate('/dashboard/p/khata')}>
          <div className="trade-stat-label">{t('sbKhataOutstanding')}</div>
          <div className="trade-stat-value" style={{ color: data && data.khataOutstanding > 0 ? 'var(--av-error)' : undefined }}>
            {data ? inr(data.khataOutstanding) : '…'}
          </div>
          <div className="trade-hint">{t('sbDebtors', { count: data?.khataDebtors ?? 0 })}</div>
        </button>
        <button type="button" className="trade-stat" style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => navigate('/dashboard/p/procurement')}>
          <div className="trade-stat-label">{t('sbProcPending')}</div>
          <div className="trade-stat-value">{data ? inr(data.procPending) : '…'}</div>
        </button>
        <button type="button" className="trade-stat" style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={() => navigate('/dashboard/p/analytics')}>
          <div className="trade-stat-label">{t('sbOpenOffers')}</div>
          <div className="trade-stat-value">{data?.analytics?.openOffers ?? '…'}</div>
          <div className="trade-hint">{t('sbActiveDemands', { count: data?.analytics?.activeDemands ?? 0 })}</div>
        </button>
      </div>

      {forecast && isValidForecast(forecast) ? (
        <div className="trade-card" style={{ marginTop: 14, cursor: 'default' }}>
          <div className="trade-card-row">
            <span className="trade-card-title" style={{ fontSize: 16 }}>
              🔮 {t('sbProcurementForecastTitle')}
            </span>
            <span
              className="trade-pill"
              style={{ background: 'var(--av-brand-bg, #e1effe)', color: 'var(--av-brand, #1e429f)' }}
            >
              {t('sbProcurementForecastBadge')}
            </span>
          </div>
          <p className="trade-hint" style={{ margin: '4px 0 10px' }}>
            {t('sbProcurementForecastSub')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {forecast.suggested_procurement.map((item, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  background: 'var(--av-surface-2, #f9fafb)',
                  border: '1px solid var(--av-border, #e5e7eb)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '0.95rem' }}>{item.crop}</strong>
                  <span style={{ fontWeight: 600, color: 'var(--av-primary, #057a55)' }}>
                    {item.qty_quintal} {t('unitQuintal')}
                  </span>
                </div>
                <div style={{ fontSize: '0.825rem', marginTop: 4, color: 'var(--av-text-sub, #4b5563)' }}>
                  {item.reason}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <div className="trade-section-title" style={{ marginTop: 6 }}>{t('sbRecentPurchases')}</div>
          <div className="trade-list" style={{ marginTop: 0 }}>
            {(data?.recentPurchases ?? []).map((p) => (
              <button key={p.id} type="button" className="trade-card" style={{ padding: '10px 12px' }}
                onClick={() => navigate(`/dashboard/p/purchases/${p.id}`)}>
                <div className="trade-card-row">
                  <span className="trade-card-title" style={{ fontSize: 14 }}>
                    {p.crop} · {p.quantity} {t('unitQuintal')}
                  </span>
                  <StatusPill status={p.status} />
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">{p.farmerName || t('purchaseFarmer')}</span>
                  <span className="trade-card-amount" style={{ fontSize: 14 }}>{inr(p.totalAmount)}</span>
                </div>
              </button>
            ))}
            {data && data.recentPurchases.length === 0 ? (
              <p className="trade-hint">{t('purchasesEmpty')}</p>
            ) : null}
          </div>
        </div>
        <div>
          <div className="trade-section-title" style={{ marginTop: 6 }}>{t('sbRecentSales')}</div>
          <div className="trade-list" style={{ marginTop: 0 }}>
            {(data?.sales.recent ?? []).map((s) => (
              <button key={s.id} type="button" className="trade-card" style={{ padding: '10px 12px' }}
                onClick={() => navigate('/dashboard/p/pos')}>
                <div className="trade-card-row">
                  <span className="trade-card-title" style={{ fontSize: 14 }}>
                    {s.item} · {s.quantity} {s.unit || t('unitQuintal')}
                  </span>
                  <StatusPill status={s.status} />
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">{s.buyerName}</span>
                  <span className="trade-card-amount" style={{ fontSize: 14 }}>{inr(s.netAmount)}</span>
                </div>
              </button>
            ))}
            {data && data.sales.recent.length === 0 ? (
              <p className="trade-hint">{t('posEmpty')}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="trade-section-title" style={{ marginTop: 6 }}>
        {t('sbFreshLots')}
      </div>
      <div className="trade-list" style={{ marginTop: 0 }}>
        {(data?.freshLots ?? []).map((lot) => (
          <button
            key={lot.id}
            type="button"
            className="trade-card"
            style={{ padding: '10px 12px' }}
            onClick={() => navigate(`/dashboard/p/browseLots/${lot.id}`)}
          >
            <div className="trade-card-row">
              <span className="trade-card-title" style={{ fontSize: 14 }}>
                {lot.crop} · {lot.quantityQuintals} {t('unitQuintal')}
              </span>
              <StatusPill status={lot.status} />
            </div>
            <div className="trade-card-row">
              <span className="trade-card-sub">
                {[lot.farmerName, lot.farmerVillage || lot.location?.village]
                  .filter(Boolean)
                  .join(' · ') || t('commonNotAvailable')}
              </span>
              <span className="trade-card-amount" style={{ fontSize: 14 }}>
                {inr(lot.expectedRate)}
                {t('perQuintal')}
              </span>
            </div>
          </button>
        ))}
        {data && data.freshLots.length === 0 ? (
          <p className="trade-hint">{t('discoverAllEmpty')}</p>
        ) : null}
      </div>

      <div className="trade-actions-row" style={{ marginTop: 12 }}>
        <button type="button" className="av-btn av-btn-primary" onClick={() => navigate('/dashboard/p/browseLots')}>
          🔍 {t('sbViewAllLots')} →
        </button>
        <button type="button" className="av-btn av-btn-ghost" onClick={() => navigate('/dashboard/p/analytics')}>
          📊 {t('tool_analytics')}
        </button>
      </div>

      <InsightsPanel />
    </section>
  );
}
