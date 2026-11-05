import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Plus,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Pencil,
  Copy,
  Trash2,
  Star,
  Layers,
} from 'lucide-react';
import { courses, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { asRec, numOf, recArr, strOf } from './helpers';

const STATUS_BADGE: Record<string, string> = {
  published: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pendingReview: 'bg-amber-50 text-amber-700 border-amber-200',
  draft: 'bg-slate-100 text-slate-600 border-slate-200',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  unpublished: 'bg-sky-50 text-sky-700 border-sky-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};

const statusLabel = (status: string): string =>
  status === 'pendingReview' ? 'Pending Review' : status || 'Draft';

/** Course Builder home — every course an instructor owns, with create, edit,
 *  publish/unpublish/archive, duplicate and delete in one place. Editing a
 *  single course happens in CourseBuilderPage (/instructor/courses/:id/edit). */
export const CourseBuilderHomePage: React.FC = () => {
  const navigate = useNavigate();
  const [list, setList] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    category: 'General',
    accessType: 'free',
    priceRupees: 0,
    language: 'hi',
  });

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      setList((await courses.mine()).map(asRec));
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim() || creating) return;
    setCreating(true);
    setError(null);
    setNotice(null);
    try {
      const course = asRec(
        await courses.create({
          title: createForm.title.trim(),
          category: createForm.category,
          accessType: createForm.accessType,
          priceRupees: createForm.accessType === 'paid' ? Number(createForm.priceRupees) : 0,
          language: createForm.language,
        }),
      );
      setCreateOpen(false);
      setCreateForm({ title: '', category: 'General', accessType: 'free', priceRupees: 0, language: 'hi' });
      navigate(`/instructor/courses/${strOf(course.id)}/edit`);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setCreating(false);
    }
  };

  const setStatus = async (courseId: string, status: string, label: string) => {
    setBusyId(courseId);
    setError(null);
    setNotice(null);
    try {
      await courses.update(courseId, { status });
      setNotice(`Course ${label}.`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const duplicate = async (courseId: string) => {
    setBusyId(courseId);
    setError(null);
    setNotice(null);
    try {
      const copy = asRec(await courses.duplicate(courseId));
      setNotice(`Course duplicated as “${strOf(copy.title)}” (draft).`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  const remove = async (c: Record<string, unknown>) => {
    if (!window.confirm(`Delete course “${strOf(c.title)}” permanently?`)) return;
    setBusyId(strOf(c.id));
    setError(null);
    setNotice(null);
    try {
      await courses.remove(strOf(c.id));
      setNotice('Course deleted.');
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusyId('');
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Loading course builder…</p>;

  const publishedCount = list.filter((c) => strOf(c.status) === 'published').length;
  const inputCls = 'w-full px-3 py-2 text-xs rounded-xl border border-slate-300';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link
            to="/instructor/home"
            className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-600 mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Academy Studio
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            Course Builder
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {list.length} course{list.length === 1 ? '' : 's'} • {publishedCount} published •{' '}
            {list.length - publishedCount} draft / review
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs inline-flex items-center gap-1"
          >
            <Plus className="w-4 h-4" /> Create Course
          </button>
          <Link
            to="/academy"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs"
          >
            Learner view
          </Link>
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

      {list.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center max-w-xl mx-auto space-y-3">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">No courses yet</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            Create your first course — add modules and lessons in the builder, then publish it to the
            Gurukul Academy catalog.
          </p>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
          >
            <Plus className="w-4 h-4" /> Create Course
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900">My Courses</h3>
            <span className="text-[11px] text-slate-400">
              Free courses enrol instantly • paid courses connect learner ↔ instructor
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Course</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Access</th>
                  <th className="py-3 px-3">Price</th>
                  <th className="py-3 px-3">Content</th>
                  <th className="py-3 px-3">Rating</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {list.map((c) => {
                  const id = strOf(c.id);
                  const status = strOf(c.status, 'draft') || 'draft';
                  const isPublished = status === 'published';
                  const modules = recArr(c.modules);
                  const lessonCount = modules.reduce((n, m) => n + recArr(m.lessons).length, 0);
                  const ratingCount = numOf(c.ratingCount);
                  const ratingSum = numOf(c.ratingSum);
                  const busy = busyId === id;
                  return (
                    <tr key={id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-5 font-bold text-slate-900">
                        {strOf(c.title)}
                        <span className="text-[10px] text-slate-400 block font-semibold capitalize">
                          {strOf(c.category) || 'General'} • updated {strOf(c.lastUpdatedAt).slice(0, 10) || '—'}
                        </span>
                        {status === 'rejected' && strOf(c.rejectedReason) && (
                          <span className="text-[10px] text-rose-500 block font-semibold">
                            Rejected: {strOf(c.rejectedReason)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                            STATUS_BADGE[status] ?? STATUS_BADGE.draft
                          }`}
                        >
                          {statusLabel(status)}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                            strOf(c.accessType) === 'paid'
                              ? 'bg-violet-50 text-violet-700 border-violet-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                          }`}
                        >
                          {strOf(c.accessType) === 'paid' ? 'Paid' : 'Free'}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-slate-800">
                        {numOf(c.priceRupees) === 0
                          ? 'Free'
                          : `${strOf(c.currency, 'INR') || 'INR'} ${numOf(c.priceRupees).toLocaleString('en-IN')}`}
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        <span className="inline-flex items-center gap-1">
                          <Layers className="w-3.5 h-3.5 text-slate-400" />
                          {modules.length} module{modules.length === 1 ? '' : 's'} • {lessonCount} lesson
                          {lessonCount === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-slate-700">
                        {ratingCount > 0 ? (
                          <span className="inline-flex items-center gap-1">
                            <Star className="w-3.5 h-3.5 text-amber-400" />
                            {(ratingSum / ratingCount).toFixed(1)} ({ratingCount})
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1.5">
                          {isPublished ? (
                            <>
                              <button
                                onClick={() => setStatus(id, 'unpublished', 'unpublished')}
                                disabled={busy}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[10px] disabled:opacity-50"
                              >
                                Unpublish
                              </button>
                              <button
                                onClick={() => setStatus(id, 'archived', 'archived')}
                                disabled={busy}
                                className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold text-[10px] disabled:opacity-50"
                              >
                                Archive
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => setStatus(id, 'published', 'published')}
                                disabled={busy}
                                className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] disabled:opacity-50"
                              >
                                Publish
                              </button>
                              {(status === 'draft' || status === 'rejected' || status === 'pendingReview') && (
                                <button
                                  onClick={() => setStatus(id, 'pendingReview', 'submitted for review')}
                                  disabled={busy}
                                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[10px] disabled:opacity-50"
                                >
                                  Submit for Review
                                </button>
                              )}
                            </>
                          )}
                          <Link
                            to={`/instructor/courses/${id}/edit`}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-[10px] inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" /> Edit
                          </Link>
                          <button
                            onClick={() => duplicate(id)}
                            disabled={busy}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                            title="Duplicate"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          {!isPublished && (
                            <button
                              onClick={() => remove(c)}
                              disabled={busy}
                              className="p-1.5 rounded-lg border border-slate-200 text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      <p className="text-[10px] text-slate-400">
        Publishing makes a course visible in the{' '}
        <Link to="/academy" className="font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-0.5">
          Academy catalog <ArrowRight className="w-3 h-3" />
        </Link>{' '}
        — the moderation queue reviews content independently. Unpublishing keeps enrolments and progress
        intact.
      </p>

      {/* Create-course modal */}
      <ModalSheet
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Course"
        description="Add lessons and publish from the course builder. Free courses enrol instantly; for paid courses learners pay you directly and you grant access manually."
        maxWidth="md"
      >
        <form onSubmit={createCourse} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Course title *</label>
            <input
              type="text"
              value={createForm.title}
              onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Tomato Protection Masterclass"
              minLength={3}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Crop / topic</label>
              <input
                type="text"
                value={createForm.category}
                onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Language</label>
              <select
                value={createForm.language}
                onChange={(e) => setCreateForm((f) => ({ ...f, language: e.target.value }))}
                className={`${inputCls} bg-white`}
              >
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Access</label>
              <select
                value={createForm.accessType}
                onChange={(e) => setCreateForm((f) => ({ ...f, accessType: e.target.value }))}
                className={`${inputCls} bg-white`}
              >
                <option value="free">Free — instant enrolment</option>
                <option value="paid">Paid — learner pays you directly</option>
              </select>
            </div>
            {createForm.accessType === 'paid' ? (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Listed price (INR) *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={createForm.priceRupees || ''}
                  onChange={(e) => setCreateForm((f) => ({ ...f, priceRupees: Number(e.target.value) }))}
                  className={inputCls}
                  required
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Price</label>
                <input
                  type="text"
                  value="Free (₹0)"
                  disabled
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 text-slate-400"
                />
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={creating || createForm.title.trim().length < 3 || (createForm.accessType === 'paid' && numOf(createForm.priceRupees) <= 0)}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md"
          >
            {creating ? 'Creating…' : 'Create & Open Builder'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default CourseBuilderHomePage;
