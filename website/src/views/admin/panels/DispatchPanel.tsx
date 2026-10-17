import React, { useState } from 'react';
import { Truck, BadgeCheck, SlidersHorizontal, Ban } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  Btn,
  Tabs,
  Field,
  TextInput,
  Select,
  JsonConfigCard,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  type Row,
} from './shared';

/**
 * SOP-08 — Transport Fleet & Dispatch.
 * Transport bookings board with forced status, vehicle verification,
 * transporter suspension and pricing rules.
 */
export const DispatchPanel: React.FC = () => {
  const [tab, setTab] = useState('bookings');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'bookings', label: 'Bookings board' },
          { id: 'vehicles', label: 'Vehicles' },
          { id: 'pricing', label: 'Pricing rules' },
          { id: 'suspend', label: 'Suspend transporter' },
        ]}
      />
      {tab === 'bookings' && <BookingsCard />}
      {tab === 'vehicles' && <VehiclesCard />}
      {tab === 'pricing' && (
        <JsonConfigCard
          title="SOP-08: Transport Pricing Rules"
          subtitle="Base fares, per-km rates and surge windows (GET/PUT /admin/transport/pricing-rules)."
          icon={SlidersHorizontal}
          load={() => admin.dispatch.pricingRules()}
          save={(payload, reason) => admin.dispatch.updatePricingRules(payload, reason)}
        />
      )}
      {tab === 'suspend' && <SuspendTransporterCard />}
    </>
  );
};

const BOOKING_STATUSES = ['pending', 'accepted', 'loading', 'in_transit', 'delivered', 'cancelled', 'disputed'];

const BookingsCard: React.FC = () => {
  const [status, setStatus] = useState('');
  const { request, modal } = useReasonModal();
  const bookings = useAsync(
    () => admin.dispatch.bookings({ ...(status ? { status } : {}) }),
    [status]
  );

  return (
    <PanelShell
      title="SOP-08: Transport Bookings Board"
      subtitle="Live load bookings. Force a booking status only to break deadlocks — every override is audit-logged."
      icon={Truck}
      loading={bookings.loading}
      error={bookings.error}
      onRefresh={bookings.reload}
      actions={
        <Field label="Status filter" className="w-40">
          <Select
            value={status}
            onChange={setStatus}
            options={[{ value: '', label: 'All' }, ...BOOKING_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]}
          />
        </Field>
      }
    >
      <DataTable
        rows={(bookings.data ?? []) as Row[]}
        empty="No bookings match this filter."
        columns={[
          {
            header: 'Load',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'crop', 'commodity', 'loadType', 'title')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          {
            header: 'Route',
            cell: (r) => (
              <span className="text-slate-600">
                {str(r, 'from', 'origin', 'pickup')} → {str(r, 'to', 'destination', 'drop')}
              </span>
            ),
          },
          {
            header: 'Transporter',
            cell: (r) => <span className="text-slate-600">{str(r, 'transporterName', 'transporter', 'vehicleNo', 'vehicleNumber')}</span>,
          },
          {
            header: 'Fare',
            cell: (r) => <span className="font-bold">{money(num(r, 'fare', 'price', 'agreedFare', 'quote'))}</span>,
          },
          {
            header: 'Status',
            cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
          },
          {
            header: 'Force status',
            className: 'text-right',
            cell: (r) => (
              <Select
                className="w-36 ml-auto"
                value=""
                onChange={(v) =>
                  v &&
                  request({
                    title: `Force booking ${idOf(r)} → ${v}`,
                    confirmLabel: 'Force status',
                    tone: 'warn',
                    action: (reason) => admin.dispatch.setBookingStatus(idOf(r), v, reason),
                    onDone: bookings.reload,
                  })
                }
                options={[{ value: '', label: 'Set…' }, ...BOOKING_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]}
              />
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const VehiclesCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const vehicles = useAsync(() => admin.dispatch.vehicles(), []);

  return (
    <PanelShell
      title="SOP-08: Fleet Vehicle Registry"
      subtitle="Verify vehicle documents (RC, permit, insurance) before they can accept loads."
      icon={BadgeCheck}
      loading={vehicles.loading}
      error={vehicles.error}
      onRefresh={vehicles.reload}
    >
      <DataTable
        rows={(vehicles.data ?? []) as Row[]}
        empty="No vehicles registered."
        columns={[
          {
            header: 'Vehicle',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'vehicleNumber', 'numberPlate', 'registrationNo', 'rcNumber')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'type', 'vehicleType', 'model', 'capacity')}</p>
              </div>
            ),
          },
          {
            header: 'Owner',
            cell: (r) => (
              <div>
                <p className="font-semibold text-slate-700">{str(r, 'ownerName', 'transporterName', 'owner')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{str(r, 'ownerId', 'transporterId', 'uid')}</p>
              </div>
            ),
          },
          {
            header: 'Docs',
            cell: (r) => <span className="text-slate-500">{str(r, 'documents', 'docs', 'permit')}</span>,
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
                    title: `Verify vehicle ${str(r, 'vehicleNumber', 'numberPlate', 'registrationNo')}`,
                    defaultReason: 'RC + permit + insurance verified',
                    confirmLabel: 'Verify vehicle',
                    action: (reason) => admin.dispatch.verifyVehicle(idOf(r), reason),
                    onDone: vehicles.reload,
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

const SuspendTransporterCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [tid, setTid] = useState('');

  return (
    <PanelShell
      title="SOP-08: Suspend Transporter"
      subtitle="Suspend a transporter for fraud or safety violations — cancels their active bids and freezes payouts."
      icon={Ban}
    >
      <div className="flex flex-wrap items-end gap-2 max-w-xl">
        <Field label="Transporter ID" className="flex-1 min-w-52">
          <TextInput value={tid} onChange={setTid} placeholder="trn_…" />
        </Field>
        <Btn
          tone="danger"
          disabled={!tid.trim()}
          onClick={() =>
            request({
              title: `Suspend transporter ${tid.trim()}`,
              confirmLabel: 'Suspend',
              requireMpin: true,
              tone: 'danger',
              action: (reason) => admin.dispatch.suspendTransporter(tid.trim(), { reason, suspended: true }, reason),
            })
          }
        >
          Suspend transporter
        </Btn>
      </div>
      {modal}
    </PanelShell>
  );
};
