import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Check, MapPin } from 'lucide-react';
import { api, EP, type GeoReverseRes, type LanguageInfo, type LanguagesRes } from '@/api/client';
import type { LanguageCode } from '@/api/types';
import { AudioButton, Button, Card, EmptyState, Skeleton } from '@/components/ui';
import { useSession } from '@/state/SessionContext';
import { useT, type Lang } from '@/i18n';
import { cx } from '@/lib/format';
import { ErrorBanner, OnboardingShell } from './onboarding-ui';

const FALLBACK_GEO: GeoReverseRes = {
  state: 'Maharashtra',
  district: 'Nashik',
  region: 'West',
  suggestedLanguages: ['mr', 'hi'],
};

const REGION_ORDER = ['West', 'North', 'South', 'Central', 'East', 'NorthEast', 'All'];

export default function LanguagePage() {
  const navigate = useNavigate();
  const { language, setLanguage } = useSession();
  const t = useT();
  const [geo, setGeo] = useState<GeoReverseRes>(FALLBACK_GEO);
  const [languages, setLanguages] = useState<LanguageInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<LanguageCode>(language);

  const load = async () => {
    setError(null);
    setLanguages(null);
    try {
      try {
        const g = await api.get<GeoReverseRes>(EP.reference.geoReverse);
        setGeo(g);
      } catch {
        setGeo(FALLBACK_GEO);
      }
      const res = await api.get<LanguagesRes>(EP.reference.languages);
      setLanguages(res.languages);
      setSelected((cur) => cur);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = useMemo(() => {
    if (!languages) return [];
    const byRegion = new Map<string, LanguageInfo[]>();
    for (const lang of languages) {
      const list = byRegion.get(lang.region) ?? [];
      list.push(lang);
      byRegion.set(lang.region, list);
    }
    const ordered = [...byRegion.entries()].sort((a, b) => {
      const ia = a[0] === geo.region ? -1 : REGION_ORDER.indexOf(a[0]);
      const ib = b[0] === geo.region ? -1 : REGION_ORDER.indexOf(b[0]);
      return ia - ib;
    });
    for (const [, list] of ordered) {
      list.sort((a, b) => {
        const pa = geo.suggestedLanguages.indexOf(a.code);
        const pb = geo.suggestedLanguages.indexOf(b.code);
        return (pa === -1 ? 99 : pa) - (pb === -1 ? 99 : pb);
      });
    }
    return ordered;
  }, [languages, geo]);

  const pick = (code: LanguageCode) => {
    setSelected(code);
    // session supports hi/mr/en; other codes keep hi UI and are stored as preference
    const sessionLang: Lang = code === 'mr' || code === 'en' ? code : 'hi';
    setLanguage(sessionLang);
    localStorage.setItem('ks.lang.pref', code);
  };

  return (
    <OnboardingShell
      step={1}
      total={3}
      title={t('अपनी भाषा चुनें', 'Choose your language')}
      subtitle={t('आप ऐप को अपनी भाषा में इस्तेमाल करेंगे', 'You will use the app in your language')}
    >
      <Card className="animate-fade-up flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-transport/10 text-transport">
          <MapPin size={22} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink">
            {t('पता लगाया गया स्थान', 'Detected location')}: {geo.district}, {geo.state}
          </p>
          <p className="text-xs text-muted">
            {t('सुझाई गई भाषाएँ सबसे ऊपर दिखाई गई हैं', 'Suggested languages are shown first')}
          </p>
        </div>
      </Card>

      <ErrorBanner message={error} />
      {error && (
        <Button variant="ghost" onClick={() => void load()}>
          {t('पुनः प्रयास', 'Retry')}
        </Button>
      )}

      {!languages && !error && (
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {languages && languages.length === 0 && !error && (
        <EmptyState title={t('भाषाएँ उपलब्ध नहीं', 'No languages available')} />
      )}

      {groups.map(([region, list], gi) => (
        <section key={region} className="animate-fade-up" style={{ '--stagger': gi * 80 } as CSSProperties}>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            {region === geo.region ? `${region} · ${t('आपके क्षेत्र के लिए', 'for your region')}` : region}
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {list.map((lang, i) => {
              const active = lang.code === selected;
              const suggested = geo.suggestedLanguages.includes(lang.code);
              return (
                <Card
                  key={lang.code}
                  className={cx(
                    'animate-fade-up flex flex-col gap-2 border-2 transition-colors',
                    active ? '!border-primary bg-accent/60' : '!border-transparent',
                  )}
                  style={{ '--stagger': (gi * 2 + i) * 60 } as CSSProperties}
                >
                  <button
                    type="button"
                    onClick={() => pick(lang.code)}
                    aria-pressed={active}
                    className="flex min-h-11 items-center justify-between gap-2 text-left"
                  >
                    <span>
                      <span className="block text-lg font-bold text-ink">{lang.nativeName}</span>
                      <span className="block text-xs text-muted">{lang.name}</span>
                    </span>
                    {active && (
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
                        <Check size={14} aria-hidden />
                      </span>
                    )}
                  </button>
                  <div className="flex items-center justify-between gap-2">
                    <AudioButton text={lang.audioText} />
                    {suggested && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                        {t('सुझाई गई', 'Suggested')}
                      </span>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      ))}

      <Button size="lg" className="sticky bottom-4 mt-2 shadow-lg" onClick={() => navigate('/onboarding/profiles')}>
        {t('आगे बढ़ें', 'Continue')}
        <ArrowRight size={18} aria-hidden />
      </Button>
    </OnboardingShell>
  );
}
