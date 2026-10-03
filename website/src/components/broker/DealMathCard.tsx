import { dealMath, inr } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';

interface DealMathCardProps {
  quantityQuintals: number;
  agreedRate: number;
  pct: number;
  /** Weighed quantity at delivery — pro-rata adjusts gross/payout (plan §8 E6). */
  weighedQty?: number;
  variant?: 'broker' | 'farmer';
}

/**
 * The three visible numbers (plan §2.1): Gross = Qty × Rate, Commission (−),
 * Payout (=). Same card for the broker (earnings view) and the farmer
 * (payout view, vernacular labels). Greys out until inputs are valid.
 */
export default function DealMathCard({
  quantityQuintals,
  agreedRate,
  pct,
  weighedQty,
  variant = 'broker',
}: DealMathCardProps) {
  const t = useT();
  const qty = weighedQty ?? quantityQuintals;
  const valid = qty > 0 && agreedRate > 0;

  const labels =
    variant === 'farmer'
      ? { gross: t('mathReceived'), commission: t('mathDalali'), payout: t('mathHaath') }
      : { gross: t('mathGross'), commission: t('mathCommission'), payout: t('mathPayout') };

  return (
    <div className="trade-invoice-box broker-math-card">
      <div className="trade-invoice-row">
        <span>
          {labels.gross} · {qty} {t('unitQuintalShort')} × {inr(agreedRate)}
        </span>
        <span>{valid ? inr(dealMath(qty, agreedRate, pct).gross) : '—'}</span>
      </div>
      <div className="trade-invoice-row">
        <span>
          {labels.commission} · {pct}%
        </span>
        <span>{valid ? `− ${inr(dealMath(qty, agreedRate, pct).commission)}` : '—'}</span>
      </div>
      <div className="trade-invoice-row trade-invoice-total">
        <span>{labels.payout}</span>
        <span>{valid ? inr(dealMath(qty, agreedRate, pct).payout) : '—'}</span>
      </div>
      {weighedQty !== undefined && weighedQty !== quantityQuintals ? (
        <p className="trade-hint">{t('ddProRataNote')}</p>
      ) : null}
    </div>
  );
}
