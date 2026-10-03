import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { fetchLanguages } from '../../lib/api/reference';
import type { LanguageInfo } from '../../lib/api/types';
import { updateSettings } from '../../lib/api/users';
import { useT } from '../../lib/i18n';
import { LANGUAGE_CATALOGUE } from '../../lib/languages';
import { useOnboardingStore } from '../../stores/onboarding';
import { useSessionStore } from '../../stores/session';
import '../../theme/views.css';

const FEATURED = [
  { code: 'en', name: 'English', english: 'English', badgeKey: 'badgeDefault', initials: 'EN' },
  { code: 'mr', name: 'मराठी', english: 'Marathi', badgeKey: 'badgeMaharashtra', initials: 'म' },
  { code: 'hi', name: 'हिन्दी', english: 'Hindi', badgeKey: 'badgeNational', initials: 'हि' },
];

/** Languages shown below the featured cards — the full bundled catalogue, so
 *  every language renders instantly (the API response is merged on top for
 *  audio previews and any future additions). */
function catalogueOptions(): LanguageInfo[] {
  return LANGUAGE_CATALOGUE.filter((l) => !FEATURED.some((f) => f.code === l.code)).map((l) => ({
    code: l.code,
    name: l.name,
    englishName: l.englishName,
    regions: [...l.regions],
    audioText: l.audioText,
  }));
}

/** Step 1/4 — language selection: featured cards + searchable regional groups.
 *  In the register continuation it feeds the next step; for logged-in users it
 *  just changes the app language (persisted to /users/me/settings). */
export default function LanguageSelect() {
  const t = useT();
  const navigate = useNavigate();
  const language = useOnboardingStore((s) => s.language);
  const setLanguage = useOnboardingStore((s) => s.setLanguage);
  const hasToken = useSessionStore((s) => !!s.accessToken);
  const isOnboarded = useOnboardingStore((s) => s.isOnboarded);
  const [otherLanguages, setOtherLanguages] = useState<LanguageInfo[]>(catalogueOptions);
  const [query, setQuery] = useState('');

  /** Logged-in users arrive here from the header switcher / dashboard. */
  const laterMode = hasToken && isOnboarded;

  useEffect(() => {
    let cancelled = false;
    fetchLanguages()
      .then((res) => {
        if (cancelled) return;
        setOtherLanguages((prev) => {
          const merged = [...prev];
          for (const apiLang of res.languages ?? []) {
            const existing = merged.find((l) => l.code === apiLang.code);
            if (existing) {
              existing.audioText = apiLang.audioText ?? existing.audioText;
            } else {
              merged.push(apiLang);
            }
          }
          return merged;
        });
      })
      .catch(() => undefined); // bundled catalogue is already shown — silent fail
    return () => {
      cancelled = true;
    };
  }, []);

  /** Group languages by their primary region (first entry) so each language
   *  appears exactly once; region headers are localized via region_* keys. */
  const regionGroups = useMemo(() => {
    const groups = new Map<string, LanguageInfo[]>();
    for (const lang of otherLanguages) {
      const region = lang.regions && lang.regions.length > 0 ? lang.regions[0] : '';
      const list = groups.get(region) ?? [];
      list.push(lang);
      groups.set(region, list);
    }
    if (groups.size === 0) return [];
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([region, languages]) => ({ region, languages }));
  }, [otherLanguages]);

  /** Search filter across native name, English name and code. */
  const visibleGroups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return regionGroups;
    return regionGroups
      .map((group) => ({
        ...group,
        languages: group.languages.filter(
          (l) =>
            l.name.toLowerCase().includes(q) ||
            (l.englishName ?? '').toLowerCase().includes(q) ||
            l.code.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.languages.length > 0);
  }, [regionGroups, query]);

  /** Localized region header with graceful fallback to the raw region name. */
  const regionLabel = (region: string): string => {
    if (!region) return t('allRegions');
    const key = `region_${region}`;
    const label = t(key);
    return label === key ? region : label;
  };

  const selectedName = LANGUAGE_CATALOGUE.find((l) => l.code === language)?.name ?? '';
  const totalCount = otherLanguages.length + FEATURED.length;

  const handleContinue = () => {
    if (laterMode) {
      void updateSettings({ language, preferredLanguage: language }).catch(() => undefined);
      navigate('/dashboard');
      return;
    }
    navigate('/onboarding/profiles');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <SiteHeader step={laterMode ? undefined : 2} />
      <main style={{ flex: 1 }}>
        <div className="av-container">
          <div className="av-hero">
            <div className="lang-hero-emoji">🌍</div>
            <h1 className="av-page-title">{t('selectLanguagePrompt')}</h1>
            <p className="av-page-subtitle">{t('languagesGrouped')}</p>
          </div>

          <div className="av-panel lang-panel">
            <div className="av-panel-pad">
              <div className="gps-card">
                <p className="gps-card-title">📍 {t('gpsDetected')}</p>
                <div className="lang-cards">
                  {FEATURED.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      className={`lang-card${language === lang.code ? ' selected' : ''}`}
                      onClick={() => setLanguage(lang.code)}
                    >
                      <span className="lang-check">✓</span>
                      <span className="lang-card-avatar">{lang.initials}</span>
                      <span className="lang-card-name">{lang.name}</span>
                      <span className="lang-card-english">{lang.english}</span>
                      <span className="lang-badge">{t(lang.badgeKey)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="lang-search">
                <span className="lang-search-icon">🔍</span>
                <input
                  type="search"
                  value={query}
                  placeholder={t('searchLanguages')}
                  aria-label={t('searchLanguages')}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              {visibleGroups.length > 0 ? (
                visibleGroups.map((group) => (
                  <div className="region-group" key={group.region || 'all'}>
                    <div className="region-group-head">
                      <p className="region-group-name">{regionLabel(group.region)}</p>
                      <span className="region-group-count">{group.languages.length}</span>
                    </div>
                    <div className="lang-grid">
                      {group.languages.map((lang) => (
                        <button
                          key={`${group.region}-${lang.code}`}
                          type="button"
                          className={`lang-tile${language === lang.code ? ' selected' : ''}`}
                          onClick={() => setLanguage(lang.code)}
                        >
                          <span className="lang-tile-check">✓</span>
                          <span className="lang-tile-name">{lang.name}</span>
                          <span className="lang-tile-english">{lang.englishName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <p className="lang-empty">{t('noLanguagesFound')}</p>
              )}
            </div>
          </div>
        </div>
      </main>

      <div className="action-bar">
        <div className="av-container action-bar-inner">
          <span className="action-count">
            🌐 {selectedName} · {t('languagesAvailable', { count: totalCount })}
          </span>
          <button type="button" className="av-btn av-btn-primary" onClick={handleContinue}>
            {t('continue')} →
          </button>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
