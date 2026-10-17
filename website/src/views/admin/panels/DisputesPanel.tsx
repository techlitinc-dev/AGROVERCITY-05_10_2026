import React, { useState } from 'react';
import { Scale, Map, Sprout } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Tabs,
  Field,
  Select,
  TextInput,
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
 * SOP-10 — Disputes Desk & Land Arbitration.
 * Unified dispute inbox (trade / transport / escrow) with ruling + structured
 * settlement, plus the land-lease desk: agreement inspection and arbitrated
 * lease termination (MPIN step-up).
 */
export const DisputesPanel: React.FC = () => {
  const [tab, setTab] = useState('disputes');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'disputes', label: 'Disputes inbox' },
          { id: 'leases', label: 'Land leases' },
          { id: 'listings', label: 'Land listings' },
        ]}
      />
      {tab === 'disputes' && <DisputesCard />}
      {tab === 'leases' && <LeasesCard />}
      {tab === 'listings' && <ListingsCard />}
    </>
  );
};

const DisputesCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleParty, setSettleParty] = useState('buyer');
  const disputes = useAsync(() => admin.disputes.list(), []);
  const detail = useAsync(
    () => (selectedId ? admin.disputes.get(selectedId).catch(() => null) : Promise.resolve(null)),
    [selectedId]
  );

  const rows = (disputes.data ?? []) as Row[];
  const selected = selectedId ? rows.find((r) => idOf(r) === selectedId) ?? null : null;

  return (
    <>
      <PanelShell
        title="SOP-10: Unified Disputes Inbox"
        subtitle="Escrow and trade disputes across bookings, lots, deals and equipment. Rule with a resolution or push a structured settlement with money movement."
        icon={Scale}
        loading={disputes.loading}
        error={disputes.error}
        onRefresh={() => {
          disputes.reload();
          detail.reload();
        }}
      >
        <DataTable
          rows={rows}
          empty="No open disputes."
          columns={[
            {
              header: 'Dispute',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'reason', 'category', 'subject', 'title')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                </div>
              ),
            },
            {
              header: 'Raised by',
              cell: (r) => (
                <div>
                  <p className="font-semibold text-slate-700">{str(r, 'raisedBy', 'complainant', 'buyerName', 'farmerName')}</p>
                  <p className="text-[10px] text-slate-400">vs {str(r, 'against', 'respondent', 'counterparty')}</p>
                </div>
              ),
            },
            {
              header: 'Amount at stake',
              cell: (r) => <span className="font-bold">{money(num(r, 'amount', 'disputedAmount', 'escrowAmount'))}</span>,
            },
            {
              header: 'Opened',
              cell: (r) => <span className="text-slate-500">{str(r, 'createdAt', 'openedAt', 'filedAt')}</span>,
            },
            {
              header: 'Status',
              cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
            },
            {
              header: 'Action',
              className: 'text-right',
              cell: (r) => <Btn onClick={() => setSelectedId(idOf(r))}>Open</Btn>,
            },
          ]}
        />
      </PanelShell>

      {selected && (
        <PanelShell
          title={`Dispute ${idOf(selected)}`}
          subtitle="Thread detail, ruling and structured settlement (POST /admin/disputes/{id}/settlement executes the money movement)."
          icon={Scale}
          actions={
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Settlement ₹" className="w-32">
                <TextInput type="number" value={settleAmount} onChange={setSettleAmount} placeholder="5000" />
              </Field>
              <Field label="Award to" className="w-32">
                <Select
                  value={settleParty}
                  onChange={setSettleParty}
                  options={[
                    { value: 'buyer', label: 'Buyer' },
                    { value: 'seller', label: 'Seller / farmer' },
                    { value: 'split', label: 'Split' },
                  ]}
                />
              </Field>
              <Btn
                disabled={!settleAmount}
                onClick={() =>
                  request({
                    title: `Structured settlement — dispute ${idOf(selected)}`,
                    description: `Award ₹${settleAmount} to ${settleParty}.`,
                    confirmLabel: 'Push settlement',
                    action: (reason) =>
                      admin.disputes.settle(
                        idOf(selected),
                        { amount: Number(settleAmount), awardedTo: settleParty, reason },
                        reason
                      ),
                    onDone: disputes.reload,
                  })
                }
              >
                Settle
              </Btn>
              <Btn
                tone="primary"
                onClick={() =>
                  request({
                    title: `Resolve dispute ${idOf(selected)}`,
                    defaultReason: 'Reviewed evidence from both parties',
                    confirmLabel: 'Resolve',
                    action: (reason) => admin.disputes.resolve(idOf(selected), { resolution: reason, reason }, reason),
                    onDone: disputes.reload,
                  })
                }
              >
                Resolve
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

const LeasesCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [agreement, setAgreement] = useState<Row | null>(null);
  const leases = useAsync(() => admin.fieldOps.landLeases(), []);

  const openAgreement = async (leaseId: string) => {
    try {
      const data = await admin.fieldOps.leaseAgreement(leaseId);
      setAgreement(data && typeof data === 'object' ? (data as Row) : { leaseId, body: data });
    } catch {
      setAgreement({ leaseId, error: 'Agreement document unavailable' });
    }
  };

  return (
    <PanelShell
      title="SOP-10: Land Lease Arbitration"
      subtitle="Active farmer ↔ landlord leases. Inspect the generated agreement; terminate only after arbitration — MPIN step-up required."
      icon={Map}
      loading={leases.loading}
      error={leases.error}
      onRefresh={leases.reload}
    >
      <DataTable
        rows={(leases.data ?? []) as Row[]}
        empty="No land leases on record."
        columns={[
          {
            header: 'Plot',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'plotName', 'plot', 'title', 'village')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          {
            header: 'Landlord → Tenant',
            cell: (r) => (
              <span className="text-slate-600">
                {str(r, 'landlordName', 'landlord')} → {str(r, 'tenantName', 'farmerName', 'tenant')}
              </span>
            ),
          },
          {
            header: 'Rent',
            cell: (r) => (
              <div>
                <p className="font-bold">{money(num(r, 'rentPerYear', 'annualRent', 'rent'))}/yr</p>
                <p className="text-[10px] text-slate-400">{num(r, 'areaAcres', 'acres', 'area')} acres</p>
              </div>
            ),
          },
          {
            header: 'Term',
            cell: (r) => (
              <span className="text-slate-500">
                {str(r, 'startDate', 'from')} → {str(r, 'endDate', 'to')}
              </span>
            ),
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
                <Btn onClick={() => openAgreement(idOf(r))}>Agreement</Btn>
                <Btn
                  tone="danger"
                  onClick={() =>
                    request({
                      title: `Terminate lease ${idOf(r)}`,
                      description: `${str(r, 'plotName', 'plot', 'title')} — ${str(r, 'landlordName', 'landlord')} → ${str(r, 'tenantName', 'farmerName', 'tenant')}`,
                      confirmLabel: 'Terminate lease',
                      requireMpin: true,
                      tone: 'danger',
                      action: (reason) => admin.fieldOps.terminateLease(idOf(r), { reason }, reason),
                      onDone: leases.reload,
                    })
                  }
                >
                  Terminate
                </Btn>
              </div>
            ),
          },
        ]}
      />
      {agreement && (
        <div className="pt-4">
          <PanelShell
            title={`Lease agreement — ${str(agreement, 'leaseId')}`}
            subtitle="Stored lease agreement snapshot (GET /admin/land/leases/{id}/agreement)."
            icon={Map}
            actions={<Btn onClick={() => setAgreement(null)}>Close</Btn>}
          >
            <KV record={agreement} />
          </PanelShell>
        </div>
      )}
      {modal}
    </PanelShell>
  );
};

const ListingsCard: React.FC = () => {
  const listings = useAsync(() => admin.fieldOps.landListings(), []);

  return (
    <PanelShell
      title="SOP-10: Land Listings"
      subtitle="Plots listed for lease on the marketplace, with AI quality audit flags (rent band, completeness)."
      icon={Sprout}
      loading={listings.loading}
      error={listings.error}
      onRefresh={listings.reload}
    >
      <DataTable
        rows={(listings.data ?? []) as Row[]}
        empty="No land listings."
        columns={[
          {
            header: 'Plot',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'title', 'plotName', 'village')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'district', 'state')}</p>
              </div>
            ),
          },
          { header: 'Owner', cell: (r) => <span className="text-slate-600">{str(r, 'ownerName', 'landlordName', 'owner')}</span> },
          {
            header: 'Area / Rent',
            cell: (r) => (
              <div>
                <p className="font-bold">{money(num(r, 'expectedRent', 'rentPerYear', 'rent'))}/yr</p>
                <p className="text-[10px] text-slate-400">{num(r, 'areaAcres', 'acres', 'area')} acres</p>
              </div>
            ),
          },
          {
            header: 'AI flags',
            cell: (r) => <span className="text-amber-600 text-[10px] font-semibold">{str(r, 'qualityFlags', 'flags', 'auditFlags')}</span>,
          },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
        ]}
      />
    </PanelShell>
  );
};
