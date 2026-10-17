import React, { useState } from 'react';
import { Newspaper, LayoutTemplate, Tv, Presentation, Trash2 } from 'lucide-react';
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
  TextArea,
  Select,
  Banner,
  idOf,
  str,
  num,
  useAsync,
  useReasonModal,
  asRows,
  type Row,
} from './shared';

/**
 * SOP-20 — Content CMS & Live Channels.
 * Generic per-collection CRUD, news desk, channel moderation and workshop roster.
 */
export const ContentPanel: React.FC = () => {
  const [tab, setTab] = useState('collections');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'collections', label: 'Collections' },
          { id: 'news', label: 'News desk' },
          { id: 'channels', label: 'Channels' },
          { id: 'workshops', label: 'Workshops' },
        ]}
      />
      {tab === 'collections' && <CollectionsCard />}
      {tab === 'news' && <NewsCard />}
      {tab === 'channels' && <ChannelsCard />}
      {tab === 'workshops' && <WorkshopsCard />}
    </>
  );
};

const COLLECTION_OPTIONS = ['news', 'videos', 'blogs', 'schemes', 'successStories', 'tips', 'faqs', 'bannerAds'];

const CollectionsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [collection, setCollection] = useState('videos');
  const [title, setTitle] = useState('');
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const items = useAsync(() => admin.content.collection(collection), [collection]);
  const rows = (items.data ?? []) as Row[];

  const run = async (fn: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
      setMsg({ kind: 'success', text: success });
      items.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-20: Content Collections CMS"
      subtitle="List / create / update / delete items in any content collection (GET·POST·PUT·DELETE /admin/content/{collection})."
      icon={LayoutTemplate}
      loading={items.loading}
      error={items.error}
      onRefresh={items.reload}
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <div className="flex flex-wrap items-end gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
        <Field label="Collection" className="w-48">
          <Select
            value={collection}
            onChange={(v) => {
              setCollection(v);
              setEditing(null);
            }}
            options={COLLECTION_OPTIONS.map((c) => ({ value: c, label: c }))}
          />
        </Field>
        <Field label="New item title" className="flex-1 min-w-48">
          <TextInput value={title} onChange={setTitle} placeholder={`New ${collection} item…`} />
        </Field>
        <Btn
          tone="primary"
          busy={busy}
          disabled={!title.trim()}
          onClick={() =>
            run(
              () => admin.content.createInCollection(collection, { title: title.trim(), active: true }, `CMS create in ${collection}`),
              'Item created.'
            ).then(() => setTitle(''))
          }
        >
          Create item
        </Btn>
      </div>

      {editing && (
        <div className="space-y-2 p-3 border border-emerald-200 bg-emerald-50/40 rounded-2xl">
          <p className="text-xs font-bold text-slate-700">Editing {editing.id} — JSON fields</p>
          <TextArea value={editing.draft} onChange={(v) => setEditing({ ...editing, draft: v })} rows={8} className="font-mono text-[11px]" />
          <div className="flex gap-2">
            <Btn onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn
              tone="primary"
              busy={busy}
              onClick={() => {
                let parsed: Record<string, unknown>;
                try {
                  parsed = JSON.parse(editing.draft);
                } catch {
                  setMsg({ kind: 'error', text: 'Invalid JSON.' });
                  return;
                }
                run(
                  () => admin.content.updateInCollection(collection, editing.id, parsed, `CMS update in ${collection}`),
                  'Item updated.'
                ).then(() => setEditing(null));
              }}
            >
              Save changes
            </Btn>
          </div>
        </div>
      )}

      <DataTable
        rows={rows}
        empty={`Collection "${collection}" is empty.`}
        columns={[
          {
            header: 'Item',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'title', 'headline', 'name', 'heading')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          { header: 'Language', cell: (r) => <span className="text-slate-500">{str(r, 'language', 'lang')}</span> },
          { header: 'Published', cell: (r) => <span className="text-slate-500">{str(r, 'publishedAt', 'createdAt', 'date')}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'active', 'state')} /> },
          {
            header: 'Actions',
            className: 'text-right',
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Btn
                  onClick={() => setEditing({ id: idOf(r), draft: JSON.stringify(r, null, 2) })}
                >
                  Edit
                </Btn>
                <Btn
                  tone="danger"
                  onClick={() =>
                    request({
                      title: `Delete ${collection} item ${idOf(r)}`,
                      confirmLabel: 'Delete',
                      requireMpin: true,
                      tone: 'danger',
                      action: (reason) => admin.content.deleteFromCollection(collection, idOf(r), reason),
                      onDone: () => items.reload(),
                    })
                  }
                >
                  <Trash2 className="w-3.5 h-3.5" />
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

const NewsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [headline, setHeadline] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const news = useAsync(() => admin.content.news(), []);

  const publish = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await admin.content.createNews({ title: headline.trim(), language: 'mr' }, `News published: ${headline.trim().slice(0, 50)}`);
      setMsg({ kind: 'success', text: 'News published.' });
      setHeadline('');
      news.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-20: Agri News Desk"
      subtitle="Publish and moderate the news feed."
      icon={Newspaper}
      loading={news.loading}
      error={news.error}
      onRefresh={news.reload}
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <div className="flex flex-wrap items-end gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
        <Field label="Headline" className="flex-1 min-w-64">
          <TextInput value={headline} onChange={setHeadline} placeholder="Breaking: MSP hike for pulses announced" />
        </Field>
        <Btn tone="primary" busy={busy} disabled={!headline.trim()} onClick={publish}>Publish</Btn>
      </div>
      <DataTable
        rows={(news.data ?? []) as Row[]}
        empty="No news articles."
        columns={[
          {
            header: 'Article',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'title', 'headline')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'source', 'author')} • {str(r, 'language', 'lang')}</p>
              </div>
            ),
          },
          { header: 'Published', cell: (r) => <span className="text-slate-500">{str(r, 'publishedAt', 'createdAt')}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'active', 'state')} /> },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                onClick={() =>
                  request({
                    title: `Toggle news ${idOf(r)}`,
                    confirmLabel: 'Update',
                    action: (reason) =>
                      admin.content.updateNews(idOf(r), { active: !r.active }, reason),
                    onDone: news.reload,
                  })
                }
              >
                Toggle active
              </Btn>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const ChannelsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const channels = useAsync(() => admin.content.collection('channels'), []);

  return (
    <PanelShell
      title="SOP-20: Live Channel Moderation"
      subtitle="Moderate farmer-created content channels."
      icon={Tv}
      loading={channels.loading}
      error={channels.error}
      onRefresh={channels.reload}
    >
      <DataTable
        rows={(channels.data ?? []) as Row[]}
        empty="No channels."
        columns={[
          {
            header: 'Channel',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name', 'title', 'channelName')}</p>
                <p className="text-[10px] text-slate-400">by {str(r, 'ownerName', 'owner', 'creator')}</p>
              </div>
            ),
          },
          { header: 'Followers', cell: (r) => <span>{String(num(r, 'followers', 'subscriberCount') ?? '—')}</span> },
          { header: 'Reports', cell: (r) => <span className="font-semibold text-rose-600">{num(r, 'reportCount', 'reports') ?? 0}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state', 'moderationStatus')} /> },
          {
            header: 'Actions',
            className: 'text-right',
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Btn
                  tone="danger"
                  onClick={() =>
                    request({
                      title: `Suspend channel ${str(r, 'name', 'channelName')}`,
                      confirmLabel: 'Suspend',
                      tone: 'danger',
                      action: (reason) => admin.content.moderateChannel(idOf(r), { action: 'suspend', reason }, reason),
                      onDone: channels.reload,
                    })
                  }
                >
                  Suspend
                </Btn>
                <Btn
                  tone="primary"
                  onClick={() =>
                    request({
                      title: `Reinstate channel ${str(r, 'name', 'channelName')}`,
                      defaultReason: 'Reports reviewed — channel reinstated',
                      confirmLabel: 'Reinstate',
                      action: (reason) => admin.content.moderateChannel(idOf(r), { action: 'reinstate', reason }, reason),
                      onDone: channels.reload,
                    })
                  }
                >
                  Reinstate
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

const WorkshopsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const workshops = useAsync(() => admin.content.workshops(), []);
  const roster = useAsync(
    () => (selectedId ? admin.content.workshopRoster(selectedId).catch(() => null) : Promise.resolve(null)),
    [selectedId]
  );

  const rows = (workshops.data ?? []) as Row[];
  const selected = selectedId ? rows.find((r) => idOf(r) === selectedId) ?? null : null;

  return (
    <>
      <PanelShell
        title="SOP-20: Workshops & Trainings"
        subtitle="Krishi mela / training events and their attendee rosters."
        icon={Presentation}
        loading={workshops.loading}
        error={workshops.error}
        onRefresh={workshops.reload}
      >
        <DataTable
          rows={rows}
          empty="No workshops scheduled."
          columns={[
            {
              header: 'Workshop',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'title', 'name', 'topic')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'location', 'venue', 'village')}</p>
                </div>
              ),
            },
            { header: 'Date', cell: (r) => <span className="text-slate-500">{str(r, 'date', 'scheduledAt', 'startDate')}</span> },
            { header: 'Trainer', cell: (r) => <span className="text-slate-600">{str(r, 'trainerName', 'trainer', 'instructor')}</span> },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Btn onClick={() => setSelectedId(idOf(r))}>Roster</Btn>
                  <Btn
                    onClick={() =>
                      request({
                        title: `Mark workshop ${idOf(r)} complete`,
                        defaultReason: 'Event concluded and attendance captured',
                        confirmLabel: 'Mark complete',
                        action: (reason) => admin.content.updateWorkshop(idOf(r), { status: 'completed' }, reason),
                        onDone: workshops.reload,
                      })
                    }
                  >
                    Complete
                  </Btn>
                </div>
              ),
            },
          ]}
        />
      </PanelShell>
      {selected && (
        <PanelShell
          title={`Roster — ${str(selected, 'title', 'name', 'topic')}`}
          subtitle="Registered attendees."
          icon={Presentation}
          loading={roster.loading}
          actions={<Btn onClick={() => setSelectedId(null)}>Close</Btn>}
        >
          <DataTable
            rows={asRows(roster.data)}
            empty="No attendees registered."
            columns={[
              { header: 'Attendee', cell: (r) => <span className="font-semibold">{str(r, 'name', 'attendeeName', 'userName')}</span> },
              { header: 'Phone', cell: (r) => <span className="font-mono text-slate-600">{str(r, 'phone', 'mobile')}</span> },
              { header: 'Attendance', cell: (r) => <StatusBadge status={str(r, 'attendance', 'attended', 'status')} /> },
            ]}
          />
        </PanelShell>
      )}
      {modal}
    </>
  );
};
