import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, GraduationCap, MessagesSquare } from 'lucide-react';
import { teachers } from '../../lib/api';
import { formatCurrency, formatDateTime } from '../../lib/utils';
import { asRec, nameOf, numOf, recArr, strOf } from './helpers';

const QUICK_LINKS = [
  { to: '/instructor', label: 'Academic Studio', icon: GraduationCap },
  { to: '/instructor/courses', label: 'Course Builder', icon: BookOpen },
  { to: '/instructor/enquiries', label: 'Batches & Questions', icon: MessagesSquare },
];

const ACTIONABLE_ENQUIRY = ['open', 'quoted', 'countered'];

interface LoadState {
  loading: boolean;
  error: string | null;
}

/**
 * Gurukul (instructor) dashboard — one-screen overview of the teaching
 * business: courses, students, batches, open enquiries and pending enrolment
 * requests. Read-only; every card links to the console page that manages it.
 * Sections fail independently so one bad API never blanks the page.
 */
export const InstructorDashboard: React.FC = () => {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [courses, setCourses] = useState<Record<string, unknown>[]>([]);
  const [students, setStudents] = useState<Record<string, unknown>[]>([]);
  const [batches, setBatches] = useState<Record<string, unknown>[]>([]);
  const [enquiries, setEnquiries] = useState<Record<string, unknown>[]>([]);
  const [assignments, setAssignments] = useState<Record<string, unknown>[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, unknown> | null>(null);
  const [requests, setRequests] = useState<{ rows: Record<string, unknown>[]; pending: number }>({
    rows: [],
    pending: 0,
  });
  const [state, setState] = useState<LoadState>({ loading: true, error: null });

  const load = useCallback(async () => {
    setState({ loading: true, error: null });
    try {
      const me = asRec(await teachers.me());
      setProfile(me);
      const [c, s, b, e, r, a, g] = await Promise.all([
        teachers.myCourses().catch(() => []),
        teachers.allStudents().catch(() => []),
        teachers.batches().catch(() => []),
        teachers.enquiries().catch(() => []),
        teachers.enrollmentRequests().catch(() => asRec(null)),
        teachers.analytics().catch(() => null),
        teachers.assignments().catch(() => []),
      ]);
      setCourses(recArr(c));
      setStudents(recArr(s));
      setBatches(recArr(b));
      setEnquiries(recArr(e));
      const payload: unknown = r;
      // readOne unwraps `{data: [...]}` to the bare array — handle both shapes.
      const rows = Array.isArray(payload) ? recArr(payload) : recArr(asRec(payload).data);
      const pending = Array.isArray(payload)
        ? rows.filter((x) => strOf(x.requestStatus) === 'contacted' && strOf(x.accessStatus, 'none') === 'none').length
        : numOf(asRec(payload).pendingCount);
      setRequests({ rows, pending });
      setAnalytics(asRec(a));
      setAssignments(recArr(g));
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : 'Could not load the dashboard' });
      return;
    }
    setState({ loading: false, error: null });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEnquiries = enquiries.filter((en) => ACTIONABLE_ENQUIRY.includes(strOf(en.status, 'open')));
  const waitingRequests = requests.rows.filter(
    (r) => strOf(r.accessStatus, 'none') === 'none' && strOf(r.requestStatus) !== 'dismissed',
  );

  // Analytics cards render only for fields the entitlement exposes (the basic
  // subset returns just coursesCount/studentsCount).
  const earnings = numOf(analytics?.totalEarningsRupees, NaN);
  const completionRate = numOf(analytics?.completionRatePercent, NaN);
  const averageRating = numOf(analytics?.averageRating, NaN);
  const pendingReview = numOf(analytics?.pendingReviewCourses, NaN);
  const analyticsCards = [
    Number.isFinite(earnings) ? { label: 'Earnings', value: formatCurrency(earnings) } : null,
    Number.isFinite(completionRate) ? { label: 'Completion rate', value: `${completionRate}%` } : null,
    Number.isFinite(averageRating) ? { label: 'Avg rating', value: String(averageRating) } : null,
    Number.isFinite(pendingReview) ? { label: 'Pending review', value: String(pendingReview) } : null,
  ].filter((c): c is { label: string; value: string } => c !== null);

  // Next upcoming sessions across all batches.
  const nowMs = Date.now();
  const upcomingSessions = batches
    .flatMap((b) => recArr(b.sessions).map((s) => ({ batch: nameOf(b, strOf(b.batchName, 'Batch')), session: s })))
    .map((x) => ({ ...x, at: new Date(strOf(x.session.startsAt)).getTime() }))
    .filter((x) => Number.isFinite(x.at) && x.at >= nowMs)
    .sort((a, b) => a.at - b.at)
    .slice(0, 4);

  // Grading queue: submitted assignments, newest first.
  const gradingQueue = assignments
    .filter((a) => strOf(a.status) === 'submitted')
    .slice()
    .sort((a, b) => strOf(b.submittedAt).localeCompare(strOf(a.submittedAt)))
    .slice(0, 5);

  const loaded = !state.loading || courses.length + students.length + batches.length + enquiries.length > 0;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <header>
        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-emerald-600" />
          {nameOf(profile, 'Gurukul Instructor')}
        </h1>
        <p className="text-sm text-slate-500">Gurukul Dashboard — your teaching at a glance.</p>
      </header>

      {state.error && (
        <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {state.error}
        </div>
      )}

      {!loaded ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
          Loading your dashboard…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard label="My courses" value={String(courses.length)} />
            <StatCard label="Students" value={String(students.length)} />
            <StatCard label="Active batches" value={String(batches.length)} />
            <StatCard label="Open enquiries" value={String(openEnquiries.length)} accent />
          </div>

          {analyticsCards.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {analyticsCards.map((c) => (
                <StatCard key={c.label} label={c.label} value={c.value} />
              ))}
            </div>
          )}

          <SectionCard
            title="Needs attention"
            action={
              waitingRequests.length > 0 ? (
                <Link to="/instructor/enrollment-requests" className="text-xs font-semibold text-emerald-700 hover:underline">
                  Review requests →
                </Link>
              ) : undefined
            }
          >
            {waitingRequests.length === 0 ? (
              <p className="text-xs text-slate-500">
                {requests.pending > 0
                  ? `${requests.pending} enrolment request(s) pending review.`
                  : 'No pending enrolment requests — all clear.'}
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {waitingRequests.slice(0, 5).map((r) => (
                  <li key={strOf(r.requestId) || nameOf(r)} className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-700 truncate">
                      {nameOf(r, strOf(r.learnerName, 'Learner'))}
                      <span className="text-slate-400"> · {strOf(r.courseTitle) || 'Course'}</span>
                    </span>
                    <span className="text-slate-500 shrink-0">{strOf(r.requestedAt)?.slice(0, 10) || '—'}</span>
                  </li>
                ))}
                {waitingRequests.length > 5 && (
                  <li className="py-1.5 text-xs text-slate-400">+{waitingRequests.length - 5} more in Enrolment Requests</li>
                )}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Upcoming sessions"
            action={
              <Link to="/instructor/batches" className="text-xs font-semibold text-emerald-700 hover:underline">
                Open batches →
              </Link>
            }
          >
            {upcomingSessions.length === 0 ? (
              <p className="text-xs text-slate-500">No upcoming sessions scheduled.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {upcomingSessions.map((x) => (
                  <li key={strOf(x.session.id) || `${x.batch}-${x.at}`} className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-700 truncate">
                      {strOf(x.session.title, 'Session')}
                      <span className="text-slate-400"> · {x.batch}</span>
                    </span>
                    <span className="text-slate-500 shrink-0">{formatDateTime(strOf(x.session.startsAt))}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Latest enquiries"
            action={
              <Link to="/instructor/enquiries" className="text-xs font-semibold text-emerald-700 hover:underline">
                Open Batches & Questions →
              </Link>
            }
          >
            {enquiries.length === 0 ? (
              <p className="text-xs text-slate-500">
                No enquiries yet — they appear when a farmer asks about one of your courses.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {enquiries.slice(0, 4).map((en) => (
                  <li key={strOf(en.id)} className="py-1.5 flex justify-between gap-2">
                    <span className="text-slate-700 truncate">
                      {nameOf(en, strOf(en.farmerName, 'Farmer enquiry'))}
                      <span className="text-slate-400"> · {strOf(en.courseTitle) || 'Course enquiry'}</span>
                    </span>
                    <span className="text-slate-500 shrink-0 capitalize">{strOf(en.status, 'open')}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title="Awaiting grade"
            action={
              gradingQueue.length > 0 ? (
                <Link to="/instructor/assignments" className="text-xs font-semibold text-emerald-700 hover:underline">
                  Grade now →
                </Link>
              ) : undefined
            }
          >
            {gradingQueue.length === 0 ? (
              <p className="text-xs text-slate-500">No assignments waiting for a grade.</p>
            ) : (
              <ul className="divide-y divide-slate-100 text-sm">
                {gradingQueue.map((a) => {
                  const suggestion = asRec(a.aiSuggestion);
                  return (
                    <li key={strOf(a.id)} className="py-1.5 flex justify-between gap-2">
                      <span className="text-slate-700 truncate">
                        {strOf(a.title, 'Assignment')}
                        <span className="text-slate-400">
                          {' '}· {nameOf(a, strOf(a.studentName, 'Student'))} · {strOf(a.courseTitle) || 'Course'}
                        </span>
                      </span>
                      <span className="text-slate-500 shrink-0">
                        {strOf(suggestion.suggestedGrade)
                          ? `AI: ${strOf(suggestion.suggestedGrade)}`
                          : formatDateTime(strOf(a.submittedAt))}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Go to">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {QUICK_LINKS.map((ql) => (
                <Link
                  key={ql.to}
                  to={ql.to}
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700 transition-colors"
                >
                  <ql.icon className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="truncate">{ql.label}</span>
                </Link>
              ))}
            </div>
          </SectionCard>
        </>
      )}

      {state.error && (
        <button
          onClick={load}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Retry
        </button>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; accent?: boolean }> = ({ label, value, accent }) => (
  <div
    className={`rounded-2xl border p-3 ${
      accent ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200'
    }`}
  >
    <div className={`text-[11px] uppercase tracking-wide ${accent ? 'text-emerald-100' : 'text-slate-500'}`}>
      {label}
    </div>
    <div className="text-lg font-semibold">{value}</div>
  </div>
);

const SectionCard: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  action,
  children,
}) => (
  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 sm:p-5">
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

