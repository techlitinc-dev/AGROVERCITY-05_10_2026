import React, { useState } from 'react';
import { Landmark, PauseCircle, Percent, FileBarChart2 } from 'lucide-react';
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
  Banner,
  JsonConfigCard,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  asRow,
  type Row,
} from './shared';

/**
 * SOP-25 — Financial Settlements & Cron Jobs.
 * Settlements list + status filter, mark-paid, run batch, holds place/release/reject,
 * commission config, financial reports.
 */
export const SettlementsPanel: React.FC = () => {
  const [tab, setTab] = useState('settlements');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'settlements', label: 'Settlements' },
          { id: 'holds', label: 'Holds' },
          { id: 'commissions', label: 'Commissions' },
          { id: 'reports', label: 'Financial reports' },
        ]}
      />
      {tab === 'settlements' && <SettlementsCard />}
      {tab === 'holds' && <HoldsCard />}
      {tab === 'commissions' && (
        <JsonConfigCard
          title="SOP-25: Commission Configuration"
          subtitle="Platform commission matrix (GET/PUT /admin/platform-config/commissions)."
          icon={Percent}
          load={() => admin.platform.commissionConfig()}
          save={(payload, reason) => admin.platform.updateCommissionConfig(payload, reason)}
        />
      )}
      {tab === 'reports' && <FinancialReportsCard />}
    </>
  );
};

const SettlementsCard: React.FC = () => {
  const [status, setStatus] = useState('');
  const { request, modal } = useReasonModal();
  const settlements = useAsync(
    () => admin.finance.settlements({ ...(status ? { status } : {}) }),
    [status]
  );

  return (
    <PanelShell
      title="SOP-25: Settlements Queue"
      subtitle="Payout settlements across marketplaces, transport and equipment. Run the batch job or mark individual settlements paid."
      icon={Landmark}
      loading={settlements.loading}
      error={settlements.error}
      onRefresh={settlements.reload}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Status filter" className="w-40">
            <Select
              value={status}
              onChange={setStatus}
              options={[
                { value: '', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'processing', label: 'Processing' },
                { value: 'paid', label: 'Paid' },
                { value: 'on_hold', label: 'On hold' },
                { value: 'failed', label: 'Failed' },
              ]}
            />
          </Field>
          <Btn
            tone="warn"
            onClick={() =>
              request({
                title: 'Run settlements batch job',
                description: 'Executes POST /admin/jobs/settlements/run for all due settlements.',
                confirmLabel: 'Run batch',
                tone: 'warn',
                requireMpin: true,
                defaultReason: 'Manual settlement batch from SOP-25',
                action: (reason) => admin.finance.runSettlements(reason),
                onDone: settlements.reload,
              })
            }
          >
            Run batch job
          </Btn>
        </div>
      }
    >
      <DataTable
        rows={(settlements.data ?? []) as Row[]}
        empty="No settlements match this filter."
        columns={[
          {
            header: 'Settlement',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'payeeName', 'partyName', 'payee', 'name')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          {
            header: 'Type / Ref',
            cell: (r) => (
              <div>
                <p className="font-semibold text-slate-700">{str(r, 'type', 'kind', 'category')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'referenceId', 'refId', 'orderId', 'sourceId')}</p>
              </div>
            ),
          },
          {
            header: 'Amount',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{money(num(r, 'amount', 'grossAmount', 'total', 'payable'))}</p>
                <p className="text-[10px] text-slate-400">commission {money(num(r, 'commission', 'commissionAmount', 'fee'))}</p>
              </div>
            ),
          },
          {
            header: 'Due',
            cell: (r) => <span className="text-slate-500">{str(r, 'dueDate', 'scheduledAt', 'createdAt')}</span>,
          },
          {
            header: 'Status',
            cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
          },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) =>
              ['paid'].includes(str(r, 'status', 'state').toLowerCase()) ? (
                <span className="text-xs font-bold text-emerald-700">Settled</span>
              ) : (
                <Btn
                  tone="primary"
                  onClick={() =>
                    request({
                      title: `Mark settlement ${idOf(r)} as paid`,
                      description: `${money(num(r, 'amount', 'grossAmount', 'total', 'payable'))} → ${str(r, 'payeeName', 'partyName', 'payee')}`,
                      confirmLabel: 'Mark paid',
                      action: (reason) => admin.finance.markSettlementPaid(idOf(r), reason),
                      onDone: settlements.reload,
                    })
                  }
                >
                  Mark paid
                </Btn>
              ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const HoldsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const holds = useAsync(() => admin.settlementDesk.holds(), []);
  const [settlementId, setSettlementId] = useState('');
  const [holdReason, setHoldReason] = useState('');
  const [placing, setPlacing] = useState(false);
  const [placeMsg, setPlaceMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const placeHold = async () => {
    setPlacing(true);
    setPlaceMsg(null);
    try {
      await admin.finance.holdSettlement({ settlementId: settlementId.trim(), reason: holdReason.trim() }, holdReason.trim());
      setPlaceMsg({ kind: 'success', text: 'Hold placed.' });
      setSettlementId('');
      setHoldReason('');
      holds.reload();
    } catch (e) {
      setPlaceMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setPlacing(false);
    }
  };

  return (
    <PanelShell
      title="SOP-25: Settlement Holds"
      subtitle="Place, release or reject holds on settlement lines."
      icon={PauseCircle}
      loading={holds.loading}
      error={holds.error}
      onRefresh={holds.reload}
    >
      {placeMsg && <Banner kind={placeMsg.kind}>{placeMsg.text}</Banner>}
      <div className="flex flex-wrap items-end gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
        <Field label="Settlement ID" className="w-56">
          <TextInput value={settlementId} onChange={setSettlementId} placeholder="stl_…" />
        </Field>
        <Field label="Hold reason" className="flex-1 min-w-56">
          <TextInput value={holdReason} onChange={setHoldReason} placeholder="Why is this payout frozen?" />
        </Field>
        <Btn tone="warn" busy={placing} disabled={!settlementId.trim() || holdReason.trim().length < 3} onClick={placeHold}>
          Place hold
        </Btn>
      </div>
      <DataTable
        rows={(holds.data ?? []) as Row[]}
        empty="No holds on settlement lines."
        columns={[
          {
            header: 'Line',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{idOf(r)}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'settlementId', 'sourceId', 'referenceId')}</p>
              </div>
            ),
          },
          {
            header: 'Amount',
            cell: (r) => <span className="font-bold text-slate-900">{money(num(r, 'amount', 'value', 'total'))}</span>,
          },
          {
            header: 'Reason',
            cell: (r) => <span className="text-slate-600">{str(r, 'reason', 'holdReason', 'note')}</span>,
          },
          {
            header: 'Placed by',
            cell: (r) => <span className="text-slate-500">{str(r, 'placedBy', 'createdBy', 'adminUid')}</span>,
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
                      title: `Reject hold ${idOf(r)}`,
                      description: 'Releases the hold and lets the settlement pay out.',
                      confirmLabel: 'Reject hold',
                      tone: 'danger',
                      action: (reason) => admin.settlementDesk.rejectHold(idOf(r), { reason }, reason),
                      onDone: holds.reload,
                    })
                  }
                >
                  Reject hold
                </Btn>
                <Btn
                  tone="primary"
                  onClick={() =>
                    request({
                      title: `Release hold ${idOf(r)}`,
                      defaultReason: 'Hold reviewed and confirmed',
                      confirmLabel: 'Release',
                      action: (reason) => admin.settlementDesk.releaseHold(idOf(r), reason),
                      onDone: holds.reload,
                    })
                  }
                >
                  Release
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

const FinancialReportsCard: React.FC = () => {
  const report = useAsync(() => admin.finance.financialReports().catch(() => null), []);
  return (
    <PanelShell
      title="SOP-25: Financial Reports"
      subtitle="Aggregated platform financials (GET /admin/reports/financial)."
      icon={FileBarChart2}
      loading={report.loading}
      onRefresh={report.reload}
    >
      {report.error ? <Banner kind="error">{report.error}</Banner> : <KV record={asRow(report.data)} />}
    </PanelShell>
  );
};
