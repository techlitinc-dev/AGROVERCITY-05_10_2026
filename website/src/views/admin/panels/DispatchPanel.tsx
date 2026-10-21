import React, { useState } from 'react';
import { Truck, BadgeCheck, SlidersHorizontal, Ban, IdCard, Eye, X } from 'lucide-react';
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
  Banner,
  KV,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  asRow,
  asRows,
  type Row,
} from './shared';

/**
 * SOP-08 — Transport Fleet & Dispatch.
 * Transport bookings board with per-booking trip detail (status stepper,
 * negotiation rounds, expenses, POD photos), fleet-wide drivers & vehicle
 * registries (document validity highlights), forced status, transporter
 * suspension and pricing rules.
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
          { id: 'pickupAgents', label: 'Produce pickup agents' },
          { id: 'drivers', label: 'Drivers' },
          { id: 'vehicles', label: 'Vehicles' },
          { id: 'pricing', label: 'Pricing rules' },
          { id: 'suspend', label: 'Suspend transporter' },
        ]}
      />
      {tab === 'bookings' && <BookingsCard />}
      {tab === 'pickupAgents' && <PickupAgentsCard />}
      {tab === 'drivers' && <DriversCard />}
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
  const [detailId, setDetailId] = useState<string | null>(null);
  const { request, modal } = useReasonModal();
  const bookings = useAsync(
    () => admin.dispatch.bookings({ ...(status ? { status } : {}) }),
    [status]
  );

  return (
    <>
      <PanelShell
        title="SOP-08: Transport Bookings Board"
        subtitle="Live load bookings. Open a booking for the full trip file — status stepper, negotiation rounds, expenses and POD photos. Force a booking status only to break deadlocks."
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
              header: 'Actions',
              className: 'text-right',
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Btn onClick={() => setDetailId(idOf(r))}>
                    <Eye className="w-3.5 h-3.5" /> Detail
                  </Btn>
                  <Select
                    className="w-36"
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
                    options={[{ value: '', label: 'Force…' }, ...BOOKING_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]}
                  />
                </div>
              ),
            },
          ]}
        />
        {modal}
      </PanelShell>

      {detailId && <BookingDetailCard bookingId={detailId} onClose={() => setDetailId(null)} />}
    </>
  );
};

/** Renders an ISO date; red + bold when the date is already past (document expired). */
const ExpiryCell: React.FC<{ value: unknown }> = ({ value }) => {
  if (value === undefined || value === null || value === '') return <span className="text-slate-300">—</span>;
  const s = String(value);
  const d = new Date(s);
  const past = !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
  return (
    <span className={past ? 'font-bold text-rose-600' : 'text-slate-600'}>
      {s.slice(0, 10)}
      {past && <span className="ml-1 text-[9px] uppercase tracking-wider">expired</span>}
    </span>
  );
};

const firstDefined = (r: Row, key: string): unknown => r[key];

const BookingDetailCard: React.FC<{ bookingId: string; onClose: () => void }> = ({ bookingId, onClose }) => {
  const detail = useAsync(() => admin.dispatch.booking(bookingId), [bookingId]);
  const row = asRow(detail.data);
  const booking = asRow(row?.booking);
  const parties = asRow(row?.parties);
  const offers = asRows(row?.offers);
  const expenses = asRows(row?.expenses);
  const waypoints = Array.isArray(row?.waypointsLog) ? (row!.waypointsLog as Row[]) : [];
  const podPhotos = Array.isArray(row?.podPhotos) ? (row!.podPhotos as unknown[]) : [];
  const payments = asRows(row?.payments);

  const partyName = (uid: unknown): string => {
    if (!uid || typeof uid !== 'string') return '—';
    const p = asRow(parties?.[uid]);
    return p ? `${str(p, 'name')} (${str(p, 'phone')})` : uid;
  };

  return (
    <PanelShell
      title={`Trip file — ${bookingId}`}
      subtitle="GET /admin/transport/bookings/{id}: booking, negotiation rounds, waypoint history, expenses, POD photos, escrow & payments."
      icon={Truck}
      loading={detail.loading}
      error={detail.error}
      onRefresh={detail.reload}
      actions={<Btn onClick={onClose}><X className="w-3.5 h-3.5" /> Close</Btn>}
    >
      {row && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</p>
              <StatusBadge status={str(booking, 'status', 'state')} />
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Fare</p>
              <p className="text-sm font-extrabold text-slate-900">{money(num(row, 'fare') ?? num(booking, 'fare'))}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Shipper (farmer)</p>
              <p className="text-xs font-semibold text-slate-700 break-all">{partyName(str(booking, 'userId'))}</p>
            </div>
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Transporter</p>
              <p className="text-xs font-semibold text-slate-700 break-all">
                {partyName(str(booking, 'transporterId'))}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <div>
              <h4 className="text-xs font-extrabold text-slate-700 mb-2">Status stepper (waypointsLog)</h4>
              {waypoints.length === 0 ? (
                <p className="text-xs text-slate-400">No waypoint events recorded yet.</p>
              ) : (
                <ol className="relative border-l border-slate-200 ml-2 space-y-4">
                  {waypoints.map((w, i) => (
                    <li key={i} className="ml-4">
                      <span className="absolute -left-1.5 mt-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white" />
                      <p className="text-xs font-bold text-slate-800">
                        {str(w, 'label', 'waypoint', 'status')}
                        <span className="ml-2 text-[10px] font-mono font-normal text-slate-400">
                          {str(w, 'time', 'at', 'createdAt')}
                        </span>
                      </p>
                      {str(w, 'note', 'remark') !== '—' && <p className="text-[11px] text-slate-500">{str(w, 'note', 'remark')}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <div className="space-y-5">
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 mb-2">Negotiation rounds ({offers.length})</h4>
                {offers.length === 0 ? (
                  <p className="text-xs text-slate-400">No counter-offers on this booking.</p>
                ) : (
                  <div className="space-y-1.5">
                    {offers.map((o, i) => {
                      const farePaise = num(o, 'farePaise', 'fare', 'amountPaise');
                      return (
                        <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                          <span className="font-mono text-[10px] text-slate-400">R{num(o, 'round') ?? '—'}</span>
                          <StatusBadge status={str(o, 'fromRole', 'role', 'by')} />
                          <span className="font-bold text-slate-800">
                            {farePaise !== null ? money(farePaise / 100) : str(o, 'fare', 'amount')}
                          </span>
                          <span className="ml-auto text-[10px] text-slate-400">{str(o, 'createdAt', 'at')}</span>
                          {str(o, 'status') !== '—' && <StatusBadge status={str(o, 'status')} />}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-extrabold text-slate-700 mb-2">Expenses ({expenses.length})</h4>
                {expenses.length === 0 ? (
                  <p className="text-xs text-slate-400">No trip expenses logged.</p>
                ) : (
                  <div className="space-y-1.5">
                    {expenses.map((e, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-slate-50 border border-slate-100 rounded-xl px-3 py-2">
                        <span className="font-semibold text-slate-700">{str(e, 'type', 'kind', 'category', 'title')}</span>
                        <span className="font-bold text-slate-800 ml-auto">
                          {money((num(e, 'amountPaise', 'paise') ?? NaN) || num(e, 'amount', 'cost'))}
                        </span>
                        <span className="text-[10px] text-slate-400">{str(e, 'createdAt', 'at')}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-xs font-extrabold text-slate-700 mb-2">POD photos ({podPhotos.length})</h4>
                {podPhotos.length === 0 ? (
                  <p className="text-xs text-slate-400">No proof-of-delivery photos yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {podPhotos.map((p, i) => {
                      const url = typeof p === 'string' ? p : str(p as Row, 'url', 'photoUrl', 'imageUrl', 'path');
                      return (
                        <a key={i} href={url} target="_blank" rel="noreferrer" title={url}>
                          <img
                            src={url}
                            alt={`POD ${i + 1}`}
                            className="w-20 h-20 object-cover rounded-xl border border-slate-200 hover:border-emerald-400 transition-colors"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {(payments.length > 0 || asRow(row?.escrow)) && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 mb-2">Escrow</h4>
                <Banner kind="info">Escrow state and any payment splits recorded on the booking.</Banner>
                <div className="mt-2"><KV record={asRow(row?.escrow)} compact /></div>
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-slate-700 mb-2">Payments ({payments.length})</h4>
                {payments.length === 0 ? (
                  <p className="text-xs text-slate-400">No payment records.</p>
                ) : (
                  <DataTable
                    rows={payments}
                    empty="No payment records."
                    columns={[
                      { header: 'Kind', cell: (r) => <span className="font-semibold">{str(r, 'kind', 'type', 'method')}</span> },
                      {
                        header: 'Amount',
                        cell: (r) => <span className="font-bold">{money((num(r, 'amountPaise') ?? NaN) || num(r, 'amount'))}</span>,
                      },
                      { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
                      { header: 'At', cell: (r) => <span className="text-slate-500">{str(r, 'createdAt', 'at')}</span> },
                    ]}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </PanelShell>
  );
};

const DriversCard: React.FC = () => {
  const [search, setSearch] = useState('');
  const drivers = useAsync(
    () => admin.dispatch.drivers({ ...(search.trim() ? { search: search.trim() } : {}) }),
    [search.trim()]
  );

  return (
    <PanelShell
      title="SOP-08: Fleet Drivers Registry"
      subtitle="Every driver profile across transporters, joined with the fleet owner (GET /admin/transport/drivers)."
      icon={IdCard}
      loading={drivers.loading}
      error={drivers.error}
      onRefresh={drivers.reload}
      actions={
        <Field label="Search" className="w-56">
          <TextInput value={search} onChange={setSearch} placeholder="name, phone, transporter…" />
        </Field>
      }
    >
      <DataTable
        rows={(drivers.data ?? []) as Row[]}
        empty="No drivers registered."
        columns={[
          {
            header: 'Driver',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name', 'driverName')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          { header: 'Phone', cell: (r) => <span className="text-slate-600">{str(r, 'phone', 'mobile')}</span> },
          {
            header: 'Transporter (fleet owner)',
            cell: (r) => (
              <div>
                <p className="font-semibold text-slate-700">{str(r, 'transporterName', 'fleetOwnerName', 'ownerName')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'transporterPhone')}</p>
              </div>
            ),
          },
          {
            header: 'Licence / Vehicle',
            cell: (r) => (
              <div>
                <p className="text-slate-600">{str(r, 'licenceNo', 'licenseNo', 'drivingLicence', 'dlNumber')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'assignedVehicle', 'vehicleNo', 'vehicleNumber')}</p>
              </div>
            ),
          },
          {
            header: 'Active',
            cell: (r) => <StatusBadge status={r.active === false ? 'inactive' : 'active'} />,
          },
          { header: 'Joined', cell: (r) => <span className="text-slate-500">{str(r, 'createdAt')}</span> },
        ]}
      />
    </PanelShell>
  );
};

const VehiclesCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const vehicles = useAsync(() => admin.dispatch.vehicles(), []);

  return (
    <PanelShell
      title="SOP-08: Fleet Vehicle Registry"
      subtitle="Verify vehicle documents (RC, permit, insurance) before they can accept loads. Expired validity dates are highlighted red."
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
                <p className="font-bold text-slate-900">{str(r, 'registrationNo', 'vehicleNumber', 'numberPlate', 'rcNumber')}</p>
                <p className="text-[10px] text-slate-400">
                  {str(r, 'vehicleType', 'type', 'model')} • {num(r, 'capacityTonnes', 'capacity') ?? '—'} t
                </p>
              </div>
            ),
          },
          {
            header: 'Owner',
            cell: (r) => (
              <div>
                <p className="font-semibold text-slate-700">{str(r, 'ownerName', 'transporterName', 'owner')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'ownerPhone')}</p>
              </div>
            ),
          },
          {
            header: 'Assigned driver',
            cell: (r) => (
              <div>
                <p className="text-slate-600">{str(r, 'assignedDriverName', 'driverName')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'driverPhone')}</p>
              </div>
            ),
          },
          {
            header: 'Validity',
            cell: (r) => (
              <div className="space-y-0.5 text-[11px]">
                <p>Ins: <ExpiryCell value={firstDefined(r, 'insuranceExpiry')} /></p>
                <p>Permit: <ExpiryCell value={firstDefined(r, 'permitExpiry')} /></p>
                <p>Fitness: <ExpiryCell value={firstDefined(r, 'fitnessExpiry')} /></p>
                <p>PUC: <ExpiryCell value={firstDefined(r, 'pucExpiry')} /></p>
              </div>
            ),
          },
          {
            header: 'RC status',
            cell: (r) => <StatusBadge status={str(r, 'rcStatus', 'docStatus', 'verificationStatus', 'status')} />,
          },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                tone="primary"
                onClick={() =>
                  request({
                    title: `Verify vehicle ${str(r, 'registrationNo', 'vehicleNumber', 'numberPlate')}`,
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

const PickupAgentsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const agents = useAsync(() => admin.pickupAgents.list(), []);
  const exceptions = useAsync(() => admin.dispatch.pickupExceptions(), []);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [vehicleType, setVehicleType] = useState('Bolero Pickup');
  const [vehicleNumber, setVehicleNumber] = useState('MH-12-AB-1234');
  const [areas, setAreas] = useState('Pune, Khed, Baramati');
  const [busy, setBusy] = useState(false);

  const handleCreateAgent = (e: React.FormEvent) => {
    e.preventDefault();
    request({
      title: `Onboard pickup agent ${name}`,
      confirmLabel: 'Register Agent',
      requireMpin: true,
      tone: 'primary',
      action: async (reason) => {
        setBusy(true);
        try {
          await admin.pickupAgents.create(
            {
              name,
              phone,
              vehicleType,
              vehicleNumber: vehicleNumber.toUpperCase(),
              areas: areas.split(',').map((s) => s.trim()).filter(Boolean),
            },
            reason
          );
          setName('');
          setPhone('');
          await agents.reload();
        } finally {
          setBusy(false);
        }
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Onboard Form */}
      <PanelShell
        title="Produce Pickup Fleet & Agents"
        subtitle="Onboard and manage certified local pickup agents for farmgate produce collection (GET/POST /admin/pickup-agents)."
        icon={Truck}
        loading={agents.loading}
        onRefresh={agents.reload}
      >
        <form onSubmit={handleCreateAgent} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4 mb-4">
          <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider">Register New Produce Pickup Agent</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Agent Full Name">
              <TextInput value={name} onChange={setName} placeholder="Sham / Suresh" required />
            </Field>
            <Field label="Contact Phone">
              <TextInput value={phone} onChange={setPhone} placeholder="+919812345678" required />
            </Field>
            <Field label="Vehicle Type">
              <TextInput value={vehicleType} onChange={setVehicleType} placeholder="Bolero Pickup / Tata Ace" required />
            </Field>
            <Field label="Vehicle Registration No.">
              <TextInput value={vehicleNumber} onChange={setVehicleNumber} placeholder="MH-12-AB-1234" required />
            </Field>
            <Field label="Service Areas (comma-separated)" className="sm:col-span-2">
              <TextInput value={areas} onChange={setAreas} placeholder="Pune, Khed, Junnar, Baramati" required />
            </Field>
          </div>
          <div className="flex justify-end pt-1">
            <Btn type="submit" tone="primary" disabled={busy || !name.trim() || !phone.trim()}>
              {busy ? 'Registering…' : 'Register Pickup Agent'}
            </Btn>
          </div>
        </form>

        <DataTable
          rows={(agents.data ?? []) as Row[]}
          empty="No pickup agents registered in platform fleet."
          columns={[
            {
              header: 'Agent & Contact',
              cell: (r) => (
                <div>
                  <span className="font-bold text-slate-900">{str(r, 'name')}</span>
                  <div className="text-[11px] text-slate-500 font-mono">{str(r, 'phone')}</div>
                </div>
              ),
            },
            {
              header: 'Vehicle',
              cell: (r) => (
                <div>
                  <span className="font-mono text-xs font-black text-slate-800">{str(r, 'vehicleNumber')}</span>
                  <div className="text-[11px] text-slate-500">{str(r, 'vehicleType')}</div>
                </div>
              ),
            },
            {
              header: 'Service Areas',
              cell: (r) => {
                const aList = Array.isArray(r.areas) ? r.areas : [];
                return (
                  <div className="flex flex-wrap gap-1">
                    {aList.map((a: unknown, i: number) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold">
                        {String(a)}
                      </span>
                    ))}
                  </div>
                );
              },
            },
            {
              header: 'Status',
              cell: (r) => <StatusBadge status={r.active ? 'active' : 'inactive'} />,
            },
            {
              header: 'Action',
              cell: (r) => (
                <Btn
                  tone={r.active ? 'ghost' : 'primary'}
                  onClick={() =>
                    request({
                      title: `${r.active ? 'Deactivate' : 'Activate'} agent ${str(r, 'name')}`,
                      confirmLabel: r.active ? 'Deactivate' : 'Activate',
                      requireMpin: true,
                      tone: r.active ? 'danger' : 'primary',
                      action: async (reason) => {
                        await admin.pickupAgents.update(idOf(r), { active: !r.active }, reason);
                        await agents.reload();
                      },
                    })
                  }
                >
                  {r.active ? 'Deactivate' : 'Activate'}
                </Btn>
              ),
            },
          ]}
        />
      </PanelShell>

      {/* Exceptions past grace window */}
      <PanelShell
        title="Pickup Exceptions Desk"
        subtitle="Produce purchase pickups stuck past the configured grace window (GET /admin/exceptions/pickup)."
        icon={Ban}
        loading={exceptions.loading}
        onRefresh={exceptions.reload}
      >
        <DataTable
          rows={(exceptions.data ?? []) as Row[]}
          empty="Zero stuck pickup exceptions. All bookings within grace window."
          columns={[
            {
              header: 'Purchase ID',
              cell: (r) => <span className="font-mono font-bold text-slate-800">#{idOf(r)}</span>,
            },
            {
              header: 'Commodity',
              cell: (r) => <span className="font-bold text-slate-900">{str(r, 'crop')}</span>,
            },
            {
              header: 'Assigned Agent',
              cell: (r) => <span className="font-semibold text-slate-700">{str(r, 'agentId', 'agentName')}</span>,
            },
            {
              header: 'Status',
              cell: (r) => <StatusBadge status={str(r, 'status')} />,
            },
          ]}
        />
      </PanelShell>

      {modal}
    </div>
  );
};
