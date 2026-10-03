import { fmtINR, fmtL, type MilkCollection } from '../../../lib/api/dairy';
import { useT } from '../../../lib/i18n';

export const fmtDate = (value: string): string =>
  new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

interface SlipCardProps {
  slip: MilkCollection;
}

/** Collection slip card — shared by the manager ledger and the farmer's "My Slips". */
export default function SlipCard({ slip }: SlipCardProps) {
  const t = useT();
  return (
    <div className="dairy-slip">
      <div className="dairy-slip-head">
        <span className="dairy-slip-title">
          {fmtDate(slip.date)} · {t(`dairyShift_${slip.shift}`)} · {t(`dairyMilk_${slip.milkType}`)}
        </span>
        <span className="dairy-slip-amount">{fmtINR(slip.totalAmount)}</span>
      </div>
      <div className="dairy-slip-grid">
        <div>
          <div className="dairy-slip-cell-label">{t('dairyLiters')}</div>
          <div className="dairy-slip-cell-value">{fmtL(slip.liters)}</div>
        </div>
        <div>
          <div className="dairy-slip-cell-label">{t('dairyFat')}</div>
          <div className="dairy-slip-cell-value">{slip.fatPercent}%</div>
        </div>
        <div>
          <div className="dairy-slip-cell-label">{t('dairySnf')}</div>
          <div className="dairy-slip-cell-value">{slip.snfPercent}%</div>
        </div>
        <div>
          <div className="dairy-slip-cell-label">{t('dairyRatePerLiter')}</div>
          <div className="dairy-slip-cell-value">{fmtINR(slip.ratePerLiter)}</div>
        </div>
      </div>
      <div className="dairy-slip-no">
        {t('dairySlipNo')} {slip.slipNumber}
      </div>
    </div>
  );
}
