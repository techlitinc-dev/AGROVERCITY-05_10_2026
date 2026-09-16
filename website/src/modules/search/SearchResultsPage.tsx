import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { History, Mic, SearchX, Sparkles, Trash2, TrendingUp } from 'lucide-react';
import { Button, Card, EmptyState, PageHeader, SearchInput, Skeleton } from '@/components/ui';
import { useT } from '@/i18n';
import { useSession } from '@/state/SessionContext';
import { useToast } from '@/state/ToastContext';
import { api, ApiError } from '@/api/client';
import { EP } from '@/api/endpoints';
import type { SearchResults } from '@/api/types';
import { clearRecentSearches, getRecentSearches, saveRecentSearch } from './recentSearches';
import { ResultRails } from './ResultRails';

const POPULAR_SEARCHES: [string, string][] = [
  ['गेहूं का भाव', 'Wheat price'],
  ['सोयाबीन', 'Soybean'],
  ['PM-KISAN', 'PM-KISAN'],
  ['यूरिया', 'Urea'],
  ['ट्रैक्टर किराया', 'Tractor rental'],
  ['कपास', 'Cotton'],
];

function resultCount(r: SearchResults): number {
  return r.schemes.length + r.products.length + r.news.length + r.crops.length + r.videos.length;
}

function RailSkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1, 2].map((s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-5 w-40" />
          <div className="flex gap-3 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="w-44 shrink-0 space-y-2">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-3 w-2/5" />
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchResultsPage() {
  const t = useT();
  const { language } = useSession();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();
  const q = (params.get('q') ?? '').trim();

  const [input, setInput] = useState(q);
  const [recent, setRecent] = useState<string[]>(getRecentSearches);
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setInput(q), [q]);

  useEffect(() => {
    if (!q) {
      setResults(null);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<SearchResults>(EP.search, { query: { q, lang: language } })
      .then((data) => {
        if (cancelled) return;
        setResults(data);
        setRecent(saveRecentSearch(data.query || q));
      })
      .catch((e) => {
        if (cancelled) return;
        setResults(null);
        setError(e instanceof ApiError ? e.message : t('कुछ गड़बड़ हो गई. फिर कोशिश करें.', 'Something went wrong. Try again.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, language]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next = input.trim();
    setParams(next ? { q: next } : {});
  };

  const runSearch = (term: string) => setParams({ q: term });

  const onMic = () => toast(t('वॉइस सर्च जल्द आ रहा है', 'Voice search coming soon'), 'info');

  const total = results ? resultCount(results) : 0;
  const showEmpty = !loading && !error && q && results !== null && total === 0;

  return (
    <div className="animate-fade-up mx-auto w-full max-w-6xl space-y-5">
      <PageHeader
        title={t('खोजें', 'Search')}
        subtitle={q ? t(`"${q}" के परिणाम`, `Results for "${q}"`) : t('फ़सल, भाव, योजनाएं, ख़बरें — सब एक जगह', 'Crops, prices, schemes, news — all in one place')}
      />

      <form onSubmit={submit} role="search">
        <SearchInput
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={t('गेहूं, PM-KISAN, यूरिया… खोजें', 'Search wheat, PM-KISAN, urea…')}
          aria-label={t('खोजें', 'Search')}
          onMic={onMic}
        />
      </form>

      {recent.length > 0 && !loading && (
        <section className="animate-fade-up" style={{ '--stagger': 0 } as CSSProperties}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <History size={16} className="text-muted" aria-hidden />
              {t('हाल की खोजें', 'Recent searches')}
            </h2>
            <button
              type="button"
              onClick={() => {
                clearRecentSearches();
                setRecent([]);
              }}
              aria-label={t('हाल की खोजें साफ़ करें', 'Clear recent searches')}
              className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-muted hover:bg-accent hover:text-danger"
            >
              <Trash2 size={16} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((term, i) => (
              <button
                key={term}
                type="button"
                onClick={() => runSearch(term)}
                className="glass-card animate-fade-up min-h-11 rounded-full px-4 text-sm font-medium text-ink hover:bg-accent"
                style={{ '--stagger': i * 40 } as CSSProperties}
              >
                {term}
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && <RailSkeleton />}

      {!loading && error && (
        <Card>
          <EmptyState icon={SearchX} title={t('खोज विफल', 'Search failed')} message={error} />
          <div className="flex justify-center pb-2">
            <Button variant="ghost" onClick={() => setParams({ q, r: String(Date.now()) } as never)}>
              {t('पुनः प्रयास करें', 'Retry')}
            </Button>
          </div>
        </Card>
      )}

      {!loading && !error && results && total > 0 && <ResultRails results={results} />}

      {showEmpty && (
        <Card className="animate-fade-up">
          <EmptyState
            icon={SearchX}
            title={t(`"${q}" के लिए कोई परिणाम नहीं`, `No results for "${q}"`)}
            message={t('वर्तनी जांचें या लोकप्रिय खोजों से शुरुआत करें', 'Check spelling or start with a popular search')}
          />
          <div className="mx-auto flex max-w-md flex-col items-center gap-3 pb-4">
            <Button variant="ghost" onClick={onMic}>
              <Mic size={16} aria-hidden />
              {t('बोलकर खोजें', 'Search by voice')}
            </Button>
            <div className="flex flex-wrap justify-center gap-2">
              {POPULAR_SEARCHES.map(([hi, en], i) => (
                <button
                  key={hi}
                  type="button"
                  onClick={() => runSearch(hi)}
                  className="glass-card animate-fade-up flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-ink hover:bg-accent"
                  style={{ '--stagger': i * 40 } as CSSProperties}
                >
                  <TrendingUp size={14} className="text-primary" aria-hidden />
                  {t(hi, en)}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {!q && !loading && (
        <Card className="animate-fade-up" style={{ '--stagger': 120 } as CSSProperties}>
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-primary">
              <Sparkles size={28} aria-hidden />
            </span>
            <h3 className="text-base font-bold text-ink">{t('क्या खोज रहे हैं?', 'What are you looking for?')}</h3>
            <p className="max-w-sm text-sm text-muted">
              {t('मंडी भाव, उत्पाद, योजनाएं, ख़बरें और वीडियो — एक ही खोज में', 'Mandi prices, products, schemes, news and videos — in a single search')}
            </p>
            <div className="mt-1 flex flex-wrap justify-center gap-2">
              {POPULAR_SEARCHES.map(([hi, en], i) => (
                <button
                  key={hi}
                  type="button"
                  onClick={() => runSearch(hi)}
                  className="glass-card animate-fade-up flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-ink hover:bg-accent"
                  style={{ '--stagger': i * 40 } as CSSProperties}
                >
                  <TrendingUp size={14} className="text-primary" aria-hidden />
                  {t(hi, en)}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
