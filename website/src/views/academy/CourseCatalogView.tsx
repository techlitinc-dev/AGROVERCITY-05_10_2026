import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Play,
  Star,
  Clock,
  Award,
  Search,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  MonitorSmartphone,
  Sparkles,
} from 'lucide-react';
import { courses, teachers, apiErrorMessage } from '../../lib/api';
import { getCourseRecommendations } from '../../lib/api/dashboard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import { asRec, boolOf, nameOf, numOf, recArr, strOf } from './helpers';

/**
 * Krishi Gurukul course catalog — real `/courses` list with search/filters,
 * curriculum viewer and enroll/purchase action. Shows an instructor-mode
 * toggle when the signed-in user has an instructor profile (`teachers.home`).
 */
export const CourseCatalogView: React.FC = () => {
  const [catalog, setCatalog] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [freeOnly, setFreeOnly] = useState(false);
  const [instructorMode, setInstructorMode] = useState(false);
  const [instructorAvailable, setInstructorAvailable] = useState(false);

  const [activeCourse, setActiveCourse] = useState<Record<string, unknown> | null>(null);
  const [curriculum, setCurriculum] = useState<Record<string, unknown> | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [recommended, setRecommended] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const recs = await getCourseRecommendations();
        const top = [...recs]
          .sort((a, b) => numOf(asRec(b).relevance) - numOf(asRec(a).relevance))
          .slice(0, 3);
        const docs = await Promise.all(
          top.map((rec) =>
            courses
              .get(strOf(asRec(rec).courseId))
              .then((c) => asRec(c))
              .catch(() => null)
          )
        );
        if (!mounted) return;
        setRecommended(docs.filter((d): d is Record<string, unknown> => d !== null && Object.keys(d).length > 0));
      } catch {
        /* recommendations are an enhancement — catalog renders without them */
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [list, home] = await Promise.all([
          courses.list({ search: search || undefined, category, isFree: freeOnly || undefined }),
          teachers.home().catch(() => null),
        ]);
        setCatalog(recArr(list));
        if (home) setInstructorAvailable(true);
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, freeOnly]);

  const categories = ['All', ...Array.from(new Set(catalog.map((c) => strOf(c.category)).filter(Boolean)))];

  const openCourse = async (c: Record<string, unknown>) => {
    setActiveCourse(c);
    setCurriculum(null);
    try {
      setCurriculum(asRec(await courses.curriculum(strOf(c.id))));
    } catch {
      setCurriculum(null);
    }
  };

  const handleEnroll = async (c: Record<string, unknown>) => {
    setEnrolling(true);
    setError(null);
    setNotice(null);
    try {
      const price = numOf(c.priceRupees, numOf(c.price));
      if (price > 0) {
        await courses.purchase(strOf(c.id));
        setNotice(`Purchase initiated for “${nameOf(c, strOf(c.title))}” — complete payment to start learning.`);
      } else {
        await courses.enroll(strOf(c.id));
        setNotice(`Enrolled in “${nameOf(c, strOf(c.title))}”! Find it under My Learning.`);
      }
      setActiveCourse(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setEnrolling(false);
    }
  };

  const sessionPlan = recArr(curriculum?.sessionPlan);
  const priceOf = (c: Record<string, unknown>) => numOf(c.priceRupees, numOf(c.price));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-emerald-600" />
            Krishi Gurukul Academy
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Practical farming masterclasses led by university agronomists and progressive farmers
          </p>
        </div>
        {instructorAvailable && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <MonitorSmartphone className="w-4 h-4 text-slate-400" />
            <span className="text-xs font-bold text-slate-500">Instructor mode</span>
            <button
              onClick={() => setInstructorMode((v) => !v)}
              className={`relative w-10 h-6 rounded-full transition-colors ${instructorMode ? 'bg-emerald-600' : 'bg-slate-300'}`}
              title={instructorMode ? 'Switch to learner view' : 'Switch to instructor console'}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${instructorMode ? 'left-5' : 'left-0.5'}`}
              />
            </button>
            {instructorMode && (
              <Link
                to="/instructor/home"
                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
              >
                Open Console
              </Link>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search courses, instructors…"
            className="pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white w-64"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
          <input
            type="checkbox"
            checked={freeOnly}
            onChange={(e) => setFreeOnly(e.target.checked)}
            className="w-4 h-4 accent-emerald-600"
          />
          Free only
        </label>
      </div>

      {recommended.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <h2 className="font-bold text-sm text-slate-900">Recommended for you</h2>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-1 -mx-1 px-1">
            {recommended.map((c) => {
              const price = priceOf(c);
              const isFree = price === 0 || boolOf(c.isFree);
              return (
                <div
                  key={strOf(c.id)}
                  className="min-w-[260px] max-w-[260px] bg-white rounded-2xl overflow-hidden border border-emerald-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between flex-shrink-0"
                >
                  <div className="p-4 space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                      <span className="font-semibold text-amber-600">
                        {numOf(c.ratingAverage, numOf(c.rating)) > 0
                          ? numOf(c.ratingAverage, numOf(c.rating)).toFixed(1)
                          : 'New'}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span className="capitalize">{strOf(c.category, 'General')}</span>
                    </div>
                    <h3 className="font-extrabold text-xs text-slate-900 leading-snug line-clamp-2">
                      {strOf(c.title)}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      By {strOf(c.instructorName) || 'Gurukul Faculty'}
                    </p>
                  </div>
                  <div className="p-4 pt-0 flex items-center justify-between">
                    <span className="text-xs font-black text-emerald-800">
                      {isFree ? 'Free' : formatCurrency(price)}
                    </span>
                    <button
                      onClick={() => openCourse(c)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                    >
                      View & Enroll
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading courses…</p>
      ) : catalog.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center text-xs text-slate-400">
          No published courses match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {catalog.map((c) => {
            const price = priceOf(c);
            const isFree = price === 0 || boolOf(c.isFree);
            const rating = numOf(c.ratingAverage, numOf(c.rating));
            const ratingCount = numOf(c.ratingCount);
            return (
              <div
                key={strOf(c.id)}
                className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="relative h-44 w-full bg-slate-900">
                    {strOf(c.thumbnailUrl) ? (
                      <img src={strOf(c.thumbnailUrl)} alt={strOf(c.title)} className="w-full h-full object-cover opacity-80" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <BookOpen className="w-12 h-12 text-slate-600" />
                      </div>
                    )}
                    <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-sm text-white px-2.5 py-1 rounded-full text-[10px] font-bold capitalize">
                      {strOf(c.category, 'General')}
                    </div>
                    <button
                      onClick={() => openCourse(c)}
                      className="absolute inset-0 m-auto w-12 h-12 rounded-full bg-emerald-600/90 text-white flex items-center justify-center hover:scale-110 transition-transform shadow-lg"
                    >
                      <Play className="w-5 h-5 ml-0.5 fill-current" />
                    </button>
                  </div>

                  <div className="p-5 space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-amber-600">
                        <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                        {rating > 0 ? rating.toFixed(1) : 'New'}
                        {ratingCount > 0 && <span className="text-slate-400">({ratingCount})</span>}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        {numOf(c.durationHours) > 0
                          ? `${numOf(c.durationHours)} hrs`
                          : `${numOf(curriculumMinutes(c))} min`}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-sm text-slate-900 leading-snug">{strOf(c.title)}</h3>
                    <p className="text-xs text-slate-400">By {strOf(c.instructorName) || 'Gurukul Faculty'}</p>
                    <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                      {strOf(c.subtitle) || strOf(c.description)}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0 border-t border-slate-100 mt-4 flex items-center justify-between">
                  <span className="text-sm font-black text-emerald-800">
                    {isFree ? 'Free Course' : formatCurrency(price)}
                  </span>
                  <button
                    onClick={() => openCourse(c)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                  >
                    {boolOf(c.isPurchased) ? 'Continue Learning' : 'View & Enroll'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Course detail + curriculum modal */}
      <ModalSheet
        isOpen={Boolean(activeCourse)}
        onClose={() => setActiveCourse(null)}
        title={activeCourse ? strOf(activeCourse.title) : undefined}
        description={
          activeCourse
            ? `${strOf(activeCourse.instructorName) || 'Gurukul Faculty'} • ${strOf(activeCourse.category, 'General')}`
            : undefined
        }
        maxWidth="2xl"
      >
        {activeCourse && (
          <div className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">{strOf(activeCourse.description) || strOf(activeCourse.subtitle)}</p>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  label: 'Fee',
                  value: priceOf(activeCourse) === 0 ? 'Free' : formatCurrency(priceOf(activeCourse)),
                },
                { label: 'Mode', value: strOf(curriculum?.mode) || 'hybrid' },
                { label: 'Level', value: strOf(curriculum?.level) || strOf(activeCourse.level) || 'all levels' },
                { label: 'Sessions', value: String(numOf(curriculum?.sessionCount)) },
                { label: 'Duration', value: `${numOf(curriculum?.durationMinutes)} min` },
                { label: 'Language', value: strOf(curriculum?.language) || strOf(activeCourse.language) || 'hi' },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">{s.label}</p>
                  <p className="text-sm font-black text-slate-900 capitalize">{s.value}</p>
                </div>
              ))}
            </div>

            <div>
              <h4 className="font-bold text-sm text-slate-900 mb-2">Curriculum</h4>
              {!curriculum ? (
                <p className="text-xs text-slate-400">Loading curriculum…</p>
              ) : sessionPlan.length === 0 ? (
                <p className="text-xs text-slate-400">No modules published yet.</p>
              ) : (
                <div className="space-y-2">
                  {sessionPlan.map((m) => (
                    <div key={strOf(m.moduleId)} className="border border-slate-100 rounded-2xl p-3">
                      <p className="text-xs font-black text-slate-800">
                        Module {numOf(m.order)}: {strOf(m.title)}
                      </p>
                      <ul className="mt-1.5 space-y-1">
                        {recArr(m.lessons).map((l) => (
                          <li key={strOf(l.lessonId)} className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="flex items-center gap-1.5">
                              <Play className="w-3 h-3 text-emerald-600" />
                              {strOf(l.title)}
                            </span>
                            <span>{numOf(l.durationMinutes)} min</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                <Award className="w-4 h-4" /> Certificate awarded on completion
              </span>
              <button
                onClick={() => handleEnroll(activeCourse)}
                disabled={enrolling}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
              >
                {enrolling ? 'Working…' : priceOf(activeCourse) === 0 ? 'Enroll Free' : `Buy ${formatCurrency(priceOf(activeCourse))}`}
              </button>
            </div>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};

function curriculumMinutes(c: Record<string, unknown>): number {
  return numOf(c.durationMinutes) || Math.round(numOf(c.durationHours) * 60);
}

export default CourseCatalogView;
