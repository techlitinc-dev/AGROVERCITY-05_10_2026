import { useState } from 'react';
import LabeledTextField from '../../../components/LabeledTextField';
import { toast } from '../../../components/toast';
import { isApiError } from '../../../lib/api/client';
import { type RateChart, type RateChartInput } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import SpeciesToggle from './SpeciesToggle';

interface RateChartFormProps {
  initial: RateChart | null;
  busy: boolean;
  onSubmit: (payload: RateChartInput) => Promise<void>;
}

const num = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return value === '' || Number.isNaN(parsed) ? fallback : parsed;
};

/** FAT/SNF rate chart editor — fields per RateChartIn + advanced minimums block. */
export default function RateChartForm({ initial, busy, onSubmit }: RateChartFormProps) {
  const t = useT();
  const [species, setSpecies] = useState(initial?.species ?? 'cow');
  const [effectiveFrom, setEffectiveFrom] = useState(initial?.effectiveFrom ?? '');
  const [baseRate, setBaseRate] = useState(initial ? String(initial.baseRate) : '');
  const [fatBase, setFatBase] = useState(initial ? String(initial.fatBase) : '');
  const [snfBase, setSnfBase] = useState(initial ? String(initial.snfBase) : '');
  const [fatStep, setFatStep] = useState(initial ? String(initial.fatStep) : '1.0');
  const [snfStep, setSnfStep] = useState(initial ? String(initial.snfStep) : '1.0');
  const [minRate, setMinRate] = useState(initial ? String(initial.minRate) : '');
  const [minFat, setMinFat] = useState(initial ? String(initial.minFat) : '');
  const [minSnf, setMinSnf] = useState(initial ? String(initial.minSnf) : '');
  const [active, setActive] = useState(initial?.active ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async () => {
    if (busy) return;
    setErrors({});
    const payload: RateChartInput = {
      species,
      effectiveFrom,
      baseRate: num(baseRate, 0),
      fatBase: num(fatBase, 0),
      snfBase: num(snfBase, 0),
      fatStep: num(fatStep, 1),
      snfStep: num(snfStep, 1),
      minRate: num(minRate, 0),
      minFat: num(minFat, 0),
      minSnf: num(minSnf, 0),
      active,
    };
    try {
      await onSubmit(payload);
    } catch (e) {
      if (isApiError(e) && e.fieldErrors && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast(t('actionFailed'), { error: true });
      }
    }
  };

  return (
    <div className="dairy-form">
      <div className="av-field">
        <label className="av-label">{t('dairyFormSpecies')}</label>
        <SpeciesToggle value={species} onChange={setSpecies} />
      </div>
      <LabeledTextField
        label={t('dairyRcEffectiveFrom')}
        value={effectiveFrom}
        onChange={setEffectiveFrom}
        type="date"
        error={errors.effectiveFrom}
        required
      />
      <LabeledTextField
        label={t('dairyRcBaseRate')}
        value={baseRate}
        onChange={setBaseRate}
        type="number"
        inputMode="decimal"
        error={errors.baseRate}
        required
      />
      <LabeledTextField
        label={t('dairyRcFatBase')}
        value={fatBase}
        onChange={setFatBase}
        type="number"
        inputMode="decimal"
        error={errors.fatBase}
        required
      />
      <LabeledTextField
        label={t('dairyRcSnfBase')}
        value={snfBase}
        onChange={setSnfBase}
        type="number"
        inputMode="decimal"
        error={errors.snfBase}
        required
      />
      <LabeledTextField
        label={t('dairyRcFatStep')}
        value={fatStep}
        onChange={setFatStep}
        type="number"
        inputMode="decimal"
        error={errors.fatStep}
      />
      <LabeledTextField
        label={t('dairyRcSnfStep')}
        value={snfStep}
        onChange={setSnfStep}
        type="number"
        inputMode="decimal"
        error={errors.snfStep}
      />

      <div className="dairy-section-title" style={{ margin: '10px 0 4px' }}>
        {t('dairyRcMinRate')}
      </div>
      <LabeledTextField
        label={t('dairyRcMinRate')}
        value={minRate}
        onChange={setMinRate}
        type="number"
        inputMode="decimal"
        error={errors.minRate}
      />
      <LabeledTextField
        label={t('dairyRcMinFat')}
        value={minFat}
        onChange={setMinFat}
        type="number"
        inputMode="decimal"
        error={errors.minFat}
      />
      <LabeledTextField
        label={t('dairyRcMinSnf')}
        value={minSnf}
        onChange={setMinSnf}
        type="number"
        inputMode="decimal"
        error={errors.minSnf}
      />

      <label style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 0' }}>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          style={{ width: 20, height: 20 }}
        />
        <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--av-title)' }}>
          {t('dairyRcActive')}
        </span>
      </label>
      {active ? <p className="dairy-hint">{t('dairyRcActiveHint')}</p> : null}

      <div className="dairy-actions">
        <button type="button" className="av-btn av-btn-primary" onClick={() => void submit()} disabled={busy}>
          {busy ? <span className="av-spinner" aria-hidden /> : t('commonSave')}
        </button>
      </div>
    </div>
  );
}
