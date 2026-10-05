import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  getCoinBalance,
  getCourseRecommendations,
  listCourses,
  type CourseRecommendation,
  type CourseSummary,
  type InstructorCredential,
  type ListCoursesParams,
} from '../../lib/api/courses';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/** Badge id the backend attaches to a course matching the farmer's crops. */
export const CROPS_MATCH_BADGE = 'matches_your_crops';

/** Map a verified credential `type` to its badge label key (data → copy). */
export function credentialLabelKey(type: string): string {
  switch (type) {
    case 'dgca_remote_pilot_certificate':
      return 'academyCredentialDgca';
    case 'degree_certificate':
      return 'academyCredentialDegree';
    case 'nabard_nrlm_srlm_empanelment':
      return 'academyCredentialNabard';
    default:
      return 'academyCredentialVerified';
  }
}

/** Credential badges rendered on course cards and the detail page (WS-02). */
export function CredentialBadges({ credentials }: { credentials?: InstructorCredential[] }) {
  const t = useT();
  if (!credentials || credentials.length === 0) return null;
  return (
    <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
      {credentials.map((cred) => (
        <span
          key={cred.type}
          className="av-chip"
          style={{ background: '#DCFCE7', color: '#166534', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}
        >
          🎓 {t(credentialLabelKey(cred.type))}
        </span>
      ))}
    </span>
  );
}

const LEVELS = ['beginner', 'intermediate', 'advanced', 'masterclass'] as const;
const LEVEL_KEYS: Record<string, string> = {
  beginner: 'academyLevelBeginner',
  intermediate: 'academyLevelIntermediate',
  advanced: 'academyLevelAdvanced',
  masterclass: 'academyLevelMasterclass',
};

/**
 * Krishi Academy catalog — filter (category/level/language/price/free-paid) +
 * free-text search against GET /v1/courses (task 1.10, instructions §WS-01).
 */
export default function CourseCatalogPage() {
  const t = useT();
  const [filters, setFilters] = useState<ListCoursesParams>({});
  const [courses, setCourses] = useState<CourseSummary[] | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [recommendations, setRecommendations] = useState<Record<string, CourseRecommendation>>({});

  const load = useCallback(() => {
    listCourses(filters)
      .then((res) => setCourses(res.data))
      .catch(() => {
        setCourses([]);
        toast(t('academyLoadFailed'), { error: true });
      });
  }, [filters, t]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getCoinBalance()
      .then(setBalance)
      .catch(() => setBalance(null));
  }, []);

  // WS-06 task 6.6 — suggest-level relevance annotation. On error/empty/shim
  // (`source: "fallback"`) the map is empty and the catalog renders the exact
  // same layout; the badge row container is always present (no collapsing).
  useEffect(() => {
    getCourseRecommendations()
      .then((res) => {
        const map: Record<string, CourseRecommendation> = {};
        for (const row of res.data) map[row.courseId] = row;
        setRecommendations(map);
      })
      .catch(() => setRecommendations({}));
  }, []);

  const relevanceOf = useCallback(
    (courseId: string): number => recommendations[courseId]?.relevance ?? -1,
    [recommendations],
  );

  const orderedCourses = useMemo(() => {
    if (!courses) return null;
    // Stable sort keeps the server's order for equal relevance (unmatched = -1).
    return [...courses].sort((a, b) => relevanceOf(b.id) - relevanceOf(a.id));
  }, [courses, relevanceOf]);

  const matchesCrops = (courseId: string): boolean =>
    recommendations[courseId]?.badges.includes(CROPS_MATCH_BADGE) ?? false;

  const feeText = (priceRupees: number): string =>
    priceRupees === 0 ? t('academyFilterFree') : `₹${priceRupees}`;

  return (
    <ToolShell toolId="courses">
      <section className="dash-section">
        <h3>{t('academyCatalogTitle')}</h3>
        {balance !== null ? (
          <p className="dash-empty-line">🪙 {t('academyCoinsBalance', { count: balance })}</p>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '12px 0' }}>
          <input
            aria-label={t('academySearchPlaceholder')}
            placeholder={t('academySearchPlaceholder')}
            value={filters.search ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value || undefined }))}
          />
          <input
            aria-label={t('academyFilterCategory')}
            placeholder={t('academyFilterCategory')}
            value={filters.category ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value || undefined }))}
          />
          <select
            aria-label={t('academyFilterLevel')}
            value={filters.level ?? 'all_levels'}
            onChange={(e) =>
              setFilters((f) => ({ ...f, level: e.target.value === 'all_levels' ? undefined : e.target.value }))
            }
          >
            <option value="all_levels">{t('academyAllLevels')}</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(LEVEL_KEYS[level])}
              </option>
            ))}
          </select>
          <select
            aria-label={t('academyFilterLanguage')}
            value={filters.language ?? ''}
            onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value || undefined }))}
          >
            <option value="">{t('academyAllLanguages')}</option>
            <option value="hi">{t('academyLanguageHindi')}</option>
            <option value="en">{t('academyLanguageEnglish')}</option>
          </select>
          <select
            aria-label={t('academyFilterPrice')}
            value={filters.freeOnly === undefined ? 'all' : filters.freeOnly ? 'free' : 'paid'}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                freeOnly: e.target.value === 'all' ? undefined : e.target.value === 'free',
              }))
            }
          >
            <option value="all">{t('academyFilterAll')}</option>
            <option value="free">{t('academyFilterFree')}</option>
            <option value="paid">{t('academyFilterPaid')}</option>
          </select>
          <input
            type="number"
            min={0}
            aria-label={t('academyPriceMaxLabel')}
            placeholder={t('academyPriceMaxLabel')}
            value={filters.maxPrice ?? ''}
            onChange={(e) =>
              setFilters((f) => ({ ...f, maxPrice: e.target.value === '' ? undefined : Number(e.target.value) }))
            }
          />
        </div>

        {orderedCourses === null ? (
          <p className="dash-empty-line">…</p>
        ) : orderedCourses.length === 0 ? (
          <p className="dash-empty-line">🎥 {t('academyEmptyCatalog')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {orderedCourses.map((course) => (
              <Link
                key={course.id}
                to={`/dashboard/p/courses/${course.id}`}
                className="av-card"
                style={{ display: 'block', padding: 12, border: '1px solid #E5E7EB', borderRadius: 12, textDecoration: 'none', color: 'inherit' }}
              >
                <strong>{course.title}</strong>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                  {course.category} · {t(LEVEL_KEYS[course.level] ?? 'academyAllLevels')}
                </div>
                {/* WS-06 relevance badge row — always rendered (no collapsing). */}
                <div style={{ marginTop: 6, minHeight: 22 }}>
                  {matchesCrops(course.id) ? (
                    <span className="av-chip" style={{ background: '#E0E7FF', color: '#3730A3', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}>
                      🌱 {t('academyMatchesYourCrops')}
                    </span>
                  ) : null}
                </div>
                <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 600 }}>{feeText(course.priceRupees)}</span>
                  {course.ratingAverage !== undefined ? (
                    <span style={{ fontSize: 13, color: '#B45309' }}>
                      ⭐ {course.ratingAverage} ({t('academyRatingLabel')})
                    </span>
                  ) : null}
                </div>
                {course.coinsDiscountAllowed > 0 ? (
                  <div style={{ marginTop: 6 }}>
                    <span className="av-chip" style={{ background: '#FEF3C7', color: '#92400E', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}>
                      🪙 {t('academyCoinsDiscount')}
                    </span>
                  </div>
                ) : null}
                <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
                  {course.instructorName}
                </div>
                <div style={{ marginTop: 4 }}>
                  <CredentialBadges credentials={course.instructorCredentials} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </ToolShell>
  );
}
