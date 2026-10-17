import React, { useState } from 'react';
import { NotebookPen, TrendingUp, Trophy } from 'lucide-react';
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
  money,
  pct,
  useAsync,
  useReasonModal,
  asRow,
  asRows,
  type Row,
} from './shared';

/**
 * SOP-13 — Farm Diary & P&L Oversight.
 * Diary entries, aggregate summary and P&L crop benchmarks.
 * /admin/pnl/benchmarks is absent from the admin namespace → direct apiClient.
 */
export const DiaryPanel: React.FC = () => {
  const [tab, setTab] = useState('entries');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'entries', label: 'Diary entries' },
          { id: 'summary', label: 'Summary' },
          { id: 'benchmarks', label: 'P&L benchmarks' },
        ]}
      />
      {tab === 'entries' && <EntriesCard />}
      {tab === 'summary' && <SummaryCard />}
      {tab === 'benchmarks' && <BenchmarksCard />}
    </>
  );
};

const EntriesCard: React.FC = () => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const entries = useAsync(() => admin.fieldOps.diaryEntries(), []);

  const rows = (entries.data ?? []) as Row[];
  const selected = selectedId ? rows.find((r) => idOf(r) === selectedId) ?? null : null;

  return (
    <>
      <PanelShell
        title="SOP-13: Farm Diary Entries"
        subtitle="Sowing, input, labour and harvest records across the farmer base."
        icon={NotebookPen}
        loading={entries.loading}
        error={entries.error}
        onRefresh={entries.reload}
      >
        <DataTable
          rows={rows}
          empty="No diary entries."
          columns={[
            {
              header: 'Activity',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'activity', 'type', 'title', 'category')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                </div>
              ),
            },
            { header: 'Farmer', cell: (r) => <span className="text-slate-600">{str(r, 'farmerName', 'userName', 'userId')}</span> },
            { header: 'Crop / Plot', cell: (r) => <span className="text-slate-600">{str(r, 'crop', 'plot', 'plotName')}</span> },
            {
              header: 'Cost / Qty',
              cell: (r) => (
                <div>
                  <p className="font-bold">{money(num(r, 'cost', 'amount', 'expense'))}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'quantity', 'qty')}</p>
                </div>
              ),
            },
            { header: 'Date', cell: (r) => <span className="text-slate-500">{str(r, 'date', 'createdAt', 'performedAt')}</span> },
            { header: 'Action', className: 'text-right', cell: (r) => <Btn onClick={() => setSelectedId(idOf(r))}>Detail</Btn> },
          ]}
        />
      </PanelShell>
      {selected && (
        <PanelShell
          title={`Entry ${idOf(selected)}`}
          subtitle="Full diary record."
          icon={NotebookPen}
          actions={<Btn onClick={() => setSelectedId(null)}>Close</Btn>}
        >
          <KV record={selected} />
        </PanelShell>
      )}
    </>
  );
};

const SummaryCard: React.FC = () => {
  const summary = useAsync(() => admin.fieldOps.diarySummary().catch(() => null), []);
  return (
    <PanelShell
      title="SOP-13: Diary & P&L Summary"
      subtitle="Aggregated cost / revenue / profit picture (GET /admin/diary/summary)."
      icon={TrendingUp}
      loading={summary.loading}
      onRefresh={summary.reload}
    >
      {summary.error ? <Banner kind="error">{summary.error}</Banner> : <KV record={asRow(summary.data)} />}
    </PanelShell>
  );
};

const BenchmarksCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const benchmarks = useAsync(
    () => apiClient.get('/admin/pnl/benchmarks').then((res) => (res.data?.data ?? res.data) as unknown),
    []
  );

  const [crop, setCrop] = useState('');
  const [profitPerAcre, setProfitPerAcre] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await apiClient.put(
        `/admin/pnl/benchmarks/${encodeURIComponent(crop.trim())}`,
        { profitPerAcre: Number(profitPerAcre) },
        { headers: { 'X-Audit-Reason': `Benchmark set for ${crop.trim()}` } }
      );
      setMsg({ kind: 'success', text: 'Benchmark saved.' });
      benchmarks.reload();
    } catch (e) {
      setMsg({ kind: 'error', text: apiErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const rows = asRows(benchmarks.data);

  return (
    <PanelShell
      title="SOP-13: Crop P&L Benchmarks"
      subtitle="Reference profit-per-acre per crop, shown to farmers against their own P&L (direct apiClient — not in admin namespace)."
      icon={Trophy}
      loading={benchmarks.loading}
      error={benchmarks.error}
      onRefresh={benchmarks.reload}
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}
      <div className="flex flex-wrap items-end gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
        <Field label="Crop" className="w-44">
          <TextInput value={crop} onChange={setCrop} placeholder="Soybean" />
        </Field>
        <Field label="Profit ₹/acre" className="w-36">
          <TextInput type="number" value={profitPerAcre} onChange={setProfitPerAcre} placeholder="18500" />
        </Field>
        <Btn
          tone="primary"
          busy={busy}
          disabled={!crop.trim() || !profitPerAcre}
          onClick={() =>
            request({
              title: `Set ${crop.trim()} benchmark → ₹${profitPerAcre}/acre`,
              confirmLabel: 'Save benchmark',
              action: save,
              onDone: benchmarks.reload,
            })
          }
        >
          Save benchmark
        </Btn>
      </div>
      <DataTable
        rows={rows}
        empty="No benchmarks configured."
        columns={[
          { header: 'Crop', cell: (r) => <span className="font-bold text-slate-900">{str(r, 'crop', 'name', 'cropName')}</span> },
          { header: 'Profit / acre', cell: (r) => <span className="font-bold">{money(num(r, 'profitPerAcre', 'profit'))}</span> },
          { header: 'Yield', cell: (r) => <span className="text-slate-600">{str(r, 'yieldQuintals', 'yield', 'benchmarkYield')}</span> },
          { header: 'Season', cell: (r) => <span className="text-slate-500">{str(r, 'season', 'year')}</span> },
        ]}
      />
      {modal}
    </PanelShell>
  );
};
