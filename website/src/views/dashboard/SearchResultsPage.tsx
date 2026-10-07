import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AllToolsSheet from '../../components/dashboard/AllToolsSheet';
import BottomMenuBar from '../../components/dashboard/BottomMenuBar';
import MenuBar from '../../components/dashboard/MenuBar';
import SiteFooter from '../../components/SiteFooter';
import SiteHeader from '../../components/SiteHeader';
import { searchResults, type SearchGroup, type SearchResponse } from '../../lib/api/search';
import { useT } from '../../lib/i18n';
import '../../theme/dashboard.css';

/**
 * Global search results (phase-05 WS-09 task 9.6).
 *
 * Reads `?q=` from the URL (deep-linkable), renders the grouped hits returned by
 * `GET /v1/search`, and paginates each group independently via its own cursor
 * (the "see all" control). Every hit deep-links into its owning module page.
 */

const GROUPS: SearchGroup[] = ['schemes', 'products', 'news', 'crops', 'courses', 'lots'];
const PAGE_SIZE = 10;

const GROUP_LABEL_KEY: Record<SearchGroup, string> = {
  schemes: 'searchGroupSchemes',
  products: 'searchGroupProducts',
  news: 'searchGroupNews',
  crops: 'searchGroupCrops',
  courses: 'searchGroupCourses',
  lots: 'searchGroupLots',
};

const GROUP_ICON: Record<SearchGroup, string> = {
  schemes: '🏛️',
  products: '🛒',
  news: '📰',
  crops: '🌾',
  courses: '🎓',
  lots: '🧺',
};

function emptyCursors(): Record<SearchGroup, string | null> {
  return { schemes: null, products: null, news: null, crops: null, courses: null, lots: null };
}

type AnyHit = Record<string, unknown>;

/** Title/subtitle per group — render only from the hit's own fields. */
function hitLine(group: SearchGroup, hit: AnyHit): { title: string; sub: string } {
  switch (group) {
    case 'schemes':
      return { title: String(hit.name ?? ''), sub: String(hit.category ?? '') };
    case 'products':
      return { title: String(hit.title ?? ''), sub: String(hit.brand ?? hit.category ?? '') };
    case 'news':
      return {
        title: String(hit.vernacularTitle || hit.title || ''),
        sub: String(hit.summary ?? ''),
      };
    case 'crops':
      return {
        title: String(hit.name ?? ''),
        sub: String(hit.vernacularName ?? hit.category ?? ''),
      };
    case 'courses':
      return { title: String(hit.title ?? ''), sub: String(hit.instructorName ?? hit.category ?? '') };
    case 'lots': {
      const loc = (hit.location ?? {}) as { district?: string; village?: string };
      const sub = [hit.grade, hit.quantityQuintals, loc.district ?? loc.village]
        .filter((v) => v !== undefined && v !== null && v !== '')
        .join(' • ');
      return { title: String(hit.crop ?? ''), sub };
    }
    default:
      return { title: '', sub: '' };
  }
}

function appendGroup<T extends SearchGroup>(
  prev: SearchResponse,
  group: T,
  more: SearchResponse[T]
): SearchResponse {
  const merged = [...(prev[group] as unknown as AnyHit[]), ...(more as unknown as AnyHit[])];
  return { ...prev, [group]: merged } as SearchResponse;
}

export default function SearchResultsPage() {
  const t = useT();
  const [params] = useSearchParams();
  const q = params.get('q') ?? '';
  const [toolsOpen, setToolsOpen] = useState(false);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [cursors, setCursors] = useState<Record<SearchGroup, string | null>>(emptyCursors);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busyGroup, setBusyGroup] = useState<SearchGroup | null>(null);

  const load = useCallback(() => {
    if (!q.trim()) {
      setResults(null);
      setFailed(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailed(false);
    searchResults({ q, pageSize: PAGE_SIZE })
      .then((res) => {
        setResults(res);
        setCursors(res.nextCursor);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, [q]);

  useEffect(load, [load]);

  const seeAll = (group: SearchGroup) => {
    const cursor = cursors[group];
    if (!cursor || !results) return;
    setBusyGroup(group);
    searchResults({ q, group, cursor, pageSize: PAGE_SIZE })
      .then((res) => {
        setResults((prev) => (prev ? appendGroup(prev, group, res[group]) : res));
        setCursors((prev) => ({ ...prev, [group]: res.nextCursor[group] }));
      })
      .catch(() => setFailed(true))
      .finally(() => setBusyGroup(null));
  };

  const total = results ? GROUPS.reduce((n, g) => n + results[g].length, 0) : 0;
  const hasQuery = q.trim().length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <SiteHeader />
      <MenuBar onOpenAllTools={() => setToolsOpen(true)} />
      <main className="dash-content" style={{ flex: 1 }}>
        <div className="dash-toolpage-head">
          <span className="dash-toolpage-icon" style={{ background: '#4F46E522', color: '#4F46E5' }}>
            🔍
          </span>
          <span>
            <span className="dash-toolpage-title">{t('searchTitle')}</span>
            <br />
            <span className="dash-toolpage-sub">
              {hasQuery ? `“${q}”` : t('searchPlaceholder')}
            </span>
          </span>
        </div>

        {failed ? (
          <div className="trade-card">
            <span className="trade-card-sub">📡 {t('searchNoResults')}</span>
            <div className="trade-actions">
              <button type="button" className="av-btn av-btn-ghost" onClick={load}>
                ↻ {t('retry')}
              </button>
            </div>
          </div>
        ) : null}

        {loading && !results ? <p className="trade-hint">{t('commonLoading')}</p> : null}

        {!loading && hasQuery && results && total === 0 ? (
          <div className="trade-card">
            <span className="trade-card-title">{t('searchNoResults')}</span>
          </div>
        ) : null}

        {results
          ? GROUPS.map((group) => {
              const hits = results[group] as unknown as AnyHit[];
              if (hits.length === 0) return null;
              const cursor = cursors[group];
              return (
                <section className="dash-section" key={group}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <span className="trade-section-title">
                      {GROUP_ICON[group]} {t(GROUP_LABEL_KEY[group])}
                    </span>
                    <span className="trade-hint">{hits.length}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {hits.map((hit, index) => {
                      const { title, sub } = hitLine(group, hit);
                      return (
                        <Link
                          key={`${group}-${String(hit.id ?? index)}`}
                          to={String(hit.deepLink ?? '/dashboard')}
                          className="trade-card"
                        >
                          <span className="trade-card-title">{title}</span>
                          {sub ? <span className="trade-card-sub">{sub}</span> : null}
                        </Link>
                      );
                    })}
                  </div>
                  {cursor ? (
                    <div className="trade-actions">
                      <button
                        type="button"
                        className="av-btn av-btn-ghost"
                        disabled={busyGroup === group}
                        onClick={() => void seeAll(group)}
                      >
                        {t('searchSeeAll')} →
                      </button>
                    </div>
                  ) : null}
                </section>
              );
            })
          : null}
      </main>
      <SiteFooter />
      <BottomMenuBar />
      <AllToolsSheet open={toolsOpen} onClose={() => setToolsOpen(false)} />
    </div>
  );
}
