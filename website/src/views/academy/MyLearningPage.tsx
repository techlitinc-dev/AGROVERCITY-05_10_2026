import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { getMyLearning, type Paged, type CourseSummary } from '../../lib/api/courses';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

type LearningCourse = CourseSummary & {
  progressPercent?: number;
  isCompleted?: boolean;
  certificateId?: string | null;
};

/** My Learning — progress per enrolled course with a continue deep link (task 1.13). */
export default function MyLearningPage() {
  const t = useT();
  const [courses, setCourses] = useState<LearningCourse[] | null>(null);

  const load = useCallback(() => {
    getMyLearning()
      .then((res: Paged<LearningCourse>) => setCourses(res.data))
      .catch(() => {
        setCourses([]);
        toast(t('academyLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ToolShell toolId="myLibrary">
      <section className="dash-section">
        <h3>{t('academyMyLearningTitle')}</h3>
        {courses === null ? (
          <p className="dash-empty-line">…</p>
        ) : courses.length === 0 ? (
          <p className="dash-empty-line">📚 {t('academyNoLearning')}</p>
        ) : (
          courses.map((course) => {
            const progress = course.progressPercent === undefined ? 0 : course.progressPercent;
            return (
              <div key={course.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <strong>{course.title}</strong>
                  {course.isCompleted ? (
                    <span className="av-chip" style={{ background: '#DCFCE7', color: '#166534', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}>
                      ✅ {t('academyCompletedBadge')}
                    </span>
                  ) : null}
                </div>
                <div style={{ marginTop: 6, height: 8, background: '#E5E7EB', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, background: '#16A34A' }} />
                </div>
                <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
                  {t('academyProgressLabel', { percent: progress })}
                </div>
                <Link to={`/dashboard/p/courses/${course.id}/learn`} style={{ marginTop: 6, display: 'inline-block' }}>
                  {t('academyContinue')}
                </Link>
              </div>
            );
          })
        )}
      </section>
    </ToolShell>
  );
}
