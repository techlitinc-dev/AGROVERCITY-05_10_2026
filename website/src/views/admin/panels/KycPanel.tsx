import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Tabs,
  Btn,
  idOf,
  str,
  useAsync,
  useReasonModal,
  type Row,
} from './shared';

/**
 * SOP-03 — KYC & Document Vault Queue.
 * Pending list → case detail (document preview links) → verify / reject-with-reason → history.
 */
export const KycPanel: React.FC = () => {
  const [tab, setTab] = useState('pending');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { request, modal } = useReasonModal();

  const pending = useAsync(() => admin.kyc.pending(), []);
  const queue = useAsync(() => admin.kyc.queue(), []);
  const history = useAsync(() => admin.kyc.history(), []);

  const reloadAll = () => {
    pending.reload();
    queue.reload();
    history.reload();
  };

  const rows = tab === 'pending' ? pending : tab === 'queue' ? queue : history;
  const activeRows = (rows.data ?? []) as Row[];
  const selected = selectedId ? (activeRows.find((r) => idOf(r) === selectedId) ?? null) : null;

  return (
    <>
      <PanelShell
        title="SOP-03: KYC Verification & Document Vault Queue"
        subtitle="Review submitted identity documents, verify or reject with a recorded reason, browse decision history."
        icon={ShieldCheck}
        loading={rows.loading}
        error={rows.error}
        onRefresh={rows.reload}
        actions={<Tabs
          active={tab}
          onChange={(t) => {
            setTab(t);
            setSelectedId(null);
          }}
          tabs={[
            { id: 'pending', label: 'Pending' },
            { id: 'queue', label: 'Full queue' },
            { id: 'history', label: 'History' },
          ]}
        />}
      >
        <DataTable
          rows={activeRows}
          empty="Queue is empty. Nothing awaiting review."
          columns={[
            {
              header: 'Applicant',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'name', 'applicantName', 'userName', 'fullName')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{str(r, 'userId', 'uid', 'phone', 'applicantId')}</p>
                </div>
              ),
            },
            {
              header: 'Persona / Doc type',
              cell: (r) => (
                <div>
                  <p className="font-semibold text-slate-700">{str(r, 'persona', 'role', 'personaType', 'userRole')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'docType', 'documentType', 'kycType', 'type')}</p>
                </div>
              ),
            },
            {
              header: 'Submitted',
              cell: (r) => <span className="text-slate-500">{str(r, 'submittedAt', 'createdAt', 'submitted', 'updatedAt')}</span>,
            },
            {
              header: 'Status',
              cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
            },
            {
              header: 'Action',
              className: 'text-right',
              cell: (r) => (
                <Btn onClick={() => setSelectedId(idOf(r))}>Open case</Btn>
              ),
            },
          ]}
        />
      </PanelShell>

      {selected && (
        <PanelShell
          title={`Case: ${str(selected, 'name', 'applicantName', 'userName')} (${str(selected, 'docType', 'documentType', 'kycType')})`}
          subtitle="Document preview links and case actions. Every decision is written to the audit log."
          icon={ShieldCheck}
          actions={
            <div className="flex gap-2">
              <Btn
                tone="danger"
                onClick={() =>
                  request({
                    title: 'Reject KYC case',
                    description: 'Rejection reason is stored on the case and shown to the applicant.',
                    confirmLabel: 'Reject case',
                    tone: 'danger',
                    action: (reason) => admin.kyc.reject(idOf(selected), { reason }, reason),
                    onDone: reloadAll,
                  })
                }
              >
                Reject
              </Btn>
              <Btn
                tone="primary"
                onClick={() =>
                  request({
                    title: 'Verify KYC case',
                    defaultReason: 'Documents verified against originals',
                    confirmLabel: 'Verify & approve',
                    action: (reason) => admin.kyc.verify(idOf(selected), reason),
                    onDone: reloadAll,
                  })
                }
              >
                Verify
              </Btn>
            </div>
          }
        >
          <KV record={selected} />
        </PanelShell>
      )}
      {modal}
    </>
  );
};
