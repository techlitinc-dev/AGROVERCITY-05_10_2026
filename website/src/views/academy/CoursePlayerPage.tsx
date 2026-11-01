import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  CheckCircle2,
  Download,
  HelpCircle,
  Play,
} from 'lucide-react';
import { courses, apiErrorMessage } from '../../lib/api';
import { asRec, boolOf, numOf, recArr, strOf } from './helpers';
import { VerificationBadges } from './VerificationBadges';

interface LessonRow {
  moduleId: string;
  moduleTitle: string;
  lesson: Record<string, unknown>;
  index: number;
}

/**
 * Lesson player — the learner classroom. Full content is only reachable with
 * granted (non-revoked) access: the backend enforces it on /learn, on every
 * progress update and on the certificate endpoint. Supports prev/next
 * navigation, mark-complete, per-lesson "Ask a Question", notes/materials and
 * the completion certificate.
 */
export const CoursePlayerPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const courseId = id || '';

  const [course, setCourse] = useState<Record<string, unknown> | null>(null);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [progressPercent, setProgressPercent] = useState(0);
  const [certificateId, setCertificateId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [marking, setMarking] = useState(false);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const doc = asRec(await courses.learn(courseId));
        setCourse(doc);
        const rows: LessonRow[] = [];
        recArr(doc.modules)
          .slice()
          .sort((a, b) => numOf(a.order) - numOf(b.order))
          .forEach((m) => {
            recArr(m.lessons)
              .slice()
              .sort((a, b) => numOf(a.order) - numOf(b.order))
              .forEach((l) =>
                rows.push({
                  moduleId: strOf(m.id),
                  moduleTitle: strOf(m.title),
                  lesson: l,
                  index: rows.length,
                }),
              );
          });
        setLessons(rows);
        const progress = asRec(doc.userProgress);
        setCompletedIds(new Set(recArr(progress.completedLessonIds).map((x) => strOf(x))));
        setProgressPercent(numOf(progress.progressPercent));
        setCertificateId(strOf(progress.certificateId));
        // resume at the first incomplete lesson where possible
        const firstOpen = rows.findIndex((r) => !recArr(progress.completedLessonIds).map((x) => strOf(x)).includes(strOf(r.lesson.id)));
        setCurrentIndex(firstOpen >= 0 ? firstOpen : 0);
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [courseId]);

  const current = lessons[currentIndex];
  const lesson = current?.lesson ?? {};
  const lessonId = strOf(lesson.id);
  const isCompleted = completedIds.has(lessonId);
  const mediaUrl = strOf(lesson.mediaUrl);
  const kind = strOf(lesson.kind, 'video');

  const markComplete = async (completed: boolean) => {
    if (!lessonId || marking) return;
    setMarking(true);
    setError(null);
    setNotice(null);
    try {
      const result = asRec(await courses.lessonProgress(courseId, lessonId, { completed }));
      setCompletedIds(new Set(recArr(result.completedLessonIds).map((x) => strOf(x))));
      setProgressPercent(numOf(result.progressPercent));
      if (strOf(result.certificateId)) setCertificateId(strOf(result.certificateId));
      if (completed) {
        setNotice(
          numOf(result.progressPercent) >= 100
            ? 'Course completed! Your Course Completion Certificate is ready.'
            : 'Lesson marked complete.',
        );
        if (currentIndex < lessons.length - 1) setCurrentIndex(currentIndex + 1);
      }
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setMarking(false);
    }
  };

  const askQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lessonId || asking || question.trim().length < 4) return;
    setAsking(true);
    setError(null);
    setNotice(null);
    try {
      await courses.askQuestion(courseId, { question: question.trim(), lessonId });
      setNotice('Question sent to your instructor.');
      setQuestion('');
      setQuestionOpen(false);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAsking(false);
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Opening your classroom…</p>;

  if (error && !course) {
    return (
      <div className="space-y-6">
        <Link to="/academy/my-learning" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-600">
          <ArrowLeft className="w-3.5 h-3.5" /> My Learning
        </Link>
        <div className="bg-white rounded-3xl border border-rose-200 shadow-xs p-10 text-center">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <p className="text-sm font-bold text-rose-700">{error}</p>
          <p className="text-xs text-slate-400 mt-2">
            Course content unlocks after enrolment (free) or after your instructor grants access (paid).
          </p>
          <Link
            to="/academy"
            className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
          >
            <BookOpen className="w-3.5 h-3.5" /> Browse courses
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <Link to="/academy/my-learning" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> My Learning
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            {strOf(course?.title) || 'Course'}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            By {strOf(course?.instructorName) || 'your instructor'} • {lessons.length} lesson(s)
          </p>
        </div>
        <VerificationBadges identity={course?.instructorIdentityVerified} expertise={course?.instructorExpertiseVerified} />
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Player */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-900 rounded-3xl overflow-hidden aspect-video flex items-center justify-center">
            {mediaUrl && kind === 'video' ? (
              <video key={lessonId} controls className="w-full h-full" src={mediaUrl} />
            ) : mediaUrl && kind === 'audio' ? (
              <audio key={lessonId} controls className="w-full px-6" src={mediaUrl} />
            ) : mediaUrl ? (
              <a href={mediaUrl} target="_blank" rel="noreferrer" className="text-emerald-400 text-xs font-bold underline">
                Open lesson material
              </a>
            ) : (
              <div className="text-center text-slate-400 px-6">
                <Play className="w-10 h-10 mx-auto mb-2 opacity-60" />
                <p className="text-xs">{strOf(lesson.description) || 'No media attached to this lesson yet.'}</p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">
                  Lesson {currentIndex + 1} of {lessons.length}
                  {current?.moduleTitle ? ` • ${current.moduleTitle}` : ''}
                </p>
                <h2 className="text-lg font-extrabold text-slate-900">{strOf(lesson.title) || 'Lesson'}</h2>
              </div>
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                  isCompleted
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-slate-100 text-slate-500 border-slate-200'
                }`}
              >
                {isCompleted ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" /> {numOf(lesson.durationMinutes)} min • {kind}
                  </>
                )}
              </span>
            </div>

            {strOf(lesson.description) && <p className="text-xs text-slate-600 leading-relaxed">{strOf(lesson.description)}</p>}

            {recArr(lesson.resources).length > 0 && (
              <div>
                <h4 className="text-xs font-bold text-slate-900 mb-2">Notes & materials</h4>
                <ul className="space-y-1.5">
                  {recArr(lesson.resources).map((r, i) => (
                    <li key={strOf(r.downloadUrl) || i}>
                      <a
                        href={strOf(r.downloadUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
                      >
                        <Download className="w-3.5 h-3.5" /> {strOf(r.title) || 'Material'}
                        <span className="text-slate-400 font-semibold uppercase">({strOf(r.fileType, 'pdf')})</span>
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                className="px-3 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 font-bold text-[11px] inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Previous
              </button>
              {isCompleted ? (
                <button
                  onClick={() => markComplete(false)}
                  disabled={marking}
                  className="px-4 py-2 rounded-xl border border-amber-300 text-amber-700 hover:bg-amber-50 disabled:opacity-50 font-bold text-[11px]"
                >
                  Mark incomplete
                </button>
              ) : (
                <button
                  onClick={() => markComplete(true)}
                  disabled={marking}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px] inline-flex items-center gap-1"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> {marking ? 'Saving…' : 'Mark complete'}
                </button>
              )}
              <button
                onClick={() => setCurrentIndex(Math.min(lessons.length - 1, currentIndex + 1))}
                disabled={currentIndex >= lessons.length - 1}
                className="px-3 py-2 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-50 disabled:opacity-40 font-bold text-[11px] inline-flex items-center gap-1"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setQuestionOpen((v) => !v)}
                className="px-3 py-2 rounded-xl border border-violet-300 text-violet-700 hover:bg-violet-50 font-bold text-[11px] inline-flex items-center gap-1 ml-auto"
              >
                <HelpCircle className="w-3.5 h-3.5" /> Ask a Question
              </button>
            </div>

            {questionOpen && (
              <form onSubmit={askQuestion} className="space-y-2 pt-2">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                  maxLength={1000}
                  placeholder={`Ask about “${strOf(lesson.title) || 'this lesson'}”…`}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/40"
                />
                <button
                  type="submit"
                  disabled={asking || question.trim().length < 4}
                  className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold text-[11px]"
                >
                  {asking ? 'Sending…' : 'Send to instructor'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Curriculum sidebar */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4 h-fit">
          <div>
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mb-1">
              <span>Course progress</span>
              <span>{Math.round(progressPercent)}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${progressPercent}%` }} />
            </div>
          </div>

          <div className="space-y-1.5">
            {lessons.map((row) => {
              const done = completedIds.has(strOf(row.lesson.id));
              const active = row.index === currentIndex;
              return (
                <button
                  key={`${row.moduleId}-${strOf(row.lesson.id)}`}
                  onClick={() => setCurrentIndex(row.index)}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-[11px] font-bold flex items-center gap-2 ${
                    active
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-100 bg-slate-50/60 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <Play className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}
                  <span className="truncate">{strOf(row.lesson.title)}</span>
                  <span className="ml-auto text-[9px] text-slate-400 shrink-0">{numOf(row.lesson.durationMinutes)}m</span>
                </button>
              );
            })}
          </div>

          {certificateId && (
            <Link
              to={`/academy/courses/${courseId}/certificate`}
              className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px]"
            >
              <Award className="w-4 h-4" /> View Course Completion Certificate
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default CoursePlayerPage;
