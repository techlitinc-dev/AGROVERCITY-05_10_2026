import React, { useState } from 'react';
import { HeartHandshake, HandCoins, BarChart3 } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
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
 * SOP-24 — Women & SHG Enterprise Programs.
 * SHG verification queue, subsidy disbursement, enterprise directory and impact report.
 */
export const WomenPanel: React.FC = () => {
  const [tab, setTab] = useState('queue');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'queue', label: 'SHG verification queue' },
          { id: 'directory', label: 'SHG directory' },
          { id: 'subsidies', label: 'Subsidies' },
          { id: 'impact', label: 'Impact report' },
        ]}
      />
      {tab === 'queue' && <QueueCard />}
      {tab === 'directory' && <DirectoryCard />}
      {tab === 'subsidies' && <SubsidyCard />}
      {tab === 'impact' && <ImpactCard />}
    </>
  );
};

const QueueCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const queue = useAsync(() => admin.women.shgQueue(), []);

  return (
    <PanelShell
      title="SOP-24: SHG Verification Queue"
      subtitle="Self Help Groups awaiting verification to unlock group lending and subsidies."
      icon={HeartHandshake}
      loading={queue.loading}
      error={queue.error}
      onRefresh={queue.reload}
    >
      <DataTable
        rows={(queue.data ?? []) as Row[]}
        empty="No SHGs awaiting verification."
        columns={[
          {
            header: 'SHG',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name', 'shgName', 'groupName')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'village', 'district', 'block')}</p>
              </div>
            ),
          },
          { header: 'Members', cell: (r) => <span className="font-semibold">{num(r, 'memberCount', 'members') ?? '—'}</span> },
          { header: 'Leader', cell: (r) => <span className="text-slate-600">{str(r, 'leaderName', 'president', 'leader')}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state', 'verificationStatus')} /> },
          {
            header: 'Actions',
            className: 'text-right',
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Btn
                  tone="danger"
                  onClick={() =>
                    request({
                      title: `Reject SHG ${str(r, 'name', 'shgName')}`,
                      confirmLabel: 'Reject',
                      tone: 'danger',
                      action: (reason) => admin.org.rejectShg(idOf(r), { reason }, reason),
                      onDone: queue.reload,
                    })
                  }
                >
                  Reject
                </Btn>
                <Btn
                  tone="primary"
                  onClick={() =>
                    request({
                      title: `Verify SHG ${str(r, 'name', 'shgName')}`,
                      defaultReason: 'Group bylaws + member KYC verified',
                      confirmLabel: 'Verify SHG',
                      action: (reason) => admin.women.verifyShg(idOf(r), reason),
                      onDone: queue.reload,
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
      {modal}
    </PanelShell>
  );
};

const DirectoryCard: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const shgs = useAsync(() => admin.women.shgs(), []);
  const deposits = useAsync(
    () => (selectedId ? admin.org.shgDeposits(selectedId).catch(() => null) : Promise.resolve(null)),
    [selectedId]
  );
  const enterprises = useAsync(
    () => (selectedId ? admin.org.shgEnterprises(selectedId).catch(() => null) : Promise.resolve(null)),
    [selectedId]
  );

  const rows = (shgs.data ?? []) as Row[];
  const selected = selectedId ? rows.find((r) => idOf(r) === selectedId) ?? null : null;

  return (
    <>
      <PanelShell
        title="SOP-24: SHG Directory"
        subtitle="All registered SHGs with savings deposits and member enterprises."
        icon={HeartHandshake}
        loading={shgs.loading}
        error={shgs.error}
        onRefresh={shgs.reload}
      >
        <DataTable
          rows={rows}
          empty="No SHGs registered."
          columns={[
            {
              header: 'SHG',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'name', 'shgName')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'village', 'district')}</p>
                </div>
              ),
            },
            { header: 'Members', cell: (r) => <span>{num(r, 'memberCount', 'members') ?? '—'}</span> },
            { header: 'Savings', cell: (r) => <span className="font-bold">{money(num(r, 'totalSavings', 'savings', 'corpus'))}</span> },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            { header: 'Action', className: 'text-right', cell: (r) => <Btn onClick={() => setSelectedId(idOf(r))}>Detail</Btn> },
          ]}
        />
      </PanelShell>
      {selected && (
        <PanelShell
          title={`SHG detail — ${str(selected, 'name', 'shgName')}`}
          subtitle="Savings deposits and enterprises linked to this group."
          icon={HeartHandshake}
          loading={deposits.loading || enterprises.loading}
          actions={<Btn onClick={() => setSelectedId(null)}>Close</Btn>}
        >
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <h4 className="text-xs font-extrabold text-slate-700 mb-2">Deposits</h4>
              <DataTable
                rows={asRows(deposits.data)}
                empty="No deposits recorded."
                columns={[
                  { header: 'Member', cell: (r) => <span>{str(r, 'memberName', 'name', 'memberId')}</span> },
                  { header: 'Amount', cell: (r) => <span className="font-bold">{money(num(r, 'amount'))}</span> },
                  { header: 'Date', cell: (r) => <span>{str(r, 'date', 'depositedAt', 'createdAt')}</span> },
                ]}
              />
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-700 mb-2">Enterprises</h4>
              <DataTable
                rows={asRows(enterprises.data)}
                empty="No enterprises linked."
                columns={[
                  { header: 'Enterprise', cell: (r) => <span className="font-semibold">{str(r, 'name', 'enterpriseName', 'type')}</span> },
                  { header: 'Revenue', cell: (r) => <span className="font-bold">{money(num(r, 'revenue', 'monthlyRevenue'))}</span> },
                  { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
                ]}
              />
            </div>
          </div>
        </PanelShell>
      )}
    </>
  );
};

const SubsidyCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const [shgId, setShgId] = useState('');
  const [amount, setAmount] = useState('');
  const [purpose, setPurpose] = useState('equipment');

  return (
    <PanelShell
      title="SOP-24: Subsidy Disbursement"
      subtitle="Release government / platform subsidies directly to verified SHGs."
      icon={HandCoins}
    >
      <div className="flex flex-wrap items-end gap-2 max-w-3xl">
        <Field label="SHG ID" className="flex-1 min-w-44">
          <TextInput value={shgId} onChange={setShgId} placeholder="shg_…" />
        </Field>
        <Field label="Amount ₹" className="w-36">
          <TextInput type="number" value={amount} onChange={setAmount} placeholder="25000" />
        </Field>
        <Field label="Purpose" className="w-44">
          <Select
            value={purpose}
            onChange={setPurpose}
            options={[
              { value: 'equipment', label: 'Equipment purchase' },
              { value: 'working_capital', label: 'Working capital' },
              { value: 'training', label: 'Skill training' },
              { value: 'infrastructure', label: 'Infrastructure' },
            ]}
          />
        </Field>
        <Btn
          tone="primary"
          disabled={!shgId.trim() || !amount}
          onClick={() =>
            request({
              title: `Disburse subsidy — ${money(Number(amount))} to ${shgId.trim()}`,
              confirmLabel: 'Disburse',
              requireMpin: true,
              action: (reason) =>
                admin.women.disburseSubsidy(
                  { shgId: shgId.trim(), amount: Number(amount), purpose, reason },
                  reason
                ),
              onDone: () => {
                setShgId('');
                setAmount('');
              },
            })
          }
        >
          Disburse subsidy
        </Btn>
      </div>
      {modal}
    </PanelShell>
  );
};

const ImpactCard: React.FC = () => {
  const impact = useAsync(() => admin.women.impactReport().catch(() => null), []);
  const products = useAsync(() => admin.women.enterpriseProducts().catch(() => null), []);
  const enterprises = useAsync(() => admin.women.enterprises().catch(() => null), []);

  return (
    <>
      <PanelShell
        title="SOP-24: Women Enterprise Impact Report"
        subtitle="Platform-wide impact metrics (GET /admin/women/impact-report)."
        icon={BarChart3}
        loading={impact.loading}
        onRefresh={impact.reload}
      >
        {impact.error ? <Banner kind="error">{impact.error}</Banner> : <KV record={asRow(impact.data)} />}
      </PanelShell>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <PanelShell
          title="Enterprise products"
          subtitle="Gruh-udhyog products listed on the marketplace."
          icon={HeartHandshake}
          loading={products.loading}
          error={products.error}
          onRefresh={products.reload}
        >
          <DataTable
            rows={asRows(products.data)}
            empty="No products listed."
            columns={[
              { header: 'Product', cell: (r) => <span className="font-bold text-slate-900">{str(r, 'name', 'title')}</span> },
              { header: 'SHG', cell: (r) => <span className="text-slate-600">{str(r, 'shgName', 'producer', 'shgId')}</span> },
              { header: 'Price', cell: (r) => <span className="font-bold">{money(num(r, 'price'))}</span> },
              { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            ]}
          />
        </PanelShell>
        <PanelShell
          title="Enterprises"
          subtitle="Registered women-led enterprises."
          icon={HeartHandshake}
          loading={enterprises.loading}
          error={enterprises.error}
          onRefresh={enterprises.reload}
        >
          <DataTable
            rows={asRows(enterprises.data)}
            empty="No enterprises registered."
            columns={[
              { header: 'Enterprise', cell: (r) => <span className="font-bold text-slate-900">{str(r, 'name', 'enterpriseName')}</span> },
              { header: 'Type', cell: (r) => <span className="text-slate-600">{str(r, 'type', 'category')}</span> },
              { header: 'SHG', cell: (r) => <span className="text-slate-500">{str(r, 'shgName', 'shgId')}</span> },
              { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            ]}
          />
        </PanelShell>
      </div>
    </>
  );
};
