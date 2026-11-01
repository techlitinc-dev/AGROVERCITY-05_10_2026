import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Users,
  Star,
  ArrowRight,
  AlertCircle,
  Layers,
  FileText,
  Award,
  Mail,
  Inbox,
  ShieldCheck,
  HelpCircle,
  CalendarClock,
  Plus,
} from 'lucide-react';
import { courses, teachers, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { ModalSheet } from '../../components/common/ModalSheet';
import { asRec, boolOf, nameOf, numOf, recArr, strOf } from './helpers';
import { VerificationBadges } from './VerificationBadges';

const CONSOLE_LINKS = [
  { to: '/instructor/enrollment-requests', label: 'Enrollment Requests', desc: 'Paid-course contact requests & access grants', icon: Inbox },
  { to: '/instructor/students', label: 'Course Learners', desc: 'Rosters, progress, revoke & re-grant', icon: Users },
  { to: '/instructor/enquiries', label: 'Questions Desk', desc: 'Course enquiries & fee quotes', icon: Mail },
  { to: '/instructor/batches', label: 'Live Sessions', desc: 'Batches, sessions, attendance', icon: Layers },
  { to: '/instructor/assignments', label: 'Assignments', desc: 'Review submissions & grade', icon: FileText },
  { to: '/instructor/certificates', label: 'Certificates', desc: 'Issue, download & revoke', icon: Award },
];

export const InstructorConsoleHome: React.FC = () => {
  const navigate = useNavigate();
  const [home, setHome] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: '',
    category: 'General',
    accessType: 'free',
    priceRupees: 0,
    language: 'hi',
  });

  useEffect(() => {
    (async () => {
      try {
        setHome(asRec(await teachers.home()));
      } catch (e) {
        setError(apiErrorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
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

  const duplicate = async (courseId: string) => {
    setError(null);
    setNotice(null);
    try {
      const copy = asRec(await courses.duplicate(courseId));
      setNotice(`Course duplicated as “${strOf(copy.title)}” (draft).`);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  };

  if (loading) return <p className="text-xs text-slate-400">Loading instructor console…</p>;

  if (!home) {
    return (
      <div className="space-y-6">
        <div className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-emerald-600" />
            Gurukul Instructor Console
          </h1>
        </div>
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-10 text-center max-w-xl mx-auto space-y-3">
          <GraduationCap className="w-12 h-12 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Instructor profile required</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            This console is only available to users with an instructor persona. Activate the instructor
            profile from your account settings, then return here.
          </p>
          {error && (
            <p className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700">
              {error}
            </p>
          )}
          <Link
            to="/academy"
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs"
          >
            Browse Academy <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  }

  const profile = asRec(home.profile);
  const verification = asRec(home.verification);
  const stats = asRec(home.stats);
  const published = recArr(home.publishedCourses ?? home.allCourses).filter((c) => strOf(c.status) === 'published');
  const draftCount = recArr(home.allCourses).filter((c) => strOf(c.status) !== 'published').length;
  const avgRating = (() => {
    const rated = published.filter((c) => numOf(c.ratingCount) > 0);
    if (!rated.length) return 0;
    return rated.reduce((acc, c) => acc + numOf(c.ratingAverage), 0) / rated.length;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2 flex-wrap">
            <GraduationCap className="w-7 h-7 text-emerald-600" />
            {nameOf(profile, 'Instructor Studio')}
            <VerificationBadges identity={verification.identityVerified} expertise={verification.expertiseVerified} />
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {strOf(profile.headline) || strOf(profile.qualification) || 'Gurukul instructor workspace'}
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
          <ShieldCheck className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard title="Published Courses" value={numOf(stats.publishedCourses)} subtitle={`${numOf(stats.totalCourses)} total • ${draftCount} draft/review`} icon={BookOpen} colorScheme="blue" />
        <StatCard title="Total Enrolments" value={numOf(stats.totalEnrolments, numOf(stats.totalStudents)).toLocaleString('en-IN')} subtitle={`${numOf(stats.completedStudents)} completed`} icon={Users} colorScheme="purple" />
        <StatCard title="Access Requests" value={numOf(stats.newContactRequests)} subtitle="awaiting your grant" icon={Inbox} colorScheme="amber" />
        <StatCard title="Open Questions" value={numOf(stats.unansweredQuestions)} subtitle="unanswered" icon={HelpCircle} colorScheme="slate" />
        <StatCard title="Live Sessions" value={numOf(stats.upcomingSessions)} subtitle="upcoming" icon={CalendarClock} colorScheme="green" />
        <StatCard title="Avg Rating" value={avgRating > 0 ? avgRating.toFixed(1) : '—'} icon={Star} colorScheme="amber" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-sm text-slate-900">My Courses</h3>
          <span className="text-[11px] text-slate-400">Free courses enrol instantly • paid courses connect learner ↔ instructor</span>
        </div>
        {recArr(home.allCourses).length === 0 ? (
          <p className="p-6 text-xs text-slate-400">
            No courses yet — create your first course with the button above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Course</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Access</th>
                  <th className="py-3 px-3">Rating</th>
                  <th className="py-3 px-3">Price</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recArr(home.allCourses).map((c) => (
                  <tr key={strOf(c.id)} className="hover:bg-slate-50/60">
                    <td className="py-3 px-5 font-bold text-slate-900">
                      {strOf(c.title)}
                      <span className="text-[10px] text-slate-400 block font-semibold capitalize">{strOf(c.kind) || 'video course'}</span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${
                          strOf(c.status) === 'published'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}
                      >
                        {strOf(c.status, 'draft')}
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
                    <td className="py-3 px-3 text-slate-700">
                      {numOf(c.ratingCount) > 0 ? `${numOf(c.ratingAverage).toFixed(1)} (${numOf(c.ratingCount)})` : '—'}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {numOf(c.priceRupees) === 0 ? 'Free' : `${strOf(c.currency, 'INR') || 'INR'} ${numOf(c.priceRupees).toLocaleString('en-IN')}`}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="inline-flex gap-1.5">
                        <button
                          onClick={() => duplicate(strOf(c.id))}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 font-bold text-[10px]"
                        >
                          Duplicate
                        </button>
                        <Link
                          to={`/instructor/courses/${strOf(c.id)}/edit`}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                        >
                          Open Builder <ArrowRight className="w-3 h-3" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div>
        <h3 className="font-bold text-sm text-slate-900 mb-3">Console Modules</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {CONSOLE_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 hover:shadow-md hover:border-emerald-200 transition-all group"
            >
              <div className="flex items-center justify-between">
                <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <l.icon className="w-5 h-5" />
                </div>
                <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-emerald-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <h4 className="mt-3 font-bold text-sm text-slate-900">{l.label}</h4>
              <p className="text-xs text-slate-500 mt-0.5">{l.desc}</p>
            </Link>
          ))}
        </div>
      </div>

      {/* Profile & expertise verification */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Profile & Expertise Verification</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Identity Verified = unified KYC approved. Expertise Verified = your qualifications or
              experience documents were actually reviewed.
            </p>
          </div>
          <VerificationBadges identity={verification.identityVerified} expertise={verification.expertiseVerified} />
        </div>
        {recArr(profile.letters).length > 0 && (
          <ul className="space-y-1.5">
            {recArr(profile.letters).map((letter, i) => (
              <li
                key={i}
                className="flex items-center justify-between border border-slate-100 rounded-2xl px-3 py-2 text-[11px]"
              >
                <span className="font-bold text-slate-700 capitalize">{strOf(letter.type).replace(/_/g, ' ')}</span>
                <span
                  className={`px-2 py-0.5 rounded-full border font-bold text-[10px] capitalize ${
                    strOf(letter.status) === 'verified'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {strOf(letter.status) === 'verified'
                    ? `Verified${strOf(letter.verifiedAt) ? ` ${strOf(letter.verifiedAt).slice(0, 10)}` : ''}`
                    : 'Under review'}
                </span>
              </li>
            ))}
          </ul>
        )}
        {!boolOf(verification.expertiseVerified) && (
          <p className="text-[10px] text-slate-400">
            Upload qualification certificates and experience letters from your instructor profile to
            earn the Expertise Verified badge after admin review.
          </p>
        )}
      </div>

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
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
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
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Language</label>
              <select
                value={createForm.language}
                onChange={(e) => setCreateForm((f) => ({ ...f, language: e.target.value }))}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
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
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 bg-white"
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
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
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

export default InstructorConsoleHome;
