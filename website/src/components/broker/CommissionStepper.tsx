import { dealMath, inr } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';

interface CommissionStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Live context for the ₹ commission preview while negotiating (plan §2.11). */
  quantityQuintals: number;
  agreedRate: number;
}

const clampPct = (v: number) => Math.min(10, Math.max(0, Math.round(v * 2) / 2));

/** 0–10% commission stepper (0.5 steps, deal default 2%) with ₹ preview. */
export default function CommissionStepper({
  value,
  onChange,
  quantityQuintals,
  agreedRate,
}: CommissionStepperProps) {
  const t = useT();
  const preview =
    quantityQuintals > 0 && agreedRate > 0
      ? dealMath(quantityQuintals, agreedRate, value).commission
      : null;

  return (
    <div className="av-field">
      <span className="av-label">{t('dfCommission')}</span>
      <div className="trade-stepper">
        <button
          type="button"
          className="trade-stepper-btn"
          aria-label={t('qtyDecrease')}
          onClick={() => onChange(clampPct(value - 0.5))}
          disabled={value <= 0}
        >
          −
        </button>
        <span className="trade-stepper-value">
          {value}
          <small> %</small>
        </span>
        <button
          type="button"
          className="trade-stepper-btn"
          aria-label={t('qtyIncrease')}
          onClick={() => onChange(clampPct(value + 0.5))}
          disabled={value >= 10}
        >
          +
        </button>
      </div>
      {preview !== null ? (
        <p className="trade-hint">
          {t('dfCommissionPreview', { amount: inr(preview) })}
        </p>
      ) : null}
    </div>
  );
}
