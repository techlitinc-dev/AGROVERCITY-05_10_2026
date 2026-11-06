import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  BookOpen,
  Bookmark,
  CalendarClock,
  CheckCircle2,
  GraduationCap,
  HelpCircle,
  Hourglass,
  MessageCircle,
  MessagesSquare,
  Play,
  Star,
  Trash2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiErrorMessage, chat, courses, ApiError } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { asRec, boolOf, numOf, recArr, strOf } from './helpers';

/**
 * My Learning — the learner surface, organised as tabs:
 *   My Courses     — Continue Learning, Awaiting Instructor Access, Free,
 *                    Paid with Access, Live Sessions, Completed (check-in +
 *                    rating live here).
 *   Saved Courses  — bookmarked catalog courses ("Save for later"), removable.
 *   My Questions   — every question the learner asked, with the
 *                    answered/unanswered state and instructor answers.
 *   Chat with Instructor — the learner's 1:1 instructor threads; opens the
 *                    shared chat page. Paid access is always described as
 *                    "granted by the instructor" — never a platform payment.
 */
type TabKey = 'courses' | 'saved' | 'questions' | 'chats';

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: 'courses', label: 'My Courses', icon: BookOpen },
  { key: 'saved', label: 'Saved Courses', icon: Bookmark },
  { key: 'questions', label: 'My Questions', icon: HelpCircle },
  { key: 'chats', label: 'Chat with Instructor', icon: MessagesSquare },
];
export const MyLearningView: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [continueLearning, setContinueLearning] = useState<Record<string, unknown>[]>([]);
  const [freeCourses, setFreeCourses] = useState<Record<string, unknown>[]>([]);
  const [paidCourses, setPaidCourses] = useState<Record<string, unknown>[]>([]);
  const [awaitingAccess, setAwaitingAccess] = useState<Record<string, unknown>[]>([]);
  const [completedCourses, setCompletedCourses] = useState<Record<string, unknown>[]>([]);
  const [savedCourses, setSavedCourses] = useState<Record<string, unknown>[]>([]);
  const [myQuestions, setMyQuestions] = useState<Record<string, unknown>[]>([]);
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabKey>(() => {
    const t = searchParams.get('tab');
    return t === 'saved' || t === 'questions' || t === 'chats' ? t : 'courses';
  });
  const [chats, setChats] = useState<Record<string, unknown>[]>([]);
  const [chatsLoading, setChatsLoading] = useState(false);
  const [chatsLoaded, setChatsLoaded] = useState(false);
  const [removingSavedId, setRemovingSavedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [raw, questions] = await Promise.all([
        courses.myLearning(),
        courses.myQuestions().catch(() => [] as unknown[]),
      ]);
      const envelope = asRec(raw);
      const flat = Array.isArray(raw) ? (raw as Record<string, unknown>[]) : recArr(envelope.data);
      setItems(flat);
      setContinueLearning(recArr(envelope.continueLearning));
      setFreeCourses(recArr(envelope.freeCourses));
      setPaidCourses(recArr(envelope.paidCourses));
      setAwaitingAccess(recArr(envelope.awaitingAccess));
      setCompletedCourses(recArr(envelope.completedCourses));
      setSavedCourses(recArr(envelope.savedCourses));
      setMyQuestions(recArr(questions));
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
    if (tab === 'chats') void loadChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChats = async () => {
    setChatsLoading(true);
    try {
      const rows = recArr(await chat.rooms());
      setChats(rows.filter((r) => strOf(r.counterpartyPersona) === 'instructor'));
    } catch {
      setChats([]);
    } finally {
      setChatsLoading(false);
      setChatsLoaded(true);
    }
  };

  const selectTab = (next: TabKey) => {
    setTab(next);
    setSearchParams(next === 'courses' ? {} : { tab: next }, { replace: true });
    if (next === 'chats' && !chatsLoaded && !chatsLoading) void loadChats();
  };

  const handleRemoveSaved = async (c: Record<string, unknown>) => {
    const courseId = strOf(c.courseId) || strOf(c.id);
    if (!courseId || removingSavedId) return;
    setRemovingSavedId(courseId);
    setError(null);
    try {
      await courses.unsave(courseId);
      setSavedCourses((prev) => prev.filter((x) => (strOf(x.courseId) || strOf(x.id)) !== courseId));
      setNotice(`Removed “${strOf(c.title) || 'course'}” from saved courses.`);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setRemovingSavedId(null);
    }
  };

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
    const courseId = strOf(reviewTarget.id) || strOf(reviewTarget.courseId);
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
          <p className="text-xs text-slate-500 mt-1">Your courses, live sessions and questions</p>
        </div>
        <Link
          to="/academy"
          className="px-3 py-1.5 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold text-[11px] self-start sm:self-auto"
        >
          Find Courses
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="My Learning sections">
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key;
          const count =
            key === 'saved'
              ? savedCourses.length
              : key === 'questions'
                ? myQuestions.length
                : key === 'chats' && chatsLoaded
                  ? chats.length
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
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-400">Loading your learning…</p>
      ) : tab === 'courses' ? (
        items.length === 0 && awaitingAccess.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
            <p className="text-xs text-slate-400 mb-3">No courses yet.</p>
            <Link
              to="/academy"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs"
            >
              <BookOpen className="w-3.5 h-3.5" /> Find a course
            </Link>
          </div>
        ) : (
          <>
            {continueLearning.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">Continue Learning</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {continueLearning.map((c) => (
                  <LearningCourseCard
                    key={strOf(c.courseId) || strOf(c.id)}
                    course={c}
                    primaryAction={
                      <button
                        onClick={() => navigate(`/academy/courses/${strOf(c.courseId) || strOf(c.id)}/learn`)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Continue
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {awaitingAccess.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">Awaiting Instructor Access</h2>
              <div className="space-y-2">
                {awaitingAccess.map((c) => (
                  <div
                    key={strOf(c.courseId) || strOf(c.id)}
                    className="bg-white rounded-2xl border border-amber-200/80 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <span className="p-2 rounded-xl bg-amber-50 text-amber-600 shrink-0">
                        <Hourglass className="w-4 h-4" />
                      </span>
                    <div>
                        <p className="text-sm font-bold text-slate-900">{strOf(c.title) || 'Course'}</p>
                        <p className="text-[11px] text-slate-400">
                          By {strOf(c.instructorName) || 'your instructor'} •{' '}
                          {strOf(c.currency, 'INR') || 'INR'} {numOf(c.priceRupees).toLocaleString('en-IN')}
                        </p>
                        <p className="text-[11px] text-amber-700 mt-1">
                          Contact unlocked. Your instructor has not granted course access yet.
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => navigate('/academy')}
                      className="px-4 py-2 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-bold text-xs"
                    >
                      View course
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {freeCourses.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">Free Courses</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {freeCourses.map((c) => (
                  <LearningCourseCard
                    key={strOf(c.courseId) || strOf(c.id)}
                    course={c}
                    primaryAction={
                      <button
                        onClick={() => navigate(`/academy/courses/${strOf(c.courseId) || strOf(c.id)}/learn`)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Continue
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {paidCourses.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">Paid Courses with Access</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {paidCourses.map((c) => (
                  <LearningCourseCard
                    key={strOf(c.courseId) || strOf(c.id)}
                    course={c}
                    primaryAction={
                      <button
                        onClick={() => navigate(`/academy/courses/${strOf(c.courseId) || strOf(c.id)}/learn`)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Continue
                      </button>
                    }
                  />
                ))}
              </div>
            </section>
          )}

          {sessions.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">Live Sessions</h2>
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
                          <p className="text-sm font-bold text-slate-900">{strOf(s.title) || 'Scheduled session'}</p>
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

          {completedCourses.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-extrabold text-slate-900">Completed Courses</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {completedCourses.map((c) => {
                  const courseId = strOf(c.courseId) || strOf(c.id);
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
            </section>
          )}

          </>
        )
      ) : tab === 'saved' ? (
        savedCourses.length === 0 ? (
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
            {savedCourses.map((c) => {
              const courseId = strOf(c.courseId) || strOf(c.id);
              return (
                <div
                  key={courseId}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 flex flex-col justify-between"
                >
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900 leading-snug">{strOf(c.title)}</h3>
                    <p className="text-xs text-slate-400 mt-1">By {strOf(c.instructorName) || 'Gurukul Faculty'}</p>
                    <p className="text-xs font-black text-emerald-800 mt-2">
                      {numOf(c.priceRupees) === 0 ? 'Free' : `${strOf(c.currency, 'INR') || 'INR'} ${numOf(c.priceRupees).toLocaleString('en-IN')}`}
                    </p>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <button
                      onClick={() => navigate('/academy')}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                    >
                      View course
                    </button>
                    <button
                      onClick={() => void handleRemoveSaved(c)}
                      disabled={removingSavedId === courseId}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-50 font-bold text-[11px] inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> {removingSavedId === courseId ? 'Removing…' : 'Remove'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : tab === 'questions' ? (
        myQuestions.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
            <HelpCircle className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-xs text-slate-400">
              You haven’t asked any questions yet. Ask the instructor from a course page and track the answer here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {myQuestions.map((q) => (
              <div key={strOf(q.id)} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold text-violet-700">{strOf(q.courseTitle) || 'Course'}</p>
                    <p className="text-xs font-bold text-slate-900 mt-0.5">{strOf(q.question)}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${
                      boolOf(q.isAnswered)
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {boolOf(q.isAnswered) ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Answered
                      </>
                    ) : (
                      <>
                        <Hourglass className="w-3 h-3" /> Awaiting answer
                      </>
                    )}
                  </span>
                </div>
                {recArr(q.answers).map((a) => (
                  <p key={strOf(a.id)} className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100 mt-2">
                    <span className="font-bold text-emerald-700">Instructor: </span>
                    {strOf(a.answer)}
                  </p>
                ))}
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          {chatsLoading ? (
            <p className="text-xs text-slate-400">Loading your instructor chats…</p>
          ) : chats.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center">
              <MessagesSquare className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                No instructor chats yet. Chat unlocks after you enrol in a course or contact the instructor from the
                course page.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {chats.map((r) => {
                const roomId = strOf(r.id) || strOf(r.roomId);
                const unreadCount = numOf(r.unreadCount);
                return (
                  <div
                    key={roomId}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="p-2 rounded-xl bg-violet-50 text-violet-600 shrink-0">
                        <MessagesSquare className="w-4 h-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{strOf(r.counterpartyName) || 'Instructor'}</p>
                        <p className="text-[11px] text-slate-400">{strOf(r.crop) || 'Gurukul course'}</p>
                        {strOf(r.lastMessageText) && (
                          <p className="text-[11px] text-slate-500 mt-1 truncate">{strOf(r.lastMessageText)}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {unreadCount > 0 && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-bold">
                          {unreadCount} new
                        </span>
                      )}
                      <button
                        onClick={() => navigate(`/chat?room=${encodeURIComponent(roomId)}`)}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
                      >
                        Open chat
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Rate-course modal */}
      <ModalSheet
        isOpen={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={reviewTarget ? `Rate “${strOf(reviewTarget.title) || 'course'}”` : undefined}
        description="Your rating helps other farmers choose the right course."
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
  const accessStatus = strOf(c.accessStatus, 'granted');
  const status = isCompleted
    ? 'Completed'
    : accessStatus === 'accessRevoked' || accessStatus === 'revoked'
      ? 'Access revoked by instructor'
      : progress > 0
        ? 'In progress'
        : 'Not started';
  const statusClass = isCompleted
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : accessStatus === 'accessRevoked' || accessStatus === 'revoked'
      ? 'bg-rose-50 text-rose-700 border-rose-200'
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
          {strOf(c.accessType) === 'manualOffPlatform' && (
            <p className="text-[10px] text-violet-700 font-bold flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> Access granted by instructor
            </p>
          )}
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
