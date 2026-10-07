import { useState } from 'react';
import LabeledTextField from '../../components/LabeledTextField';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  confirmCropPlan,
  cropPlan,
  type CropPlanOption,
  type CropPlanResult,
} from '../../lib/api/advisory';
import { inr } from '../../lib/api/trade';
import { currentLanguage, useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/advisory.css';

/**
 * AI crop planner (robust.md §7.2, brief M13, SGR) — `suggest` only.
 *
 * The endpoint suggests 2-3 rotation crops with a vernacular rationale; it never
 * creates anything. Only the explicit Confirm posts to `/crop-plan/confirm`,
 * which creates the real `crop_cycles` doc and the task schedule.
 */
export default function CropPlannerPage() {
  const t = useT();
  const user = useSessionStore((s) => s.user);

  const [soil, setSoil] = useState('');
  const [irrigation, setIrrigation] = useState('');
  const [size, setSize] = useState('');
  const [history, setHistory] = useState('');
  const [district, setDistrict] = useState(
    typeof user?.district === 'string' ? user.district : ''
  );
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<CropPlanResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const run = async () => {
    const acres = Number(size);
    if (!soil.trim() || !irrigation.trim() || !(acres > 0) || !district.trim()) {
      toast(t('actionFailed'), { error: true });
      return;
    }
    setBusy(true);
    setConfirmed(false);
    try {
      const plan = await cropPlan({
        soil: soil.trim(),
        irrigation: irrigation.trim(),
        plotSizeAcres: acres,
        cropHistory: history
          .split(',')
          .map((crop) => crop.trim())
          .filter(Boolean),
        district: district.trim(),
        lang: currentLanguage() === 'hi' ? 'hi' : 'en',
      });
      setResult(plan);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        toast(Object.values(e.fieldErrors)[0], { error: true });
      } else {
        toast(t('actionFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (option: CropPlanOption) => {
    try {
      await confirmCropPlan({
        crop: option.crop,
        district: district.trim(),
        rationale: option.rationale,
      });
      setConfirmed(true);
      toast(t('cropPlannerConfirmed'));
    } catch {
      toast(t('actionFailed'), { error: true });
    }
  };

  return (
    <section className="advisory-tab" aria-label={t('cropPlannerTitle')}>
      <p className="trade-section-title">{t('cropPlannerTitle')}</p>

      <LabeledTextField label={t('cropPlannerSoil')} value={soil} onChange={setSoil} />
      <LabeledTextField
        label={t('cropPlannerIrrigation')}
        value={irrigation}
        onChange={setIrrigation}
      />
      <LabeledTextField
        label={t('cropPlannerSize')}
        value={size}
        onChange={setSize}
        inputMode="decimal"
      />
      <LabeledTextField
        label={t('cropPlannerHistory')}
        value={history}
        onChange={setHistory}
      />
      <LabeledTextField
        label={t('cropPlannerDistrict')}
        value={district}
        onChange={setDistrict}
      />

      <div className="trade-actions">
        <button
          type="button"
          className="av-btn av-btn-primary"
          onClick={() => void run()}
          disabled={busy}
        >
          {busy ? <span className="av-spinner" aria-hidden /> : t('cropPlannerRun')}
        </button>
      </div>

      {result !== null ? (
        <div style={{ marginTop: 12 }}>
          <p className="trade-section-title">
            {t('cropPlannerOptions')}
            {result.cached ? ` · ${t('cropPlannerCached')}` : ''}
          </p>
          {result.options.map((option) => (
            <div className="trade-card" key={option.crop} style={{ cursor: 'default' }}>
              <span className="trade-card-title">{option.crop}</span>
              <p className="trade-card-sub">
                {t('cropPlannerRationale')}: {option.rationale}
              </p>
              {option.estimatedRevenuePaisa > 0 ? (
                <p className="trade-card-sub">
                  {t('cropPlannerEstRevenue', {
                    price: inr(option.estimatedRevenuePaisa / 100),
                  })}
                </p>
              ) : null}
              <div className="trade-actions">
                <button
                  type="button"
                  className="av-btn"
                  onClick={() => void confirm(option)}
                  disabled={confirmed}
                >
                  {t('cropPlannerConfirm')}
                </button>
              </div>
            </div>
          ))}
          {confirmed ? <p className="trade-hint">{t('cropPlannerConfirmed')}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
