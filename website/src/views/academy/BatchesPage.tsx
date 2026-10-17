import React, { useEffect, useState } from 'react';
import {
  Layers,
  Plus,
  CalendarPlus,
  ClipboardCheck,
  QrCode,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { teachers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDate, formatDateTime } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

const todayStr = (): string => new Date().toISOString().slice(0, 10);

/**
 * Instructor batches — schedule on-farm batches (teachers.batches*), create
 * sessions with QR check-in tokens, and mark attendance per session
 * (teachers.attendance / markAttendance). NOTE: the backend has no
 * list-sessions endpoint; sessions created in this session are kept locally
 * so attendance can be taken immediately.
 */
export const BatchesPage: React.FC = () => {
  const [batches, setBatches] = useState<Record<string, unknown>[]>([]);
  const [courses, setCourses] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    courseId: '',
    batchName: '',
    startDate: todayStr(),
    endDate: todayStr(),
    locationPin: 'Farm Training Center',
    maxSeats: 25,
    scheduleDays: 'Mon-Wed-Fri 10:00 AM',
  });
  const [saving, setSaving] = useState(false);

  // sessions created this visit, keyed by batchId
  const [sessionsByBatch, setSessionsByBatch] = useState<Record<string, Record<string, unknown>[]>>({});

  const [sessionFor, setSessionFor] = useState<Record<string, unknown> | null>(null);
  const [sessionForm, setSessionForm] = useState({ title: '', topic: '', date: todayStr(), time: '10:00', durationMin: 120 });

  const [attFor, setAttFor] = useState<{ batch: Record<string, unknown>; session: Record<string, unknown> } | null>(null);
  const [attendance, setAttendance] = useState<Record<string, unknown> | null>(null);
  const [attLoading, setAttLoading] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [attSaving, setAttSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [b, c] = await Promise.all([teachers.batches(), teachers.myCourses()]);
      setBatches(recArr(b));
      setCourses(recArr(c));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await teachers.createBatch({ ...form, maxSeats: Number(form.maxSeats) || 25 });
      setCreateOpen(false);
      setNotice(`Batch “${form.batchName}” scheduled.`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleAddSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionFor) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const startsAt = new Date(`${sessionForm.date}T${sessionForm.time}:00`).toISOString();
      const endsAt = new Date(`${sessionForm.date}T${sessionForm.time}:00`).getTime() + sessionForm.durationMin * 60000;
      const created = asRec(
        await teachers.addSession(strOf(sessionFor.id), {
          title: sessionForm.title || 'Session',
          topic: sessionForm.topic,
          startsAt,
          endsAt: new Date(endsAt).toISOString(),
        }),
      );
      const batchId = strOf(sessionFor.id);
      setSessionsByBatch((prev) => ({
        ...prev,
        [batchId]: [...(prev[batchId] || []), created],
      }));
      setSessionFor(null);
      setNotice(`Session scheduled — QR token ${strOf(created.qrToken).slice(0, 8)}… for check-in.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openAttendance = async (batch: Record<string, unknown>, session: Record<string, unknown>) => {
    setAttFor({ batch, session });
    setAttendance(null);
    setStudentId('');
    setAttLoading(true);
    try {
      setAttendance(asRec(await teachers.attendance(strOf(session.id))));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAttLoading(false);
    }
  };

  const mark = async (status: string) => {
    if (!attFor || !studentId.trim()) return;
    setAttSaving(true);
    setError(null);
    try {
      const updated = asRec(
        await teachers.markAttendance(strOf(attFor.session.id), {
          sessionId: strOf(attFor.session.id),
          studentId: studentId.trim(),
          status,
          verificationMethod: 'manual_roll_call',
        }),
      );
      setAttendance(updated);
      setStudentId('');
      setNotice(`Attendance marked ${status} for ${studentId.trim()}.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setAttSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Layers className="w-7 h-7 text-emerald-600" />
            Batches & Sessions
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            On-farm training batches, session schedule with QR check-in, and attendance
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={reload}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => {
              setForm({ courseId: strOf(courses[0]?.id), batchName: '', startDate: todayStr(), endDate: todayStr(), locationPin: 'Farm Training Center', maxSeats: 25, scheduleDays: 'Mon-Wed-Fri 10:00 AM' });
              setCreateOpen(true);
            }}
            disabled={courses.length === 0}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px] inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> New Batch
          </button>
        </div>
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
        <p className="text-xs text-slate-400">Loading batches…</p>
      ) : batches.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400">
          No batches yet — schedule your first on-farm batch. Publishing requires approved instructor KYC.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {batches.map((b) => {
            const batchId = strOf(b.id);
            const sessions = [...recArr(b.sessions), ...(sessionsByBatch[batchId] || [])];
            return (
              <div key={batchId} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm text-slate-900">{nameOf(b, strOf(b.batchName, 'Batch'))}</h3>
                  <StatusBadge status={strOf(b.status, 'upcoming')} />
                </div>
                <p className="text-[11px] text-slate-400">
                  {strOf(b.courseTitle) || strOf(courses.find((c) => strOf(c.id) === strOf(b.courseId))?.title) || strOf(b.courseId)}
                  {' • '}
                  {formatDate(strOf(b.startDate))} → {formatDate(strOf(b.endDate))}
                </p>
                <p className="text-[11px] text-slate-500">
                  {numOf(b.enrolledSeats)}/{numOf(b.maxSeats, 25)} seats • {strOf(b.scheduleDays)}
                  {strOf(b.locationPin) && ` • ${strOf(b.locationPin)}`}
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSessionFor(b);
                      setSessionForm({ title: '', topic: '', date: todayStr(), time: '10:00', durationMin: 120 });
                    }}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                  >
                    <CalendarPlus className="w-3.5 h-3.5" /> Add Session
                  </button>
                </div>

                {sessions.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    {sessions.map((s, i) => (
                      <div key={strOf(s.id) || i} className="flex items-center justify-between gap-2 border border-slate-100 rounded-2xl p-2.5">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-800 truncate">{strOf(s.title, 'Session')}</p>
                          <p className="text-[10px] text-slate-400">{formatDateTime(strOf(s.startsAt))}</p>
                          {strOf(s.qrToken) && (
                            <p className="text-[10px] text-emerald-700 font-mono flex items-center gap-1">
                              <QrCode className="w-3 h-3" /> {strOf(s.qrToken).slice(0, 12)}…
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => openAttendance(b, s)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1 shrink-0"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" /> Attendance
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create batch modal */}
      <ModalSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Schedule New Batch"
        description="Batch creation is KYC-gated like publishing (403 KYC_NOT_APPROVED otherwise)."
        maxWidth="md"
      >
        <form onSubmit={handleCreate} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Course *</label>
            <select
              value={form.courseId}
              onChange={(e) => setForm({ ...form, courseId: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
              required
            >
              <option value="">— select course —</option>
              {courses.map((c) => (
                <option key={strOf(c.id)} value={strOf(c.id)}>
                  {strOf(c.title)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Batch Name *</label>
            <input
              type="text"
              value={form.batchName}
              onChange={(e) => setForm({ ...form, batchName: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="e.g. जून-2026 बॅच"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start Date *</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">End Date *</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Max Seats</label>
              <input
                type="number"
                min="1"
                max="100"
                value={form.maxSeats}
                onChange={(e) => setForm({ ...form, maxSeats: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Schedule Days</label>
              <input
                type="text"
                value={form.scheduleDays}
                onChange={(e) => setForm({ ...form, scheduleDays: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="Mon-Wed-Fri 10:00 AM"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Location</label>
            <input
              type="text"
              value={form.locationPin}
              onChange={(e) => setForm({ ...form, locationPin: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Creating…' : 'Schedule Batch'}
          </button>
        </form>
      </ModalSheet>

      {/* Add session modal */}
      <ModalSheet
        isOpen={Boolean(sessionFor)}
        onClose={() => setSessionFor(null)}
        title={sessionFor ? `Add Session — ${nameOf(sessionFor, strOf(sessionFor.batchName, 'Batch'))}` : undefined}
        description="Each session mints a QR check-in token for the farmers' app."
        maxWidth="md"
      >
        <form onSubmit={handleAddSession} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
              <input
                type="text"
                value={sessionForm.title}
                onChange={(e) => setSessionForm({ ...sessionForm, title: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                placeholder="Soil sampling demo"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Topic</label>
              <input
                type="text"
                value={sessionForm.topic}
                onChange={(e) => setSessionForm({ ...sessionForm, topic: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
              <input
                type="date"
                value={sessionForm.date}
                onChange={(e) => setSessionForm({ ...sessionForm, date: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Start *</label>
              <input
                type="time"
                value={sessionForm.time}
                onChange={(e) => setSessionForm({ ...sessionForm, time: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Minutes</label>
              <input
                type="number"
                min="15"
                step="15"
                value={sessionForm.durationMin}
                onChange={(e) => setSessionForm({ ...sessionForm, durationMin: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Creating…' : 'Create Session'}
          </button>
        </form>
      </ModalSheet>

      {/* Attendance modal */}
      <ModalSheet
        isOpen={Boolean(attFor)}
        onClose={() => setAttFor(null)}
        title={attFor ? `Attendance — ${strOf(attFor.session.title, 'Session')}` : undefined}
        description="Manual roll-call marking; the farmer self check-in flow scans the session QR."
        maxWidth="md"
      >
        {attLoading ? (
          <p className="text-xs text-slate-400">Loading attendance…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400">Present</p>
                <p className="text-lg font-black text-emerald-700">{numOf(attendance?.totalPresent)}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] uppercase font-bold text-slate-400">Recorded</p>
                <p className="text-lg font-black text-slate-900">{recArr(attendance?.records).length}</p>
              </div>
            </div>

            {recArr(attendance?.records).length > 0 && (
              <div className="border border-slate-100 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] border-b border-slate-100">
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Marked At</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {recArr(attendance?.records).map((r, i) => (
                      <tr key={strOf(r.studentId) || i}>
                        <td className="py-2 px-3 font-bold text-slate-800">{strOf(r.studentId)}</td>
                        <td className="py-2 px-3 capitalize">
                          <StatusBadge status={strOf(r.status, 'present')} />
                        </td>
                        <td className="py-2 px-3 text-slate-500">{formatDateTime(strOf(r.verifiedAt))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex gap-2">
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="Student user ID"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              />
              <button
                onClick={() => mark('present')}
                disabled={attSaving || !studentId.trim()}
                className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-[11px]"
              >
                Present
              </button>
              <button
                onClick={() => mark('absent')}
                disabled={attSaving || !studentId.trim()}
                className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-50 text-rose-600 font-bold text-[11px]"
              >
                Absent
              </button>
            </div>
          </div>
        )}
      </ModalSheet>
    </div>
  );
};

export default BatchesPage;
