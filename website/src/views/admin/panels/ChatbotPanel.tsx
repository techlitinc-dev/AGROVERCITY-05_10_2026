import React, { useState } from 'react';
import { MessagesSquare, Headset, Star, BrainCircuit, BookOpenText, LifeBuoy, Cpu } from 'lucide-react';
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
 * metrics, prompt-config editing (with second-admin warning), and the
 * chatbot CMS: intent registry, fallback rotation and the AI model config.
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
          { id: 'intents', label: 'Intents CMS' },
          { id: 'fallback', label: 'Fallback config' },
          { id: 'ai', label: 'AI model config' },
        ]}
      />
      {tab === 'handoffs' && <HandoffsCard />}
      {tab === 'transcripts' && <TranscriptsCard />}
      {tab === 'satisfaction' && <SatisfactionCard />}
      {tab === 'prompt' && <PromptConfigCard />}
      {tab === 'intents' && <IntentsCard />}
      {tab === 'fallback' && <FallbackConfigCard />}
      {tab === 'ai' && <AiModelConfigCard />}
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

const IntentsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const intentsRes = useAsync(() => admin.chatbot.intents().catch(() => null), []);
  const data = asRow(intentsRes.data);
  const intents = Array.isArray(data?.intents) ? (data!.intents as Row[]) : [];

  const [editing, setEditing] = useState<Row | null>(null);
  const [draft, setDraft] = useState<Row | null>(null);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const startCreate = () => {
    setEditing(null);
    setDraft({ intent: '', samplePhrases: '', response: '', enabled: true });
    setMsg(null);
  };

  const startEdit = (r: Row) => {
    setEditing(r);
    setDraft({
      ...r,
      samplePhrases: Array.isArray(r.samplePhrases) ? (r.samplePhrases as unknown[]).join(', ') : str(r, 'samplePhrases'),
    });
    setMsg(null);
  };

  const persist = async (reason: string) => {
    if (!draft) return;
    const next: Row = {
      ...(editing ?? {}),
      intent: str(draft, 'intent').trim(),
      samplePhrases: String(draft.samplePhrases ?? '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      response: str(draft, 'response').trim(),
      enabled: draft.enabled !== false,
    };
    const list = editing
      ? intents.map((i) => (str(i, 'intent') === str(editing, 'intent') ? next : i))
      : [...intents.filter((i) => str(i, 'intent') !== next.intent), next];
    await admin.chatbot.updateIntents({ intents: list }, reason);
    setMsg({ kind: 'success', text: `Intent “${next.intent}” saved.` });
    setDraft(null);
    setEditing(null);
    intentsRes.reload();
  };

  const remove = (r: Row) =>
    request({
      title: `Delete intent ${str(r, 'intent')}`,
      description: 'The whole intent list is rewritten without this entry.',
      confirmLabel: 'Delete intent',
      tone: 'danger',
      action: async (reason) => {
        await admin.chatbot.updateIntents(
          { intents: intents.filter((i) => str(i, 'intent') !== str(r, 'intent')) },
          reason
        );
        intentsRes.reload();
      },
    });

  return (
    <PanelShell
      title="SOP-12: Chatbot Intents CMS"
      subtitle="Curated intent/response registry consumed by the Kisan Mitra fallback engine. Saving rewrites the whole list (PUT /admin/chatbot/intents)."
      icon={BookOpenText}
      loading={intentsRes.loading}
      onRefresh={intentsRes.reload}
      actions={<Btn tone="primary" onClick={startCreate}>New intent</Btn>}
    >
      {intentsRes.error && <Banner kind="error">{intentsRes.error}</Banner>}
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

      {draft && (
        <div className="p-3 border border-emerald-200 bg-emerald-50/40 rounded-2xl space-y-3">
          <p className="text-xs font-bold text-slate-700">{editing ? `Edit intent “${str(editing, 'intent')}”` : 'New intent'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Intent name">
              <TextInput value={str(draft, 'intent')} onChange={(v) => setDraft({ ...draft, intent: v })} placeholder="pest_advisory" disabled={editing !== null} />
            </Field>
            <Field label="Enabled">
              <Select
                value={String(draft.enabled !== false)}
                onChange={(v) => setDraft({ ...draft, enabled: v === 'true' })}
                options={[
                  { value: 'true', label: 'Enabled' },
                  { value: 'false', label: 'Disabled' },
                ]}
              />
            </Field>
            <Field label="Sample phrases (comma-separated)" className="sm:col-span-2">
              <TextArea
                value={String(draft.samplePhrases ?? '')}
                onChange={(v) => setDraft({ ...draft, samplePhrases: v })}
                rows={2}
                placeholder="आलू में कीड़ा, potato pest, pest attack…"
              />
            </Field>
            <Field label="Response" className="sm:col-span-2">
              <TextArea value={str(draft, 'response')} onChange={(v) => setDraft({ ...draft, response: v })} rows={3} placeholder="Reply sent when the intent matches…" />
            </Field>
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => { setDraft(null); setEditing(null); }}>Cancel</Btn>
            <Btn
              tone="primary"
              disabled={!str(draft, 'intent').trim() || !str(draft, 'response').trim()}
              onClick={() =>
                request({
                  title: `${editing ? 'Update' : 'Create'} intent “${str(draft, 'intent')}”`,
                  defaultReason: `Intents CMS update — ${str(draft, 'intent')}`,
                  confirmLabel: 'Save intents',
                  action: persist,
                })
              }
            >
              Save intent (audited)
            </Btn>
          </div>
        </div>
      )}

      <DataTable
        rows={intents}
        empty="No intents configured — the chatbot relies on the AI model alone."
        columns={[
          { header: 'Intent', cell: (r) => <span className="font-mono font-bold text-slate-800">{str(r, 'intent')}</span> },
          {
            header: 'Sample phrases',
            cell: (r) => (
              <span className="text-[11px] text-slate-500 break-all">
                {Array.isArray(r.samplePhrases) ? (r.samplePhrases as unknown[]).join(', ') : str(r, 'samplePhrases')}
              </span>
            ),
          },
          { header: 'Response', cell: (r) => <span className="text-[11px] text-slate-600 line-clamp-2">{str(r, 'response')}</span> },
          {
            header: 'Enabled',
            cell: (r) => <StatusBadge status={r.enabled === false ? 'disabled' : 'enabled'} />,
          },
          {
            header: 'Actions',
            className: 'text-right',
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Btn onClick={() => startEdit(r)}>
                  Edit
                </Btn>
                <Btn tone="danger" onClick={() => remove(r)}>
                  Delete
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

const FallbackConfigCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const cfgRes = useAsync(() => admin.chatbot.fallbackConfig().catch(() => null), []);
  const cfg = asRow(cfgRes.data);

  const [messages, setMessages] = useState('');
  const [escalateAfter, setEscalateAfter] = useState('');
  const [handoffMessage, setHandoffMessage] = useState('');
  const dirty = messages !== '' || escalateAfter !== '' || handoffMessage.trim() !== '';

  const save = async (reason: string) => {
    let parsedMessages: string[] | undefined;
    if (messages.trim()) {
      parsedMessages = messages
        .split('\n')
        .map((m) => m.trim())
        .filter(Boolean);
    }
    await admin.chatbot.updateFallbackConfig(
      {
        ...(parsedMessages ? { fallbackMessages: parsedMessages } : {}),
        ...(escalateAfter !== '' ? { escalateAfter: Number(escalateAfter) } : {}),
        ...(handoffMessage.trim() ? { handoffMessage: handoffMessage.trim() } : {}),
      },
      reason
    );
    setMessages('');
    setEscalateAfter('');
    setHandoffMessage('');
    cfgRes.reload();
  };

  return (
    <PanelShell
      title="SOP-12: Fallback Config"
      subtitle="Reply rotation when the bot does not understand, plus the expert-handoff threshold (GET/PUT /admin/chatbot/fallback-config)."
      icon={LifeBuoy}
      loading={cfgRes.loading}
      onRefresh={cfgRes.reload}
      actions={
        dirty ? (
          <div className="flex gap-2">
            <Btn onClick={() => { setMessages(''); setEscalateAfter(''); setHandoffMessage(''); }}>Cancel</Btn>
            <Btn
              tone="primary"
              onClick={() =>
                request({
                  title: 'Update fallback config',
                  defaultReason: 'Chatbot fallback config update',
                  confirmLabel: 'Save fallback config',
                  action: save,
                })
              }
            >
              Save (audited)
            </Btn>
          </div>
        ) : undefined
      }
    >
      {cfgRes.error && <Banner kind="error">{cfgRes.error}</Banner>}
      {cfg && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Field
              label="Fallback messages — one per line"
              className={messages === '' ? 'opacity-70' : undefined}
            >
              <TextArea
                value={messages}
                onChange={setMessages}
                rows={6}
                placeholder={Array.isArray(cfg.fallbackMessages) ? (cfg.fallbackMessages as unknown[]).join('\n') : 'Message 1\nMessage 2'}
              />
            </Field>
            <p className="text-[11px] text-slate-400">
              Current rotation ({Array.isArray(cfg.fallbackMessages) ? (cfg.fallbackMessages as unknown[]).length : 0} messages):
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {(Array.isArray(cfg.fallbackMessages) ? (cfg.fallbackMessages as unknown[]) : []).map((m, i) => (
                <li key={i} className="text-[11px] text-slate-500">{String(m)}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <Field label={`Escalate after (misses) — current ${num(cfg, 'escalateAfter') ?? '—'}`}>
              <TextInput type="number" inputMode="numeric" value={escalateAfter} onChange={setEscalateAfter} placeholder={String(num(cfg, 'escalateAfter') ?? 3)} />
            </Field>
            <Field label="Handoff message" className={handoffMessage === '' ? 'opacity-70' : undefined}>
              <TextArea
                value={handoffMessage}
                onChange={setHandoffMessage}
                rows={2}
                placeholder={str(cfg, 'handoffMessage')}
              />
            </Field>
            <p className="text-[11px] text-slate-400">
              Last updated {str(cfg, 'updatedAt')} by {str(cfg, 'updatedBy')}.
            </p>
          </div>
        </div>
      )}
    </PanelShell>
  );
};

const AiModelConfigCard: React.FC = () => {
  const cfg = useAsync(() => admin.platform.aiConfig().catch(() => null), []);
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const save = async () => {
    if (!draft) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setMsg({ kind: 'error', text: 'Invalid JSON — fix the draft before saving.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await admin.platform.updateAiConfig(parsed, 'AI model config update from SOP-12 desk');
      setMsg({ kind: 'success', text: 'AI model config updated.' });
      setDraft(null);
      cfg.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-12: AI Model Config"
      subtitle="Model provider, credentials and parameters for the AI agronomist (GET/PUT /admin/platform-config/ai)."
      icon={Cpu}
      loading={cfg.loading}
      onRefresh={() => {
        cfg.reload();
        setDraft(null);
      }}
      actions={
        draft !== null ? (
          <div className="flex gap-2">
            <Btn onClick={() => setDraft(null)}>Cancel</Btn>
            <Btn tone="primary" busy={busy} onClick={save}>
              Save (audited)
            </Btn>
          </div>
        ) : (
          <Btn onClick={() => setDraft(JSON.stringify(cfg.data ?? {}, null, 2))}>Edit as JSON</Btn>
        )
      }
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {cfg.error && <Banner kind="error">{cfg.error}</Banner>}
      {draft !== null ? (
        <TextArea value={draft} onChange={setDraft} rows={14} className="font-mono text-[11px]" />
      ) : (
        <KV record={asRow(cfg.data)} />
      )}
    </PanelShell>
  );
};
