import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { fetchAcademyAnalytics, type AcademyAnalytics } from '../../lib/api/instructorAcademy';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const SECTIONS = [
  { toolId: 'myCourses', labelKey: 'instructorMyCourses', icon: '📚' },
  { toolId: 'batches', labelKey: 'instructorBatches', icon: '🗓️' },
  { toolId: 'enquiries', labelKey: 'instructorEnquiries', icon: '📩' },
  { toolId: 'assignments', labelKey: 'instructorAssignments', icon: '📸' },
  { toolId: 'earnings', labelKey: 'instructorEarnings', icon: '💰' },
  { toolId: 'credentials', labelKey: 'instructorCredentials', icon: '🪪' },
];

/**
 * Instructor console home (WS-02 task 2.2) — real dashboard summary from
 * GET /v1/teachers/analytics plus links to the six routed sections. No demo
 * data, no `?? <number>` fallbacks.
 */
export default function InstructorHome() {
  const t = useT();
  const [analytics, setAnalytics] = useState<AcademyAnalytics | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    fetchAcademyAnalytics()
      .then(setAnalytics)
      .catch(() => {
        setAnalytics(null);
        setFailed(true);
        toast(t('instructorLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ToolShell toolId="instructorHome">
      <section className="dash-section">
        <h3>{t('instructorHomeTitle')}</h3>
        {failed ? (
          <p className="dash-empty-line">{t('instructorLoadFailed')}</p>
        ) : analytics === null ? (
          <p className="dash-empty-line">{t('instructorLoading')}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <div className="dash-summary-card" style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{t('instructorActiveCourses')}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{analytics.totalCourses}</div>
            </div>
            <div className="dash-summary-card" style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{t('instructorTotalStudents')}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{analytics.totalStudents}</div>
            </div>
            <div className="dash-summary-card" style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{t('instructorCompletionRate')}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>{analytics.completionRatePercent}%</div>
            </div>
            <div className="dash-summary-card" style={{ padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{t('instructorAverageRating')}</div>
              <div style={{ fontSize: 22, fontWeight: 700 }}>★ {analytics.averageRating}</div>
            </div>
          </div>
        )}
      </section>

      <section className="dash-section">
        <h3>{t('instructorQuickLinks')}</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
          {SECTIONS.map((section) => (
            <Link
              key={section.toolId}
              to={`/dashboard/p/${section.toolId}`}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 12, border: '1px solid #E5E7EB', borderRadius: 10 }}
            >
              <span style={{ fontSize: 20 }}>{section.icon}</span>
              <span>{t(section.labelKey)}</span>
            </Link>
          ))}
        </div>
      </section>
    </ToolShell>
  );
}
