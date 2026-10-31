import React, { useState } from 'react';
import { Scale, Map, Sprout, AlarmClock, TimerOff } from 'lucide-react';
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
  Banner,
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
 * Unified dispute inbox (trade / transport reports / escrow) with ruling + structured
 * settlement, land-lease desk (agreement inspection and arbitrated lease
 * termination), and the pickup-exception monitor: grace-window config plus
 * bookings stuck past their scheduled pickup slot.
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
          { id: 'pickups', label: 'Pickup exceptions' },
          { id: 'leases', label: 'Land leases' },
          { id: 'listings', label: 'Land listings' },
        ]}
      />
      {tab === 'disputes' && <DisputesCard />}
      {tab === 'pickups' && <PickupExceptionsCard />}
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

const PickupExceptionsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const grace = useAsync(() => admin.dispatch.graceWindow().catch(() => null), []);
  const exceptions = useAsync(() => admin.dispatch.pickupExceptions(), []);

  const cfg = asRow(grace.data);
  const [pickupGrace, setPickupGrace] = useState('');
  const [dropGrace, setDropGrace] = useState('');
  const [autoCancel, setAutoCancel] = useState<boolean | null>(null);
  const draftStarted =
    pickupGrace !== '' || dropGrace !== '' || autoCancel !== null;

  const saveGrace = async (reason: string) => {
    await admin.dispatch.updateGraceWindow(
      {
        ...(pickupGrace !== '' ? { pickupGraceMinutes: Number(pickupGrace) } : {}),
        ...(dropGrace !== '' ? { dropGraceMinutes: Number(dropGrace) } : {}),
        ...(autoCancel !== null ? { autoCancelEnabled: autoCancel } : {}),
      },
      reason
    );
    setPickupGrace('');
    setDropGrace('');
    setAutoCancel(null);
    grace.reload();
    exceptions.reload();
  };

  return (
    <>
      <PanelShell
        title="SOP-10: Pickup Grace Window"
        subtitle="Grace minutes before a scheduled pickup/drop counts as an exception. Feed for the exception monitor and the auto-canceller (GET/PUT /admin/platform-config/grace-window)."
        icon={AlarmClock}
        loading={grace.loading}
        onRefresh={grace.reload}
        actions={
          draftStarted ? (
            <div className="flex items-end gap-2">
              <Btn onClick={() => { setPickupGrace(''); setDropGrace(''); setAutoCancel(null); }}>Cancel</Btn>
              <Btn
                tone="primary"
                onClick={() =>
                  request({
                    title: 'Update pickup grace window',
                    defaultReason: 'Grace window tuning from disputes desk',
                    confirmLabel: 'Save grace window',
                    action: saveGrace,
                  })
                }
              >
                Save (audited)
              </Btn>
            </div>
          ) : undefined
        }
      >
        {grace.error && <Banner kind="error">{grace.error}</Banner>}
        {cfg && (
          <div className="flex flex-wrap items-end gap-3">
            <Field label={`Pickup grace (min) — current ${num(cfg, 'pickupGraceMinutes') ?? '—'}`} className="w-44">
              <TextInput type="number" inputMode="numeric" value={pickupGrace} onChange={setPickupGrace} placeholder={String(num(cfg, 'pickupGraceMinutes') ?? 30)} />
            </Field>
            <Field label={`Drop grace (min) — current ${num(cfg, 'dropGraceMinutes') ?? '—'}`} className="w-44">
              <TextInput type="number" inputMode="numeric" value={dropGrace} onChange={setDropGrace} placeholder={String(num(cfg, 'dropGraceMinutes') ?? 60)} />
            </Field>
            <Field label={`Auto-cancel — currently ${String(cfg.autoCancelEnabled ?? false)}`} className="w-52">
              <Select
                value={autoCancel === null ? '' : String(autoCancel)}
                onChange={(v) => setAutoCancel(v === '' ? null : v === 'true')}
                options={[
                  { value: '', label: 'Keep current' },
                  { value: 'true', label: 'Enabled' },
                  { value: 'false', label: 'Disabled' },
                ]}
              />
            </Field>
            <p className="text-[11px] text-slate-400 pb-2.5">
              Last updated {str(cfg, 'updatedAt')} by {str(cfg, 'updatedBy')}
            </p>
          </div>
        )}
      </PanelShell>

      <PanelShell
        title="SOP-10: Pickup Exceptions Monitor"
        subtitle="Bookings stuck in requested/accepted/arrivedPickup past the scheduled pickup slot + grace window (GET /admin/exceptions/pickup)."
        icon={TimerOff}
        loading={exceptions.loading}
        error={exceptions.error}
        onRefresh={exceptions.reload}
      >
        <DataTable
          rows={(exceptions.data ?? []) as Row[]}
          empty="No pickups stuck past the grace window."
          columns={[
            {
              header: 'Booking',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'commodity', 'vehicleNo', 'status')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{str(r, 'bookingId')}</p>
                </div>
              ),
            },
            {
              header: 'Route',
              cell: (r) => (
                <span className="text-slate-600">{str(r, 'pickup')} → {str(r, 'drop')}</span>
              ),
            },
            {
              header: 'Driver / Vehicle',
              cell: (r) => (
                <div>
                  <p className="text-slate-700">{str(r, 'driverName')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'driverPhone')} • {str(r, 'vehicleNo')}</p>
                </div>
              ),
            },
            {
              header: 'Scheduled pickup',
              cell: (r) => <span className="text-slate-500">{str(r, 'scheduledPickupAt')}</span>,
            },
            {
              header: 'Overdue',
              cell: (r) => {
                const mins = num(r, 'minutesOverdue');
                return (
                  <span className={`font-extrabold ${mins !== null && mins > (num(r, 'graceMinutes') ?? 0) * 2 ? 'text-rose-600' : 'text-amber-600'}`}>
                    {mins ?? '—'} min
                  </span>
                );
              },
            },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status')} /> },
            {
              header: 'Parties',
              cell: (r) => (
                <div className="text-[10px] text-slate-400 font-mono">
                  <p>farmer: {str(r, 'userId')}</p>
                  <p>transporter: {str(r, 'transporterId')}</p>
                </div>
              ),
            },
          ]}
        />
      </PanelShell>
      {modal}
    </>
  );
};
