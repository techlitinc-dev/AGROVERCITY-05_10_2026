import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, BadgeCheck, BookOpen, GraduationCap, Star, UserRound, Users } from 'lucide-react';
import { apiErrorMessage, teachers } from '../../lib/api';
import { followUser, unfollowUser, getFollows } from '../../lib/api/follows';
import type { FollowedUser } from '../../lib/api/follows';
import { arrOf, numOf, strOf } from './helpers';

/**
 * Instructor directory (SR 28) — public GET /teachers list with follow
 * toggles backed by the follows API and a deep link back to the Academy
 * catalog for each instructor's courses.
 */
export const InstructorsView: React.FC = () => {
  const navigate = useNavigate();
  const [instructors, setInstructors] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [togglingId, setTogglingId] = useState<string | null>(null);

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

  const teacherIdOf = (t: Record<string, unknown>): string => strOf(t.userId) || strOf(t.id);

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

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Users className="w-7 h-7 text-emerald-600" />
          Gurukul Instructors
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Follow agronomists and progressive farmers to keep up with their masterclasses
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading instructors…</p>
      ) : instructors.length === 0 ? (
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
          {instructors.map((t) => {
            const teacherId = teacherIdOf(t);
            const name = strOf(t.name) || 'Gurukul Instructor';
            const isFollowing = followedIds.has(teacherId);
            const rating = numOf(t.ratingAverage, numOf(t.rating));
            const courseCount = numOf(t.totalCourses, numOf(t.coursesCount));
            const expertise = arrOf(t.expertise).map((e) => strOf(e)).filter(Boolean);
            return (
              <div
                key={teacherId}
                className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
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
                    {courseCount > 0 && <span>{courseCount} course{courseCount === 1 ? '' : 's'}</span>}
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
                    onClick={() => toggleFollow(t)}
                    disabled={togglingId === teacherId}
                    className={`px-4 py-2 rounded-xl font-bold text-xs border transition-colors ${
                      isFollowing
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        : 'border-slate-300 text-slate-600 hover:border-emerald-600 hover:text-emerald-700'
                    } disabled:opacity-60`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>
                  <button
                    onClick={() => navigate('/academy')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                  >
                    <BookOpen className="w-3.5 h-3.5" /> View courses
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default InstructorsView;
