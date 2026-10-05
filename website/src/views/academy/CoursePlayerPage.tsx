import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import { getCourseLearning, postLessonProgress, type CourseLearning, type CourseLesson } from '../../lib/api/courses';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

interface FlatLesson extends CourseLesson {
  moduleTitle: string;
}

/** Course player — lesson list + progress toggle + certificate CTA (task 1.14). */
export default function CoursePlayerPage() {
  const t = useT();
  const { courseId = '' } = useParams();
  const [learning, setLearning] = useState<CourseLearning | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [progressPercent, setProgressPercent] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getCourseLearning(courseId)
      .then((res) => {
        setLearning(res);
        setCompleted(new Set(res.userProgress.completedLessonIds));
        setProgressPercent(res.userProgress.progressPercent);
        setIsCompleted(res.userProgress.isCompleted);
      })
      .catch((e) => toast(isApiError(e) ? e.message : t('academyLoadFailed'), { error: true }));
  }, [courseId, t]);

  useEffect(() => {
    load();
  }, [load]);

  const lessons: FlatLesson[] = (learning?.modules ?? []).flatMap((mod) =>
    mod.lessons.map((lesson) => ({ ...lesson, moduleTitle: mod.title })),
  );

  const toggle = async (lessonId: string) => {
    if (busy) return;
    const next = !completed.has(lessonId);
    setBusy(true);
    try {
      const res = await postLessonProgress(courseId, lessonId, { completed: next });
      setCompleted(new Set(res.completedLessonIds));
      setProgressPercent(res.progressPercent);
      setIsCompleted(res.isCompleted);
    } catch (e) {
      toast(isApiError(e) ? e.message : t('academyProgressFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="courses" backTo="/dashboard/p/myLearning">
      <section className="dash-section">
        <h3>{learning ? learning.title : t('academyPlayerTitle')}</h3>
        {learning === null ? (
          <p className="dash-empty-line">…</p>
        ) : (
          <>
            <div style={{ height: 8, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden', margin: '8px 0' }}>
              <div style={{ height: '100%', width: `${progressPercent}%`, background: '#16A34A' }} />
            </div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              {t('academyProgressLabel', { percent: progressPercent })} ·{' '}
              {t('academyProgressLessons', { done: completed.size, total: lessons.length })}
            </div>

            <ul style={{ marginTop: 12, listStyle: 'none', padding: 0 }}>
              {lessons.map((lesson) => (
                <li
                  key={lesson.id}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}
                >
                  <span>
                    <span style={{ color: '#6B7280', fontSize: 12 }}>{lesson.moduleTitle}</span>
                    <br />
                    {lesson.title}
                  </span>
                  <button type="button" disabled={busy} onClick={() => toggle(lesson.id)}>
                    {completed.has(lesson.id) ? `✅ ${t('academyMarkIncomplete')}` : t('academyMarkComplete')}
                  </button>
                </li>
              ))}
            </ul>

            {isCompleted ? (
              <Link to={`/dashboard/p/courses/${courseId}/certificate`} style={{ display: 'inline-block', marginTop: 12 }}>
                🏆 {t('academyCertificateCta')}
              </Link>
            ) : null}
          </>
        )}
      </section>
    </ToolShell>
  );
}
