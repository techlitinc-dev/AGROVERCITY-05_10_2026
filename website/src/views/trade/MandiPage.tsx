import { useCallback, useEffect, useMemo, useState } from 'react';
import ChipSelect from '../../components/ChipSelect';
import LabeledTextField from '../../components/LabeledTextField';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  mandiCompare,
  mandiList,
  mandiPriceHistory,
  mandiPrices,
  vyapariRates,
  type MandiCompareItem,
  type MandiInfo,
  type MandiPrice,
  type PricePoint,
  type VyapariRate,
} from '../../lib/api/mandi';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

const trendArrow = (trend: string | undefined, fallback: string): string => {
  if (!trend) return fallback;
  const v = trend.toLowerCase();
  if (v.includes('up')) return `↗ ${trend}`;
  if (v.includes('down')) return `↘ ${trend}`;
  return trend;
};

/**
 * Mandi reference (spec F7/V3) — live APMC prices with crop filters, the
 * "Where should I sell?" net-revenue comparator, vyapari-posted rates and
 * modal-price history. Shared by farmer / seller / broker roles.
 */
export default function MandiPage() {
  const t = useT();

  const [prices, setPrices] = useState<MandiPrice[] | null>(null);
  const [pricesFailed, setPricesFailed] = useState(false);
  const [cropFilter, setCropFilter] = useState<string[]>([]);

  const [rates, setRates] = useState<VyapariRate[] | null>(null);
  const [ratesFailed, setRatesFailed] = useState(false);

  const [compareCrop, setCompareCrop] = useState('');
  const [compareQty, setCompareQty] = useState('');
  const [compareErrors, setCompareErrors] = useState<Record<string, string>>({});
  const [compareBusy, setCompareBusy] = useState(false);
  const [compareItems, setCompareItems] = useState<MandiCompareItem[] | null>(null);

  const [mandis, setMandis] = useState<MandiInfo[] | null>(null);
  const [mandisFailed, setMandisFailed] = useState(false);
  const [histCrop, setHistCrop] = useState('');
  const [histMandi, setHistMandi] = useState('');
  const [histErrors, setHistErrors] = useState<Record<string, string>>({});
  const [histBusy, setHistBusy] = useState(false);
  const [histPoints, setHistPoints] = useState<PricePoint[] | null>(null);

  const loadPrices = useCallback(() => {
    setPricesFailed(false);
    mandiPrices({ page: 1, pageSize: 100 })
      .then((p) => setPrices(p.data))
      .catch(() => setPricesFailed(true));
  }, []);

  const loadRates = useCallback(() => {
    setRatesFailed(false);
    vyapariRates()
      .then((res) => setRates(res.data))
      .catch(() => setRatesFailed(true));
  }, []);

  const loadMandis = useCallback(() => {
    setMandisFailed(false);
    mandiList()
      .then((res) => {
        setMandis(res.data);
        setHistMandi((prev) => prev || res.data[0]?.name || '');
      })
      .catch(() => setMandisFailed(true));
  }, []);

  useEffect(() => {
    loadPrices();
    loadRates();
    loadMandis();
  }, [loadPrices, loadRates, loadMandis]);

  const crops = useMemo(
    () => Array.from(new Set((prices ?? []).map((p) => p.commodity).filter(Boolean))).slice(0, 12),
    [prices]
  );

  const visiblePrices = useMemo(
    () =>
      cropFilter.length === 0
        ? (prices ?? [])
        : (prices ?? []).filter((p) => cropFilter.includes(p.commodity)),
    [prices, cropFilter]
  );

  const toggleCrop = (option: string) => {
    setCropFilter((prev) => {
      if (option === t('commonAll')) return [];
      return prev.includes(option)
        ? prev.filter((c) => c !== option)
        : [...prev, option];
    });
  };

  const runCompare = async () => {
    const next: Record<string, string> = {};
    if (!compareCrop.trim()) next.crop = t('commonRequired');
    if (!(Number(compareQty) > 0)) next.qty = t('commonRequired');
    setCompareErrors(next);
    if (Object.keys(next).length > 0) return;
    setCompareBusy(true);
    try {
      const res = await mandiCompare(compareCrop.trim(), Number(compareQty));
      setCompareItems(res.data);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setCompareErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setCompareBusy(false);
    }
  };

  const runHistory = async () => {
    const next: Record<string, string> = {};
    if (!histCrop.trim()) next.crop = t('commonRequired');
    if (!histMandi.trim()) next.mandi = t('commonRequired');
    setHistErrors(next);
    if (Object.keys(next).length > 0) return;
    setHistBusy(true);
    try {
      const res = await mandiPriceHistory({ crop: histCrop.trim(), mandi: histMandi, months: 3 });
      setHistPoints(res.data);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setHistErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setHistBusy(false);
    }
  };

  return (
    <ToolShell toolId="mandi">
      <p className="trade-section-title">{t('tool_mandi')}</p>

      {prices === null && !pricesFailed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {pricesFailed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={loadPrices}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {prices !== null ? (
        <>
          <ChipSelect
            options={[t('commonAll'), ...crops]}
            selected={cropFilter.length === 0 ? [t('commonAll')] : cropFilter}
            onToggle={toggleCrop}
          />
          {visiblePrices.length === 0 ? (
            <EmptyState icon="📈" titleKey="mandiEmpty" />
          ) : (
            <div className="trade-list">
              {visiblePrices.map((p, i) => (
                <div key={p.id ?? `${p.mandiName}-${p.commodity}-${i}`} className="trade-card" style={{ cursor: 'default' }}>
                  <div className="trade-card-row">
                    <span className="trade-card-title">
                      {p.commodity}
                      {p.variety ? ` · ${p.variety}` : ''}
                    </span>
                    <span className="trade-card-amount">
                      {p.modalPrice !== undefined ? inr(p.modalPrice) : t('commonNotAvailable')}
                      {t('perQuintal')}
                    </span>
                  </div>
                  <div className="trade-card-row">
                    <span className="trade-card-sub">{p.mandiName}</span>
                    {p.distanceKm !== undefined ? (
                      <span className="trade-card-sub">
                        {t('mandiDistance')}: {p.distanceKm} km
                      </span>
                    ) : null}
                  </div>
                  <div className="trade-detail-grid" style={{ marginBottom: 0 }}>
                    <div className="trade-detail-item">
                      <p className="trade-detail-label">{t('mandiMin')}</p>
                      <p className="trade-detail-value">
                        {p.minPrice !== undefined ? inr(p.minPrice) : t('commonNotAvailable')}
                      </p>
                    </div>
                    <div className="trade-detail-item">
                      <p className="trade-detail-label">{t('mandiMax')}</p>
                      <p className="trade-detail-value">
                        {p.maxPrice !== undefined ? inr(p.maxPrice) : t('commonNotAvailable')}
                      </p>
                    </div>
                    <div className="trade-detail-item">
                      <p className="trade-detail-label">{t('mandiMsp')}</p>
                      <p className="trade-detail-value">
                        {p.msp !== undefined ? inr(p.msp) : t('commonNotAvailable')}
                      </p>
                    </div>
                    <div className="trade-detail-item">
                      <p className="trade-detail-label">{t('mandiTrend')}</p>
                      <p className="trade-detail-value">{trendArrow(p.trend, t('commonNotAvailable'))}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      <p className="trade-section-title">{t('mandiCompareTitle')}</p>
      <LabeledTextField
        label={t('mandiSelectCrop')}
        value={compareCrop}
        onChange={setCompareCrop}
        placeholder={t('lotsCropPlaceholder')}
        error={compareErrors.crop}
      />
      <LabeledTextField
        label={t('mandiCompareQty')}
        value={compareQty}
        onChange={setCompareQty}
        type="number"
        inputMode="decimal"
        error={compareErrors.qty}
      />
      <div className="trade-actions" style={{ marginTop: 8 }}>
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => void runCompare()}
          disabled={compareBusy}
        >
          {compareBusy ? <span className="av-spinner" aria-hidden /> : t('commonSearch')}
        </button>
      </div>
      {compareItems !== null ? (
        compareItems.length === 0 ? (
          <p className="trade-hint">{t('mandiEmpty')}</p>
        ) : (
          <div className="trade-list">
            {compareItems.map((item) => (
              <div key={item.mandiName} className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">{item.mandiName}</span>
                  <span className="trade-card-amount">{inr(item.netProfit)}</span>
                </div>
                <div className="trade-invoice-box" style={{ marginTop: 4 }}>
                  <div className="trade-invoice-row">
                    <span>{t('mandiModal')}</span>
                    <span>
                      {inr(item.modalPrice)}
                      {t('perQuintal')}
                    </span>
                  </div>
                  <div className="trade-invoice-row trade-invoice-total">
                    <span>{t('mandiCompareNet')}</span>
                    <span>{inr(item.netProfit)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : null}

      {rates === null && !ratesFailed ? <p className="trade-hint">{t('commonLoading')}</p> : null}
      {ratesFailed ? (
        <div className="trade-actions-row" style={{ alignItems: 'center', marginTop: 8 }}>
          <p className="trade-hint" style={{ flex: 1, marginTop: 0 }}>
            {t('tradeLoadFailed')}
          </p>
          <button type="button" className="av-btn av-btn-ghost" onClick={loadRates}>
            ↻ {t('retry')}
          </button>
        </div>
      ) : null}
      {rates !== null && rates.length > 0 ? (
        <>
          <p className="trade-section-title">{t('mandiVyapariRatesTitle')}</p>
          <div className="trade-list" style={{ marginTop: 0 }}>
            {rates.map((r, i) => (
              <div key={r.id ?? `${r.crop}-${r.mandiName}-${i}`} className="trade-card" style={{ cursor: 'default' }}>
                <div className="trade-card-row">
                  <span className="trade-card-title">{r.crop}</span>
                  <span className="trade-card-amount">
                    {inr(r.ratePerKg)}/{t('unitKg')}
                  </span>
                </div>
                <div className="trade-card-row">
                  <span className="trade-card-sub">{r.mandiName}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <p className="trade-section-title">{t('mandiHistoryTitle')}</p>
      {mandis === null && !mandisFailed ? <p className="trade-hint">{t('commonLoading')}</p> : null}
      {mandisFailed ? (
        <div className="trade-actions-row" style={{ alignItems: 'center' }}>
          <p className="trade-hint" style={{ flex: 1, marginTop: 0 }}>
            {t('tradeLoadFailed')}
          </p>
          <button type="button" className="av-btn av-btn-ghost" onClick={loadMandis}>
            ↻ {t('retry')}
          </button>
        </div>
      ) : null}
      {mandis !== null ? (
        <>
          <LabeledTextField
            label={t('mandiSelectCrop')}
            value={histCrop}
            onChange={setHistCrop}
            placeholder={t('lotsCropPlaceholder')}
            error={histErrors.crop}
          />
          <div className="av-field">
            <label className="av-label" htmlFor="mandi-history-select">
              {t('tool_mandi')}
            </label>
            <select
              id="mandi-history-select"
              className="av-input"
              value={histMandi}
              onChange={(e) => setHistMandi(e.target.value)}
              aria-invalid={!!histErrors.mandi}
            >
              {mandis.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} — {m.district}
                </option>
              ))}
            </select>
            {histErrors.mandi ? <p className="av-field-error">{histErrors.mandi}</p> : null}
          </div>
          <div className="trade-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void runHistory()}
              disabled={histBusy}
            >
              {histBusy ? <span className="av-spinner" aria-hidden /> : t('commonSearch')}
            </button>
          </div>
        </>
      ) : null}
      {histPoints !== null ? (
        histPoints.length === 0 ? (
          <p className="trade-hint">{t('mandiEmpty')}</p>
        ) : (
          <div className="trade-invoice-box">
            {histPoints.map((pt) => (
              <div key={pt.date} className="trade-invoice-row">
                <span>{fmtDate(pt.date)}</span>
                <span>
                  {inr(pt.modalPrice)}
                  {t('perQuintal')}
                </span>
              </div>
            ))}
          </div>
        )
      ) : null}
    </ToolShell>
  );
}
