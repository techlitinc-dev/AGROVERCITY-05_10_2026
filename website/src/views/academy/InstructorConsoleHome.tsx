import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  GraduationCap,
  BookOpen,
  Users,
  IndianRupee,
  Star,
  ArrowRight,
  AlertCircle,
  Layers,
  FileText,
  Award,
  Mail,
} from 'lucide-react';
import { teachers, apiErrorMessage } from '../../lib/api';
import { StatCard } from '../../components/common/StatCard';
import { formatCurrency } from '../../lib/utils';
import { asRec, boolOf, nameOf, numOf, recArr, strOf } from './helpers';

const CONSOLE_LINKS = [
  { to: '/instructor/enquiries', label: 'Enquiries Desk', desc: 'Quote, counter & accept fee enquiries', icon: Mail },
  { to: '/instructor/students', label: 'Students Roster', desc: 'Per-course rosters & announcements', icon: Users },
  { to: '/instructor/batches', label: 'Batches & Sessions', desc: 'On-farm batches, sessions, attendance', icon: Layers },
  { to: '/instructor/assignments', label: 'Assignments', desc: 'Review submissions & grade', icon: FileText },
  { to: '/instructor/certificates', label: 'Certificates', desc: 'Issue, download & revoke', icon: Award },
  { to: '/instructor/earnings', label: 'Earnings', desc: 'Fees, commission & settlements', icon: IndianRupee },
];

export const InstructorConsoleHome: React.FC = () => {
  const [home, setHome] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  const published = recArr(home.publishedCourses ?? home.allCourses).filter((c) => strOf(c.status) === 'published');
  const draftCount = recArr(home.allCourses).filter((c) => strOf(c.status) !== 'published').length;
  const totalStudents = recArr(home.allCourses).reduce((acc, c) => acc + numOf(c.enrolledStudents ?? c.studentsCount), 0);
  const totalRevenue = recArr(home.allCourses).reduce((acc, c) => acc + numOf(c.revenueRupees ?? c.totalRevenueRupees), 0);
  const avgRating = (() => {
    const rated = published.filter((c) => numOf(c.ratingCount) > 0);
    if (!rated.length) return 0;
    return rated.reduce((acc, c) => acc + numOf(c.ratingAverage), 0) / rated.length;
  })();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <GraduationCap className="w-7 h-7 text-emerald-600" />
            {nameOf(profile, 'Instructor Studio')}
            {boolOf(profile.isVerified) && (
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">Verified</span>
            )}
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            {strOf(profile.headline) || strOf(profile.qualification) || 'Gurukul instructor workspace'}
          </p>
        </div>
        <Link
          to="/academy"
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-xs self-start sm:self-auto"
        >
          Learner view
        </Link>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Published Courses" value={published.length} subtitle={`${draftCount} in draft/review`} icon={BookOpen} colorScheme="blue" />
        <StatCard title="Total Students" value={totalStudents.toLocaleString('en-IN')} icon={Users} colorScheme="purple" />
        <StatCard title="Course Revenue" value={formatCurrency(totalRevenue)} icon={IndianRupee} colorScheme="green" />
        <StatCard title="Avg Rating" value={avgRating > 0 ? avgRating.toFixed(1) : '—'} icon={Star} colorScheme="amber" />
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h3 className="font-bold text-sm text-slate-900">My courses</h3>
        </div>
        {recArr(home.allCourses).length === 0 ? (
          <p className="p-6 text-xs text-slate-400">
            No courses yet — create your first course from the Academy studio.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase text-[10px] tracking-wider border-b border-slate-100">
                  <th className="py-3 px-5">Course</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Students</th>
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
                    <td className="py-3 px-3 text-slate-700">{numOf(c.enrolledStudents ?? c.studentsCount)}</td>
                    <td className="py-3 px-3 text-slate-700">
                      {numOf(c.ratingCount) > 0 ? `${numOf(c.ratingAverage).toFixed(1)} (${numOf(c.ratingCount)})` : '—'}
                    </td>
                    <td className="py-3 px-3 font-bold text-slate-800">
                      {numOf(c.priceRupees) === 0 ? 'Free' : formatCurrency(numOf(c.priceRupees))}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <Link
                        to={`/instructor/courses/${strOf(c.id)}/edit`}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
                      >
                        Open Builder <ArrowRight className="w-3 h-3" />
                      </Link>
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
    </div>
  );
};

export default InstructorConsoleHome;
