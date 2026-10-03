import { t } from '../../lib/i18n';

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  step?: number;
  min?: number;
  max?: number;
  unit?: string;
}

/** Quintal/kg stepper with −/+ buttons (large touch targets, spec §2.3). */
export default function QuantityStepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  unit,
}: QuantityStepperProps) {
  const clamp = (v: number) => Math.max(min, max !== undefined ? Math.min(v, max) : v);
  return (
    <div className="trade-stepper">
      <button
        type="button"
        className="trade-stepper-btn"
        aria-label={t('qtyDecrease')}
        onClick={() => onChange(clamp(Math.round((value - step) * 100) / 100))}
        disabled={value <= min}
      >
        −
      </button>
      <span className="trade-stepper-value">
        {value}
        {unit ? <small> {unit}</small> : null}
      </span>
      <button
        type="button"
        className="trade-stepper-btn"
        aria-label={t('qtyIncrease')}
        onClick={() => onChange(clamp(Math.round((value + step) * 100) / 100))}
        disabled={max !== undefined && value >= max}
      >
        +
      </button>
    </div>
  );
}
