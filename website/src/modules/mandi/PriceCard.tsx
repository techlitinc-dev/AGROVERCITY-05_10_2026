import type { CSSProperties } from 'react';
import { MapPin, Minus, TrendingDown, TrendingUp, Wheat } from 'lucide-react';
import type { MandiPrice } from '@/api/client';
import { AudioButton, Badge, Card } from '@/components/ui';
import { useT } from '@/i18n';
import { cx, formatInr, formatNumber } from '@/lib/format';
import { cropLabel, TREND_META, timeAgo } from './mandiUi';

interface PriceCardProps {
  price: MandiPrice;
  index: number;
}

export function PriceCard({ price, index }: PriceCardProps) {
  const t = useT();
  const trend = TREND_META[price.trend];
  const TrendIcon = price.trend === 'up' ? TrendingUp : price.trend === 'down' ? TrendingDown : Minus;
  const aboveMsp = price.msp != null && price.modalPrice >= price.msp;
  const crop = cropLabel(t, price.commodity);

  const audioText = t(
    `${price.mandiName} मंडी में ${crop} का मोडल भाव ${price.modalPrice} रुपये प्रति क्विंटल है। न्यूनतम ${price.minPrice}, अधिकतम ${price.maxPrice} रुपये।`,
    `${crop} modal price at ${price.mandiName} is ${price.modalPrice} rupees per quintal.`,
  );

  return (
    <Card
      className="flex flex-col gap-3 animate-fade-up"
      style={{ '--stagger': `${index * 60}ms` } as CSSProperties}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold text-ink">{price.mandiName}</h3>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
            <MapPin size={12} aria-hidden />
            {t(`${formatNumber(price.distanceKm)} किमी दूर`, `${formatNumber(price.distanceKm)} km away`)}
            <span aria-hidden>•</span>
            {timeAgo(price.updatedAt, t)}
          </p>
        </div>
        <Badge tone={trend.tone}>
          <TrendIcon size={13} aria-hidden />
          {trend.sign}
          {formatNumber(price.changePercent)}%
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-sm text-muted">
        <Wheat size={15} className="shrink-0 text-primary" aria-hidden />
        <span className="font-semibold text-ink">{crop}</span>
        <span className="truncate">{price.variety}</span>
      </div>

      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-muted">{t('मोडल भाव', 'Modal price')}</p>
          <p className="text-2xl font-extrabold text-primary">
            {formatInr(price.modalPrice)}
            <span className="text-xs font-semibold text-muted">{t('/क्विंटल', '/qtl')}</span>
          </p>
        </div>
        <div className="text-right text-xs text-muted">
          <p>
            {t('न्यूनतम', 'Min')} <span className="font-semibold text-ink">{formatInr(price.minPrice)}</span>
          </p>
          <p>
            {t('अधिकतम', 'Max')} <span className="font-semibold text-ink">{formatInr(price.maxPrice)}</span>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-ink/5 pt-2.5">
        {price.msp != null ? (
          <>
            <span className="text-xs text-muted">
              MSP <span className="font-semibold text-ink">{formatInr(price.msp)}</span>
            </span>
            <Badge tone={aboveMsp ? 'success' : 'danger'}>
              {aboveMsp ? t('MSP से ऊपर', 'Above MSP') : t('MSP से नीचे', 'Below MSP')}
            </Badge>
          </>
        ) : (
          <span className="text-xs text-muted">{t('MSP लागू नहीं', 'No MSP')}</span>
        )}
        <span className="ml-auto text-xs text-muted">
          {t('आवक', 'Arrivals')}{' '}
          <span className="font-semibold text-ink">
            {formatNumber(price.arrivalsQuintals)} {t('क्विंटल', 'qtl')}
          </span>
        </span>
      </div>

      <AudioButton text={audioText} className={cx('self-start')} />
    </Card>
  );
}
