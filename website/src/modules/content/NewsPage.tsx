import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Newspaper, RefreshCw, Share2, Zap } from 'lucide-react';
import { api, EP, isApiError, type AgriNewsItem, type NewsCategory } from '@/api/client';
import {
  AudioButton,
  Badge,
  BottomSheet,
  Button,
  Card,
  EmptyState,
  FilterChips,
  PageHeader,
  RatingStars,
  Skeleton,
} from '@/components/ui';
import { useT } from '@/i18n';
import { cx, formatDateTime } from '@/lib/format';

type CategoryFilter = 'all' | NewsCategory;

const CATEGORY_META: Record<NewsCategory, { hi: string; en: string; chipClass: string }> = {
  marketPolicy: { hi: 'मंडी नीति', en: 'Market Policy', chipClass: 'bg-seller/10 text-seller' },
  weatherAlert: { hi: 'मौसम चेतावनी', en: 'Weather Alert', chipClass: 'bg-transport/10 text-transport' },
  govtSubsidy: { hi: 'सरकारी सब्सिडी', en: 'Govt Subsidy', chipClass: 'bg-primary/10 text-primary' },
  agriTech: { hi: 'एग्री टेक', en: 'Agri Tech', chipClass: 'bg-broker/10 text-broker' },
};

function relTime(iso: string, t: (hi: string, en?: string) => string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return t(`${mins} मिनट पहले`, `${mins} min ago`);
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t(`${hours} घंटे पहले`, `${hours} hr ago`);
  const days = Math.floor(hours / 24);
  return t(`${days} दिन पहले`, `${days} d ago`);
}

export default function NewsPage() {
  const t = useT();
  const [category, setCategory] = useState<CategoryFilter>('all');
  const [items, setItems] = useState<AgriNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AgriNewsItem | null>(null);

  const load = useCallback(async (cat: CategoryFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AgriNewsItem[]>(EP.content.news, {
        query: { category: cat === 'all' ? undefined : cat, page: 1 },
      });
      setItems(res);
    } catch (e) {
      setError(isApiError(e) ? e.message : t('समाचार लोड नहीं हो सके', 'Could not load news'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(category);
  }, [category, load]);

  const breaking = useMemo(() => items.find((i) => i.isBreaking), [items]);
  const rest = useMemo(() => items.filter((i) => i !== breaking), [items, breaking]);

  const chips = useMemo(
    () => [
      { value: 'all', label: t('सभी', 'All') },
      ...(Object.keys(CATEGORY_META) as NewsCategory[]).map((k) => ({
        value: k,
        label: t(CATEGORY_META[k].hi, CATEGORY_META[k].en),
      })),
    ],
    [t],
  );

  return (
    <div className="animate-fade-up">
      <PageHeader title={t('कृषि समाचार', 'Agri News')} subtitle={t('ताज़ा ख़बरें, आपकी भाषा में', 'Fresh news in your language')} />

      {breaking && !loading && (
        <Card className="mb-4 border-l-4 border-l-danger bg-danger/5">
          <div className="mb-1 flex items-center gap-2">
            <Badge tone="danger">
              <Zap size={12} aria-hidden /> {t('ब्रेकिंग न्यूज़', 'BREAKING')}
            </Badge>
            <span className="text-xs text-muted">{relTime(breaking.timestamp, t)}</span>
            <span className="ml-auto">
              <AudioButton text={breaking.audioText} />
            </span>
          </div>
          <button type="button" onClick={() => setSelected(breaking)} className="w-full text-left">
            <h2 className="text-base font-bold text-ink">{t(breaking.vernacularTitle, breaking.title)}</h2>
            <p className="mt-1 line-clamp-2 text-sm text-muted">{breaking.summary}</p>
          </button>
        </Card>
      )}

      <FilterChips options={chips} selected={category} onSelect={(v) => setCategory(v as CategoryFilter)} className="mb-4" />

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Card key={i}>
              <Skeleton className="mb-2 h-4 w-24" />
              <Skeleton className="mb-2 h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <EmptyState icon={Newspaper} title={t('समाचार उपलब्ध नहीं', 'News unavailable')} message={error} />
          <div className="flex justify-center pb-2">
            <Button variant="ghost" onClick={() => void load(category)}>
              <RefreshCw size={16} aria-hidden /> {t('पुनः प्रयास करें', 'Retry')}
            </Button>
          </div>
        </Card>
      ) : rest.length === 0 && !breaking ? (
        <Card>
          <EmptyState
            icon={Newspaper}
            title={t('इस श्रेणी में कोई ख़बर नहीं', 'No news in this category')}
            message={t('दूसरी श्रेणी चुनें या बाद में देखें', 'Pick another category or check later')}
          />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rest.map((item, i) => {
            const meta = CATEGORY_META[item.category];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelected(item)}
                className="animate-fade-up text-left"
                style={{ '--stagger': `${i * 60}ms` } as CSSProperties}
              >
                <Card className="h-full transition-shadow hover:shadow-md">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', meta.chipClass)}>
                      {t(meta.hi, meta.en)}
                    </span>
                    <RatingStars rating={item.impactRating} size={12} />
                  </div>
                  <h3 className="text-sm font-bold text-ink">{t(item.vernacularTitle, item.title)}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-muted">{item.summary}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted">
                    <span className="font-semibold">{t('स्रोत', 'Source')}: {item.source}</span>
                    <span aria-hidden>•</span>
                    <span>{relTime(item.timestamp, t)}</span>
                    <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
                      <AudioButton text={item.audioText} />
                    </span>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      <BottomSheet
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected ? t(selected.vernacularTitle, selected.title) : undefined}
      >
        {selected && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className={cx('rounded-full px-2.5 py-0.5 text-xs font-semibold', CATEGORY_META[selected.category].chipClass)}>
                {t(CATEGORY_META[selected.category].hi, CATEGORY_META[selected.category].en)}
              </span>
              <RatingStars rating={selected.impactRating} size={12} />
              <span className="text-xs text-muted">{formatDateTime(selected.timestamp)}</span>
            </div>
            <p className="mb-2 text-xs font-semibold text-muted">{t('स्रोत', 'Source')}: {selected.source}</p>
            <p className="whitespace-pre-line text-sm leading-relaxed text-ink">{selected.content}</p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <AudioButton text={selected.audioText} />
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`${selected.vernacularTitle}\n\n${selected.summary}`)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-success px-4 text-sm font-semibold text-white hover:bg-success/90"
              >
                <Share2 size={16} aria-hidden /> {t('WhatsApp पर साझा करें', 'Share on WhatsApp')}
              </a>
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
