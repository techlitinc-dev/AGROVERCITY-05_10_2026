import type { CSSProperties } from 'react';
import { BadgeCheck, MapPin, Phone, Sprout } from 'lucide-react';
import { api, EP, type Page, type PlantNursery } from '@/api/client';
import { Badge, Button, Card, EmptyState, RatingStars, Skeleton } from '@/components/ui';
import { useT } from '@/i18n';
import { useFetch } from './useFetch';

export function NurseryTab() {
  const t = useT();
  const { data, loading, error, reload } = useFetch<Page<PlantNursery>>(
    () => api.get(EP.livestock.nurseries),
    [],
  );

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-3 h-12" />
          </Card>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <EmptyState title={t('नर्सरी सूची नहीं मिली', 'Could not load nurseries')} message={error} />
        <div className="flex justify-center">
          <Button variant="ghost" onClick={() => void reload()}>
            {t('पुनः प्रयास करें', 'Retry')}
          </Button>
        </div>
      </div>
    );
  }
  const items = data?.data ?? [];
  if (items.length === 0) {
    return <EmptyState title={t('आसपास कोई नर्सरी नहीं', 'No nursery nearby')} icon={Sprout} />;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((n, i) => (
        <Card key={n.id} className="animate-fade-up" style={{ '--stagger': `${i * 60}ms` } as CSSProperties}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-ink">{t(n.vernacularName, n.name)}</h3>
              <p className="text-xs text-muted">{n.ownerName}</p>
            </div>
            <RatingStars rating={n.rating} size={14} />
          </div>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted">
            <MapPin size={13} aria-hidden /> {n.location} • {n.distanceKm} {t('कि.मी.', 'km')}
          </p>
          {n.isGovtCertified && (
            <div className="mt-2">
              <Badge tone="success">
                <BadgeCheck size={12} aria-hidden /> {t('सरकारी प्रमाणित', 'Govt certified')}
              </Badge>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {n.availableSaplings.map((s) => (
              <Badge key={s} tone="info">{s}</Badge>
            ))}
          </div>
          <p className="mt-2 text-sm font-semibold text-ink">
            {t('मूल्य सीमा', 'Price range')}: {n.priceRange}
          </p>
          <a href={`tel:${n.phone}`} className="mt-3 block">
            <Button variant="ghost" className="w-full">
              <Phone size={16} aria-hidden /> {t('उपलब्धता पूछें', 'Call for availability')}
            </Button>
          </a>
        </Card>
      ))}
    </div>
  );
}
