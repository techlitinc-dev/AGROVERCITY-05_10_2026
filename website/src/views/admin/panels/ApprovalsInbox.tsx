import React from 'react';
import { CheckCheck } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  Btn,
  idOf,
  str,
  useAsync,
  useReasonModal,
  type Row,
} from './shared';

/**
 * Maker-checker approvals inbox — high-value money movements (refunds,
 * penny-drop overrides, coin adjustments, claim payouts) park a pending
 * admin_approvals doc that a *different* admin must second
 * (GET /admin/approvals, POST /admin/approvals/{id}/approve|reject).
 * Mounted both as a sidebar entry and inside the SOP-26 platform panel.
 */
export const ApprovalsInboxPanel: React.FC = () => {
  const { request, modal } = useReasonModal();
  const approvals = useAsync(() => admin.moderation.approvals(), []);

  return (
    <PanelShell
      title="Approvals Inbox (maker-checker)"
      subtitle="High-risk actions awaiting a second admin's approval. Approving executes the parked mutation."
      icon={CheckCheck}
      loading={approvals.loading}
      error={approvals.error}
      onRefresh={approvals.reload}
    >
      <DataTable
        rows={(approvals.data ?? []) as Row[]}
        empty="Nothing pending approval."
        columns={[
          {
            header: 'Request',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'action', 'type', 'title', 'kind')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'summary', 'description', 'payload', 'entity')}</p>
              </div>
            ),
          },
          {
            header: 'Requested by',
            cell: (r) => <span className="text-slate-600">{str(r, 'requestedBy', 'maker', 'requester', 'uid')}</span>,
          },
          {
            header: 'Amount',
            cell: (r) => <span className="font-bold text-slate-900">{str(r, 'amount', 'value', 'paise')}</span>,
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
                      title: `Reject approval ${idOf(r)}`,
                      confirmLabel: 'Reject',
                      tone: 'danger',
                      action: (reason) => admin.moderation.reject(idOf(r), { reason }, reason),
                      onDone: approvals.reload,
                    })
                  }
                >
                  Reject
                </Btn>
                <Btn
                  tone="primary"
                  onClick={() =>
                    request({
                      title: `Approve ${str(r, 'action', 'type')}`,
                      description: 'This executes the parked mutation immediately.',
                      defaultReason: 'Second-admin approval granted',
                      confirmLabel: 'Approve',
                      action: (reason) => admin.moderation.approve(idOf(r), reason),
                      onDone: approvals.reload,
                    })
                  }
                >
                  Approve
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
