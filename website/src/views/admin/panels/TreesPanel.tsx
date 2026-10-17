import React, { useState } from 'react';
import { TreePine, Leaf, Globe2, Sprout } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiClient } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Tabs,
  Field,
  Select,
  Banner,
  idOf,
  str,
  num,
  useAsync,
  useReasonModal,
  asRow,
  asRows,
  type Row,
} from './shared';

/**
 * SOP-21 — Agroforestry & Saplings.
 * Tree plantation requests + status + survival tracking, NGO verification,
 * biofuel tree edits, carbon audit and climate variety advisories.
 */
export const TreesPanel: React.FC = () => {
  const [tab, setTab] = useState('requests');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'requests', label: 'Tree requests' },
          { id: 'ngos', label: 'NGO partners' },
          { id: 'biofuel', label: 'Biofuel trees' },
          { id: 'saplings', label: 'Sapling requests' },
          { id: 'carbon', label: 'Carbon audit' },
        ]}
      />
      {tab === 'requests' && <TreeRequestsCard />}
      {tab === 'ngos' && <NgoCard />}
      {tab === 'biofuel' && <BiofuelCard />}
      {tab === 'saplings' && <SaplingCard />}
      {tab === 'carbon' && <CarbonCard />}
    </>
  );
};

const TREE_STATUSES = ['submitted', 'approved', 'planted', 'verified', 'rejected'];

const TreeRequestsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [survival, setSurvival] = useState<Row | null>(null);

  const requests = useAsync(() => admin.economy.treeRequests(), []);
  const rows = (requests.data ?? []) as Row[];
  const selected = selectedId ? rows.find((r) => idOf(r) === selectedId) ?? null : null;

  const loadSurvival = async (requestId: string) => {
    try {
      const data = await admin.economy.treeSurvival(requestId);
      setSurvival(asRow(data) ?? { requestId, note: 'no survival data' });
    } catch {
      setSurvival({ requestId, note: 'Survival data unavailable' });
    }
  };

  return (
    <>
      <PanelShell
        title="SOP-21: Tree Plantation Requests"
        subtitle="Agroforestry grants — approve requests, then track survival rate after planting."
        icon={TreePine}
        loading={requests.loading}
        error={requests.error}
        onRefresh={requests.reload}
      >
        <DataTable
          rows={rows}
          empty="No tree requests."
          columns={[
            {
              header: 'Request',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'species', 'treeSpecies', 'name', 'farmerName')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                </div>
              ),
            },
            { header: 'Farmer', cell: (r) => <span className="text-slate-600">{str(r, 'farmerName', 'userName', 'userId')}</span> },
            { header: 'Trees', cell: (r) => <span className="font-semibold">{num(r, 'treeCount', 'count', 'saplings') ?? '—'}</span> },
            { header: 'Location', cell: (r) => <span className="text-slate-500">{str(r, 'village', 'district', 'plot')}</span> },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Btn onClick={() => setSelectedId(idOf(r))}>Status</Btn>
                  <Btn onClick={() => loadSurvival(idOf(r))}>Survival</Btn>
                </div>
              ),
            },
          ]}
        />
      </PanelShell>

      {selected && (
        <PanelShell
          title={`Request ${idOf(selected)} — set status`}
          subtitle="Move the request through the plantation lifecycle."
          icon={TreePine}
          actions={
            <div className="flex items-end gap-2">
              <Field label="Status" className="w-44">
                <Select
                  value=""
                  onChange={(v) =>
                    v &&
                    request({
                      title: `Tree request ${idOf(selected)} → ${v}`,
                      confirmLabel: 'Apply',
                      tone: v === 'rejected' ? 'danger' : 'primary',
                      action: (reason) => admin.economy.setTreeRequestStatus(idOf(selected), { status: v, reason }, reason),
                      onDone: requests.reload,
                    })
                  }
                  options={[{ value: '', label: 'Set…' }, ...TREE_STATUSES.map((s) => ({ value: s, label: s }))]}
                />
              </Field>
              <Btn onClick={() => setSelectedId(null)}>Close</Btn>
            </div>
          }
        >
          <KV record={selected} />
        </PanelShell>
      )}

      {survival && (
        <PanelShell
          title={`Survival — ${str(survival, 'requestId')}`}
          subtitle="Geo-tagged survival audit of planted saplings."
          icon={Sprout}
          actions={<Btn onClick={() => setSurvival(null)}>Close</Btn>}
        >
          <KV record={survival} />
        </PanelShell>
      )}
      {modal}
    </>
  );
};

const NgoCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const ngos = useAsync(() => admin.economy.treeNgos(), []);

  return (
    <PanelShell
      title="SOP-21: Tree NGO Partners"
      subtitle="NGOs running plantation drives — verify before they can receive sapling grants."
      icon={Globe2}
      loading={ngos.loading}
      error={ngos.error}
      onRefresh={ngos.reload}
    >
      <DataTable
        rows={(ngos.data ?? []) as Row[]}
        empty="No NGO partners."
        columns={[
          {
            header: 'NGO',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name', 'ngoName')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'registrationNo', 'district')}</p>
              </div>
            ),
          },
          { header: 'Drives', cell: (r) => <span>{num(r, 'driveCount', 'drives') ?? '—'}</span> },
          { header: 'Trees planted', cell: (r) => <span className="font-semibold">{num(r, 'treesPlanted', 'treeCount') ?? '—'}</span> },
          { header: 'Verification', cell: (r) => <StatusBadge status={str(r, 'verificationStatus', 'status', 'state')} /> },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                tone="primary"
                onClick={() =>
                  request({
                    title: `Verify NGO ${str(r, 'name', 'ngoName')}`,
                    defaultReason: 'Registration + past drive audit verified',
                    confirmLabel: 'Verify',
                    action: (reason) => admin.org.verifyNgo(idOf(r), reason),
                    onDone: ngos.reload,
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

const BiofuelCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const trees = useAsync(() => admin.economy.biofuelTrees(), []);

  return (
    <PanelShell
      title="SOP-21: Biofuel Tree Registry"
      subtitle="Pongamia / jatropha plantations tracked for biofuel offtake. Edit yield and offtake status."
      icon={Leaf}
      loading={trees.loading}
      error={trees.error}
      onRefresh={trees.reload}
    >
      <DataTable
        rows={(trees.data ?? []) as Row[]}
        empty="No biofuel trees registered."
        columns={[
          {
            header: 'Plantation',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'species', 'name', 'type')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'farmerName', 'ownerName', 'district')}</p>
              </div>
            ),
          },
          { header: 'Trees', cell: (r) => <span>{num(r, 'treeCount', 'count') ?? '—'}</span> },
          { header: 'Yield', cell: (r) => <span>{str(r, 'yield', 'seedYield', 'yieldKg')}</span> },
          { header: 'Offtake status', cell: (r) => <StatusBadge status={str(r, 'offtakeStatus', 'status', 'state')} /> },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                onClick={() =>
                  request({
                    title: `Edit biofuel tree ${idOf(r)}`,
                    defaultReason: 'Yield audit update',
                    confirmLabel: 'Mark audited',
                    action: (reason) => admin.economy.updateBiofuelTree(idOf(r), { audited: true, reason }, reason),
                    onDone: trees.reload,
                  })
                }
              >
                Mark audited
              </Btn>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const SaplingCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const saplings = useAsync(() => admin.economy.saplingRequests(), []);

  return (
    <PanelShell
      title="SOP-21: Sapling Distribution Requests"
      subtitle="Free / subsidised sapling requests from nurseries and farmers."
      icon={Sprout}
      loading={saplings.loading}
      error={saplings.error}
      onRefresh={saplings.reload}
    >
      <DataTable
        rows={(saplings.data ?? []) as Row[]}
        empty="No sapling requests."
        columns={[
          {
            header: 'Request',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'species', 'saplingType', 'name')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          { header: 'Requestor', cell: (r) => <span className="text-slate-600">{str(r, 'requestorName', 'farmerName', 'nurseryName', 'userId')}</span> },
          { header: 'Quantity', cell: (r) => <span>{num(r, 'quantity', 'count') ?? '—'}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
          {
            header: 'Actions',
            className: 'text-right',
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Btn
                  tone="danger"
                  onClick={() =>
                    request({
                      title: `Reject sapling request ${idOf(r)}`,
                      confirmLabel: 'Reject',
                      tone: 'danger',
                      action: (reason) => admin.economy.reviewSaplingRequest(idOf(r), { decision: 'rejected', reason }, reason),
                      onDone: saplings.reload,
                    })
                  }
                >
                  Reject
                </Btn>
                <Btn
                  tone="primary"
                  onClick={() =>
                    request({
                      title: `Approve sapling request ${idOf(r)}`,
                      defaultReason: 'Stock available at nearest nursery',
                      confirmLabel: 'Approve',
                      action: (reason) => admin.economy.reviewSaplingRequest(idOf(r), { decision: 'approved', reason }, reason),
                      onDone: saplings.reload,
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

const CarbonCard: React.FC = () => {
  const audit = useAsync(
    () => apiClient.get('/admin/climate/carbon-audit').then((res) => (res.data?.data ?? res.data) as unknown),
    []
  );

  const varieties = useAsync(() => admin.fieldOps.climateVarieties(), []);

  return (
    <>
      <PanelShell
        title="SOP-21: Carbon Credit Audit"
        subtitle="Sequestration estimate across plantation programmes (GET /admin/climate/carbon-audit — direct apiClient; not in admin namespace)."
        icon={Globe2}
        loading={audit.loading}
        error={audit.error}
        onRefresh={audit.reload}
      >
        <KV record={asRow(audit.data)} />
      </PanelShell>
      <PanelShell
        title="SOP-21: Climate-Resilient Varieties"
        subtitle="Varieties promoted alongside agroforestry for climate adaptation."
        icon={Leaf}
        loading={varieties.loading}
        error={varieties.error}
        onRefresh={varieties.reload}
      >
        <DataTable
          rows={asRows(varieties.data)}
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
            { header: 'Trait', cell: (r) => <span className="text-slate-600">{str(r, 'trait', 'climateTrait', 'resistance')}</span> },
            { header: 'Regions', cell: (r) => <span className="text-slate-500">{str(r, 'districts', 'regions')}</span> },
          ]}
        />
      </PanelShell>
    </>
  );
};
