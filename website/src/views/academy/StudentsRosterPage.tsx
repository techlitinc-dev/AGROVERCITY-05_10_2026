import React, { useEffect, useState } from 'react';
import {
  Users,
  Search,
  Megaphone,
  Award,
  Eye,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  BookOpen,
  Sprout,
} from 'lucide-react';
import { teachers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatCurrency, formatDate } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

/**
 * Instructor students roster — every paid enrollment across courses with
 * progress / completion / certificate state, a per-student full file drawer
 * (teachers.student), certificate issuing and batch-wide announcements.
 */
export const StudentsRosterPage: React.FC = () => {
  const [students, setStudents] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [courseFilter, setCourseFilter] = useState('');

  const [drawerFor, setDrawerFor] = useState<Record<string, unknown> | null>(null);
  const [drawer, setDrawer] = useState<Record<string, unknown> | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const [announceFor, setAnnounceFor] = useState<Record<string, unknown> | null>(null);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceText, setAnnounceText] = useState('');
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setStudents(recArr(await teachers.allStudents()));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const courses = Array.from(new Set(students.map((s) => strOf(s.courseId)).filter(Boolean)));

  const filtered = students.filter((s) => {
    if (courseFilter && strOf(s.courseId) !== courseFilter) return false;
    if (search) {
      const needle = search.toLowerCase();
      return (
        strOf(s.studentName).toLowerCase().includes(needle) ||
        strOf(s.courseTitle).toLowerCase().includes(needle)
      );
    }
    return true;
  });

  const openDrawer = async (s: Record<string, unknown>) => {
    setDrawerFor(s);
    setDrawer(null);
    setDrawerLoading(true);
    try {
      setDrawer(asRec(await teachers.student(strOf(s.studentId))));
    } catch (e) {
      setDrawer({ __error: apiErrorMessage(e) });
    } finally {
      setDrawerLoading(false);
    }
  };

  const issueCertificate = async (s: Record<string, unknown>) => {
    if (!window.confirm(`Issue the completion certificate to ${nameOf(s)} for “${strOf(s.courseTitle)}”?`))
      return;
    setError(null);
    setNotice(null);
    try {
      await teachers.issueCertificate(strOf(s.courseId), strOf(s.studentId));
      setNotice(`Certificate issued to ${nameOf(s)}.`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const sendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!announceFor) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await teachers.announce(strOf(announceFor.courseId), { title: announceTitle, message: announceText });
      setAnnounceFor(null);
      setAnnounceTitle('');
      setAnnounceText('');
      setNotice(`Announcement broadcast to all students of “${strOf(announceFor.courseTitle)}”.`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Users className="w-7 h-7 text-emerald-600" />
            Students Roster
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Paid enrollments across all your courses — progress, completion & certificates
          </p>
        </div>
        <button
          onClick={reload}
          className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
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

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student or course…"
            className="pl-8 pr-3 py-2 text-xs rounded-xl border border-slate-300 bg-white w-60"
          />
        </div>
        <select
          value={courseFilter}
          onChange={(e) => setCourseFilter(e.target.value)}
          className="px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
        >
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c} value={c}>
              {strOf(students.find((s) => strOf(s.courseId) === c)?.courseTitle) || c}
            </option>
          ))}
        </select>
        <span className="text-[11px] text-slate-400 ml-auto">{filtered.length} enrollment(s)</span>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading roster…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400">
          No paid enrollments match these filters.
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Student</th>
                  <th className="py-3 px-3">Course</th>
                  <th className="py-3 px-3">Enrolled</th>
                  <th className="py-3 px-3">Progress</th>
                  <th className="py-3 px-3">Paid</th>
                  <th className="py-3 px-3">Certificate</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => {
                  const completed = Boolean(s.isCompleted);
                  const certId = strOf(s.certificateId);
                  return (
                    <tr key={strOf(s.enrollmentId) || `${strOf(s.studentId)}-${strOf(s.courseId)}`} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-bold text-slate-900">
                        {nameOf(s, strOf(s.studentName, 'Student'))}
                        <span className="text-[10px] text-slate-400 block font-semibold">{strOf(s.studentPhone) || '—'}</span>
                      </td>
                      <td className="py-3 px-3 text-slate-600 max-w-44 truncate">{strOf(s.courseTitle)}</td>
                      <td className="py-3 px-3 text-slate-600">{formatDate(strOf(s.enrolledAt))}</td>
                      <td className="py-3 px-3">
                        <div className="w-20 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${completed ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            style={{ width: `${Math.min(100, numOf(s.progressPercent))}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-400">{numOf(s.progressPercent)}%</span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">{formatCurrency(numOf(s.amountPaidRupees))}</td>
                      <td className="py-3 px-3">
                        {certId ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold font-mono">
                            {certId.slice(0, 14)}…
                          </span>
                        ) : (
                          <StatusBadge status={completed ? 'completed' : 'in-progress'} />
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => openDrawer(s)}
                            className="p-1.5 rounded-lg text-sky-600 hover:bg-sky-50"
                            title="Student file"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!certId && (
                            <button
                              onClick={() => issueCertificate(s)}
                              className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-50"
                              title="Issue certificate"
                            >
                              <Award className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setAnnounceFor(s);
                              setAnnounceTitle('');
                              setAnnounceText('');
                            }}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50"
                            title="Announce to this course"
                          >
                            <Megaphone className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Per-student drawer */}
      <ModalSheet
        isOpen={Boolean(drawerFor)}
        onClose={() => {
          setDrawerFor(null);
          setDrawer(null);
        }}
        title={drawerFor ? `Student file — ${nameOf(drawerFor, strOf(drawerFor.studentName, 'Student'))}` : undefined}
        description={drawerFor ? strOf(drawerFor.courseTitle) : undefined}
        maxWidth="2xl"
      >
        {drawerLoading ? (
          <p className="text-xs text-slate-400">Loading student file…</p>
        ) : !drawer ? null : drawer.__error ? (
          <p className="text-xs font-bold text-rose-600">{strOf(drawer.__error)}</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Village', value: strOf(drawer.village) || '—' },
                { label: 'Phone', value: strOf(drawer.phone) || strOf(drawer.studentPhone) || '—' },
                { label: 'Active Crops', value: String(recArr(drawer.activeCrops).length || numOf(drawer.activeCropsCount)) },
                { label: 'Open Lots', value: String(recArr(drawer.openLots).length || numOf(drawer.openLotsCount)) },
              ].map((s) => (
                <div key={s.label} className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                  <p className="text-[10px] uppercase font-bold text-slate-400">{s.label}</p>
                  <p className="text-sm font-black text-slate-900 truncate">{s.value}</p>
                </div>
              ))}
            </div>

            {recArr(drawer.activeCrops).length > 0 && (
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Sprout className="w-3.5 h-3.5 text-emerald-600" /> Active Crops
                </h4>
                <div className="flex flex-wrap gap-2">
                  {recArr(drawer.activeCrops).map((c, i) => (
                    <span key={strOf(c.name) || i} className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[11px] font-bold capitalize">
                      {nameOf(c, strOf(c))}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {recArr(drawer.coursesWithMe ?? drawer.courses).length > 0 && (
              <div>
                <h4 className="font-bold text-xs text-slate-900 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> Courses With Me
                </h4>
                <div className="space-y-2">
                  {recArr(drawer.coursesWithMe ?? drawer.courses).map((c, i) => (
                    <div key={strOf(c.courseId) || i} className="flex items-center justify-between border border-slate-100 rounded-2xl p-3 text-xs">
                      <span className="font-bold text-slate-800">{strOf(c.courseTitle) || strOf(c.title) || 'Course'}</span>
                      <span className="text-slate-500">{numOf(c.progressPercent)}% complete</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </ModalSheet>

      {/* Announcement modal */}
      <ModalSheet
        isOpen={Boolean(announceFor)}
        onClose={() => setAnnounceFor(null)}
        title="Batch-wide Announcement"
        description={announceFor ? `Broadcast to every student of “${strOf(announceFor.courseTitle)}”.` : undefined}
        maxWidth="md"
      >
        <form onSubmit={sendAnnouncement} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Title *</label>
            <input
              type="text"
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              placeholder="e.g. Saturday session rescheduled"
              minLength={3}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Message *</label>
            <textarea
              value={announceText}
              onChange={(e) => setAnnounceText(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              rows={3}
              placeholder="e.g. Saturday session shifted to 9 AM due to heat"
              minLength={5}
              required
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Sending…' : 'Broadcast Announcement'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default StudentsRosterPage;
