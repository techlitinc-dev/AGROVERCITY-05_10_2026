import { useState, type CSSProperties } from 'react';
import { Building2, HeartHandshake, Leaf, MapPin, Phone } from 'lucide-react';
import { api, ApiError, EP, type GaushalaItem, type Page } from '@/api/client';
import { Badge, Button, Card, EmptyState, Modal, RatingStars, Skeleton } from '@/components/ui';
import { useT } from '@/i18n';
import { cx } from '@/lib/format';
import { useSession } from '@/state/SessionContext';
import { useToast } from '@/state/ToastContext';
import { useFetch } from './useFetch';

const MANURE_OPTIONS = [
  { product: 'गोबर खाद', priceLabel: '₹300 / 50 कि.ग्रा.', quantity: '50 कि.ग्रा.' },
  { product: 'गोबर स्लरी', priceLabel: '₹150 / 50 लीटर', quantity: '50 लीटर' },
  { product: 'वर्मी कम्पोस्ट', priceLabel: '₹450 / 50 कि.ग्रा.', quantity: '50 कि.ग्रा.' },
];

interface ManureOrderRes {
  orderId: string;
  status: string;
}

export function GaushalaTab() {
  const t = useT();
  const { user } = useSession();
  const { toast } = useToast();
  const { data, loading, error, reload } = useFetch<Page<GaushalaItem>>(
    () => api.get(EP.livestock.gaushalas, { query: { district: user?.district } }),
    [user?.district],
  );
  const [orderFor, setOrderFor] = useState<GaushalaItem | null>(null);
  const [option, setOption] = useState(0);
  const [units, setUnits] = useState(1);
  const [busy, setBusy] = useState(false);

  const openOrder = (g: GaushalaItem) => {
    setOrderFor(g);
    setOption(0);
    setUnits(1);
  };

  const submitOrder = async () => {
    if (!orderFor) return;
    setBusy(true);
    const opt = MANURE_OPTIONS[option];
    try {
      await api.post<ManureOrderRes>(EP.livestock.manureOrder(orderFor.id), {
        product: opt.product,
        quantity: `${opt.quantity} × ${units}`,
      });
      toast(t('ऑर्डर दर्ज हुआ — गौशाला संपर्क करेगी', 'Order placed'), 'success');
      setOrderFor(null);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : t('ऑर्डर विफल', 'Order failed'), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[0, 1, 2].map((i) => (
          <Card key={i}>
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-1/2" />
            <Skeleton className="mt-3 h-16" />
          </Card>
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div>
        <EmptyState title={t('गौशाला सूची नहीं मिली', 'Could not load gaushalas')} message={error} />
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
    return <EmptyState title={t('आसपास कोई गौशाला नहीं', 'No gaushala nearby')} />;
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((g, i) => (
          <Card key={g.id} className="animate-fade-up" style={{ '--stagger': `${i * 60}ms` } as CSSProperties}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-ink">{t(g.vernacularName, g.name)}</h3>
                <p className="flex items-center gap-1 text-xs text-muted">
                  <Building2 size={13} aria-hidden /> {g.trustName}
                </p>
              </div>
              <RatingStars rating={g.rating} size={14} />
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              <MapPin size={13} aria-hidden /> {g.district} • {g.distanceKm} {t('कि.मी.', 'km')}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge tone="info">{g.cowCount} {t('गायें', 'cows')}</Badge>
              {g.breeds.map((b) => (
                <Badge key={b}>{b}</Badge>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">{g.facilities}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {g.providesOrganicManure && (
                <Badge tone="success">
                  <Leaf size={12} aria-hidden /> {t('जैविक खाद उपलब्ध', 'Organic manure')}
                </Badge>
              )}
              {g.offersCowAdoption && (
                <Badge tone="warn">
                  <HeartHandshake size={12} aria-hidden /> {t('गो-दत्तक योजना', 'Cow adoption')}
                </Badge>
              )}
            </div>
            <div className="mt-3 flex gap-2">
              <a href={`tel:${g.phone}`} className="flex-1">
                <Button variant="ghost" className="w-full">
                  <Phone size={16} aria-hidden /> {t('संपर्क करें', 'Contact')}
                </Button>
              </a>
              {g.providesOrganicManure && (
                <Button className="flex-1" onClick={() => openOrder(g)}>
                  {t('खाद बुक करें', 'Book manure')}
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={orderFor !== null}
        onClose={() => setOrderFor(null)}
        title={t('गोबर खाद / स्लरी बुक करें', 'Book manure')}
      >
        {orderFor && (
          <div className="space-y-4">
            <p className="text-sm text-muted">{t(orderFor.vernacularName, orderFor.name)}</p>
            <div className="space-y-2">
              {MANURE_OPTIONS.map((opt, i) => (
                <button
                  key={opt.product}
                  type="button"
                  onClick={() => setOption(i)}
                  className={cx(
                    'flex min-h-11 w-full items-center justify-between rounded-xl border px-3 text-left text-sm font-semibold transition-colors',
                    i === option ? 'border-primary bg-primary/5 text-primary' : 'border-ink/10 text-ink hover:bg-accent',
                  )}
                >
                  <span>{opt.product}</span>
                  <span className="text-xs text-muted">{opt.priceLabel}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">{t('मात्रा (इकाई)', 'Units')}</span>
              <div className="flex items-center gap-2">
                {[1, 2, 5, 10].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setUnits(u)}
                    className={cx(
                      'min-h-11 min-w-11 rounded-xl text-sm font-bold',
                      u === units ? 'bg-primary text-white' : 'bg-accent text-primary',
                    )}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            <Button size="lg" className="w-full" disabled={busy} onClick={() => void submitOrder()}>
              {busy ? t('भेजा जा रहा है…', 'Placing…') : t('ऑर्डर करें', 'Place order')}
            </Button>
          </div>
        )}
      </Modal>
    </>
  );
}
