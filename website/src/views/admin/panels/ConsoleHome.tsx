import React, { useState } from 'react';
import { Gauge, Cpu, Sparkles, Activity } from 'lucide-react';
import { admin, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  TextInput,
  Banner,
  str,
  useAsync,
  asRow,
  asRows,
  type Row,
} from './shared';

/**
 * Console home — the superadmin "morning chai" surface (userflow.md §15 Journey 1).
 * Platform overview + analytics summary, overnight cron hygiene, AI stack
 * heartbeat and the copilot briefing, all read live from the admin namespace.
 */
export const ConsoleHome: React.FC = () => {
  const overview = useAsync(() => admin.platform.overview().catch(() => null), []);
  const summary = useAsync(() => admin.platform.analyticsSummary().catch(() => null), []);

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <PanelShell
          title="Platform Overview"
          subtitle="Unified console view (GET /admin/overview)."
          icon={Gauge}
          loading={overview.loading}
          onRefresh={overview.reload}
        >
          {overview.error ? <Banner kind="error">{overview.error}</Banner> : <KV record={asRow(overview.data)} />}
        </PanelShell>
        <PanelShell
          title="Analytics Summary"
          subtitle="KPI fan-out — users, GMV, leases, pending queues (GET /admin/analytics/summary)."
          icon={Activity}
          loading={summary.loading}
          onRefresh={summary.reload}
        >
          {summary.error ? <Banner kind="error">{summary.error}</Banner> : <KV record={asRow(summary.data)} />}
        </PanelShell>
      </div>
      <CronLogsCard />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <AiHealthCard />
        <CopilotBriefingCard />
      </div>
    </>
  );
};

const CronLogsCard: React.FC = () => {
  const cron = useAsync(() => admin.platform.cronLogs(), []);
  const rows = asRows(cron.data);

  const failures = rows.filter((r) => {
    const s = str(r, 'status', 'result', 'state').toLowerCase();
    return s.includes('fail') || s.includes('error');
  }).length;

  return (
    <PanelShell
      title="Overnight Cron Hygiene"
      subtitle={`Settlement batch, escrow releases, mandi sync — every cron_job_logs row (${failures} failure${failures === 1 ? '' : 's'} in view).`}
      icon={Cpu}
      loading={cron.loading}
      error={cron.error}
      onRefresh={cron.reload}
    >
      <DataTable
        rows={rows}
        empty="No cron runs logged."
        columns={[
          {
            header: 'Job',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'job', 'name', 'jobName', 'id')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'schedule', 'cron')}</p>
              </div>
            ),
          },
          {
            header: 'Last run',
            cell: (r) => <span className="text-slate-500">{str(r, 'lastRun', 'ranAt', 'startedAt', 'createdAt')}</span>,
          },
          {
            header: 'Result',
            cell: (r) => (
              <div>
                <span
                  className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${
                    ['failed', 'error'].includes(str(r, 'status', 'result', 'state').toLowerCase())
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {str(r, 'status', 'result', 'state')}
                </span>
                <p className="text-[10px] text-slate-400 mt-0.5">{str(r, 'detail', 'message', 'error')}</p>
              </div>
            ),
          },
        ]}
      />
    </PanelShell>
  );
};

const AiHealthCard: React.FC = () => {
  const ai = useAsync(() => admin.platform.aiHealth().catch(() => null), []);
  return (
    <PanelShell
      title="AI Stack Heartbeat"
      subtitle="OpenRouter / Sarvam / vision gateway latency and availability (GET /admin/ai/health)."
      icon={Cpu}
      loading={ai.loading}
      onRefresh={ai.reload}
    >
      {ai.error ? <Banner kind="error">{ai.error}</Banner> : <KV record={asRow(ai.data)} />}
    </PanelShell>
  );
};

const CopilotBriefingCard: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const briefing = useAsync(() => admin.copilot.briefing().catch(() => null), []);

  const ask = async () => {
    setBusy(true);
    setErr(null);
    try {
      setAnswer(
        await admin.copilot.query({ question: question.trim() }, `Console-home copilot query: ${question.trim().slice(0, 60)}`)
      );
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PanelShell
        title="Copilot Morning Briefing"
        subtitle="Auto-generated anomaly summary (GET /admin/copilot/briefing)."
        icon={Sparkles}
        loading={briefing.loading}
        onRefresh={briefing.reload}
      >
        {briefing.error ? <Banner kind="error">{briefing.error}</Banner> : <KV record={asRow(briefing.data)} />}
      </PanelShell>
      <PanelShell
        title="Ask the platform copilot"
        subtitle="Natural-language query over platform data (POST /admin/copilot/query — audited)."
        icon={Sparkles}
      >
        <div className="flex gap-2">
          <TextInput
            value={question}
            onChange={setQuestion}
            placeholder="e.g. Which settlement lines were held last night?"
            className="flex-1"
          />
          <Btn tone="primary" busy={busy} disabled={question.trim().length < 3} onClick={ask}>
            Ask
          </Btn>
        </div>
        {err && <Banner kind="error">{err}</Banner>}
        {answer !== null && <KV record={asRow(answer) ?? { result: answer }} />}
      </PanelShell>
    </>
  );
};
