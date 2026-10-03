import { useEffect, useState } from 'react';
import LabeledTextField from '../../../components/LabeledTextField';
import { calcRate, fmtINR, type CollectionShift, type DairySpecies, type RateCalcResult } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';
import ShiftToggle from './ShiftToggle';
import SpeciesToggle from './SpeciesToggle';

export interface CollectionDraftValues {
  shift: CollectionShift;
  milkType: DairySpecies;
  liters: string;
  fatPercent: string;
  snfPercent: string;
}

interface CollectionFormProps {
  value: CollectionDraftValues;
  onChange: (patch: Partial<CollectionDraftValues>) => void;
  fieldErrors?: Record<string, string>;
}

/** Liters/FAT/SNF inputs + live rate preview (rate-calc), labeled approx. */
export default function CollectionForm({ value, onChange, fieldErrors }: CollectionFormProps) {
  const t = useT();
  const [preview, setPreview] = useState<RateCalcResult | null>(null);

  const liters = Number(value.liters);
  const fat = Number(value.fatPercent);
  const snf = Number(value.snfPercent);
  const inputsValid =
    value.liters !== '' &&
    value.fatPercent !== '' &&
    value.snfPercent !== '' &&
    liters > 0 &&
    liters <= 2000 &&
    fat >= 2 &&
    fat <= 14 &&
    snf >= 6 &&
    snf <= 14;

  useEffect(() => {
    if (!inputsValid) {
      setPreview(null);
      return;
    }
    let stale = false;
    const timer = window.setTimeout(() => {
      calcRate({ milkType: value.milkType, fatPercent: fat, snfPercent: snf, liters })
        .then((res) => {
          if (!stale) setPreview(res);
        })
        .catch(() => {
          if (!stale) setPreview(null);
        });
    }, 350);
    return () => {
      stale = true;
      window.clearTimeout(timer);
    };
  }, [inputsValid, value.milkType, liters, fat, snf]);

  return (
    <div className="dairy-form">
      <div className="av-field">
        <label className="av-label">{t('dairyFormShift')}</label>
        <ShiftToggle value={value.shift} onChange={(shift) => onChange({ shift })} />
      </div>
      <div className="av-field">
        <label className="av-label">{t('dairyFormSpecies')}</label>
        <SpeciesToggle value={value.milkType} onChange={(milkType) => onChange({ milkType })} />
      </div>
      <LabeledTextField
        label={t('dairyFormLiters')}
        value={value.liters}
        onChange={(liters) => onChange({ liters })}
        type="number"
        inputMode="decimal"
        error={fieldErrors?.liters}
        required
      />
      <LabeledTextField
        label={t('dairyFormFat')}
        value={value.fatPercent}
        onChange={(fatPercent) => onChange({ fatPercent })}
        type="number"
        inputMode="decimal"
        error={fieldErrors?.fatPercent}
        required
      />
      <LabeledTextField
        label={t('dairyFormSnf')}
        value={value.snfPercent}
        onChange={(snfPercent) => onChange({ snfPercent })}
        type="number"
        inputMode="decimal"
        error={fieldErrors?.snfPercent}
        required
      />

      {preview ? (
        <div className="dairy-preview">
          <div className="dairy-preview-title">{t('dairyFormPreviewTitle')}</div>
          <div className="dairy-preview-rate">
            {fmtINR(preview.ratePerLiter)} <small>/ {t('dairyLiters')}</small>
          </div>
          <div className="dairy-preview-rate" style={{ fontSize: 18 }}>
            {t('dairyFormTotal')}: {fmtINR(preview.totalAmount)}
          </div>
          <div className="dairy-preview-formula">{preview.formula}</div>
          <div className="dairy-hint">{t('dairyFormPreviewApprox')}</div>
        </div>
      ) : null}
    </div>
  );
}
