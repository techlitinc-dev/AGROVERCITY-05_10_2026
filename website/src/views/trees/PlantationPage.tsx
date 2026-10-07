import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { listMyPlantations, registerPlantation, type Plantation } from '../../lib/api/tree';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Plantation tracker (robust.md §7.22, task 7.12). Lists plantations with
 * species, count, planted date and survival; registering a plantation emits
 * recurring survival-check tasks server-side. The per-plantation CO₂e figure is
 * an estimate — it renders the shared `carbonEstimateNotCredits` label.
 */
export default function PlantationPage() {
  const t = useT();
  const [plantations, setPlantations] = useState<Plantation[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const [parcelName, setParcelName] = useState('');
  const [treeSpecies, setTreeSpecies] = useState('');
  const [treeCount, setTreeCount] = useState('');
  const [plantingDate, setPlantingDate] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      setPlantations((await listMyPlantations()).data);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const count = Number(treeCount);
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (
      parcelName.trim().length < 2 ||
      treeSpecies.trim().length < 2 ||
      !treeCount.trim() ||
      Number.isNaN(count) ||
      count <= 0 ||
      !plantingDate.trim() ||
      !latitude.trim() ||
      !longitude.trim() ||
      Number.isNaN(lat) ||
      Number.isNaN(lng)
    ) {
      toast(t('treePlantationInvalid'), { error: true });
      return;
    }
    setBusy(true);
    try {
      await registerPlantation({
        parcelName: parcelName.trim(),
        treeSpecies: treeSpecies.trim(),
        treeCount: count,
        plantingDate,
        latitude: lat,
        longitude: lng,
      });
      toast(t('treePlantationRegistered'));
      setParcelName('');
      setTreeSpecies('');
      setTreeCount('');
      setPlantingDate('');
      setLatitude('');
      setLongitude('');
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="treePlantation">
      <section className="dash-section">
        <h3>{t('treePlantationTitle')}</h3>
        <p className="trade-hint">{t('treePlantationHint')}</p>
        {loading ? <p className="trade-hint">{t('commonLoading')}</p> : null}
        {failed ? <p className="trade-hint">{t('treePlantationLoadFailed')}</p> : null}
        {!loading && !failed && plantations.length === 0 ? (
          <EmptyState icon="🌳" titleKey="treePlantationEmpty" />
        ) : null}
        {plantations.map((p) => (
          <div className="trade-card" key={p.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{p.treeSpecies}</span>
              <span className="trade-card-amount">
                {t('treePlantationCount', { count: p.treeCount })}
              </span>
            </div>
            <p className="trade-card-sub">
              {t('treePlantationParcel')}: {p.parcelName}
            </p>
            <p className="trade-card-sub">
              {t('treePlantationPlantedDate', { date: p.plantingDate })}
            </p>
            <p className="trade-card-sub">
              {t('treePlantationSurvival', { percent: p.survivalRate })}
            </p>
            <p className="trade-card-sub">
              {t('treePlantationCarbon', { kg: p.estimatedCo2KgPerYear })} ·{' '}
              {t('carbonEstimateNotCredits')}
            </p>
          </div>
        ))}
      </section>

      <section className="dash-section">
        <h3>{t('treePlantationRegisterTitle')}</h3>
        <div className="trade-actions-row">
          <label className="trade-card-sub" htmlFor="pl-parcel">
            {t('treePlantationParcel')}
          </label>
          <input
            id="pl-parcel"
            className="av-input"
            value={parcelName}
            onChange={(e) => setParcelName(e.target.value)}
          />
        </div>
        <div className="trade-actions-row">
          <label className="trade-card-sub" htmlFor="pl-species">
            {t('treePlantationSpecies')}
          </label>
          <input
            id="pl-species"
            className="av-input"
            value={treeSpecies}
            onChange={(e) => setTreeSpecies(e.target.value)}
          />
        </div>
        <div className="trade-actions-row">
          <label className="trade-card-sub" htmlFor="pl-count">
            {t('treePlantationCountLabel')}
          </label>
          <input
            id="pl-count"
            className="av-input"
            inputMode="numeric"
            value={treeCount}
            onChange={(e) => setTreeCount(e.target.value)}
          />
        </div>
        <div className="trade-actions-row">
          <label className="trade-card-sub" htmlFor="pl-date">
            {t('treePlantationPlantedDateLabel')}
          </label>
          <input
            id="pl-date"
            className="av-input"
            type="date"
            value={plantingDate}
            onChange={(e) => setPlantingDate(e.target.value)}
          />
        </div>
        <div className="trade-actions-row">
          <label className="trade-card-sub" htmlFor="pl-lat">
            {t('treePlantationLatitude')}
          </label>
          <input
            id="pl-lat"
            className="av-input"
            inputMode="decimal"
            value={latitude}
            onChange={(e) => setLatitude(e.target.value)}
          />
          <label className="trade-card-sub" htmlFor="pl-lng">
            {t('treePlantationLongitude')}
          </label>
          <input
            id="pl-lng"
            className="av-input"
            inputMode="decimal"
            value={longitude}
            onChange={(e) => setLongitude(e.target.value)}
          />
        </div>
        <div className="trade-actions-row">
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('treePlantationRegister')}
          </button>
        </div>
      </section>
    </ToolShell>
  );
}
