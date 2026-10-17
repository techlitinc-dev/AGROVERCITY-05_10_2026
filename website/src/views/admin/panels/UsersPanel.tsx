import React, { useState } from 'react';
import { Users, Download } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Field,
  TextInput,
  Select,
  Banner,
  idOf,
  str,
  fmtVal,
  useAsync,
  useReasonModal,
  type Row,
} from './shared';

/** The 15 platform personas an account can link (≥1 must remain). */
const PERSONA_OPTIONS = [
  'farmer',
  'seller',
  'transporter',
  'equipmentOwner',
  'landlord',
  'broker',
  'directBuyer',
  'exporter',
  'dairyManager',
  'milkSeller',
  'instructor',
  'bankManager',
  'insuranceProvider',
  'coldStorageProvider',
  'gaushalaManager',
];

const personasOf = (r: Row | null): string[] => {
  if (!r) return [];
  const v = r.personas ?? r.linkedPersonas;
  if (Array.isArray(v)) return (v as unknown[]).map((p) => (typeof p === 'object' ? str(p as Row, 'type', 'persona', 'role') : String(p)));
  return [];
};

/**
 * SOP-02 — User & Persona Governance.
 * Search/list users, open a profile (personas, status), set status,
 * reset MPIN, revoke sessions, export the roster.
 */
export const UsersPanel: React.FC = () => {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const { request, modal } = useReasonModal();

  const list = useAsync(
    () =>
      admin.users.list({
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
      }),
    [query.trim(), statusFilter]
  );
  const detail = useAsync(() => (selectedUid ? admin.users.get(selectedUid) : Promise.resolve(null)), [selectedUid]);
  const profiles = useAsync(
    () => (selectedUid ? admin.users.roleProfiles(selectedUid).catch(() => null) : Promise.resolve(null)),
    [selectedUid]
  );

  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const exportRoster = async () => {
    setExporting(true);
    setExportError(null);
    try {
      const data = await admin.users.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `agrovercity-users-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportError(apiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const selectedRow = selectedUid
    ? ((list.data ?? []) as Row[]).find((r) => idOf(r) === selectedUid || str(r, 'uid') === selectedUid) ?? null
    : null;

  const reloadAll = () => {
    list.reload();
    detail.reload();
    profiles.reload();
  };

  return (
    <>
      <PanelShell
        title="SOP-02: User Management & Multi-Persona Governance"
        subtitle="Search the user base, inspect persona profiles, suspend or activate accounts, reset MPINs and revoke sessions."
        icon={Users}
        loading={list.loading}
        error={list.error ?? exportError}
        onRefresh={reloadAll}
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Search" className="w-48">
              <TextInput value={query} onChange={setQuery} placeholder="Name or phone…" />
            </Field>
            <Field label="Status" className="w-36">
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: '', label: 'All' },
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                  { value: 'disabled', label: 'Disabled' },
                  { value: 'pending', label: 'Pending' },
                ]}
              />
            </Field>
            <Btn busy={exporting} onClick={exportRoster}>
              <Download className="w-3.5 h-3.5" /> Export roster
            </Btn>
          </div>
        }
      >
        <DataTable
          rows={(list.data ?? []) as Row[]}
          empty="No users match this filter."
          columns={[
            {
              header: 'User',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'name', 'displayName', 'fullName')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">+91 {str(r, 'phone', 'mobile')}</p>
                </div>
              ),
            },
            {
              header: 'Personas',
              cell: (r) => (
                <span className="text-slate-600">
                  {Array.isArray(r.personas) ? (r.personas as unknown[]).map(fmtVal).join(', ') : str(r, 'persona', 'primaryPersona', 'role')}
                </span>
              ),
            },
            {
              header: 'District',
              cell: (r) => <span className="text-slate-500">{str(r, 'district', 'village', 'state')}</span>,
            },
            {
              header: 'Status',
              cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
            },
            {
              header: 'Action',
              className: 'text-right',
              cell: (r) => <Btn onClick={() => setSelectedUid(str(r, 'uid', 'id'))}>Open profile</Btn>,
            },
          ]}
        />
      </PanelShell>

      {selectedUid && (
        <PanelShell
          title={`Profile: ${str(asRow(detail.data), 'name', 'displayName') || str(selectedRow, 'name')}`}
          subtitle={`uid ${selectedUid}`}
          icon={Users}
          loading={detail.loading}
          onRefresh={() => detail.reload()}
          actions={
            <div className="flex flex-wrap gap-2">
              <Btn
                onClick={() =>
                  request({
                    title: 'Reset user MPIN',
                    description: 'User will be forced to set a new MPIN at next login.',
                    defaultReason: 'Requested by user / support escalation',
                    action: (reason) => admin.users.resetMpin(selectedUid, reason),
                  })
                }
              >
                Reset MPIN
              </Btn>
              <Btn
                tone="danger"
                onClick={() =>
                  request({
                    title: 'Revoke all sessions',
                    description: 'Forces logout on every device for this user.',
                    confirmLabel: 'Revoke sessions',
                    requireMpin: true,
                    action: (reason) => admin.users.revokeSessions(selectedUid, reason),
                  })
                }
              >
                Revoke sessions
              </Btn>
            </div>
          }
        >
          {detail.error && <Banner kind="error">{detail.error}</Banner>}
          <KV record={asRow(detail.data) ?? selectedRow} />
          {!!profiles.data && (
            <div>
              <h4 className="text-xs font-extrabold text-slate-700 mb-2">Role profiles</h4>
              <KV record={asRow(profiles.data)} compact />
            </div>
          )}
          <PersonaEditor
            uid={selectedUid}
            current={personasOf(asRow(detail.data) ?? selectedRow)}
            onChanged={reloadAll}
          />
          <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-100">
            <Field label="Set account status" className="w-44">
              <Select
                value={str(asRow(detail.data) ?? selectedRow, 'status', 'state') === '—' ? 'active' : str(asRow(detail.data) ?? selectedRow, 'status', 'state')}
                onChange={(v) =>
                  request({
                    title: `Set status → ${v}`,
                    confirmLabel: 'Apply status',
                    tone: v === 'active' ? 'primary' : 'warn',
                    action: (reason) => admin.users.setStatus(selectedUid, { status: v }, reason),
                    onDone: reloadAll,
                  })
                }
                options={[
                  { value: 'active', label: 'Active' },
                  { value: 'suspended', label: 'Suspended' },
                  { value: 'disabled', label: 'Disabled' },
                ]}
              />
            </Field>
          </div>
        </PanelShell>
      )}
      {modal}
    </>
  );
};

const asRow = (d: unknown): Row | null => (d && typeof d === 'object' && !Array.isArray(d) ? (d as Row) : null);

/**
 * Persona governance — toggle the linked persona set and persist with
 * PUT /admin/users/{uid}/personas (≥1 persona must remain, else 409 LAST_PROFILE).
 */
const PersonaEditor: React.FC<{ uid: string; current: string[]; onChanged: () => void }> = ({ uid, current, onChanged }) => {
  const { request, modal } = useReasonModal();
  const [draft, setDraft] = useState<string[] | null>(null);
  const active = draft ?? current;

  const toggle = (p: string) =>
    setDraft(active.includes(p) ? active.filter((x) => x !== p) : [...active, p]);

  const dirty = draft !== null && JSON.stringify([...draft].sort()) !== JSON.stringify([...current].sort());

  return (
    <div className="pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h4 className="text-xs font-extrabold text-slate-700">Linked personas</h4>
        {dirty && (
          <div className="flex gap-2">
            <Btn onClick={() => setDraft(null)}>Revert</Btn>
            <Btn
              tone="primary"
              disabled={active.length === 0}
              onClick={() =>
                request({
                  title: `Update personas — ${uid}`,
                  description: active.length === 0 ? 'At least one persona must remain (409 LAST_PROFILE).' : `New set: ${active.join(', ')}`,
                  confirmLabel: 'Save personas',
                  action: (reason) => admin.users.setPersonas(uid, active, reason),
                  onDone: () => {
                    setDraft(null);
                    onChanged();
                  },
                })
              }
            >
              Save personas
            </Btn>
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {PERSONA_OPTIONS.map((p) => {
          const on = active.includes(p);
          return (
            <button
              key={p}
              type="button"
              onClick={() => toggle(p)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors ${
                on
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-500 border-slate-200 hover:border-emerald-300'
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>
      {modal}
    </div>
  );
};
