import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  createCourse,
  fetchMyCourses,
  updateCourse,
  type AcademyCourse,
} from '../../lib/api/instructorAcademy';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const STATUS_KEYS: Record<string, string> = {
  published: 'instructorStatusPublished',
  draft: 'instructorStatusDraft',
  pendingReview: 'instructorStatusPendingReview',
  // WS-02 task 2.24: new courses are stamped `pending_review` for the phase-07
  // admin moderation queue — never render the raw backend string.
  pending_review: 'instructorModerationPendingReview',
  archived: 'instructorStatusArchived',
  rejected: 'instructorStatusRejected',
};

/** Billing/subscription screen for the Instructor Pro upgrade (task 2.25). */
const UPGRADE_ROUTE = '/dashboard/p/settings';

function statusLabel(t: (key: string) => string, status: string): string {
  const key = STATUS_KEYS[status];
  return key ? t(key) : status;
}

/**
 * My Courses (WS-02 task 2.3) — instructor course studio. Lists
 * GET /v1/teachers/courses/mine, creates via POST /v1/teachers/courses/create,
 * edits via the courses.py PUT /v1/courses/{id} CRUD. Shows `status` and
 * `moderationStatus` with translated labels. All strings via t() (en + hi).
 */
export default function MyCoursesPage() {
  const t = useT();
  const [courses, setCourses] = useState<AcademyCourse[] | null>(null);
  const [newCourse, setNewCourse] = useState({ title: '', category: 'Agri-Skills', feeRupees: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ title: '', priceRupees: '' });
  const [busy, setBusy] = useState(false);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  const load = useCallback(() => {
    fetchMyCourses()
      .then(setCourses)
      .catch(() => {
        setCourses([]);
        toast(t('instructorLoadFailed'), { error: true });
      });
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newCourse.title.trim()) return;
    setBusy(true);
    try {
      await createCourse({
        title: newCourse.title.trim(),
        category: newCourse.category,
        feeRupees: Number(newCourse.feeRupees),
      });
      setNewCourse({ title: '', category: 'Agri-Skills', feeRupees: '' });
      toast(t('instructorCourseCreated'));
      load();
    } catch (error) {
      // WS-02 task 2.25: a Free-tier instructor hitting the 1-course ceiling
      // (402/403 ENTITLEMENT_REQUIRED) gets the Instructor Pro upgrade prompt.
      if (isApiError(error) && error.code === 'ENTITLEMENT_REQUIRED') {
        setUpgradeRequired(true);
      } else {
        toast(t('instructorCourseCreateFailed'), { error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (course: AcademyCourse) => {
    setEditId(course.id);
    setEditDraft({ title: course.title, priceRupees: String(course.feeRupees) });
  };

  const handleUpdate = async (event: React.FormEvent, courseId: string) => {
    event.preventDefault();
    setBusy(true);
    try {
      await updateCourse(courseId, {
        title: editDraft.title.trim(),
        priceRupees: Number(editDraft.priceRupees),
      });
      setEditId(null);
      toast(t('instructorCourseUpdated'));
      load();
    } catch {
      toast(t('instructorCourseUpdateFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="myCourses">
      {upgradeRequired && (
        <section className="dash-section">
          <h3>{t('instructorUpgradeTitle')}</h3>
          <p className="dash-empty-line">{t('instructorUpgradeBody')}</p>
          <Link to={UPGRADE_ROUTE} className="av-btn" style={{ display: 'inline-block' }}>
            {t('instructorUpgradeCta')}
          </Link>
        </section>
      )}
      <section className="dash-section">
        <h3>{t('instructorMyCourses')}</h3>
        {courses === null ? (
          <p className="dash-empty-line">{t('instructorLoading')}</p>
        ) : courses.length === 0 ? (
          <p className="dash-empty-line">📚 {t('instructorNoCourses')}</p>
        ) : (
          courses.map((course) => (
            <div key={course.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{course.title}</strong>
                <span style={{ fontSize: 12, color: '#6B7280' }}>
                  {t('instructorCourseStatus')}: {statusLabel(t, course.status)}
                  {course.moderationStatus ? ` • ${t('instructorCourseModeration')}: ${statusLabel(t, course.moderationStatus)}` : ''}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {t('instructorCourseCategory')}: {course.category} • {t('instructorCourseFee')}: {course.feeRupees}
              </div>
              {editId === course.id ? (
                <form onSubmit={(e) => handleUpdate(e, course.id)} style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
                  <input
                    className="av-input"
                    value={editDraft.title}
                    onChange={(e) => setEditDraft({ ...editDraft, title: e.target.value })}
                    aria-label={t('instructorCourseTitle')}
                  />
                  <input
                    className="av-input"
                    type="number"
                    value={editDraft.priceRupees}
                    onChange={(e) => setEditDraft({ ...editDraft, priceRupees: e.target.value })}
                    aria-label={t('instructorCourseFee')}
                  />
                  <button type="submit" className="av-btn" disabled={busy}>
                    {t('instructorSave')}
                  </button>
                  <button type="button" className="av-btn" onClick={() => setEditId(null)}>
                    {t('instructorCancel')}
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="av-btn"
                  style={{ marginTop: 6 }}
                  onClick={() => startEdit(course)}
                >
                  {t('instructorEdit')}
                </button>
              )}
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h3>{t('instructorNewCourse')}</h3>
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <input
            className="av-input"
            placeholder={t('instructorCourseTitle')}
            value={newCourse.title}
            onChange={(e) => setNewCourse({ ...newCourse, title: e.target.value })}
            required
          />
          <input
            className="av-input"
            placeholder={t('instructorCourseCategory')}
            value={newCourse.category}
            onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
          />
          <input
            className="av-input"
            type="number"
            placeholder={t('instructorCourseFee')}
            value={newCourse.feeRupees}
            onChange={(e) => setNewCourse({ ...newCourse, feeRupees: e.target.value })}
            required
          />
          <button type="submit" className="av-btn" disabled={busy}>
            {t('instructorCreateCourse')}
          </button>
        </form>
      </section>
    </ToolShell>
  );
}
