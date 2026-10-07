import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createEnrollment,
  formatPaisa,
  getCarbonPotential,
  getResilientVarieties,
  listMyEnrollments,
  type CarbonEnrollment,
  type CarbonPotential,
  type ResilientVariety,
} from '../../lib/api/climate';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Climate & carbon home (robust.md §7.13, tasks 7.10/7.11).
 *
 * Reads entirely from the `climate_varieties` / `carbon_factors`-backed
 * endpoints (no hardcoded data — rule 1). Every carbon number renders the
 * mandatory `carbonEstimateNotCredits` label adjacent to it; enrollment shows
 * the clearly-labelled partner-MRV placeholder (no fake MRV flow).
 */
export default function ClimateHomePage() {
  const t = useT();

  const [carbon, setCarbon] = useState<CarbonPotential | null>(null);
  const [carbonFailed, setCarbonFailed] = useState(false);
  const [varieties, setVarieties] = useState<ResilientVariety[]>([]);
  const [varietiesFailed, setVarietiesFailed] = useState(false);
  const [enrollments, setEnrollments] = useState<CarbonEnrollment[]>([]);
  const [enrollFailed, setEnrollFailed] = useState(false);
  const [plotId, setPlotId] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setCarbonFailed(false);
    setVarietiesFailed(false);
    setEnrollFailed(false);
    try {
      setCarbon(await getCarbonPotential());
    } catch {
      setCarbonFailed(true);
    }
    try {
      setVarieties((await getResilientVarieties()).data);
    } catch {
      setVarietiesFailed(true);
    }
    try {
      setEnrollments((await listMyEnrollments()).data);
    } catch {
      setEnrollFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePractice = (practice: string) => {
    setSelected((prev) =>
      prev.includes(practice) ? prev.filter((p) => p !== practice) : [...prev, practice]
    );
  };

  const enroll = async () => {
    setBusy(true);
    try {
      await createEnrollment({ plotId: plotId.trim() || undefined, practices: selected });
      toast(t('climateEnrollSubmitted'));
      setPlotId('');
      setSelected([]);
      await load();
    } catch (e) {
      toast(isApiError(e) ? e.message : t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const estimateLabel = t('carbonEstimateNotCredits');

  return (
    <ToolShell toolId="climate">
      <section className="dash-section">
        <h3>{t('climateCarbonTitle')}</h3>
        <p className="trade-hint">{t('climateCarbonHint')}</p>
        {carbonFailed ? <p className="trade-hint">{t('climateCarbonLoadFailed')}</p> : null}
        {carbon ? (
          <div className="trade-card" style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{t('climateCo2eLabel')}</span>
              <span className="trade-card-amount">
                {carbon.co2eTonnes} {t('climateUnitTonnes')}
              </span>
            </div>
            <p className="trade-card-sub">{estimateLabel}</p>
            <div className="trade-card-row">
              <span className="trade-card-title">{t('climateIncomeLabel')}</span>
              <span className="trade-card-amount">
                {formatPaisa(carbon.annualIncomePotentialPaisa)}
              </span>
            </div>
            <p className="trade-card-sub">{estimateLabel}</p>
            <div className="trade-card-row">
              <span className="trade-card-title">{t('climatePlantationLabel')}</span>
              <span className="trade-card-amount">
                {carbon.plantation_estimate} {t('climateUnitTonnes')}
              </span>
            </div>
            <p className="trade-card-sub">{estimateLabel}</p>
            <p className="trade-card-sub">
              {t('climatePracticesLabel')}: {carbon.practices.join(', ')}
            </p>
          </div>
        ) : null}
      </section>

      <section className="dash-section">
        <h3>{t('climateVarietiesTitle')}</h3>
        <p className="trade-hint">{t('climateVarietiesHint')}</p>
        {varietiesFailed ? <p className="trade-hint">{t('climateVarietiesLoadFailed')}</p> : null}
        {!varietiesFailed && varieties.length === 0 ? (
          <EmptyState icon="🌱" titleKey="climateVarietiesEmpty" />
        ) : null}
        {varieties.map((v) => (
          <div className="trade-card" key={v.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{v.variety}</span>
            </div>
            <p className="trade-card-sub">
              {t('climateVarietiesCrop')}: {v.crop}
            </p>
            <p className="trade-card-sub">
              {t('climateVarietiesTrait')}: {v.trait}
            </p>
            <p className="trade-card-sub">
              {t('climateVarietiesSource')}: {v.source}
            </p>
          </div>
        ))}
      </section>

      <section className="dash-section">
        <h3>{t('climateEnrollTitle')}</h3>
        <p className="trade-hint">{t('climateEnrollHint')}</p>
        <p className="trade-card-sub">{t('carbonMrPartnerPlaceholder')}</p>
        <div className="trade-actions-row">
          <label className="trade-card-sub" htmlFor="climate-plot">
            {t('climateEnrollPlot')}
          </label>
          <input
            id="climate-plot"
            className="av-input"
            placeholder={t('climateEnrollPlotPlaceholder')}
            value={plotId}
            onChange={(e) => setPlotId(e.target.value)}
          />
        </div>
        {carbon && carbon.practices.length > 0 ? (
          <div className="trade-actions-row" style={{ flexWrap: 'wrap' }}>
            {carbon.practices.map((practice) => (
              <label className="trade-card-sub" key={practice}>
                <input
                  type="checkbox"
                  checked={selected.includes(practice)}
                  onChange={() => togglePractice(practice)}
                />{' '}
                {practice}
              </label>
            ))}
          </div>
        ) : null}
        <div className="trade-actions-row">
          <button
            type="button"
            className="av-btn av-btn-primary"
            disabled={busy}
            onClick={() => void enroll()}
          >
            {busy ? <span className="av-spinner" aria-hidden /> : t('climateEnrollSubmit')}
          </button>
        </div>

        {enrollFailed ? <p className="trade-hint">{t('climateEnrollLoadFailed')}</p> : null}
        {!enrollFailed && enrollments.length === 0 ? (
          <EmptyState icon="📝" titleKey="climateEnrollEmpty" />
        ) : null}
        {enrollments.map((enrollment) => (
          <div className="trade-card" key={enrollment.id} style={{ cursor: 'default' }}>
            <div className="trade-card-row">
              <span className="trade-card-title">{enrollment.plotId ?? enrollment.id}</span>
            </div>
            <p className="trade-card-sub">
              {t('climateEnrollStatus', { status: enrollment.status })}
            </p>
            <p className="trade-card-sub">{enrollment.practices.join(', ')}</p>
          </div>
        ))}
      </section>
    </ToolShell>
  );
}
