import { useEffect, useState } from 'react';
import { mandiCompare } from '../../lib/api/mandi';
import { inr } from '../../lib/api/trade';
import { useT } from '../../lib/i18n';

interface PriceWithBenchmarkProps {
  crop: string;
  quantityQuintals: number;
  price: number;
}

/**
 * Mandi benchmark card shown beside every price decision (spec F7) —
 * "never let a user type a price blind" (plan §2.5).
 */
export default function PriceWithBenchmark({ crop, quantityQuintals, price }: PriceWithBenchmarkProps) {
  const t = useT();
  const [items, setItems] = useState<
    Array<{ mandiName: string; modalPrice: number; netProfit: number }> | null
  >(null);

  useEffect(() => {
    if (!crop || quantityQuintals <= 0) {
      setItems(null);
      return;
    }
    let live = true;
    mandiCompare(crop, quantityQuintals)
      .then((res) => live && setItems(res.data.slice(0, 3)))
      .catch(() => live && setItems(null));
    return () => {
      live = false;
    };
  }, [crop, quantityQuintals]);

  if (!items?.length) return null;
  const best = items[0];
  const delta = price > 0 && best ? price - best.modalPrice : null;

  return (
    <div className="trade-benchmark av-card">
      <p className="trade-benchmark-title">📈 {t('benchmarkTitle')}</p>
      {items.map((item) => (
        <div key={item.mandiName} className="trade-benchmark-row">
          <span>{item.mandiName}</span>
          <span className="trade-benchmark-value">
            {inr(item.modalPrice)}/{t('unitQuintal')}
          </span>
        </div>
      ))}
      {delta !== null ? (
        <p className={delta <= 0 ? 'trade-benchmark-good' : 'trade-benchmark-warn'}>
          {delta <= 0
            ? t('benchmarkBelow', { amount: inr(Math.abs(delta)) })
            : t('benchmarkAbove', { amount: inr(delta) })}
        </p>
      ) : null}
    </div>
  );
}
