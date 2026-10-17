import React, { useState } from 'react';
import { Droplets, Waves, PiggyBank, Gauge } from 'lucide-react';
import { admin, apiClient, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Tabs,
  Field,
  TextInput,
  TextArea,
  Banner,
  idOf,
  str,
  num,
  useAsync,
  useReasonModal,
  asRow,
  type Row,
} from './shared';

/**
 * SOP-17 — Water Resources & Canal Roster.
 * Canal schedules, groundwater reading ingestion, subsidy rules and usage stats.
 * Groundwater/subsidy/usage endpoints are absent from the admin namespace and
 * are called directly via apiClient (documented /admin/* paths).
 */
export const WaterPanel: React.FC = () => {
  const [tab, setTab] = useState('canal');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'canal', label: 'Canal roster' },
          { id: 'groundwater', label: 'Groundwater' },
          { id: 'subsidy', label: 'Subsidy rules' },
          { id: 'usage', label: 'Usage stats' },
        ]}
      />
      {tab === 'canal' && <CanalCard />}
      {tab === 'groundwater' && <GroundwaterCard />}
      {tab === 'subsidy' && <SubsidyCard />}
      {tab === 'usage' && <UsageCard />}
    </>
  );
};

const CanalCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const schedules = useAsync(() => admin.fieldOps.waterSchedules(), []);

  return (
    <PanelShell
      title="SOP-17: Canal Water Roster"
      subtitle="Irrigation canal rotation schedules by village/waraba."
      icon={Droplets}
      loading={schedules.loading}
      error={schedules.error}
      onRefresh={schedules.reload}
    >
      <DataTable
        rows={(schedules.data ?? []) as Row[]}
        empty="No canal schedules."
        columns={[
          {
            header: 'Canal / Village',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'canal', 'canalName', 'name', 'village')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'outlet', 'section', 'commandArea')}</p>
              </div>
            ),
          },
          {
            header: 'Rotation window',
            cell: (r) => (
              <span className="text-slate-600">
                {str(r, 'startDate', 'from')} → {str(r, 'endDate', 'to')}
              </span>
            ),
          },
          { header: 'Flow (cusecs)', cell: (r) => <span className="font-semibold">{num(r, 'flow', 'flowCusecs', 'discharge') ?? '—'}</span> },
          {
            header: 'Status',
            cell: (r) => <span className="text-slate-500">{str(r, 'status', 'state')}</span>,
          },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                onClick={() =>
                  request({
                    title: `Update schedule ${idOf(r)}`,
                    defaultReason: 'Rotation adjusted by irrigation dept intake',
                    confirmLabel: 'Publish update',
                    action: (reason) => admin.fieldOps.updateWaterSchedule(idOf(r), { reason, updated: true }, reason),
                    onDone: schedules.reload,
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

const GroundwaterCard: React.FC = () => {
  const [station, setStation] = useState('');
  const [level, setLevel] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.post(
        '/admin/water/groundwater-readings',
        {
          readings: [{ stationId: station.trim(), levelMeters: Number(level), recordedAt: new Date().toISOString() }],
        },
        { headers: { 'X-Audit-Reason': reason.trim() || `Groundwater reading ingest — ${station.trim()}` } }
      );
      setMsg({ kind: 'success', text: 'Groundwater reading ingested.' });
      setStation('');
      setLevel('');
      setReason('');
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-17: Groundwater Readings"
      subtitle="Ingest telemetry / manual readings (POST /admin/water/groundwater-readings — direct apiClient; not in admin namespace). Audit reason required."
      icon={Gauge}
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <div className="flex flex-wrap items-end gap-2 max-w-3xl">
        <Field label="Station ID" className="flex-1 min-w-40">
          <TextInput value={station} onChange={setStation} placeholder="gw_nashik_04" />
        </Field>
        <Field label="Level (m)" className="w-32">
          <TextInput type="number" value={level} onChange={setLevel} placeholder="8.4" />
        </Field>
        <Field label="Audit reason" className="flex-1 min-w-52">
          <TextInput value={reason} onChange={setReason} placeholder="CGWB weekly sync" />
        </Field>
        <Btn
          tone="primary"
          busy={busy}
          disabled={Boolean(!station.trim() || !level || (reason.trim() && reason.trim().length < 3))}
          onClick={submit}
        >
          Ingest reading
        </Btn>
      </div>
    </PanelShell>
  );
};

const SubsidyCard: React.FC = () => {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const save = async () => {
    if (!draft) return;
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(draft);
    } catch {
      setMsg({ kind: 'error', text: 'Invalid JSON.' });
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.put('/admin/water/subsidy-rules', parsed, {
        headers: { 'X-Audit-Reason': 'Subsidy rules update from SOP-17 desk' },
      });
      setMsg({ kind: 'success', text: 'Subsidy rules updated.' });
      setDraft(null);
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-17: Water Subsidy Rules"
      subtitle="Drip / pump subsidy eligibility matrix (PUT /admin/water/subsidy-rules — direct apiClient)."
      icon={PiggyBank}
      actions={
        draft !== null ? (
          <div className="flex gap-2">
            <Btn onClick={() => setDraft(null)}>Cancel</Btn>
            <Btn tone="primary" busy={busy} onClick={save}>Save (audited)</Btn>
          </div>
        ) : (
          <Btn onClick={() => setDraft('{\n  "dripSubsidyPct": 80,\n  "solarPumpCap": 100000\n}')}>Edit rules</Btn>
        )
      }
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      {draft !== null ? (
        <TextArea value={draft} onChange={setDraft} rows={10} className="font-mono text-[11px]" />
      ) : (
        <p className="text-xs text-slate-400">Rules are stored server-side. Open the editor to review and update.</p>
      )}
    </PanelShell>
  );
};

const UsageCard: React.FC = () => {
  const usage = useAsync(
    () => apiClient.get('/admin/water/usage-stats').then((res) => (res.data?.data ?? res.data) as unknown).catch((e) => Promise.reject(e)),
    []
  );
  return (
    <PanelShell
      title="SOP-17: Water Usage Statistics"
      subtitle="Aggregated canal + groundwater consumption (GET /admin/water/usage-stats — direct apiClient)."
      icon={Waves}
      loading={usage.loading}
      error={usage.error}
      onRefresh={usage.reload}
    >
      <KV record={asRow(usage.data)} />
    </PanelShell>
  );
};
