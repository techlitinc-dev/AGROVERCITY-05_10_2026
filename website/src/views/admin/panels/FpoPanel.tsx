import React, { useState } from 'react';
import { Handshake, Landmark, PlusCircle } from 'lucide-react';
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
  Select,
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
 * SOP-18 — FPO Verification & Pools.
 * FPO onboarding verification, financials, trading pools (create + status).
 */
export const FpoPanel: React.FC = () => {
  const [tab, setTab] = useState('fpos');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'fpos', label: 'FPO directory' },
          { id: 'pools', label: 'Trading pools' },
        ]}
      />
      {tab === 'fpos' && <FpoDirectoryCard />}
      {tab === 'pools' && <PoolsCard />}
    </>
  );
};

const FpoDirectoryCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const fpos = useAsync(() => admin.org.fpos(), []);
  const financials = useAsync(
    () => (selectedId ? admin.org.fpoFinancials(selectedId).catch(() => null) : Promise.resolve(null)),
    [selectedId]
  );

  const rows = (fpos.data ?? []) as Row[];
  const selected = selectedId ? rows.find((r) => idOf(r) === selectedId) ?? null : null;

  return (
    <>
      <PanelShell
        title="SOP-18: FPO Verification"
        subtitle="Farmer Producer Organisations — verify registration before they can pool produce."
        icon={Handshake}
        loading={fpos.loading}
        error={fpos.error}
        onRefresh={fpos.reload}
      >
        <DataTable
          rows={rows}
          empty="No FPOs registered."
          columns={[
            {
              header: 'FPO',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'name', 'fpoName', 'orgName')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'district', 'state', 'registrationNo')}</p>
                </div>
              ),
            },
            {
              header: 'Members',
              cell: (r) => <span className="font-semibold">{num(r, 'memberCount', 'members', 'memberFarmerCount') ?? '—'}</span>,
            },
            {
              header: 'Contact',
              cell: (r) => <span className="text-slate-500">{str(r, 'contactName', 'ceoName', 'phone')}</span>,
            },
            {
              header: 'Verification',
              cell: (r) => <StatusBadge status={str(r, 'verificationStatus', 'status', 'verified', 'state')} />,
            },
            {
              header: 'Actions',
              className: 'text-right',
              cell: (r) => (
                <div className="flex justify-end gap-1.5">
                  <Btn onClick={() => setSelectedId(idOf(r))}>Financials</Btn>
                  <Btn
                    tone="primary"
                    onClick={() =>
                      request({
                        title: `Verify FPO ${str(r, 'name', 'fpoName')}`,
                        defaultReason: 'Registration + bye-laws verified',
                        confirmLabel: 'Verify FPO',
                        action: (reason) => admin.org.verifyFpo(idOf(r), reason),
                        onDone: fpos.reload,
                      })
                    }
                  >
                    Verify
                  </Btn>
                </div>
              ),
            },
          ]}
        />
      </PanelShell>
      {selected && (
        <PanelShell
          title={`FPO financials — ${str(selected, 'name', 'fpoName')}`}
          subtitle="Pooled turnover, outstanding and payout history."
          icon={Landmark}
          loading={financials.loading}
          actions={<Btn onClick={() => setSelectedId(null)}>Close</Btn>}
        >
          <KV record={asRow(financials.data) ?? selected} />
        </PanelShell>
      )}
      {modal}
    </>
  );
};

const POOL_STATUSES = ['open', 'active', 'closed', 'settled'];

const PoolsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [selectedFpo, setSelectedFpo] = useState('');
  const [crop, setCrop] = useState('');
  const [targetQty, setTargetQty] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const pools = useAsync(
    () =>
      selectedFpo
        ? apiClient
            .get(`/admin/fpos/${selectedFpo}/pools`)
            .then((res) => (res.data?.data ?? res.data) as unknown)
            .catch(() => null)
        : Promise.resolve(null),
    [selectedFpo]
  );
  const fpos = useAsync(() => admin.org.fpos(), []);
  const fpoRows = (fpos.data ?? []) as Row[];

  const createPool = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await admin.org.createFpoPool(
        { fpoId: selectedFpo, crop: crop.trim(), targetQtyQuintals: Number(targetQty) || 0 },
        `Pool opened: ${crop.trim()}`
      );
      setMsg({ kind: 'success', text: 'Pool created.' });
      pools.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-18: FPO Trading Pools"
      subtitle="Bulk produce pooling runs. Pool listing uses GET /admin/fpos/{id}/pools via apiClient (absent from the admin namespace)."
      icon={PlusCircle}
      loading={fpos.loading}
      error={fpos.error}
      onRefresh={() => {
        fpos.reload();
        pools.reload();
      }}
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <div className="flex flex-wrap items-end gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
        <Field label="FPO" className="w-56">
          <Select
            value={selectedFpo}
            onChange={setSelectedFpo}
            options={[{ value: '', label: 'Select FPO…' }, ...fpoRows.map((r) => ({ value: idOf(r), label: str(r, 'name', 'fpoName') }))]}
          />
        </Field>
        <Field label="Crop" className="w-40">
          <TextInput value={crop} onChange={setCrop} placeholder="Soybean" />
        </Field>
        <Field label="Target qty (q)" className="w-32">
          <TextInput type="number" value={targetQty} onChange={setTargetQty} placeholder="500" />
        </Field>
        <Btn tone="primary" busy={busy} disabled={!selectedFpo || !crop.trim()} onClick={createPool}>
          Open pool
        </Btn>
      </div>
      <DataTable
        rows={asRows(pools.data)}
        empty={selectedFpo ? 'This FPO has no pools.' : 'Select an FPO to view its pools.'}
        columns={[
          {
            header: 'Pool',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'crop', 'commodity', 'name')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          { header: 'Target', cell: (r) => <span>{num(r, 'targetQtyQuintals', 'targetQty', 'target') ?? '—'} q</span> },
          { header: 'Pooled', cell: (r) => <span>{num(r, 'pooledQtyQuintals', 'pooledQty', 'collected') ?? '—'} q</span> },
          { header: 'Farmers', cell: (r) => <span>{num(r, 'farmerCount', 'members') ?? '—'}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Select
                className="w-32 ml-auto"
                value=""
                onChange={(v) =>
                  v &&
                  request({
                    title: `Pool ${idOf(r)} → ${v}`,
                    confirmLabel: 'Apply',
                    action: (reason) => admin.org.setFpoPoolStatus(idOf(r), v, reason),
                    onDone: pools.reload,
                  })
                }
                options={[{ value: '', label: 'Set…' }, ...POOL_STATUSES.map((s) => ({ value: s, label: s }))]}
              />
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};
