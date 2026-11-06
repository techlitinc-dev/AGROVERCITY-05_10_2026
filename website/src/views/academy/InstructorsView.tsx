import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  BadgeCheck,
  BookOpen,
  Bookmark,
  GraduationCap,
  HeartHandshake,
  LayoutGrid,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiErrorMessage, courses, teachers } from '../../lib/api';
import { followUser, unfollowUser, getFollows } from '../../lib/api/follows';
import type { FollowedUser } from '../../lib/api/follows';
import { arrOf, asRec, numOf, recArr, strOf } from './helpers';

/**
 * Instructor directory (SR 28) — tabbed: all Gurukul instructors (with follow
 * toggles), the instructors I follow, my saved courses, and the full course
 * catalog. Each instructor opens a profile page that lists their own courses
 * (GET /teachers/{id}); course CTAs deep-link back to the Academy catalog,
 * which owns enrolment and contact flows.
 */
type InstructorsTab = 'instructors' | 'following' | 'saved' | 'courses';

const INSTRUCTOR_TABS: { key: InstructorsTab; label: string; icon: LucideIcon }[] = [
  { key: 'instructors', label: 'Instructors', icon: Users },
  { key: 'following', label: 'Following', icon: HeartHandshake },
  { key: 'saved', label: 'Saved Courses', icon: Bookmark },
  { key: 'courses', label: 'All Courses', icon: LayoutGrid },
];

const teacherIdOf = (t: Record<string, unknown>): string => strOf(t.userId) || strOf(t.id);

export const InstructorsView: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [instructors, setInstructors] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [tab, setTab] = useState<InstructorsTab>(() => {
    const t = searchParams.get('tab');
    return t === 'following' || t === 'saved' || t === 'courses' ? t : 'instructors';
  });
  const [savedCourses, setSavedCourses] = useState<Record<string, unknown>[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedLoaded, setSavedLoaded] = useState(false);
  const [allCourses, setAllCourses] = useState<Record<string, unknown>[]>([]);
  const [allLoading, setAllLoading] = useState(false);
  const [allLoaded, setAllLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [list, follows] = await Promise.all([
          teachers.list(),
          getFollows().catch(() => [] as FollowedUser[]),
        ]);
        setInstructors(Array.isArray(list) ? (list as Record<string, unknown>[]) : []);
        setFollowedIds(new Set(follows.map((f) => f.userId)));
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadSaved = async () => {
    setSavedLoading(true);
    try {
      const raw = asRec(await courses.myLearning());
      setSavedCourses(recArr(raw.savedCourses));
    } catch {
      setSavedCourses([]);
    } finally {
      setSavedLoading(false);
      setSavedLoaded(true);
    }
  };

  const loadAllCourses = async () => {
    setAllLoading(true);
    try {
      setAllCourses(recArr(await courses.list({})));
    } catch {
      setAllCourses([]);
    } finally {
      setAllLoading(false);
      setAllLoaded(true);
    }
  };

  const selectTab = (next: InstructorsTab) => {
    setTab(next);
    setSearchParams(next === 'instructors' ? {} : { tab: next }, { replace: true });
    if (next === 'saved' && !savedLoaded && !savedLoading) void loadSaved();
    if (next === 'courses' && !allLoaded && !allLoading) void loadAllCourses();
  };

  useEffect(() => {
    if (tab === 'saved') void loadSaved();
    if (tab === 'courses') void loadAllCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleFollow = async (t: Record<string, unknown>) => {
    const teacherId = teacherIdOf(t);
    if (!teacherId || togglingId) return;
    const wasFollowing = followedIds.has(teacherId);
    setTogglingId(teacherId);
    setError(null);
    // Optimistic toggle — revert if the mutation fails.
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (wasFollowing) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
    try {
      if (wasFollowing) await unfollowUser(teacherId);
      else await followUser(teacherId);
    } catch (e) {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (wasFollowing) next.add(teacherId);
        else next.delete(teacherId);
        return next;
      });
      setError(apiErrorMessage(e));
    } finally {
      setTogglingId(null);
    }
  };

  const following = instructors.filter((t) => followedIds.has(teacherIdOf(t)));

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-emerald-600" />
          Gurukul Instructors
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Follow agronomists and progressive farmers, browse their masterclasses and keep track of what you saved
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Instructor sections">
        {INSTRUCTOR_TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const count =
            key === 'following'
              ? following.length
              : key === 'saved' && savedLoaded
                ? savedCourses.length
                : key === 'courses' && allLoaded
                  ? allCourses.length
                  : null;
          return (
            <button
              key={key}
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(key)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
                active
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== null && count > 0 && (
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
                    active ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {tab === 'instructors' || tab === 'following' ? (
        loading ? (
          <p className="text-xs text-slate-400">Loading instructors…</p>
        ) : tab === 'following' && following.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
            <HeartHandshake className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400 mb-3">
              You are not following any instructors yet. Follow instructors to see them here first.
            </p>
            <button
              onClick={() => selectTab('instructors')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
            >
              <Users className="w-3.5 h-3.5" /> Browse instructors
            </button>
          </div>
        ) : tab === 'instructors' && instructors.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
            <p className="text-xs text-slate-400 mb-3">No instructor profiles are listed yet.</p>
            <button
              onClick={() => navigate('/academy')}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
            >
              <GraduationCap className="w-3.5 h-3.5" /> Browse the Academy catalog
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {(tab === 'following' ? following : instructors).map((t) => (
              <InstructorCard
                key={teacherIdOf(t)}
                instructor={t}
                isFollowing={followedIds.has(teacherIdOf(t))}
                toggling={togglingId === teacherIdOf(t)}
                onToggleFollow={() => toggleFollow(t)}
                onViewCourses={() => navigate(`/academy/instructors/${encodeURIComponent(teacherIdOf(t))}`)}
              />
            ))}
          </div>
        )
      ) : tab === 'saved' ? (
        savedLoading ? (
          <p className="text-xs text-slate-400">Loading your saved courses…</p>
        ) : savedCourses.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
            <Bookmark className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400 mb-3">
              No saved courses yet. Use “Save for later” on any course in the catalog.
            </p>
            <Link
              to="/academy"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5" /> Browse courses
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {savedCourses.map((c) => (
              <CourseMiniCard key={strOf(c.courseId) || strOf(c.id)} course={c} />
            ))}
          </div>
        )
      ) : allLoading ? (
        <p className="text-xs text-slate-400">Loading courses…</p>
      ) : allCourses.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
          <p className="text-xs text-slate-400 mb-3">No courses are published yet.</p>
          <Link
            to="/academy"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
          >
            <GraduationCap className="w-3.5 h-3.5" /> Open the Academy
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {allCourses.map((c) => (
            <CourseMiniCard key={strOf(c.id)} course={c} />
          ))}
        </div>
      )}
    </div>
  );
};

/** Directory card — identity, stats, follow toggle and the profile deep link. */
const InstructorCard: React.FC<{
  instructor: Record<string, unknown>;
  isFollowing: boolean;
  toggling: boolean;
  onToggleFollow: () => void;
  onViewCourses: () => void;
}> = ({ instructor: t, isFollowing, toggling, onToggleFollow, onViewCourses }) => {
  const name = strOf(t.name) || 'Gurukul Instructor';
  const rating = numOf(t.ratingAverage, numOf(t.rating));
  const courseCount = numOf(t.totalCourses, numOf(t.coursesCount));
  const expertise = arrOf(t.expertise)
    .map((e) => strOf(e))
    .filter(Boolean);
  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          {strOf(t.avatarUrl) ? (
            <img src={strOf(t.avatarUrl)} alt={name} className="w-12 h-12 rounded-full object-cover" />
          ) : (
            <span className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <UserRound className="w-6 h-6" />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-slate-900 flex items-center gap-1">
              <span className="truncate">{name}</span>
              {Boolean(t.isVerified) && <BadgeCheck className="w-4 h-4 text-emerald-600 shrink-0" />}
            </p>
            <p className="text-[11px] text-slate-400 truncate">
              {strOf(t.headline) || strOf(t.qualification) || 'Agricultural instructor'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {rating > 0 && (
            <span className="flex items-center gap-1 font-semibold text-amber-600">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              {rating.toFixed(1)}
            </span>
          )}
          {courseCount > 0 && (
            <span>
              {courseCount} course{courseCount === 1 ? '' : 's'}
            </span>
          )}
          {numOf(t.experienceYears) > 0 && <span>{numOf(t.experienceYears)} yrs experience</span>}
        </div>

        {expertise.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {expertise.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold capitalize"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="p-5 pt-0 border-t border-slate-100 mt-2 flex items-center justify-between gap-2">
        <button
          onClick={onToggleFollow}
          disabled={toggling}
          className={`px-4 py-2 rounded-xl font-bold text-xs border transition-colors ${
            isFollowing
              ? 'border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
              : 'border-slate-300 text-slate-600 hover:border-emerald-600 hover:text-emerald-700'
          } disabled:opacity-60`}
        >
          {isFollowing ? 'Following' : 'Follow'}
        </button>
        <button
          onClick={onViewCourses}
          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
        >
          <BookOpen className="w-3.5 h-3.5" /> View courses
        </button>
      </div>
    </div>
  );
};

/** Compact course card for the Saved / All Courses tabs — details live in the catalog. */
const CourseMiniCard: React.FC<{ course: Record<string, unknown> }> = ({ course: c }) => {
  const navigate = useNavigate();
  const price = numOf(c.priceRupees, numOf(c.price));
  const rating = numOf(c.ratingAverage, numOf(c.rating));
  return (
    <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between">
      <div className="space-y-2">
        {strOf(c.category) && (
          <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold capitalize">
            {strOf(c.category)}
          </span>
        )}
        <h3 className="font-extrabold text-sm text-slate-900 leading-snug">{strOf(c.title) || 'Course'}</h3>
        <p className="text-xs text-slate-400">By {strOf(c.instructorName) || 'Gurukul Faculty'}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
          {rating > 0 && (
            <span className="flex items-center gap-1 font-semibold text-amber-600">
              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
              {rating.toFixed(1)}
            </span>
          )}
          {strOf(c.level) && <span className="capitalize">{strOf(c.level).replace(/_/g, ' ')}</span>}
          {strOf(c.language) && <span className="uppercase">{strOf(c.language)}</span>}
        </div>
        <p className="text-xs font-black text-emerald-800">
          {price === 0 || strOf(c.accessType) === 'free' ? 'Free' : `${strOf(c.currency, 'INR') || 'INR'} ${price.toLocaleString('en-IN')}`}
        </p>
      </div>
      <button
        onClick={() => navigate('/academy')}
        className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
      >
        View course
      </button>
    </div>
  );
};

export default InstructorsView;
