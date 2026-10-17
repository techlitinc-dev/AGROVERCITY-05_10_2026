import React, { useEffect, useState } from 'react';
import { FileText, ClipboardCheck, Sparkles, AlertCircle, CheckCircle2, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { teachers, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatDateTime } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

const GRADES = ['A+', 'A', 'B', 'Pass', 'Incomplete'];

/**
 * Instructor assignments — practical field assignments with submissions,
 * the server-side AI grade prefill (aiSuggestion), and the confirm-to-publish
 * grading flow (teachers.assignments / gradeAssignment).
 */
export const AssignmentsPage: React.FC = () => {
  const [assignments, setAssignments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');

  const [gradeFor, setGradeFor] = useState<Record<string, unknown> | null>(null);
  const [grade, setGrade] = useState('A');
  const [feedback, setFeedback] = useState('');
  const [passed, setPassed] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setAssignments(recArr(await teachers.assignments()));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
  }, []);

  const openGrade = (a: Record<string, unknown>) => {
    setGradeFor(a);
    const suggestion = asRec(a.aiSuggestion);
    setGrade(strOf(suggestion.suggestedGrade) || 'A');
    setFeedback(strOf(suggestion.reason));
    setPassed(true);
  };

  const submitGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradeFor) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      await teachers.gradeAssignment(strOf(gradeFor.id), { grade, feedback, passed });
      setGradeFor(null);
      setNotice(`Grade ${grade} published for ${nameOf(gradeFor, strOf(gradeFor.studentName, 'student'))}.`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const filtered = statusFilter
    ? assignments.filter((a) => strOf(a.status, 'assigned') === statusFilter)
    : assignments;

  const submitted = assignments.filter((a) => strOf(a.status) === 'submitted').length;
  const graded = assignments.filter((a) => strOf(a.status) === 'graded').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <FileText className="w-7 h-7 text-emerald-600" />
            Practical Assignments
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Photo-evidence field assignments — review submissions, confirm the AI suggestion, publish the grade
          </p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-xl border border-slate-300 bg-white"
          >
            <option value="">All statuses</option>
            <option value="assigned">Assigned</option>
            <option value="submitted">Submitted</option>
            <option value="graded">Graded</option>
          </select>
          <button
            onClick={reload}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
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

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: assignments.length, color: 'text-slate-900' },
          { label: 'Awaiting Grade', value: submitted, color: 'text-amber-600' },
          { label: 'Graded', value: graded, color: 'text-emerald-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4">
            <p className="text-[10px] uppercase font-bold text-slate-400">{s.label}</p>
            <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-xs text-slate-400">Loading assignments…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-10 text-center text-xs text-slate-400">
          No assignments match. Assignments are created from the course wall by your students' submissions.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => {
            const suggestion = asRec(a.aiSuggestion);
            const photos = recArr(a.evidencePhotoUrls);
            return (
              <div key={strOf(a.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      {strOf(a.title, 'Field assignment')}
                      <span className="text-[10px] text-slate-400 font-semibold ml-2">
                        {nameOf(a, strOf(a.studentName, 'Student'))}
                      </span>
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      {strOf(a.courseTitle)} • submitted {formatDateTime(strOf(a.submittedAt))}
                    </p>
                  </div>
                  <StatusBadge status={strOf(a.status, 'assigned')} />
                </div>

                {strOf(a.notes) && <p className="text-xs text-slate-600">{strOf(a.notes)}</p>}

                {photos.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {photos.map((p, i) => (
                      <a
                        key={strOf(p) || i}
                        href={strOf(p)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-50 border border-slate-100 text-[11px] font-bold text-slate-600 hover:border-emerald-200"
                      >
                        <ImageIcon className="w-3 h-3" /> Evidence {i + 1}
                      </a>
                    ))}
                  </div>
                )}

                {strOf(a.status) === 'submitted' && Boolean(a.aiSuggestion) && (
                  <div className="p-3 rounded-2xl bg-violet-50 border border-violet-100 flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <span className="font-black text-violet-800">
                        AI suggestion: {strOf(suggestion.suggestedGrade) || '—'} ({numOf(suggestion.suggestedScorePct)}%)
                      </span>
                      {strOf(suggestion.reason) && <p className="text-violet-700 mt-0.5">{strOf(suggestion.reason)}</p>}
                      <p className="text-[10px] text-violet-400 mt-1">Prefill only — you confirm the published grade.</p>
                    </div>
                  </div>
                )}

                {strOf(a.status) === 'graded' && (
                  <p className="text-xs font-bold text-emerald-800">
                    Grade {strOf(a.grade)} {boolPassed(a) ? '— passed' : '— not passed'} • {formatDateTime(strOf(a.gradedAt))}
                  </p>
                )}

                <div className="flex items-center gap-2">
                  {strOf(a.status) === 'submitted' && (
                    <button
                      onClick={() => openGrade(a)}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> Review & Grade
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ModalSheet
        isOpen={Boolean(gradeFor)}
        onClose={() => setGradeFor(null)}
        title="Publish Grade"
        description="The published grade is recorded against the AI suggestion for the outcome hook."
        maxWidth="sm"
      >
        <form onSubmit={submitGrade} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Grade *</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
            >
              {GRADES.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Feedback</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              rows={3}
            />
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <input
              type="checkbox"
              checked={passed}
              onChange={(e) => setPassed(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            Student passed
          </label>
          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Publishing…' : 'Publish Grade'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

function boolPassed(a: Record<string, unknown>): boolean {
  return a.passed !== false;
}

export default AssignmentsPage;
