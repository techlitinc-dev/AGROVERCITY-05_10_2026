import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  BookOpen,
  Save,
  Plus,
  Pencil,
  Trash2,
  Upload,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  MessageCircle,
  Layers,
} from 'lucide-react';
import { courses, uploads, put, del, apiErrorMessage } from '../../lib/api';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatCurrency } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

// lib `courses.update/updateModule/removeModule/remove` post to routes that only
// accept PUT/DELETE — call the exported helpers directly (API gap, lib left as-is).
const putCourse = (courseId: string, updates: Record<string, unknown>): Promise<unknown> =>
  put<unknown>(`/courses/${courseId}`, updates);
const putModule = (courseId: string, moduleId: string, body: Record<string, unknown>): Promise<unknown> =>
  put<unknown>(`/courses/${courseId}/modules/${moduleId}`, body);
const delModule = (courseId: string, moduleId: string): Promise<unknown> =>
  del<unknown>(`/courses/${courseId}/modules/${moduleId}`);

interface LessonDraft {
  id: string;
  title: string;
  kind: string;
  durationMinutes: number;
}

const EMPTY_MODULE = { title: '', description: '', order: 1 };

export const CourseBuilderPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const courseId = id || '';

  const [course, setCourse] = useState<Record<string, unknown> | null>(null);
  const [questions, setQuestions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'details' | 'modules' | 'qa'>('details');

  // details form
  const [form, setForm] = useState({
    title: '',
    subtitle: '',
    description: '',
    category: 'General',
    level: 'beginner',
    language: 'hi',
    mode: 'hybrid',
    priceRupees: 0,
    thumbnailUrl: '',
    whatYouWillLearn: '',
    requirements: '',
  });

  // module modal
  const [modModal, setModModal] = useState(false);
  const [editingMod, setEditingMod] = useState<Record<string, unknown> | null>(null);
  const [modForm, setModForm] = useState(EMPTY_MODULE);
  const [lessons, setLessons] = useState<LessonDraft[]>([]);

  // Q&A
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [savingAnswer, setSavingAnswer] = useState('');

  // upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [c, q] = await Promise.all([
        courses.get(courseId),
        courses.questions(courseId).catch(() => []),
      ]);
      const rec = asRec(c);
      setCourse(rec);
      setQuestions(recArr(q));
      setForm({
        title: strOf(rec.title),
        subtitle: strOf(rec.subtitle),
        description: strOf(rec.description),
        category: strOf(rec.category, 'General') || 'General',
        level: strOf(rec.level, 'beginner') || 'beginner',
        language: strOf(rec.language, 'hi') || 'hi',
        mode: strOf(rec.mode, 'hybrid') || 'hybrid',
        priceRupees: numOf(rec.priceRupees),
        thumbnailUrl: strOf(rec.thumbnailUrl),
        whatYouWillLearn: recArr(rec.whatYouWillLearn).map((x) => strOf(x)).join('\n'),
        requirements: recArr(rec.requirements).map((x) => strOf(x)).join('\n'),
      });
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (courseId) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  const saveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = asRec(
        await putCourse(courseId, {
          title: form.title,
          subtitle: form.subtitle,
          description: form.description,
          category: form.category,
          level: form.level,
          language: form.language,
          mode: form.mode,
          priceRupees: Number(form.priceRupees),
          thumbnailUrl: form.thumbnailUrl || undefined,
          whatYouWillLearn: form.whatYouWillLearn.split('\n').map((s) => s.trim()).filter(Boolean),
          requirements: form.requirements.split('\n').map((s) => s.trim()).filter(Boolean),
        }),
      );
      setCourse(updated);
      setNotice('Course details saved.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = asRec(await uploads.upload(file, { folder: 'courses', purpose: 'thumbnail' }));
      const url = strOf(res.url ?? res.fileUrl ?? res.downloadUrl ?? res.path);
      if (!url) throw new Error('Upload succeeded but no URL was returned.');
      setForm((f) => ({ ...f, thumbnailUrl: url }));
      setNotice('Thumbnail uploaded — remember to save details.');
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const openAddModule = () => {
    setEditingMod(null);
    setModForm({ ...EMPTY_MODULE, order: recArr(course?.modules).length + 1 });
    setLessons([]);
    setModModal(true);
  };

  const openEditModule = (m: Record<string, unknown>) => {
    setEditingMod(m);
    setModForm({
      title: strOf(m.title),
      description: strOf(m.description),
      order: numOf(m.order, 1),
    });
    setLessons(
      recArr(m.lessons).map((l) => ({
        id: strOf(l.id) || `les_${Math.random().toString(36).slice(2, 8)}`,
        title: strOf(l.title),
        kind: strOf(l.kind, 'video') || 'video',
        durationMinutes: numOf(l.durationMinutes),
      })),
    );
    setModModal(true);
  };

  const saveModule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        id: editingMod ? strOf(editingMod.id) : `mod_${Math.random().toString(36).slice(2, 10)}`,
        title: modForm.title,
        description: modForm.description,
        order: Number(modForm.order),
        lessons: lessons.map((l, i) => ({
          id: l.id,
          title: l.title,
          kind: l.kind,
          durationMinutes: Number(l.durationMinutes) || 0,
          order: i + 1,
          isPreviewFree: i === 0,
        })),
      };
      if (editingMod) {
        await putModule(courseId, strOf(editingMod.id), payload);
      } else {
        await courses.addModule(courseId, payload);
      }
      setModModal(false);
      setNotice(`Module “${modForm.title}” saved.`);
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const removeModule = async (m: Record<string, unknown>) => {
    if (!window.confirm(`Delete module “${nameOf(m)}”?`)) return;
    setError(null);
    try {
      await delModule(courseId, strOf(m.id));
      setNotice('Module deleted.');
      await reload();
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  const answerQuestion = async (questionId: string) => {
    const body = answers[questionId]?.trim();
    if (!body) return;
    setSavingAnswer(questionId);
    setError(null);
    try {
      await courses.answerQuestion(courseId, questionId, { body });
      setNotice('Answer posted.');
      setAnswers((a) => ({ ...a, [questionId]: '' }));
      setQuestions(recArr(await courses.questions(courseId)));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSavingAnswer('');
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Loading course builder…</p>;

  const modules = recArr(course?.modules).slice().sort((a, b) => numOf(a.order) - numOf(b.order));
  const inputCls = 'w-full px-3 py-2 text-xs rounded-xl border border-slate-300';
  const labelCls = 'block text-xs font-bold text-slate-700 mb-1';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/instructor/home" className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-emerald-600 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Console
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-7 h-7 text-emerald-600" />
            Course Builder
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {strOf(course?.title)} • {numOf(course?.priceRupees) === 0 ? 'Free' : formatCurrency(numOf(course?.priceRupees))} •{' '}
            <span className="capitalize">{strOf(course?.status, 'draft')}</span>
          </p>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto no-scrollbar">
          {(
            [
              { id: 'details', label: 'Details & Media' },
              { id: 'modules', label: `Modules (${modules.length})` },
              { id: 'qa', label: `Q&A (${questions.length})` },
            ] as { id: 'details' | 'modules' | 'qa'; label: string }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                tab === t.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
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

      {tab === 'details' && (
        <form onSubmit={saveDetails} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-6 space-y-4 max-w-3xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Course Title *</label>
              <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={inputCls} required />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Subtitle</label>
              <input type="text" value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Category</label>
              <input type="text" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Level</label>
              <select value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} className={inputCls}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
                <option value="all_levels">All levels</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Language</label>
              <select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} className={inputCls}>
                <option value="hi">Hindi</option>
                <option value="mr">Marathi</option>
                <option value="en">English</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Mode</label>
              <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} className={inputCls}>
                <option value="hybrid">Hybrid</option>
                <option value="on-farm">On-farm</option>
                <option value="centre-based">Centre-based</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Price (₹, 0 = free)</label>
              <input type="number" min="0" step="1" value={form.priceRupees} onChange={(e) => setForm({ ...form, priceRupees: Number(e.target.value) })} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>What learners will gain (one per line)</label>
              <textarea value={form.whatYouWillLearn} onChange={(e) => setForm({ ...form, whatYouWillLearn: e.target.value })} rows={3} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Requirements (one per line)</label>
              <textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })} rows={2} className={inputCls} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Thumbnail</label>
              <div className="flex items-center gap-3">
                {form.thumbnailUrl && (
                  <img src={form.thumbnailUrl} alt="thumbnail" className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-bold text-xs inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5" /> {uploading ? 'Uploading…' : 'Upload Image'}
                </button>
                <input
                  type="text"
                  value={form.thumbnailUrl}
                  onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
                  placeholder="…or paste image URL"
                  className={`${inputCls} flex-1`}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Uploads go through POST /uploads (multipart) — remember to Save afterwards.</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Details'}
          </button>
        </form>
      )}

      {tab === 'modules' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" /> Course Modules
            </h3>
            <button
              onClick={openAddModule}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Module
            </button>
          </div>
          {modules.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
              No modules yet — structure the course into modules with lessons (video / podcast / pdf).
            </div>
          ) : (
            <div className="space-y-3">
              {modules.map((m) => (
                <div key={strOf(m.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">
                        <span className="text-slate-400">#{numOf(m.order)}</span> {nameOf(m)}
                      </h4>
                      {strOf(m.description) && <p className="text-[11px] text-slate-400 mt-0.5">{strOf(m.description)}</p>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditModule(m)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100" title="Edit">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => removeModule(m)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <ul className="mt-3 space-y-1">
                    {recArr(m.lessons).map((l) => (
                      <li key={strOf(l.id)} className="flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 rounded-lg px-3 py-1.5">
                        <span>{strOf(l.title)}</span>
                        <span className="capitalize">{strOf(l.kind)} • {numOf(l.durationMinutes)} min</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'qa' && (
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-emerald-600" /> Learner Questions
          </h3>
          {questions.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-8 text-center text-xs text-slate-400">
              No questions yet — learners can ask from the course page.
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map((q) => (
                <div key={strOf(q.id)} className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
                  <p className="text-xs font-bold text-slate-800">{strOf(q.body ?? q.question)}</p>
                  <p className="text-[10px] text-slate-400">
                    {strOf(q.askedBy ?? q.userName) || 'Learner'} • {recArr(q.answers).length} answer(s)
                  </p>
                  {recArr(q.answers).map((a) => (
                    <p key={strOf(a.id)} className="text-[11px] text-slate-600 bg-slate-50 rounded-xl p-3 border border-slate-100">
                      <span className="font-bold">Answer:</span> {strOf(a.body)}
                    </p>
                  ))}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={answers[strOf(q.id)] || ''}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [strOf(q.id)]: e.target.value }))}
                      placeholder="Write an answer…"
                      className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300"
                    />
                    <button
                      onClick={() => answerQuestion(strOf(q.id))}
                      disabled={savingAnswer === strOf(q.id) || !answers[strOf(q.id)]?.trim()}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs"
                    >
                      {savingAnswer === strOf(q.id) ? 'Posting…' : 'Answer'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Module modal */}
      <ModalSheet
        isOpen={modModal}
        onClose={() => setModModal(false)}
        title={editingMod ? 'Edit Module' : 'Add Module'}
        description="Modules hold ordered lessons (video, podcast, pdf, quiz)"
        maxWidth="2xl"
      >
        <form onSubmit={saveModule} className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className={labelCls}>Module Title *</label>
              <input type="text" value={modForm.title} onChange={(e) => setModForm({ ...modForm, title: e.target.value })} className={inputCls} required />
            </div>
            <div>
              <label className={labelCls}>Order</label>
              <input type="number" min="1" value={modForm.order} onChange={(e) => setModForm({ ...modForm, order: Number(e.target.value) })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Description</label>
            <input type="text" value={modForm.description} onChange={(e) => setModForm({ ...modForm, description: e.target.value })} className={inputCls} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Lessons</label>
              <button
                type="button"
                onClick={() =>
                  setLessons([...lessons, { id: `les_${Math.random().toString(36).slice(2, 8)}`, title: '', kind: 'video', durationMinutes: 10 }])
                }
                className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:text-emerald-800"
              >
                <Plus className="w-3 h-3" /> Add lesson
              </button>
            </div>
            {lessons.map((l, i) => (
              <div key={l.id} className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="text"
                  value={l.title}
                  onChange={(e) => {
                    const next = [...lessons];
                    next[i] = { ...l, title: e.target.value };
                    setLessons(next);
                  }}
                  placeholder="Lesson title"
                  className={`${inputCls} col-span-6`}
                />
                <select
                  value={l.kind}
                  onChange={(e) => {
                    const next = [...lessons];
                    next[i] = { ...l, kind: e.target.value };
                    setLessons(next);
                  }}
                  className={`${inputCls} col-span-3 bg-white`}
                >
                  <option value="video">Video</option>
                  <option value="podcast">Podcast</option>
                  <option value="pdf">PDF</option>
                  <option value="quiz">Quiz</option>
                  <option value="live">Live session</option>
                </select>
                <input
                  type="number"
                  min="0"
                  value={l.durationMinutes}
                  onChange={(e) => {
                    const next = [...lessons];
                    next[i] = { ...l, durationMinutes: Number(e.target.value) };
                    setLessons(next);
                  }}
                  placeholder="Min"
                  className={`${inputCls} col-span-2`}
                />
                <button
                  type="button"
                  onClick={() => setLessons(lessons.filter((_, j) => j !== i))}
                  className="col-span-1 p-1.5 rounded-lg text-slate-300 hover:text-rose-500 justify-self-center"
                  title="Remove lesson"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {saving ? 'Saving…' : editingMod ? 'Save Module' : 'Add Module'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default CourseBuilderPage;
