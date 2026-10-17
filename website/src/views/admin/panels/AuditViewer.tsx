import React, { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  Field,
  TextInput,
  str,
  useAsync,
  type Row,
} from './shared';

/**
 * Immutable admin audit trail (GET /admin/audit) with actor / action / entity
 * filters. Mounted both as a sidebar entry and inside the SOP-26 panel.
 */
export const AuditViewerPanel: React.FC = () => {
  const [actor, setActor] = useState('');
  const [action, setAction] = useState('');
  const [entity, setEntity] = useState('');

  const audit = useAsync(
    () =>
      admin.moderation.auditLog({
        ...(actor.trim() ? { actor: actor.trim() } : {}),
        ...(action.trim() ? { action: action.trim() } : {}),
        ...(entity.trim() ? { entity: entity.trim() } : {}),
      }),
    [actor.trim(), action.trim(), entity.trim()]
  );

  return (
    <PanelShell
      title="Audit Trail Viewer"
      subtitle="Immutable admin-action log — every mutation's actor, target and X-Audit-Reason."
      icon={ScrollText}
      loading={audit.loading}
      error={audit.error}
      onRefresh={audit.reload}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Actor" className="w-40">
            <TextInput value={actor} onChange={setActor} placeholder="admin uid…" />
          </Field>
          <Field label="Action" className="w-40">
            <TextInput value={action} onChange={setAction} placeholder="VERIFY_KYC…" />
          </Field>
          <Field label="Entity" className="w-40">
            <TextInput value={entity} onChange={setEntity} placeholder="kyc / settlements…" />
          </Field>
        </div>
      }
    >
      <DataTable
        rows={(audit.data ?? []) as Row[]}
        empty="No audit entries match these filters."
        columns={[
          {
            header: 'When',
            cell: (r) => <span className="text-slate-500">{str(r, 'at', 'createdAt', 'timestamp', 'time')}</span>,
          },
          {
            header: 'Actor',
            cell: (r) => <span className="font-mono text-slate-700">{str(r, 'actor', 'actorId', 'adminUid', 'uid')}</span>,
          },
          {
            header: 'Action',
            cell: (r) => (
              <div>
                <p className="font-semibold text-slate-800">{str(r, 'action', 'op', 'event')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'entity', 'collection', 'resource', 'docId', 'target')}</p>
              </div>
            ),
          },
          {
            header: 'Reason',
            cell: (r) => <span className="text-slate-500">{str(r, 'reason', 'auditReason', 'note')}</span>,
          },
          {
            header: 'IP',
            cell: (r) => <span className="font-mono text-slate-400">{str(r, 'ip', 'ipAddress')}</span>,
          },
        ]}
      />
    </PanelShell>
  );
};
