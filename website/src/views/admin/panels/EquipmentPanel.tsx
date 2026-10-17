import React, { useState } from 'react';
import { Wrench, PackageSearch, AlertTriangle } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiClient } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  Btn,
  Tabs,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  asRows,
  type Row,
} from './shared';

/**
 * SOP-09 — Equipment Rental Fleet.
 * Equipment list + verification, bookings board with force-cancel and
 * escalation, and the machinery damage-claims queue with security-deposit
 * forfeiture review (GET /admin/equipment/damage-claims — direct apiClient;
 * the admin namespace has no method for it).
 */
export const EquipmentPanel: React.FC = () => {
  const [tab, setTab] = useState('fleet');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'fleet', label: 'Fleet verification' },
          { id: 'bookings', label: 'Bookings' },
          { id: 'damage', label: 'Damage claims' },
        ]}
      />
      {tab === 'fleet' && <FleetCard />}
      {tab === 'bookings' && <BookingsCard />}
      {tab === 'damage' && <DamageClaimsCard />}
    </>
  );
};

const FleetCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const equipment = useAsync(() => admin.equipment.list(), []);

  return (
    <PanelShell
      title="SOP-09: Equipment Fleet Verification"
      subtitle="Owner-listed machinery. Verify listings before they appear in the rental marketplace."
      icon={Wrench}
      loading={equipment.loading}
      error={equipment.error}
      onRefresh={equipment.reload}
    >
      <DataTable
        rows={(equipment.data ?? []) as Row[]}
        empty="No equipment listed."
        columns={[
          {
            header: 'Machine',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'title', 'name', 'model', 'type')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'category', 'implementType')}</p>
              </div>
            ),
          },
          {
            header: 'Owner',
            cell: (r) => <span className="text-slate-600">{str(r, 'ownerName', 'owner', 'ownerId')}</span>,
          },
          {
            header: 'Rate',
            cell: (r) => (
              <div>
                <p className="font-bold">{money(num(r, 'ratePerHour', 'ratePerDay', 'price', 'rent'))}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'rateUnit', 'pricingUnit')}</p>
              </div>
            ),
          },
          {
            header: 'Verification',
            cell: (r) => <StatusBadge status={str(r, 'verificationStatus', 'verified', 'status', 'state')} />,
          },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                tone="primary"
                onClick={() =>
                  request({
                    title: `Verify equipment ${str(r, 'title', 'name', 'model')}`,
                    defaultReason: 'Ownership + condition verified',
                    confirmLabel: 'Verify',
                    action: (reason) => admin.equipment.verify(idOf(r), reason),
                    onDone: equipment.reload,
                  })
                }
              >
                Verify
              </Btn>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const BookingsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const bookings = useAsync(() => admin.equipment.bookings(), []);

  return (
    <PanelShell
      title="SOP-09: Equipment Bookings"
      subtitle="Force-cancel fraudulent bookings or escalate disputes to the claims desk."
      icon={PackageSearch}
      loading={bookings.loading}
      error={bookings.error}
      onRefresh={bookings.reload}
    >
      <DataTable
        rows={(bookings.data ?? []) as Row[]}
        empty="No equipment bookings."
        columns={[
          {
            header: 'Booking',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'equipmentName', 'equipmentTitle', 'title')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          {
            header: 'Renter / Owner',
            cell: (r) => (
              <span className="text-slate-600">
                {str(r, 'renterName', 'renter', 'farmerName')} ← {str(r, 'ownerName', 'owner')}
              </span>
            ),
          },
          {
            header: 'Dates',
            cell: (r) => (
              <span className="text-slate-500">
                {str(r, 'startDate', 'from')} → {str(r, 'endDate', 'to')}
              </span>
            ),
          },
          {
            header: 'Value',
            cell: (r) => <span className="font-bold">{money(num(r, 'total', 'amount', 'bookingValue'))}</span>,
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
                  tone="warn"
                  onClick={() =>
                    request({
                      title: `Escalate booking ${idOf(r)}`,
                      confirmLabel: 'Escalate',
                      action: (reason) => admin.equipment.escalateBooking(idOf(r), { reason, escalate: true }, reason),
                      onDone: bookings.reload,
                    })
                  }
                >
                  <AlertTriangle className="w-3.5 h-3.5" /> Escalate
                </Btn>
                <Btn
                  tone="danger"
                  onClick={() =>
                    request({
                      title: `Force-cancel booking ${idOf(r)}`,
                      confirmLabel: 'Force cancel',
                      requireMpin: true,
                      tone: 'danger',
                      action: (reason) => admin.equipment.deleteBooking(idOf(r), reason),
                      onDone: bookings.reload,
                    })
                  }
                >
                  Force-cancel
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

const DamageClaimsCard: React.FC = () => {
  const claims = useAsync(
    () => apiClient.get('/admin/equipment/damage-claims').then((res) => (res.data?.data ?? res.data) as unknown),
    []
  );
  const rows = asRows(claims.data);

  return (
    <PanelShell
      title="SOP-09: Damage Claims & Deposit Forfeiture Review"
      subtitle="Machinery damage reports joined to their booking and farmer (GET /admin/equipment/damage-claims — direct apiClient; absent from the admin namespace). Forfeit / waive deposit decisions ride on the booking escalation flow."
      icon={AlertTriangle}
      loading={claims.loading}
      error={claims.error}
      onRefresh={claims.reload}
    >
      <DataTable
        rows={rows}
        empty="No damage claims filed."
        columns={[
          {
            header: 'Claim',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'damageType', 'type', 'title', 'issue')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          {
            header: 'Booking / Equipment',
            cell: (r) => (
              <div>
                <p className="font-semibold text-slate-700">{str(r, 'equipmentName', 'equipmentTitle')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'bookingId')}</p>
              </div>
            ),
          },
          {
            header: 'Reported by',
            cell: (r) => <span className="text-slate-600">{str(r, 'ownerName', 'reportedBy', 'userName', 'ownerId')}</span>,
          },
          {
            header: 'Estimate',
            cell: (r) => <span className="font-bold">{money(num(r, 'estimateAmount', 'estimate', 'claimAmount'))}</span>,
          },
          {
            header: 'Deposit decision',
            cell: (r) => <span className="text-slate-600">{str(r, 'depositDecision', 'forfeiture', 'resolution')}</span>,
          },
          {
            header: 'Filed',
            cell: (r) => <span className="text-slate-500">{str(r, 'createdAt', 'filedAt')}</span>,
          },
          {
            header: 'Status',
            cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
          },
        ]}
      />
    </PanelShell>
  );
};
