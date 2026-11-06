import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  GraduationCap,
  Star,
  UserRound,
  Users,
} from 'lucide-react';
import { apiErrorMessage, teachers } from '../../lib/api';
import { followUser, unfollowUser, getFollows } from '../../lib/api/follows';
import { arrOf, asRec, numOf, recArr, strOf } from './helpers';

/**
 * Public instructor profile — GET /teachers/{id} returns the teacher's public
 * identity plus their published courses. Enrolment/contact still lives in the
 * Academy catalog, so course CTAs deep-link back to /academy.
 */
export const InstructorProfilePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [raw, follows] = await Promise.all([
          teachers.teacher(id || ''),
          getFollows().catch(() => []),
        ]);
        if (!mounted) return;
        setProfile(asRec(raw));
        setFollowedIds(new Set((follows as { userId: string }[]).map((f) => f.userId)));
      } catch (e) {
        if (mounted) setError(apiErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [id]);

  const teacherId = profile ? strOf(profile.userId) || strOf(profile.id) : '';
  const isFollowing = teacherId ? followedIds.has(teacherId) : false;

  const toggleFollow = async () => {
    if (!teacherId || toggling) return;
    setToggling(true);
    setError(null);
    setFollowedIds((prev) => {
      const next = new Set(prev);
      if (isFollowing) next.delete(teacherId);
      else next.add(teacherId);
      return next;
    });
    try {
      if (isFollowing) await unfollowUser(teacherId);
      else await followUser(teacherId);
    } catch (e) {
      setFollowedIds((prev) => {
        const next = new Set(prev);
        if (isFollowing) next.add(teacherId);
        else next.delete(teacherId);
        return next;
      });
      setError(apiErrorMessage(e));
    } finally {
      setToggling(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Link
          to="/academy/instructors"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All instructors
        </Link>
        <p className="text-xs text-slate-400">Loading instructor profile…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <Link
          to="/academy/instructors"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All instructors
        </Link>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
          <p className="text-xs text-slate-400 mb-3">
            {error || 'Instructor profile not found.'}
          </p>
          <Link
            to="/academy/instructors"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
          >
            <Users className="w-3.5 h-3.5" /> Back to instructors
          </Link>
        </div>
      </div>
    );
  }

  const name = strOf(profile.name) || 'Gurukul Instructor';
  const expertise = arrOf(profile.expertise)
    .map((e) => strOf(e))
    .filter(Boolean);
  const courses = recArr(profile.courses);
  const rating = numOf(profile.ratingAverage);

  return (
    <div className="space-y-6">
      <Link
        to="/academy/instructors"
        className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 hover:text-emerald-700"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> All instructors
      </Link>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            {strOf(profile.avatarUrl) ? (
              <img src={strOf(profile.avatarUrl)} alt={name} className="w-16 h-16 rounded-full object-cover shrink-0" />
            ) : (
              <span className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <UserRound className="w-8 h-8" />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-slate-900 flex items-center gap-1.5 flex-wrap">
                {name}
                {Boolean(profile.isVerified) && <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0" />}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                {strOf(profile.headline) || strOf(profile.qualification) || 'Agricultural instructor'}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {[strOf(profile.qualification), strOf(profile.institution)].filter(Boolean).join(' • ')}
              </p>
              {expertise.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {expertise.map((tag) => (
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
          </div>
          <button
            onClick={() => void toggleFollow()}
            disabled={toggling}
            className={`px-4 py-2 rounded-xl font-bold text-xs border transition-colors shrink-0 ${
              isFollowing
                ? 'border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                : 'border-slate-300 text-slate-600 hover:border-emerald-600 hover:text-emerald-700'
            } disabled:opacity-60`}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          {[
            { label: 'Courses', value: numOf(profile.totalCourses, courses.length) },
            { label: 'Students', value: numOf(profile.totalStudents) },
            { label: 'Rating', value: rating > 0 ? rating.toFixed(1) : '—' },
            { label: 'Experience', value: numOf(profile.experienceYears) > 0 ? `${numOf(profile.experienceYears)} yrs` : '—' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-lg font-black text-slate-900">{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {strOf(profile.bio) && <p className="text-xs text-slate-600 leading-relaxed mt-4">{strOf(profile.bio)}</p>}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold text-slate-900">Courses by {name.split(' ')[0]}</h2>
        {courses.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
            <p className="text-xs text-slate-400 mb-3">This instructor has not published any courses yet.</p>
            <Link
              to="/academy"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
            >
              <GraduationCap className="w-3.5 h-3.5" /> Browse the Academy catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {courses.map((c) => {
              const courseId = strOf(c.id);
              const price = numOf(c.priceRupees, numOf(c.price));
              const courseRating = numOf(c.ratingAverage);
              return (
                <div
                  key={courseId}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    {strOf(c.category) && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold capitalize">
                        {strOf(c.category)}
                      </span>
                    )}
                    <h3 className="font-extrabold text-sm text-slate-900 leading-snug">{strOf(c.title) || 'Course'}</h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      {courseRating > 0 && (
                        <span className="flex items-center gap-1 font-semibold text-amber-600">
                          <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                          {courseRating.toFixed(1)}
                        </span>
                      )}
                      {strOf(c.level) && <span className="capitalize">{strOf(c.level).replace(/_/g, ' ')}</span>}
                      {strOf(c.language) && <span className="uppercase">{strOf(c.language)}</span>}
                    </div>
                    <p className="text-xs font-black text-emerald-800">
                      {price === 0 || strOf(c.accessType) === 'free'
                        ? 'Free'
                        : `${strOf(c.currency, 'INR') || 'INR'} ${price.toLocaleString('en-IN')}`}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate('/academy')}
                    className="mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> View course
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default InstructorProfilePage;
