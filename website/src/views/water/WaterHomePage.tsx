import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  formatPaisa,
  getCanalRotation,
  getGroundwater,
  getWaterSchedule,
  pmksyCalculator,
  type CanalSlot,
  type GroundwaterGauge,
  type PmksyResult,
  type WaterScheduleItem,
} from '../../lib/api/water';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Water module home (robust.md §7.6). Four sections, each on its own backend
 * route: plot-wise irrigation schedule, the CGWB groundwater gauge, the canal
 * rotation calendar and the PMKSY 55% subsidy calculator. The schedule also
 * emits a weather-aware irrigation task server-side (skip-today on rain).
 *
 * The PMKSY button deep-links into the matching WS-05 scheme detail
 * (`pmksy-drip`). Everything is rendered from responses — no invented numbers
 * (rule 1).
 */

const PMKSY_SCHEME_ID = 'pmksy-drip';

function GroundwaterGaugeBar({ depthMeters, zone }: { depthMeters: number; zone: string }) {
  const max = 40;
  const width = Math.max(0, Math.min(depthMeters, max)) / max * 100;
  const color = zone === 'safe' ? '#16A34A' : zone === 'semiCritical' ? '#F59E0B' : '#DC2626';
  return (
    <svg viewBox="0 0 100 12" width="100%" height="18" role="img" aria-hidden>
      <rect x="0" y="4" width="100" height="4" rx="2" fill="#E5E7EB" />
      <rect x="0" y="4" width={width} height="4" rx="2" fill={color} />
      <circle cx={width} cy="6" r="3" fill={color} />
    </svg>
  );
}

export default function WaterHomePage() {
  const t = useT();

  const [schedule, setSchedule] = useState<WaterScheduleItem[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(true);
  const [scheduleFailed, setScheduleFailed] = useState(false);

  const [district, setDistrict] = useState('');
  const [gauge, setGauge] = useState<GroundwaterGauge | null>(null);
  const [gaugeFailed, setGaugeFailed] = useState(false);
  const [gaugeBusy, setGaugeBusy] = useState(false);

  const [canals, setCanals] = useState<CanalSlot[]>([]);
  const [canalFailed, setCanalFailed] = useState(false);

  const [cost, setCost] = useState('');
  const [pmksy, setPmksy] = useState<PmksyResult | null>(null);

  const loadSchedule = useCallback(async () => {
    setScheduleLoading(true);
    setScheduleFailed(false);
    try {
      const page = await getWaterSchedule();
      setSchedule(page.data);
    } catch {
      setScheduleFailed(true);
    } finally {
      setScheduleLoading(false);
    }
  }, []);

  const loadCanals = useCallback(async () => {
    setCanalFailed(false);
    try {
      const page = await getCanalRotation();
      setCanals(page.data);
    } catch {
      setCanalFailed(true);
    }
  }, []);

  useEffect(() => {
    void loadSchedule();
    void loadCanals();
  }, [loadSchedule, loadCanals]);

  const checkGroundwater = async () => {
    if (!district.trim()) return;
    setGaugeBusy(true);
    setGaugeFailed(false);
    try {
      setGauge(await getGroundwater(district.trim()));
    } catch {
      setGaugeFailed(true);
      setGauge(null);
    } finally {
      setGaugeBusy(false);
    }
  };

  const calculate = async () => {
    const rupees = Number(cost);
    if (!cost.trim() || Number.isNaN(rupees) || rupees <= 0) {
      toast(t('waterPmksyInvalid'), { error: true });
      return;
    }
    try {
      setPmksy(await pmksyCalculator({ costPaisa: Math.round(rupees * 100) }));
    } catch (e) {
      setPmksy(null);
      toast(isApiError(e) ? e.message : t('waterPmksyLoadFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="water">
      <section className="dash-section">
        <h3>{t('waterScheduleTitle')}</h3>
        <p className="trade-hint">{t('waterScheduleHint')}</p>
        {scheduleLoading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {scheduleFailed ? <p className="trade-hint">{t('waterScheduleLoadFailed')}</p> : null}
        {!scheduleLoading && !scheduleFailed && schedule.length === 0 ? (
          <EmptyState icon="💧" titleKey="waterScheduleEmpty" />
        ) : null}
        {schedule.map((item) => (
          <div className="trade-card" key={item.plotName} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {t('waterSchedulePlot')}: {item.plotName}
              </span>
              {item.skipToday ? (
                <span className="trade-card-amount">{t('waterScheduleRainBadge')}</span>
              ) : null}
            </div>
            <p className="trade-card-sub">
              {t('waterScheduleMoisture', { percent: item.moisturePercent })} ·{' '}
              {t('waterScheduleMinutes', { minutes: item.recommendedMinutes })}
            </p>
            <p className="trade-card-sub">
              {t('waterScheduleMethod', { method: item.method })}
            </p>
            {item.skipToday ? <p className="trade-card-sub">{t('waterScheduleSkipToday')}</p> : null}
          </div>
        ))}
      </section>

      <section className="dash-section">
        <h3>{t('waterGroundwaterTitle')}</h3>
        <p className="trade-hint">{t('waterGroundwaterHint')}</p>
        <div className="trade-actions-row">
          <label className="trade-card-sub" htmlFor="water-district">
            {t('waterGroundwaterDistrict')}
          </label>
          <input
            id="water-district"
            className="av-input"
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
          />
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={gaugeBusy}
            onClick={() => void checkGroundwater()}
          >
            {gaugeBusy ? <span className="av-spinner" aria-hidden /> : t('waterGroundwaterSearch')}
          </button>
        </div>
        {gaugeFailed ? <p className="trade-hint">{t('waterGroundwaterLoadFailed')}</p> : null}
        {gauge ? (
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{gauge.district}</span>
            </div>
            <GroundwaterGaugeBar depthMeters={gauge.depthMeters} zone={gauge.zone} />
            <p className="trade-card-sub">
              {t('waterGroundwaterDepth', { depth: gauge.depthMeters })}
            </p>
            <p className="trade-card-sub">{t('waterGroundwaterZone', { zone: gauge.zone })}</p>
            <p className="trade-card-sub">
              {t('waterGroundwaterMeasuredAt', { date: gauge.measuredAt })}
            </p>
          </div>
        ) : (
          !gaugeFailed && <p className="trade-hint">{t('waterGroundwaterNoData')}</p>
        )}
      </section>

      <section className="dash-section">
        <h3>{t('waterCanalTitle')}</h3>
        <p className="trade-hint">{t('waterCanalHint')}</p>
        {canalFailed ? <p className="trade-hint">{t('waterCanalLoadFailed')}</p> : null}
        {!canalFailed && canals.length === 0 ? (
          <EmptyState icon="🌊" titleKey="waterCanalEmpty" />
        ) : null}
        {canals.map((slot) => (
          <div className="trade-card" key={slot.canalName} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{slot.canalName}</span>
            </div>
            <p className="trade-card-sub">{t('waterCanalNext', { date: slot.nextDate })}</p>
            <p className="trade-card-sub">{t('waterCanalSlot', { slot: slot.slotTime })}</p>
          </div>
        ))}
      </section>

      <section className="dash-section">
        <h3>{t('waterPmksyTitle')}</h3>
        <p className="trade-hint">{t('waterPmksyHint')}</p>
        <div className="trade-actions-row">
          <label className="trade-card-sub" htmlFor="pmksy-cost">
            {t('waterPmksyCost')}
          </label>
          <input
            id="pmksy-cost"
            className="av-input"
            inputMode="numeric"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
          />
          <button type="button" className="av-btn av-btn-primary" onClick={() => void calculate()}>
            {t('waterPmksyCalculate')}
          </button>
        </div>
        {pmksy ? (
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{t('waterPmksyTotal')}</span>
              <span className="trade-card-amount">{formatPaisa(pmksy.totalCostPaisa)}</span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-title">
                {t('waterPmksySubsidy', { percent: pmksy.subsidyPercent })}
              </span>
              <span className="trade-card-amount">{formatPaisa(pmksy.subsidyAmountPaisa)}</span>
            </div>
            <div className="trade-card-row">
              <span className="trade-card-title">{t('waterPmksyFarmerShare')}</span>
              <span className="trade-card-amount">{formatPaisa(pmksy.farmerSharePaisa)}</span>
            </div>
            <div className="trade-actions-row">
              <Link className="av-btn av-btn-ghost" to={`/dashboard/p/schemes/${PMKSY_SCHEME_ID}`}>
                {t('waterPmksyApplyScheme')}
              </Link>
            </div>
          </div>
        ) : null}
      </section>
    </ToolShell>
  );
}
