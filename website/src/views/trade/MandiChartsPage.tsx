import { useCallback, useEffect, useMemo, useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  mandiForecast,
  mandiList,
  mandiPriceHistory,
  paisaInr,
  type MandiForecast,
  type MandiForecastBand,
  type MandiInfo,
  type PricePoint,
} from '../../lib/api/mandi';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

type RangeDays = 30 | 90;

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

/**
 * Mandi price-history charts (spec F13) — crop + mandi selectors and a
 * 30/90-day range toggle, rendered as a dependency-free inline SVG polyline
 * over the existing `/mandi/prices/history` endpoint. Prices are the backend's
 * integer modal values; an empty history renders a no-data message instead of
 * any invented number (rule 1).
 *
 * The cached 7/30-day forecast (`GET /v1/mandi/forecast`) is drawn as a dashed
 * continuation with an explicit on-chart "estimate" label. When the cache is
 * empty (404 envelope) the history chart stands alone — no forecast line and no
 * invented numbers.
 */
export default function MandiChartsPage() {
  const t = useT();

  const [mandis, setMandis] = useState<MandiInfo[] | null>(null);
  const [mandisFailed, setMandisFailed] = useState(false);

  const [crop, setCrop] = useState('');
  const [mandi, setMandi] = useState('');
  const [days, setDays] = useState<RangeDays>(30);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [points, setPoints] = useState<PricePoint[] | null>(null);
  const [forecast, setForecast] = useState<MandiForecast | null>(null);

  const loadMandis = useCallback(() => {
    setMandisFailed(false);
    mandiList()
      .then((res) => {
        setMandis(res.data);
        setMandi((prev) => prev || res.data[0]?.name || '');
      })
      .catch(() => setMandisFailed(true));
  }, []);

  useEffect(() => {
    loadMandis();
  }, [loadMandis]);

  const runHistory = async () => {
    const next: Record<string, string> = {};
    if (!crop.trim()) next.crop = t('commonRequired');
    if (!mandi.trim()) next.mandi = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    setForecast(null);
    try {
      const res = await mandiPriceHistory({
        crop: crop.trim(),
        mandi,
        months: days === 30 ? 1 : 3,
      });
      setPoints(res.data);
      try {
        const cached = await mandiForecast({ crop: crop.trim(), mandi });
        setForecast(cached.data);
      } catch {
        // 404 envelope (no cached band) or any failure — history chart only.
        setForecast(null);
      }
    } catch (e) {
      if (isApiError(e) && e.fieldErrors) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  // The cached band that matches the chart window (30-day view → 7-day band,
  // 90-day view → 30-day band).
  const forecastBand = useMemo<MandiForecastBand | null>(() => {
    if (forecast === null) return null;
    const horizon = days === 30 ? 7 : 30;
    return forecast.bands.find((band) => band.horizon_days === horizon) ?? null;
  }, [forecast, days]);

  return (
    <ToolShell toolId="mandi">
      <p className="trade-section-title">{t('mandiChartsTitle')}</p>

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
            label={t('mandiChartsCrop')}
            value={crop}
            onChange={setCrop}
            placeholder={t('lotsCropPlaceholder')}
            error={errors.crop}
          />
          <div className="av-field">
            <label className="av-label" htmlFor="mandi-charts-mandi">
              {t('mandiChartsMandi')}
            </label>
            <select
              id="mandi-charts-mandi"
              className="av-input"
              value={mandi}
              onChange={(e) => setMandi(e.target.value)}
              aria-invalid={!!errors.mandi}
            >
              {mandis.map((m) => (
                <option key={m.id} value={m.name}>
                  {m.name} — {m.district}
                </option>
              ))}
            </select>
            {errors.mandi ? <p className="av-field-error">{errors.mandi}</p> : null}
          </div>

          <div className="av-chip-row" role="group" aria-label={t('mandiChartsTitle')}>
            <button
              type="button"
              className={`av-chip${days === 30 ? ' selected' : ''}`}
              aria-pressed={days === 30}
              onClick={() => setDays(30)}
            >
              {t('mandiChartsRange30')}
            </button>
            <button
              type="button"
              className={`av-chip${days === 90 ? ' selected' : ''}`}
              aria-pressed={days === 90}
              onClick={() => setDays(90)}
            >
              {t('mandiChartsRange90')}
            </button>
          </div>

          <div className="trade-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void runHistory()}
              disabled={busy}
            >
              {busy ? <span className="av-spinner" aria-hidden /> : t('commonSearch')}
            </button>
          </div>
        </>
      ) : null}

      {points !== null ? (
        points.length === 0 ? (
          <EmptyState icon="📈" titleKey="mandiChartsNoData" />
        ) : (
          <>
            <PriceChart
              points={points}
              ariaLabel={t('mandiChartsTitle')}
              forecast={forecastBand}
              estimateLabel={t('mandiForecastEstimateLabel')}
            />
            {forecastBand === null ? (
              <p className="trade-hint">{t('mandiForecastUnavailable')}</p>
            ) : null}
          </>
        )
      ) : null}
    </ToolShell>
  );
}

/** Minimal dependency-free SVG line chart for mandi modal-price history. */
function PriceChart({
  points,
  ariaLabel,
  forecast,
  estimateLabel,
}: {
  points: PricePoint[];
  ariaLabel: string;
  forecast: MandiForecastBand | null;
  estimateLabel: string;
}) {
  const t = useT();
  const W = 320;
  const H = 120;
  const PAD = 8;
  // History uses 78% of the width; the remainder carries the forecast segment.
  const historySpan = (W - PAD * 2) * 0.78;
  const forecastX = W - PAD;

  const historyPrices = points.map((p) => p.modalPrice);
  // History modal prices are ₹/quintal; the band money is integer paisa.
  const forecastLow = forecast ? forecast.band_low_paisa / 100 : null;
  const forecastHigh = forecast ? forecast.band_high_paisa / 100 : null;
  const forecastMid =
    forecastLow !== null && forecastHigh !== null ? (forecastLow + forecastHigh) / 2 : null;

  const scale = [...historyPrices];
  if (forecastLow !== null && forecastHigh !== null) scale.push(forecastLow, forecastHigh);
  const min = Math.min(...scale);
  const max = Math.max(...scale);
  const span = Math.max(max - min, 1);
  const yFor = (value: number) => H - PAD - ((value - min) / span) * (H - PAD * 2);
  const stepX = historySpan / Math.max(points.length - 1, 1);
  const coords = points.map((p, i) => `${PAD + i * stepX},${yFor(p.modalPrice)}`);
  const lastX = PAD + (points.length - 1) * stepX;
  const lastY = yFor(points[points.length - 1].modalPrice);

  return (
    <div className="trade-card" style={{ cursor: 'default' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block' }}
        role="img"
        aria-label={ariaLabel}
      >
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
        {forecastMid !== null && forecastLow !== null && forecastHigh !== null ? (
          <>
            <line
              x1={lastX}
              y1={lastY}
              x2={forecastX}
              y2={yFor(forecastMid)}
              stroke="var(--av-primary)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
            <line
              x1={forecastX}
              y1={yFor(forecastLow)}
              x2={forecastX}
              y2={yFor(forecastHigh)}
              stroke="var(--av-primary)"
              strokeWidth="2"
              strokeDasharray="3 2"
            />
            <circle cx={forecastX} cy={yFor(forecastMid)} r="3" fill="var(--av-primary)" />
            <text
              x={forecastX}
              y={PAD + 6}
              textAnchor="end"
              fontSize="8"
              fill="var(--av-primary)"
            >
              {estimateLabel}
            </text>
          </>
        ) : null}
      </svg>
      <div className="trade-card-row" style={{ padding: '0 4px 4px' }}>
        <span className="trade-card-sub">{fmtDate(points[0].date)}</span>
        <span className="trade-card-sub">
          {inr(min)}–{inr(max)}
          {t('perQuintal')}
        </span>
        <span className="trade-card-sub">{fmtDate(points[points.length - 1].date)}</span>
      </div>
      {forecast !== null && forecastLow !== null && forecastHigh !== null ? (
        <div className="trade-card-row" style={{ padding: '0 4px 4px' }}>
          <span className="trade-card-sub">
            {estimateLabel}: {paisaInr(forecast.band_low_paisa)}–{paisaInr(forecast.band_high_paisa)}
            {t('perQuintal')}
          </span>
        </div>
      ) : null}
    </div>
  );
}

