import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import LabeledTextField from '../../components/LabeledTextField';
import SegmentedControl from '../../components/SegmentedControl';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  npkRecommendation,
  pestRadar,
  saturation,
  type NpkResult,
  type PestAlert,
  type SaturationResult,
  type AlternativeCrop,
} from '../../lib/api/advisory';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import DiseaseScanPage from './DiseaseScanPage';
import '../../theme/trade.css';
import '../../theme/advisory.css';

export type AdvisoryTab = 'saturation' | 'disease' | 'npk' | 'pestRadar' | 'kisanMitra';

/** Default pest/saturation radius (km) — the 5-km spec radius. */
const RADIUS_KM = 5;

/**
 * Advisory Hub (robust.md §7.2) — the five-tab advisory surface on mandi-linked
 * data: market saturation (M13), disease scan (M9), NPK calculator, 5-km pest
 * radar and the Kisan Mitra launcher.
 *
 * Every tab body is a component in this file/folder; nothing renders a
 * placeholder state. Tab identity strings come from `en/hi.advisory.ts`.
 */
export default function AdvisoryHubPage() {
  const t = useT();
  const [tab, setTab] = useState<AdvisoryTab>('saturation');

  return (
    <ToolShell toolId="advisoryHub">
      <p className="trade-section-title">{t('advisoryTitle')}</p>
      <p className="trade-hint">{t('advisoryHubIntro')}</p>

      <SegmentedControl<AdvisoryTab>
        value={tab}
        onChange={setTab}
        options={[
          { value: 'saturation', label: t('advisoryTabSaturation') },
          { value: 'disease', label: t('advisoryTabDisease') },
          { value: 'npk', label: t('advisoryTabNpk') },
          { value: 'pestRadar', label: t('advisoryTabPestRadar') },
          { value: 'kisanMitra', label: t('advisoryTabKisanMitra') },
        ]}
      />

      {tab === 'saturation' ? <SaturationTab /> : null}
      {tab === 'disease' ? <DiseaseTab /> : null}
      {tab === 'npk' ? <NpkTab /> : null}
      {tab === 'pestRadar' ? <PestRadarTab /> : null}
      {tab === 'kisanMitra' ? <KisanMitraTab /> : null}
    </ToolShell>
  );
}

/**
 * Browser coordinates for the saturation request. The farm profile's stored
 * coordinates are preferred; the browser location is requested only when the
 * profile has none, and only after the farmer's explicit opt-in.
 */
function browserCoords(): Promise<{ lat: number; lng: number } | null> {
  if (!('geolocation' in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => resolve(null),
      { timeout: 8000 }
    );
  });
}

/**
 * (a) Market Saturation (M13) — the read is computed from neighbouring farmers'
 * sowing intents, so it is gated behind an explicit opt-in consent block: no
 * saturation number renders until the farmer ticks the consent checkbox, and
 * ticking it also shares this farm's own sowing intent (anonymously, aggregate
 * counts only — never another farmer's identity).
 */
function SaturationTab() {
  const t = useT();
  const user = useSessionStore((s) => s.user);

  const [consent, setConsent] = useState(false);
  const [crop, setCrop] = useState('');
  const [district, setDistrict] = useState(
    typeof user?.district === 'string' ? user.district : ''
  );
  const [radiusKm, setRadiusKm] = useState(String(RADIUS_KM));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SaturationResult | null>(null);

  const profileCoords = useMemo<{ lat: number; lng: number } | null>(() => {
    const lat = user?.lat;
    const lng = user?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return { lat, lng };
  }, [user]);

  const run = async () => {
    const next: Record<string, string> = {};
    if (!crop.trim()) next.crop = t('commonRequired');
    if (!district.trim()) next.district = t('commonRequired');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    const radius = Number(radiusKm);
    setBusy(true);
    try {
      const coords = profileCoords ?? (await browserCoords());
      if (coords === null) {
        toast(t('advisoryLocationRequired'), { error: true });
        return;
      }
      const data = await saturation({
        crop: crop.trim(),
        district: district.trim(),
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: Number.isFinite(radius) && radius > 0 ? Math.round(radius) : RADIUS_KM,
        shareSowingIntent: true,
      });
      setResult(data);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="advisory-tab" aria-label={t('advisoryTabSaturation')}>
      <p className="trade-section-title">{t('advisorySaturationTitle')}</p>

      <div className="advisory-consent">
        <input
          id="advisory-saturation-consent"
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked);
            if (!e.target.checked) setResult(null);
          }}
        />
        <p className="advisory-consent-text">
          <label htmlFor="advisory-saturation-consent">{t('advisorySaturationConsent')}</label>
        </p>
      </div>

      {consent ? (
        <>
          <LabeledTextField
            label={t('advisorySaturationCrop')}
            value={crop}
            onChange={setCrop}
            placeholder={t('lotsCropPlaceholder')}
            error={errors.crop}
          />
          <LabeledTextField
            label={t('advisorySaturationDistrict')}
            value={district}
            onChange={setDistrict}
            error={errors.district}
          />
          <LabeledTextField
            label={t('advisorySaturationRadius')}
            value={radiusKm}
            onChange={setRadiusKm}
            inputMode="numeric"
          />

          <div className="trade-actions" style={{ marginTop: 8 }}>
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => void run()}
              disabled={busy}
            >
              {busy ? <span className="av-spinner" aria-hidden /> : t('advisorySaturationRun')}
            </button>
          </div>

          {result !== null ? <SaturationCard result={result} /> : null}

          <div className="trade-actions" style={{ marginTop: 8 }}>
            <Link className="av-btn" to="/dashboard/p/cropPlanner">
              {t('advisoryCropPlannerOpen')}
            </Link>
          </div>
        </>
      ) : null}
    </section>
  );
}

const RISK_LABEL_KEY: Record<string, string> = {
  green: 'advisorySaturationRiskGreen',
  yellow: 'advisorySaturationRiskYellow',
  red: 'advisorySaturationRiskRed',
};

/** Saturation result card — every figure comes from the response (rule 1). */
function SaturationCard({ result }: { result: SaturationResult }) {
  const t = useT();
  const riskKey = RISK_LABEL_KEY[result.riskLevel] ?? 'advisorySaturationRiskGreen';
  const priceAvailable = result.priceSource === 'mandi_history' && result.predictedPrice > 0;

  return (
    <div className="trade-card" style={{ cursor: 'default', marginTop: 12 }}>
      <div className="trade-card-row">
        <span className="trade-card-title">{t(riskKey)}</span>
        <span className={`advisory-pill ${result.riskLevel}`}>{result.riskLevel}</span>
      </div>
      <p className="trade-card-sub">
        {result.dataBasis.count > 0
          ? t('advisoryDataBasis', {
              count: result.dataBasis.count,
              district: result.dataBasis.district,
            })
          : t('advisoryDataBasisUnavailable')}
      </p>
      <p className="trade-card-sub">
        {t('advisorySaturationExpectedIncrease', { value: result.expectedArrivalIncrease })}
      </p>
      <p className="trade-card-sub">
        {priceAvailable
          ? t('advisorySaturationPredictedPrice', { price: inr(result.predictedPrice) })
          : t('advisorySaturationPriceUnavailable')}
      </p>
      {priceAvailable ? (
        <p className="trade-card-sub">
          {t('advisorySaturationPredictedDate', { date: result.predictedDate })}
        </p>
      ) : null}
      <p className="trade-card-title" style={{ marginTop: 8 }}>
        {t('advisorySaturationAlternatives')}
      </p>
      {result.alternativeCrops.length === 0 ? (
        <p className="trade-card-sub">{t('advisorySaturationAlternativesEmpty')}</p>
      ) : (
        result.alternativeCrops.map((alt: AlternativeCrop) => (
          <p className="trade-card-sub" key={alt.crop}>
            {alt.expectedPrice === null
              ? `${alt.crop} — ${t('advisorySaturationPriceUnavailable')}`
              : `${alt.crop} — ${inr(alt.expectedPrice)}${t('perQuintal')}`}
          </p>
        ))
      )}
    </div>
  );
}

/** (b) Disease Scan — upload → gate → diagnosis → per-plot history (M9). */
function DiseaseTab() {
  return <DiseaseScanPage />;
}

/** (c) NPK calculator — deficit-based fertiliser recommendation. */
function NpkTab() {
  const t = useT();
  const [crop, setCrop] = useState('');
  const [soilType, setSoilType] = useState('');
  const [n, setN] = useState('');
  const [p, setP] = useState('');
  const [k, setK] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<NpkResult | null>(null);

  const run = async () => {
    setBusy(true);
    try {
      const data = await npkRecommendation({
        crop: crop.trim(),
        soilType: soilType.trim(),
        n: Number(n) || 0,
        p: Number(p) || 0,
        k: Number(k) || 0,
      });
      setResult(data);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="advisory-tab" aria-label={t('advisoryTabNpk')}>
      <p className="trade-section-title">{t('advisoryNpkTitle')}</p>
      <LabeledTextField label={t('advisoryNpkCrop')} value={crop} onChange={setCrop} />
      <LabeledTextField label={t('advisoryNpkSoil')} value={soilType} onChange={setSoilType} />
      <LabeledTextField label={t('advisoryNpkN')} value={n} onChange={setN} inputMode="decimal" />
      <LabeledTextField label={t('advisoryNpkP')} value={p} onChange={setP} inputMode="decimal" />
      <LabeledTextField label={t('advisoryNpkK')} value={k} onChange={setK} inputMode="decimal" />
      <div className="trade-actions">
        <button type="button" className="av-btn av-btn-primary" onClick={() => void run()} disabled={busy}>
          {busy ? <span className="av-spinner" aria-hidden /> : t('advisoryNpkRun')}
        </button>
      </div>
      {result !== null ? (
        <div className="trade-card" style={{ cursor: 'default', marginTop: 12 }}>
          <p className="trade-card-title">{t('advisoryNpkResults')}</p>
          <p className="trade-card-sub">
            {t('advisoryNpkUrea')}: {result.ureaKgPerAcre} kg · {t('advisoryNpkDap')}:{' '}
            {result.dapKgPerAcre} kg · {t('advisoryNpkMop')}: {result.mopKgPerAcre} kg
          </p>
          {result.recommendations.map((line) => (
            <p className="trade-card-sub" key={line}>
              {line}
            </p>
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** (d) Pest radar (5 km) — reports from the real pest_reports collection. */
function PestRadarTab() {
  const t = useT();
  const user = useSessionStore((s) => s.user);
  const [radius, setRadius] = useState(String(RADIUS_KM));
  const [busy, setBusy] = useState(false);
  const [alerts, setAlerts] = useState<PestAlert[] | null>(null);

  const profileCoords = useMemo<{ lat: number; lng: number } | null>(() => {
    const lat = user?.lat;
    const lng = user?.lng;
    if (typeof lat !== 'number' || typeof lng !== 'number') return null;
    return { lat, lng };
  }, [user]);

  const run = async () => {
    setBusy(true);
    try {
      const coords = profileCoords ?? (await browserCoords());
      if (coords === null) {
        toast(t('advisoryLocationRequired'), { error: true });
        return;
      }
      const parsed = Number(radius);
      const page = await pestRadar({
        lat: coords.lat,
        lng: coords.lng,
        radiusKm: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : RADIUS_KM,
      });
      setAlerts(page.data);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="advisory-tab" aria-label={t('advisoryTabPestRadar')}>
      <p className="trade-section-title">{t('advisoryPestTitle')}</p>
      <LabeledTextField
        label={t('advisoryPestRadius')}
        value={radius}
        onChange={setRadius}
        inputMode="numeric"
      />
      <div className="trade-actions">
        <button type="button" className="av-btn av-btn-primary" onClick={() => void run()} disabled={busy}>
          {busy ? <span className="av-spinner" aria-hidden /> : t('advisoryPestRefresh')}
        </button>
      </div>
      {alerts !== null ? (
        alerts.length === 0 ? (
          <p className="trade-hint">{t('advisoryPestEmpty', { radius })}</p>
        ) : (
          alerts.map((alert, index) => (
            <div className="trade-card" key={`${alert.disease}-${index}`} style={{ cursor: 'default' }}>
              <span className="trade-card-title">{alert.disease}</span>
              <p className="trade-card-sub">{alert.crop}</p>
              <p className="trade-card-sub">
                {t('advisoryPestDistance', { distance: alert.distanceKm })} ·{' '}
                {t('advisoryPestReported', { date: alert.reportedAt })}
              </p>
            </div>
          ))
        )
      ) : null}
    </section>
  );
}

/** (e) Kisan Mitra launcher — deep-links to the phase-01 chat surface. */
function KisanMitraTab() {
  const t = useT();
  return (
    <section className="advisory-tab" aria-label={t('advisoryTabKisanMitra')}>
      <p className="trade-section-title">{t('advisoryKisanMitraTitle')}</p>
      <p className="trade-hint">{t('advisoryKisanMitraBody')}</p>
      <div className="trade-actions">
        <Link className="av-btn av-btn-primary" to="/dashboard/p/chats">
          {t('advisoryKisanMitraLaunch')}
        </Link>
      </div>
    </section>
  );
}
