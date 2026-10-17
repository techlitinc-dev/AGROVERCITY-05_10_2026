import React, { useState } from 'react';
import { Settings2, Radio, Bell, Flag, Inbox, Cpu, Sparkles } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage } from '../../../lib/api';
import { ApprovalsInboxPanel } from './ApprovalsInbox';
import { AuditViewerPanel } from './AuditViewer';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Tabs,
  Field,
  TextInput,
  TextArea,
  Select,
  Banner,
  JsonConfigCard,
  idOf,
  str,
  useAsync,
  useReasonModal,
  asRow,
  type Row,
} from './shared';

/**
 * SOP-26 — System Config & Platform Broadcasts.
 * App-config, feature flags, broadcast (real POST), notification templates,
 * reports moderation queue, plus shortcuts to the shared approvals inbox,
 * audit viewer, cron logs, AI health and copilot briefing (also mounted as
 * sidebar entries / console home).
 */
export const PlatformPanel: React.FC = () => {
  const [tab, setTab] = useState('config');

  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'config', label: 'App config' },
          { id: 'flags', label: 'Feature flags' },
          { id: 'broadcast', label: 'Broadcast' },
          { id: 'templates', label: 'Templates' },
          { id: 'reports', label: 'Reports queue' },
          { id: 'audit', label: 'Audit viewer' },
          { id: 'approvals', label: 'Approvals inbox' },
          { id: 'ops', label: 'Cron & AI health' },
          { id: 'copilot', label: 'Copilot briefing' },
        ]}
      />
      {tab === 'config' && <AppConfigCard />}
      {tab === 'flags' && <FeatureFlagsCard />}
      {tab === 'broadcast' && <BroadcastCard />}
      {tab === 'templates' && <TemplatesCard />}
      {tab === 'reports' && <ReportsCard />}
      {tab === 'audit' && <AuditViewerPanel />}
      {tab === 'approvals' && <ApprovalsInboxPanel />}
      {tab === 'ops' && <OpsCard />}
      {tab === 'copilot' && <CopilotCard />}
    </>
  );
};

const AppConfigCard: React.FC = () => (
  <JsonConfigCard
    title="SOP-26: App Configuration"
    subtitle="Platform-wide app-config (GET/PUT /admin/app-config)."
    icon={Settings2}
    load={() => admin.platform.appConfig()}
    save={(payload, reason) => admin.platform.updateAppConfig(payload, reason)}
  />
);

const FeatureFlagsCard: React.FC = () => (
  <JsonConfigCard
    title="SOP-26: Feature Flags"
    subtitle="Toggle platform features (GET/PUT /admin/feature-flags)."
    icon={Flag}
    load={() => admin.platform.featureFlags()}
    save={(payload, reason) => admin.platform.updateFeatureFlags(payload, reason)}
  />
);

const BroadcastCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [message, setMessage] = useState('');
  const [audience, setAudience] = useState('all');
  const [channel, setChannel] = useState('push');

  return (
    <PanelShell
      title="SOP-26: System Broadcasts & Alert Announcer"
      subtitle="Sends a real platform broadcast (POST /admin/broadcast) with an audit reason + MPIN step-up."
      icon={Radio}
      actions={
        <Btn
          tone="warn"
          disabled={message.trim().length < 3}
          onClick={() =>
            request({
              title: 'Send platform broadcast',
              description: `Audience: ${audience} • Channel: ${channel}. This reaches live users immediately.`,
              confirmLabel: 'Dispatch broadcast',
              tone: 'warn',
              requireMpin: true,
              defaultReason: 'Operational broadcast from SOP-26',
              action: (reason) => admin.platform.broadcast({ message: message.trim(), audience, channel }, reason),
              onDone: () => setMessage(''),
            })
          }
        >
          Dispatch broadcast
        </Btn>
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="Audience">
          <Select
            value={audience}
            onChange={setAudience}
            options={[
              { value: 'all', label: 'All users' },
              { value: 'farmers', label: 'Farmers' },
              { value: 'sellers', label: 'Sellers / Vyapari' },
              { value: 'transporters', label: 'Transporters' },
              { value: 'admins', label: 'Admins only' },
            ]}
          />
        </Field>
        <Field label="Channel">
          <Select
            value={channel}
            onChange={setChannel}
            options={[
              { value: 'push', label: 'Push notification' },
              { value: 'sms', label: 'SMS' },
              { value: 'inapp', label: 'In-app inbox' },
              { value: 'all', label: 'All channels' },
            ]}
          />
        </Field>
      </div>
      <Field label="Message">
        <TextArea
          value={message}
          onChange={setMessage}
          rows={4}
          placeholder="e.g. Alert: Unseasonal hailstorm warning for Nashik & Niphad over the next 24 hours…"
        />
      </Field>
      {modal}
    </PanelShell>
  );
};

const TemplatesCard: React.FC = () => (
  <JsonConfigCard
    title="SOP-26: Notification Templates"
    subtitle="Edit notification copy templates (GET/PUT /admin/notification-templates)."
    icon={Bell}
    load={() => admin.platform.notificationTemplates()}
    save={(payload, reason) => admin.platform.updateNotificationTemplates(payload, reason)}
  />
);

const ReportsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const reports = useAsync(() => admin.platform.reports(), []);

  return (
    <PanelShell
      title="SOP-26: Reports Queue"
      subtitle="User-generated reports (spam / fraud / abuse) awaiting moderator resolution."
      icon={Inbox}
      loading={reports.loading}
      error={reports.error}
      onRefresh={reports.reload}
    >
      <DataTable
        rows={(reports.data ?? []) as Row[]}
        empty="No open reports — queue is clear."
        columns={[
          {
            header: 'Report',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'reason', 'category', 'type', 'title')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'description', 'details', 'comment')}</p>
              </div>
            ),
          },
          {
            header: 'Reporter',
            cell: (r) => <span className="text-slate-600">{str(r, 'reporter', 'reportedBy', 'userId', 'uid')}</span>,
          },
          {
            header: 'Target',
            cell: (r) => <span className="text-slate-600">{str(r, 'target', 'targetId', 'against', 'entityId')}</span>,
          },
          {
            header: 'Status',
            cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
          },
          {
            header: 'Actions',
            className: 'text-right',
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Btn
                  tone="danger"
                  onClick={() =>
                    request({
                      title: `Dismiss report ${idOf(r)}`,
                      confirmLabel: 'Dismiss',
                      tone: 'danger',
                      action: (reason) => admin.platform.resolveReport(idOf(r), { status: 'dismissed', reason }, reason),
                      onDone: reports.reload,
                    })
                  }
                >
                  Dismiss
                </Btn>
                <Btn
                  tone="primary"
                  onClick={() =>
                    request({
                      title: `Resolve report ${idOf(r)}`,
                      defaultReason: 'Actioned against reported content',
                      confirmLabel: 'Resolve',
                      action: (reason) => admin.platform.resolveReport(idOf(r), { status: 'resolved', reason }, reason),
                      onDone: reports.reload,
                    })
                  }
                >
                  Resolve
                </Btn>
              </div>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const OpsCard: React.FC = () => {
  const cron = useAsync(() => admin.platform.cronLogs(), []);
  const ai = useAsync(() => admin.platform.aiHealth().catch(() => null), []);

  return (
    <>
      <PanelShell
        title="SOP-26: Cron Job Logs"
        subtitle="Scheduled settlement / settlement-adjacent job runs."
        icon={Cpu}
        loading={cron.loading}
        error={cron.error}
        onRefresh={cron.reload}
      >
        <DataTable
          rows={(cron.data ?? []) as Row[]}
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
                  <StatusBadge status={str(r, 'status', 'result', 'state')} />
                  <p className="text-[10px] text-slate-400 mt-0.5">{str(r, 'detail', 'message', 'error')}</p>
                </div>
              ),
            },
          ]}
        />
      </PanelShell>
      <PanelShell
        title="SOP-26: AI Health"
        subtitle="Live AI subsystem status (GET /admin/ai/health)."
        icon={Cpu}
        loading={ai.loading}
        onRefresh={ai.reload}
      >
        {ai.error ? <Banner kind="error">{ai.error}</Banner> : <KV record={asRow(ai.data)} />}
      </PanelShell>
    </>
  );
};

const CopilotCard: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const briefing = useAsync(() => admin.copilot.briefing().catch(() => null), []);

  const ask = async () => {
    setBusy(true);
    setErr(null);
    try {
      setAnswer(await admin.copilot.query({ question: question.trim() }, `SOP-26 copilot query: ${question.trim().slice(0, 60)}`));
    } catch (e) {
      setErr(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PanelShell
        title="SOP-26: Morning Copilot Briefing"
        subtitle="Auto-generated platform briefing (GET /admin/copilot/briefing)."
        icon={Sparkles}
        loading={briefing.loading}
      >
        {briefing.error ? <Banner kind="error">{briefing.error}</Banner> : <KV record={asRow(briefing.data)} />}
      </PanelShell>
      <PanelShell
        title="Ask the platform copilot"
        subtitle="Natural-language query over platform data (POST /admin/copilot/query)."
        icon={Sparkles}
      >
        <div className="flex gap-2">
          <TextInput value={question} onChange={setQuestion} placeholder="e.g. Show settlement failures this week" className="flex-1" />
          <Btn tone="primary" busy={busy} disabled={question.trim().length < 3} onClick={ask}>Ask</Btn>
        </div>
        {err && <Banner kind="error">{err}</Banner>}
        {answer !== null && <KV record={asRow(answer) ?? { result: answer }} />}
      </PanelShell>
    </>
  );
};
