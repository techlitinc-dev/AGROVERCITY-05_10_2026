import React, { useState } from 'react';
import { MessagesSquare, Headset, Star, BrainCircuit } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Tabs,
  Field,
  TextInput,
  Select,
  TextArea,
  Banner,
  idOf,
  str,
  num,
  pct,
  useAsync,
  useReasonModal,
  asRow,
  type Row,
} from './shared';

/**
 * SOP-12 — Chatbot Transcripts & Handoff.
 * Transcript browser, expert handoff queue with assignment, satisfaction
 * metrics and prompt-config editing (with second-admin warning).
 */
export const ChatbotPanel: React.FC = () => {
  const [tab, setTab] = useState('handoffs');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'handoffs', label: 'Expert handoffs' },
          { id: 'transcripts', label: 'Transcripts' },
          { id: 'satisfaction', label: 'Satisfaction' },
          { id: 'prompt', label: 'Prompt config' },
        ]}
      />
      {tab === 'handoffs' && <HandoffsCard />}
      {tab === 'transcripts' && <TranscriptsCard />}
      {tab === 'satisfaction' && <SatisfactionCard />}
      {tab === 'prompt' && <PromptConfigCard />}
    </>
  );
};

const HandoffsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expertId, setExpertId] = useState('');

  const handoffs = useAsync(() => admin.chatbot.handoffs(), []);
  const experts = useAsync(() => admin.chatbot.experts().catch(() => null), []);
  const detail = useAsync(
    () => (selectedId ? admin.chatbot.session(selectedId).catch(() => null) : Promise.resolve(null)),
    [selectedId]
  );

  const rows = (handoffs.data ?? []) as Row[];
  const selected = selectedId ? rows.find((r) => idOf(r) === selectedId) ?? null : null;
  const expertRows = Array.isArray(experts.data) ? (experts.data as Row[]) : [];

  return (
    <>
      <PanelShell
        title="SOP-12: Expert Handoff Queue"
        subtitle="Chatbot conversations escalated to human experts. Assign an expert to take over."
        icon={Headset}
        loading={handoffs.loading}
        error={handoffs.error}
        onRefresh={handoffs.reload}
      >
        <DataTable
          rows={rows}
          empty="No handoffs waiting."
          columns={[
            {
              header: 'Ticket',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'topic', 'subject', 'category', 'reason')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                </div>
              ),
            },
            { header: 'Farmer', cell: (r) => <span className="text-slate-600">{str(r, 'userName', 'farmerName', 'userId')}</span> },
            { header: 'Priority', cell: (r) => <StatusBadge status={str(r, 'priority', 'urgency')} /> },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            { header: 'Opened', cell: (r) => <span className="text-slate-500">{str(r, 'createdAt', 'openedAt')}</span> },
            { header: 'Action', className: 'text-right', cell: (r) => <Btn onClick={() => setSelectedId(idOf(r))}>Open</Btn> },
          ]}
        />
      </PanelShell>

      {selected && (
        <PanelShell
          title={`Handoff ${idOf(selected)}`}
          subtitle="Conversation context and expert assignment."
          icon={Headset}
          loading={detail.loading}
          actions={
            <div className="flex items-end gap-2">
              <Field label="Expert" className="w-52">
                <Select
                  value={expertId}
                  onChange={setExpertId}
                  options={[
                    { value: '', label: 'Select expert…' },
                    ...expertRows.map((r) => ({ value: idOf(r), label: str(r, 'name', 'expertName', 'speciality') })),
                  ]}
                />
              </Field>
              <Btn
                tone="primary"
                disabled={!expertId}
                onClick={() =>
                  request({
                    title: `Assign expert to ${idOf(selected)}`,
                    confirmLabel: 'Assign',
                    action: (reason) => admin.chatbot.assignHandoff(idOf(selected), { expertId, reason }, reason),
                    onDone: handoffs.reload,
                  })
                }
              >
                Assign
              </Btn>
            </div>
          }
        >
          <KV record={asRow(detail.data) ?? selected} />
        </PanelShell>
      )}
      {modal}
    </>
  );
};

const TranscriptsCard: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const transcripts = useAsync(() => admin.chatbot.transcripts(), []);
  const detail = useAsync(
    () => (selectedId ? admin.chatbot.session(selectedId).catch(() => null) : Promise.resolve(null)),
    [selectedId]
  );

  return (
    <>
      <PanelShell
        title="SOP-12: Chatbot Transcripts"
        subtitle="Recent conversations between farmers and the AI agronomist."
        icon={MessagesSquare}
        loading={transcripts.loading}
        error={transcripts.error}
        onRefresh={transcripts.reload}
      >
        <DataTable
          rows={(transcripts.data ?? []) as Row[]}
          empty="No transcripts."
          columns={[
            {
              header: 'Session',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'topic', 'summary', 'firstMessage', 'id')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                </div>
              ),
            },
            { header: 'Farmer', cell: (r) => <span className="text-slate-600">{str(r, 'userName', 'farmerName', 'userId')}</span> },
            { header: 'Messages', cell: (r) => <span>{num(r, 'messageCount', 'messages') ?? '—'}</span> },
            { header: 'Lang', cell: (r) => <span className="text-slate-500">{str(r, 'language', 'lang')}</span> },
            { header: 'When', cell: (r) => <span className="text-slate-500">{str(r, 'createdAt', 'startedAt')}</span> },
            { header: 'Action', className: 'text-right', cell: (r) => <Btn onClick={() => setSelectedId(idOf(r))}>Read</Btn> },
          ]}
        />
      </PanelShell>
      {selectedId && (
        <PanelShell
          title={`Transcript ${selectedId}`}
          subtitle="Full message thread."
          icon={MessagesSquare}
          loading={detail.loading}
          actions={<Btn onClick={() => setSelectedId(null)}>Close</Btn>}
        >
          <KV record={asRow(detail.data)} />
        </PanelShell>
      )}
    </>
  );
};

const SatisfactionCard: React.FC = () => {
  const satisfaction = useAsync(() => admin.chatbot.satisfaction().catch(() => null), []);
  const row = asRow(satisfaction.data);
  const csat = num(row, 'csat', 'averageRating', 'avgRating', 'score');
  return (
    <PanelShell
      title="SOP-12: Chatbot Satisfaction"
      subtitle="CSAT / resolution metrics for the AI agronomist."
      icon={Star}
      loading={satisfaction.loading}
      onRefresh={satisfaction.reload}
    >
      {satisfaction.error ? (
        <Banner kind="error">{satisfaction.error}</Banner>
      ) : (
        <>
          {csat !== null && (
            <div className="flex items-center gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{csat.toFixed(1)}</span>
              <span className="text-xs font-semibold text-slate-400">/ 5 average rating</span>
            </div>
          )}
          <KV record={row} />
        </>
      )}
    </PanelShell>
  );
};

const PromptConfigCard: React.FC = () => {
  const cfg = useAsync(() => admin.chatbot.promptConfig().catch(() => null), []);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ackSecondAdmin, setAckSecondAdmin] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const save = async () => {
    if (!draft || !ackSecondAdmin) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setMsg({ kind: 'error', text: 'Invalid JSON.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await admin.chatbot.updatePromptConfig(parsed, 'Prompt config update from SOP-12 desk');
      setMsg({ kind: 'success', text: 'Prompt config updated.' });
      setDraft(null);
      setAckSecondAdmin(false);
      cfg.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-12: Chatbot Prompt Configuration"
      subtitle="System prompt & guardrails for the AI agronomist. Changes affect every farmer conversation."
      icon={BrainCircuit}
      loading={cfg.loading}
      onRefresh={() => {
        cfg.reload();
        setDraft(null);
      }}
      actions={
        draft !== null ? (
          <div className="flex gap-2">
            <Btn onClick={() => setDraft(null)}>Cancel</Btn>
            <Btn tone="primary" busy={busy} disabled={!ackSecondAdmin} onClick={save}>
              Save (audited)
            </Btn>
          </div>
        ) : (
          <Btn onClick={() => setDraft(JSON.stringify(cfg.data ?? {}, null, 2))}>Edit config</Btn>
        )
      }
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {cfg.error && <Banner kind="error">{cfg.error}</Banner>}
      {draft !== null ? (
        <div className="space-y-3">
          <Banner kind="info">
            Second-admin control: prompt changes alter live agronomy advice. Get a second admin's sign-off before
            saving.
          </Banner>
          <TextArea value={draft} onChange={setDraft} rows={14} className="font-mono text-[11px]" />
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={ackSecondAdmin}
              onChange={(e) => setAckSecondAdmin(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            A second admin has reviewed this prompt change
          </label>
        </div>
      ) : (
        <KV record={asRow(cfg.data)} />
      )}
    </PanelShell>
  );
};
