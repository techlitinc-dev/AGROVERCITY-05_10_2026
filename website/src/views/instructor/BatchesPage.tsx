import { useCallback, useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import BatchChatView from './BatchChatView';
import {
  createBatch,
  fetchBatches,
  fetchMyCourses,
  fetchSessionAttendance,
  markSessionAttendance,
  type AcademyCourse,
  type CourseBatch,
  type SessionAttendance,
} from '../../lib/api/instructorAcademy';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Batches (WS-02 task 2.4) — GET/POST /v1/teachers/batches plus QR attendance.
 * Attendance is loaded ONLY for a real session id derived from the selected
 * batch (the batch document id) — no hardcoded demo session id (global rule 1).
 */
export default function BatchesPage() {
  const t = useT();
  const [batches, setBatches] = useState<CourseBatch[] | null>(null);
  const [courses, setCourses] = useState<AcademyCourse[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [attendance, setAttendance] = useState<SessionAttendance | null>(null);
  const [newBatch, setNewBatch] = useState({
    courseId: '',
    batchName: '',
    startDate: '',
    endDate: '',
    locationPin: '',
    maxSeats: '',
    scheduleDays: '',
  });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetchBatches()
      .then(setBatches)
      .catch(() => {
        setBatches([]);
        toast(t('instructorLoadFailed'), { error: true });
      });
    fetchMyCourses()
      .then(setCourses)
      .catch(() => setCourses([]));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const loadAttendance = useCallback(
    (sessionId: string) => {
      fetchSessionAttendance(sessionId)
        .then(setAttendance)
        .catch(() => toast(t('instructorLoadFailed'), { error: true }));
    },
    [t]
  );

  useEffect(() => {
    if (selectedBatchId) loadAttendance(selectedBatchId);
  }, [selectedBatchId, loadAttendance]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newBatch.courseId || !newBatch.batchName.trim()) return;
    setBusy(true);
    try {
      await createBatch({
        courseId: newBatch.courseId,
        batchName: newBatch.batchName.trim(),
        startDate: newBatch.startDate,
        endDate: newBatch.endDate,
        locationPin: newBatch.locationPin,
        maxSeats: Number(newBatch.maxSeats),
        scheduleDays: newBatch.scheduleDays,
      });
      setNewBatch({ courseId: '', batchName: '', startDate: '', endDate: '', locationPin: '', maxSeats: '', scheduleDays: '' });
      toast(t('instructorBatchCreated'));
      load();
    } catch {
      toast(t('instructorBatchCreateFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (studentId: string, currentStatus: string) => {
    if (!attendance) return;
    const nextStatus = currentStatus === 'present' ? 'absent' : 'present';
    try {
      const updated = await markSessionAttendance(attendance.sessionId, {
        studentId,
        status: nextStatus,
      });
      setAttendance(updated);
    } catch {
      toast(t('instructorAttendanceFailed'), { error: true });
    }
  };

  const selectedBatch = batches?.find((batch) => batch.id === selectedBatchId) ?? null;

  return (
    <ToolShell toolId="batches">
      <section className="dash-section">
        <h3>{t('instructorBatches')}</h3>
        {batches === null ? (
          <p className="dash-empty-line">{t('instructorLoading')}</p>
        ) : batches.length === 0 ? (
          <p className="dash-empty-line">🗓️ {t('instructorNoBatches')}</p>
        ) : (
          batches.map((batch) => (
            <div key={batch.id} style={{ padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                <strong>{batch.batchName}</strong>
                <span style={{ fontSize: 12, color: '#6B7280' }}>
                  {t('instructorBatchSeats')}: {batch.enrolledSeats}/{batch.maxSeats}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#6B7280' }}>
                {batch.startDate} → {batch.endDate} • {batch.scheduleDays}
              </div>
              <button
                type="button"
                className="av-btn"
                style={{ marginTop: 6 }}
                onClick={() => setSelectedBatchId(batch.id)}
              >
                {t('instructorAttendanceTitle')}
              </button>
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h3>{t('instructorAttendanceTitle')}</h3>
        {!selectedBatchId ? (
          <p className="dash-empty-line">{t('instructorSelectBatch')}</p>
        ) : attendance === null ? (
          <p className="dash-empty-line">{t('instructorLoading')}</p>
        ) : (
          <>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              {t('instructorSessionLabel')}: {attendance.sessionId} • {attendance.totalPresent}/{attendance.totalEnrolled}
            </div>
            <table style={{ width: '100%', marginTop: 8 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>{t('instructorStudent')}</th>
                  <th style={{ textAlign: 'left' }}>{t('instructorAttendanceStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {attendance.records.map((record) => (
                  <tr key={record.studentId}>
                    <td>{record.studentName}</td>
                    <td>{record.status === 'present' ? t('instructorPresent') : t('instructorAbsent')}</td>
                    <td>
                      <button type="button" className="av-btn" onClick={() => handleToggle(record.studentId, record.status)}>
                        {t('instructorToggleAttendance')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {selectedBatch && (
        <section className="dash-section">
          <h3>{t('instructorBatchChat')}</h3>
          <BatchChatView batch={selectedBatch} />
        </section>
      )}

      <section className="dash-section">
        <h3>{t('instructorNewBatch')}</h3>
        <form onSubmit={handleCreate} style={{ display: 'grid', gap: 8, maxWidth: 420 }}>
          <select
            className="av-input"
            value={newBatch.courseId}
            onChange={(e) => setNewBatch({ ...newBatch, courseId: e.target.value })}
            required
          >
            <option value="">{t('instructorBatchCourse')}</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
          <input
            className="av-input"
            placeholder={t('instructorBatchName')}
            value={newBatch.batchName}
            onChange={(e) => setNewBatch({ ...newBatch, batchName: e.target.value })}
            required
          />
          <input
            className="av-input"
            type="date"
            value={newBatch.startDate}
            onChange={(e) => setNewBatch({ ...newBatch, startDate: e.target.value })}
            required
          />
          <input
            className="av-input"
            type="date"
            value={newBatch.endDate}
            onChange={(e) => setNewBatch({ ...newBatch, endDate: e.target.value })}
            required
          />
          <input
            className="av-input"
            placeholder={t('instructorBatchSchedule')}
            value={newBatch.scheduleDays}
            onChange={(e) => setNewBatch({ ...newBatch, scheduleDays: e.target.value })}
          />
          <input
            className="av-input"
            type="number"
            placeholder={t('instructorBatchSeats')}
            value={newBatch.maxSeats}
            onChange={(e) => setNewBatch({ ...newBatch, maxSeats: e.target.value })}
          />
          <button type="submit" className="av-btn" disabled={busy}>
            {t('instructorCreateBatch')}
          </button>
        </form>
      </section>
    </ToolShell>
  );
}
