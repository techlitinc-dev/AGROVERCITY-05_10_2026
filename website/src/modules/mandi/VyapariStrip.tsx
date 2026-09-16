import type { CSSProperties } from 'react';
import { Minus, TrendingDown, TrendingUp } from 'lucide-react';
import type { VyapariRate } from '@/api/client';
import { LiveBadge, Skeleton } from '@/components/ui';
import { useT } from '@/i18n';
import { cx, formatInr } from '@/lib/format';
import { cropLabel, TREND_META, timeAgo } from './mandiUi';

interface VyapariStripProps {
  rates: VyapariRate[];
  loading: boolean;
}

export function VyapariStrip({ rates, loading }: VyapariStripProps) {
  const t = useT();

  return (
    <section aria-label={t('आज के भाव', "Today's rates")} className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold text-ink">{t('आज के भाव — व्यापारी रेट', "Aaj ke Bhav — vyapari rates")}</h2>
        <LiveBadge label={t('लाइव', 'LIVE')} />
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {loading &&
          Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="glass-card w-56 shrink-0 space-y-2 p-4">
              <Skeleton className="w-2/3" />
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="w-3/4" />
            </div>
          ))}
        {!loading &&
          rates.map((rate, i) => {
            const trend = TREND_META[rate.changeDir];
            const TrendIcon =
              rate.changeDir === 'up' ? TrendingUp : rate.changeDir === 'down' ? TrendingDown : Minus;
            return (
              <article
                key={rate.id}
                className="glass-card w-56 shrink-0 animate-fade-up p-4"
                style={{ '--stagger': `${i * 60}ms` } as CSSProperties}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-ink">{cropLabel(t, rate.crop)}</h3>
                  <span
                    className={cx(
                      'inline-flex items-center gap-0.5 text-xs font-bold',
                      trend.tone === 'success' && 'text-success',
                      trend.tone === 'danger' && 'text-danger',
                      trend.tone === 'neutral' && 'text-muted',
                    )}
                  >
                    <TrendIcon size={13} aria-hidden />
                    {formatInr(Math.abs(rate.priceChange))}
                  </span>
                </div>
                <p className="mt-1 text-lg font-extrabold text-primary">{rate.rateDisplay}</p>
                <p className="mt-1 truncate text-xs text-muted">{rate.mandiName}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {t(`${rate.vyapariCount} व्यापारी अपडेटेड`, `${rate.vyapariCount} vyaparis updated`)}
                  <span aria-hidden> • </span>
                  {timeAgo(rate.lastUpdated, t)}
                </p>
              </article>
            );
          })}
      </div>
    </section>
  );
}
