import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  Play,
  Star,
} from 'lucide-react';
import { apiErrorMessage, courses, ApiError } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { asRec, boolOf, numOf, recArr, strOf } from './helpers';

/**
 * My Learning — the student-side learner surface (SR 21). Lists purchased /
 * enrolled courses from GET /courses/my-learning with progress, upcoming
 * batch sessions with QR check-in, and a rating flow for completed courses.
 */
export const MyLearningView: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [sessions, setSessions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checkedInIds, setCheckedInIds] = useState<Set<string>>(new Set());
  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<Record<string, unknown> | null>(null);
  const [rating, setRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedIds, setReviewedIds] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = await courses.myLearning();
      const envelope = asRec(raw);
      setItems(Array.isArray(raw) ? (raw as Record<string, unknown>[]) : recArr(envelope.data));
      const upcoming = recArr(envelope.sessions);
      setSessions(upcoming.length > 0 ? upcoming : recArr(envelope.upcomingSessions));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inProgress = items.filter((c) => !boolOf(c.isCompleted));
  const completed = items.filter((c) => boolOf(c.isCompleted));

  const handleCheckIn = async (s: Record<string, unknown>) => {
    const sessionId = strOf(s.id);
    if (!sessionId || checkingInId) return;
    setCheckingInId(sessionId);
    setError(null);
    setNotice(null);
    try {
      await courses.sessionCheckIn(sessionId, strOf(s.qrToken));
      setCheckedInIds((prev) => new Set(prev).add(sessionId));
      setNotice(`Checked in to “${strOf(s.title) || 'session'}”.`);
    } catch (e) {
      // A 409 means the check-in already exists server-side — surface it as checked-in.
      if (e instanceof ApiError && e.status === 409) {
        setCheckedInIds((prev) => new Set(prev).add(sessionId));
        setNotice('You are already checked in to this session.');
      } else {
        setError(apiErrorMessage(e));
      }
    } finally {
      setCheckingInId(null);
    }
  };

  const openReview = (c: Record<string, unknown>) => {
    setReviewTarget(c);
    setRating(0);
    setReviewText('');
  };

  const handleSubmitReview = async () => {
    if (!reviewTarget) return;
    const courseId = strOf(reviewTarget.id);
    if (!courseId || submittingReview) return;
    setSubmittingReview(true);
    setError(null);
    try {
      await courses.addCourseReview(courseId, { rating, review: reviewText.trim() });
      setReviewedIds((prev) => new Set(prev).add(courseId));
      setNotice(`Thanks for rating “${strOf(reviewTarget.title) || 'the course'}”.`);
      setReviewTarget(null);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setSubmittingReview(false);
    }
  };

  const sessionTime = (value: unknown): string => {
    const raw = strOf(value);
    if (!raw) return 'Time to be announced';
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime())
      ? raw
      : parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-emerald-600" />
            My Learning
          </h1>
          <p className="text-xs text-slate-500 mt-1">Your courses, live sessions and completions</p>
        </div>
        <Link
          to="/academy"
          className="px-3 py-1.5 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold text-[11px] self-start sm:self-auto"
        >
          Browse catalog
        </Link>
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

      {loading ? (
        <p className="text-xs text-slate-400">Loading your learning…</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900">My Courses</h2>
            {inProgress.length === 0 ? (
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
                <p className="text-xs text-slate-400 mb-3">No courses in progress yet.</p>
                <Link
                  to="/academy"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
                >
                  <BookOpen className="w-3.5 h-3.5" /> Find a course at the Academy
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {inProgress.map((c) => (
                  <LearningCourseCard
                    key={strOf(c.id)}
                    course={c}
                    primaryAction={
                      <button
                        onClick={() => navigate('/academy')}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Continue
                      </button>
                    }
                  />
                ))}
              </div>
            )}
          </section>

          {sessions.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">Upcoming Sessions</h2>
              <div className="space-y-2">
                {sessions.map((s) => {
                  const sessionId = strOf(s.id);
                  const isCheckedIn =
                    checkedInIds.has(sessionId) || boolOf(s.checkedIn) || boolOf(s.checkedInByMe);
                  return (
                    <div
                      key={sessionId}
                      className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 shrink-0">
                          <CalendarClock className="w-4 h-4" />
                        </span>
                        <div>
                          <p className="text-sm font-bold text-slate-900">
                            {strOf(s.title) || 'Scheduled session'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            {strOf(s.courseTitle) && <span>{strOf(s.courseTitle)} • </span>}
                            {sessionTime(s.startsAt)}
                          </p>
                        </div>
                      </div>
                      {isCheckedIn ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Checked in
                        </span>
                      ) : (
                        <button
                          onClick={() => handleCheckIn(s)}
                          disabled={checkingInId === sessionId}
                          className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-xs"
                        >
                          {checkingInId === sessionId ? 'Checking in…' : 'Check in'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-extrabold text-slate-900">Completed</h2>
            {completed.length === 0 ? (
              <p className="text-xs text-slate-400">Finish a course to see it here with your certificate.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {completed.map((c) => {
                  const courseId = strOf(c.id);
                  const alreadyRated = reviewedIds.has(courseId);
                  return (
                    <LearningCourseCard
                      key={courseId}
                      course={c}
                      primaryAction={
                        strOf(c.certificateId) ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 font-bold text-[11px]">
                            <Award className="w-3.5 h-3.5" /> Certificate earned
                          </span>
                        ) : null
                      }
                      footerAction={
                        <button
                          onClick={() => openReview(c)}
                          disabled={alreadyRated}
                          className="px-4 py-2 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:border-slate-300 disabled:text-slate-400 font-bold text-xs flex items-center gap-1.5"
                        >
                          <Star className={`w-3.5 h-3.5 ${alreadyRated ? 'fill-amber-500 text-amber-500' : ''}`} />
                          {alreadyRated ? 'Rated' : 'Rate course'}
                        </button>
                      }
                    />
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}

      {/* Rate-course modal */}
      <ModalSheet
        isOpen={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget ? `Rate “${strOf(reviewTarget.title) || 'course'}”` : undefined}
        description="Your rating helps other farmers choose the right masterclass."
        maxWidth="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-1.5">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                onClick={() => setRating(value)}
                className="p-1 rounded-full hover:scale-110 transition-transform"
                title={`${value} star${value > 1 ? 's' : ''}`}
              >
                <Star
                  className={`w-8 h-8 ${
                    value <= rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                  }`}
                />
              </button>
            ))}
          </div>
          <textarea
            value={reviewText}
            onChange={(e) => setReviewText(e.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="How was the course? What did you learn? (min 2 characters)"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <span className="text-[11px] text-slate-400">
              {rating > 0 ? `${rating}/5 stars` : 'Tap a star to rate'}
            </span>
            <button
              onClick={() => void handleSubmitReview()}
              disabled={submittingReview || rating < 1 || reviewText.trim().length < 2}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
            >
              {submittingReview ? 'Submitting…' : 'Submit review'}
            </button>
          </div>
        </div>
      </ModalSheet>
    </div>
  );
};

/** Shared enrolled-course card: cover, instructor, progress bar and status. */
const LearningCourseCard: React.FC<{
  course: Record<string, unknown>;
  primaryAction?: React.ReactNode;
  footerAction?: React.ReactNode;
}> = ({ course: c, primaryAction, footerAction }) => {
  const progress = Math.round(Math.min(100, Math.max(0, numOf(c.progressPercent))));
  const isCompleted = boolOf(c.isCompleted);
  const status = isCompleted ? 'Completed' : progress > 0 ? 'In progress' : 'Not started';
  const statusClass = isCompleted
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : progress > 0
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-500 border-slate-200';

  return (
    <div className="bg-white rounded-3xl overflow-hidden border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <div className="relative h-36 w-full bg-slate-900">
          {strOf(c.thumbnailUrl) ? (
            <img src={strOf(c.thumbnailUrl)} alt={strOf(c.title)} className="w-full h-full object-cover opacity-80" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="w-10 h-10 text-slate-600" />
            </div>
          )}
          <span
            className={`absolute top-3 left-3 px-2.5 py-1 rounded-full text-[10px] font-bold border backdrop-blur-sm ${statusClass}`}
          >
            {status}
          </span>
        </div>
        <div className="p-5 space-y-2">
          <h3 className="font-extrabold text-sm text-slate-900 leading-snug">{strOf(c.title)}</h3>
          <p className="text-xs text-slate-400">By {strOf(c.instructorName) || 'Gurukul Faculty'}</p>
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isCompleted ? 'bg-emerald-500' : 'bg-emerald-600'}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>
      {(primaryAction || footerAction) && (
        <div className="p-5 pt-0 border-t border-slate-100 mt-4 flex items-center justify-between gap-2">
          {primaryAction}
          {footerAction}
        </div>
      )}
    </div>
  );
};

export default MyLearningView;
