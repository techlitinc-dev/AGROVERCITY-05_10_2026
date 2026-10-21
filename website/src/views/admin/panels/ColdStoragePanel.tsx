import React, { useState } from 'react';
import { Snowflake, Warehouse, CalendarClock, Leaf, Globe2 } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiClient, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Tabs,
  Field,
  TextInput,
  Banner,
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
 * SOP-23 — Climate Resilience & Cold Storage.
 * Facility verification, cold-storage directory, booking audit,
 * certified climate-resilient variety specs (GET + PUT via apiClient — the
 * PUT is absent from the admin namespace), and the carbon-credit desk.
 */
export const ColdStoragePanel: React.FC = () => {
  const [tab, setTab] = useState('facilities');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'facilities', label: 'Facilities' },
          { id: 'directory', label: 'Directory' },
          { id: 'bookings', label: 'Bookings audit' },
          { id: 'varieties', label: 'Varieties' },
          { id: 'carbon', label: 'Carbon audit' },
        ]}
      />
      {tab === 'facilities' && <FacilitiesCard />}
      {tab === 'directory' && <DirectoryCard />}
      {tab === 'bookings' && <BookingsCard />}
      {tab === 'varieties' && <VarietiesCard />}
      {tab === 'carbon' && (
        <>
          <CarbonCard />
          <CarbonConfigCard />
        </>
      )}
    </>
  );
};

const FacilitiesCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const facilities = useAsync(() => admin.coldStorage.facilities(), []);

  return (
    <PanelShell
      title="SOP-23: Cold Storage Facilities"
      subtitle="Verify facility licenses before they go live for bookings."
      icon={Warehouse}
      loading={facilities.loading}
      error={facilities.error}
      onRefresh={facilities.reload}
    >
      <DataTable
        rows={(facilities.data ?? []) as Row[]}
        empty="No facilities registered."
        columns={[
          {
            header: 'Facility',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name', 'facilityName', 'storageName')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'district', 'address', 'location')}</p>
              </div>
            ),
          },
          {
            header: 'Capacity',
            cell: (r) => (
              <div>
                <p className="font-semibold">{num(r, 'capacityMt', 'capacity', 'capacityTons') ?? '—'} MT</p>
                <p className="text-[10px] text-slate-400">{str(r, 'chambers', 'rooms')}</p>
              </div>
            ),
          },
          { header: 'Tariff', cell: (r) => <span className="text-slate-600">{money(num(r, 'tariffPerDay', 'tariff', 'ratePerDay'))}/day</span> },
          { header: 'Verification', cell: (r) => <StatusBadge status={str(r, 'verificationStatus', 'status', 'state')} /> },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                tone="primary"
                onClick={() =>
                  request({
                    title: `Verify facility ${str(r, 'name', 'facilityName')}`,
                    defaultReason: 'FSSAI + cold-chain license verified',
                    confirmLabel: 'Verify',
                    action: (reason) => admin.coldStorage.verifyFacility(idOf(r), reason),
                    onDone: facilities.reload,
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

const DirectoryCard: React.FC = () => {
  const storages = useAsync(() => admin.coldStorage.list(), []);

  return (
    <PanelShell
      title="SOP-23: Cold Storage Directory"
      subtitle="All cold storages on the platform."
      icon={Snowflake}
      loading={storages.loading}
      error={storages.error}
      onRefresh={storages.reload}
    >
      <DataTable
        rows={(storages.data ?? []) as Row[]}
        empty="No cold storages."
        columns={[
          {
            header: 'Storage',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name', 'storageName')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'ownerName', 'owner', 'district')}</p>
              </div>
            ),
          },
          { header: 'Type', cell: (r) => <span className="text-slate-600">{str(r, 'type', 'commoditySupported', 'category')}</span> },
          { header: 'Occupancy', cell: (r) => <span className="font-semibold">{num(r, 'occupancyPct', 'occupancy', 'utilization') ?? '—'}%</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
        ]}
      />
    </PanelShell>
  );
};

const BookingsCard: React.FC = () => {
  const bookings = useAsync(() => admin.coldStorage.bookings(), []);

  return (
    <PanelShell
      title="SOP-23: Cold Storage Booking Audit"
      subtitle="Every chamber booking across facilities — overbooking watch."
      icon={CalendarClock}
      loading={bookings.loading}
      error={bookings.error}
      onRefresh={bookings.reload}
    >
      <DataTable
        rows={(bookings.data ?? []) as Row[]}
        empty="No bookings."
        columns={[
          {
            header: 'Facility',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'facilityName', 'storageName', 'facility')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          {
            header: 'Farmer',
            cell: (r) => <span className="text-slate-600">{str(r, 'farmerName', 'farmer', 'userName')}</span>,
          },
          {
            header: 'Commodity',
            cell: (r) => <span className="text-slate-600">{str(r, 'commodity', 'crop', 'produce')}</span>,
          },
          {
            header: 'Period',
            cell: (r) => (
              <span className="text-slate-500">
                {str(r, 'fromDate', 'startDate', 'from')} → {str(r, 'toDate', 'endDate', 'to')}
              </span>
            ),
          },
          { header: 'Value', cell: (r) => <span className="font-bold">{money(num(r, 'total', 'amount', 'rent'))}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
        ]}
      />
    </PanelShell>
  );
};

const VarietiesCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const varieties = useAsync(() => admin.fieldOps.climateVarieties(), []);

  const [editing, setEditing] = useState<{ id: string; name: string; yieldQuintals: string; buybackPrice: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const save = async (reason: string) => {
    if (!editing) return;
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.put(
        `/admin/climate/varieties/${encodeURIComponent(editing.id)}`,
        {
          ...(editing.yieldQuintals ? { yieldQuintals: Number(editing.yieldQuintals) } : {}),
          ...(editing.buybackPrice ? { buybackPrice: Number(editing.buybackPrice) } : {}),
        },
        { headers: { 'X-Audit-Reason': reason } }
      );
      setMsg({ kind: 'success', text: `Variety ${editing.name} updated.` });
      setEditing(null);
      varieties.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-23: Certified Climate-Resilient Varieties"
      subtitle="Seed variety specs promoted to farmers by district. Edits go through PUT /admin/climate/varieties/{id} (direct apiClient — absent from the admin namespace)."
      icon={Leaf}
      loading={varieties.loading}
      error={varieties.error}
      onRefresh={varieties.reload}
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {editing && (
        <div className="p-3 border border-emerald-200 bg-emerald-50/40 rounded-2xl space-y-3">
          <p className="text-xs font-bold text-slate-700">Update {editing.name} ({editing.id})</p>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Yield (q/acre)" className="w-40">
              <TextInput type="number" value={editing.yieldQuintals} onChange={(v) => setEditing({ ...editing, yieldQuintals: v })} placeholder="12" />
            </Field>
            <Field label="Buyback price ₹/q" className="w-40">
              <TextInput type="number" value={editing.buybackPrice} onChange={(v) => setEditing({ ...editing, buybackPrice: v })} placeholder="2450" />
            </Field>
            <div className="flex gap-2">
              <Btn onClick={() => setEditing(null)}>Cancel</Btn>
              <Btn
                tone="primary"
                busy={busy}
                onClick={() =>
                  request({
                    title: `Update variety ${editing.name}`,
                    defaultReason: `Variety spec update — ${editing.name}`,
                    confirmLabel: 'Save variety',
                    action: save,
                    onDone: varieties.reload,
                  })
                }
              >
                Save (audited)
              </Btn>
            </div>
          </div>
        </div>
      )}
      <DataTable
        rows={(varieties.data ?? []) as Row[]}
        empty="No varieties catalogued."
        columns={[
          {
            header: 'Variety',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name', 'variety', 'varietyName')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'crop', 'cropName')}</p>
              </div>
            ),
          },
          { header: 'Climate trait', cell: (r) => <span className="text-slate-600">{str(r, 'trait', 'climateTrait', 'resistance')}</span> },
          { header: 'Yield', cell: (r) => <span>{str(r, 'yieldQuintals', 'yield')}</span> },
          { header: 'Buyback', cell: (r) => <span className="font-semibold">{money(num(r, 'buybackPrice', 'msp'))}</span> },
          { header: 'Regions', cell: (r) => <span className="text-slate-500">{str(r, 'districts', 'regions', 'suitableFor')}</span> },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                onClick={() =>
                  setEditing({
                    id: idOf(r),
                    name: str(r, 'name', 'variety', 'varietyName'),
                    yieldQuintals: '',
                    buybackPrice: '',
                  })
                }
              >
                Update
              </Btn>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const CarbonCard: React.FC = () => {
  const audit = useAsync(
    () => apiClient.get('/admin/climate/carbon-audit').then((res) => (res.data?.data ?? res.data) as unknown),
    []
  );

  return (
    <PanelShell
      title="SOP-23: Carbon Credit Desk"
      subtitle="Certification and payout desk — carbon_enrollments with CO₂e / payout estimates (GET /admin/climate/carbon-audit — direct apiClient; not in admin namespace)."
      icon={Globe2}
      loading={audit.loading}
      error={audit.error}
      onRefresh={audit.reload}
    >
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div>
          <h4 className="text-xs font-extrabold text-slate-700 mb-2">Summary</h4>
          <KV record={asRow(audit.data)} compact />
        </div>
        <div className="xl:col-span-2">
          <h4 className="text-xs font-extrabold text-slate-700 mb-2">Enrollments</h4>
          <DataTable
            rows={asRows(asRow(audit.data)?.enrollments)}
            empty="No carbon enrollments."
            columns={[
              {
                header: 'Farmer / Plot',
                cell: (r) => (
                  <div>
                    <p className="font-bold text-slate-900">{str(r, 'farmerName', 'userName', 'plot')}</p>
                    <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                  </div>
                ),
              },
              { header: 'Practice', cell: (r) => <span className="text-slate-600">{str(r, 'practice', 'intervention', 'type')}</span> },
              { header: 'CO₂e', cell: (r) => <span>{str(r, 'co2e', 'co2eTons', 'carbon')}</span> },
              { header: 'Payout', cell: (r) => <span className="font-bold">{money(num(r, 'payout', 'estimatedPayout'))}</span> },
              { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            ]}
          />
        </div>
      </div>
    </PanelShell>
  );
};

/** Carbon-credit economics config (GET/PUT /admin/platform-config/carbon). */
const CarbonConfigCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const cfgRes = useAsync(() => admin.coldStorage.carbonConfig().catch(() => null), []);
  const cfg = asRow(cfgRes.data);

  const [kgCo2, setKgCo2] = useState('');
  const [pricePaise, setPricePaise] = useState('');
  const [ecoCoins, setEcoCoins] = useState('');
  const [threshold, setThreshold] = useState('');
  const dirty = kgCo2 !== '' || pricePaise !== '' || ecoCoins !== '' || threshold !== '';

  const save = async (reason: string) => {
    await admin.coldStorage.updateCarbonConfig(
      {
        ...(kgCo2 !== '' ? { kgCo2PerTreePerYear: Number(kgCo2) } : {}),
        ...(pricePaise !== '' ? { creditPricePaisePerKg: Number(pricePaise) } : {}),
        ...(ecoCoins !== '' ? { ecoCoinsPerCredit: Number(ecoCoins) } : {}),
        ...(threshold !== '' ? { payoutThresholdCredits: Number(threshold) } : {}),
      },
      reason
    );
    setKgCo2('');
    setPricePaise('');
    setEcoCoins('');
    setThreshold('');
    cfgRes.reload();
  };

  return (
    <PanelShell
      title="SOP-23: Carbon Credit Config"
      subtitle="Conversion factors behind the carbon desk: per-tree CO₂ sequestration, credit price, EcoCoins conversion and the payout threshold (GET/PUT /admin/platform-config/carbon)."
      icon={Globe2}
      loading={cfgRes.loading}
      onRefresh={cfgRes.reload}
      actions={
        dirty ? (
          <div className="flex gap-2">
            <Btn onClick={() => { setKgCo2(''); setPricePaise(''); setEcoCoins(''); setThreshold(''); }}>Cancel</Btn>
            <Btn
              tone="primary"
              onClick={() =>
                request({
                  title: 'Update carbon credit config',
                  defaultReason: 'Carbon economics update from SOP-23 desk',
                  confirmLabel: 'Save carbon config',
                  action: save,
                })
              }
            >
              Save (audited)
            </Btn>
          </div>
        ) : undefined
      }
    >
      {cfgRes.error && <Banner kind="error">{cfgRes.error}</Banner>}
      {cfg && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Field label={`kg CO₂ / tree / year — current ${num(cfg, 'kgCo2PerTreePerYear') ?? '—'}`} className="w-52">
              <TextInput type="number" inputMode="decimal" value={kgCo2} onChange={setKgCo2} placeholder={String(num(cfg, 'kgCo2PerTreePerYear') ?? 21)} />
            </Field>
            <Field label={`Credit price (paise/kg) — current ${num(cfg, 'creditPricePaisePerKg') ?? '—'}`} className="w-56">
              <TextInput type="number" inputMode="numeric" value={pricePaise} onChange={setPricePaise} placeholder={String(num(cfg, 'creditPricePaisePerKg') ?? 80)} />
            </Field>
            <Field label={`EcoCoins / credit — current ${num(cfg, 'ecoCoinsPerCredit') ?? '—'}`} className="w-52">
              <TextInput type="number" inputMode="numeric" value={ecoCoins} onChange={setEcoCoins} placeholder={String(num(cfg, 'ecoCoinsPerCredit') ?? 10)} />
            </Field>
            <Field label={`Payout threshold (credits) — current ${num(cfg, 'payoutThresholdCredits') ?? '—'}`} className="w-56">
              <TextInput type="number" inputMode="numeric" value={threshold} onChange={setThreshold} placeholder={String(num(cfg, 'payoutThresholdCredits') ?? 10)} />
            </Field>
          </div>
          <p className="text-[11px] text-slate-400">
            Last updated {str(cfg, 'updatedAt')} by {str(cfg, 'updatedBy')}.
          </p>
        </>
      )}
    </PanelShell>
  );
};
