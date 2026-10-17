import React from 'react';
import { GraduationCap, Star, BarChart3 } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  idOf,
  str,
  num,
  pct,
  money,
  useAsync,
  useReasonModal,
  asRow,
  type Row,
} from './shared';

/**
 * SOP-27 — Gurukul Instructor Oversight.
 * Course review queue (approve / request changes), featuring and platform report.
 */
export const CoursesPanel: React.FC = () => {
  const { request, modal } = useReasonModal();

  const queue = useAsync(() => admin.courses.queue(), []);
  const report = useAsync(() => admin.courses.report().catch(() => null), []);

  return (
    <>
      <PanelShell
        title="SOP-27: Course Review Queue"
        subtitle="Instructor-submitted courses pending content + quality review before going live."
        icon={GraduationCap}
        loading={queue.loading}
        error={queue.error}
        onRefresh={queue.reload}
      >
        <DataTable
          rows={(queue.data ?? []) as Row[]}
          empty="No courses awaiting review."
          columns={[
            {
              header: 'Course',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'title', 'name', 'courseName')}</p>
                  <p className="text-[10px] text-slate-400">by {str(r, 'instructorName', 'instructor', 'teacherName')}</p>
                </div>
              ),
            },
            {
              header: 'Category / Lang',
              cell: (r) => (
                <span className="text-slate-600">
                  {str(r, 'category', 'subject')} • {str(r, 'language', 'lang')}
                </span>
              ),
            },
            { header: 'Price', cell: (r) => <span className="font-bold">{money(num(r, 'price', 'fee'))}</span> },
            { header: 'Lessons', cell: (r) => <span>{num(r, 'lessonCount', 'lessons', 'modules') ?? '—'}</span> },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Btn
                    tone="danger"
                    onClick={() =>
                      request({
                        title: `Request changes — ${str(r, 'title', 'name')}`,
                        confirmLabel: 'Send back',
                        tone: 'danger',
                        action: (reason) => admin.courses.review(idOf(r), { decision: 'rejected', reason }, reason),
                        onDone: queue.reload,
                      })
                    }
                  >
                    Send back
                  </Btn>
                  <Btn
                    tone="primary"
                    onClick={() =>
                      request({
                        title: `Approve course ${str(r, 'title', 'name')}`,
                        defaultReason: 'Content + pedagogy review passed',
                        confirmLabel: 'Approve & publish',
                        action: (reason) => admin.courses.review(idOf(r), { decision: 'approved', reason }, reason),
                        onDone: queue.reload,
                      })
                    }
                  >
                    Approve
                  </Btn>
                  <Btn
                    onClick={() =>
                      request({
                        title: `Feature course ${str(r, 'title', 'name')}`,
                        defaultReason: 'Promoted on Gurukul homepage',
                        confirmLabel: 'Feature',
                        action: (reason) => admin.courses.feature(idOf(r), reason),
                        onDone: queue.reload,
                      })
                    }
                  >
                    <Star className="w-3.5 h-3.5" />
                  </Btn>
                </div>
              ),
            },
          ]}
        />
      </PanelShell>

      <PanelShell
        title="SOP-27: Gurukul Platform Report"
        subtitle="Enrollment, completion and revenue across the academy (GET /admin/courses/report)."
        icon={BarChart3}
        loading={report.loading}
        onRefresh={report.reload}
      >
        {report.error ? (
          <p className="text-xs text-slate-400">{report.error}</p>
        ) : (
          <div className="space-y-4">
            {asRow(report.data) && <KV record={asRow(report.data)} />}
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Completion" value={pct(str(asRow(report.data), 'completionRate', 'avgCompletion'))} />
              <MiniStat label="Active learners" value={String(num(asRow(report.data), 'activeLearners', 'enrollments') ?? '—')} />
              <MiniStat label="Revenue" value={money(num(asRow(report.data), 'revenue', 'totalRevenue'))} />
            </div>
          </div>
        )}
      </PanelShell>
      {modal}
    </>
  );
};

const MiniStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 text-center">
    <p className="text-lg font-extrabold text-slate-900">{value}</p>
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
  </div>
);
