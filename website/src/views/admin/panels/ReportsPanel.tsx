import React, { useState } from 'react';
import { Download, Users, ArrowLeftRight, Sprout, Landmark, CreditCard, Vault } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage, download } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  Btn,
  Field,
  TextInput,
  Select,
  Banner,
  str,
  num,
  money,
  useAsync,
  asRow,
  type Row,
} from './shared';

/**
 * Reports & Exports — one-stop generators for the platform's admin reports.
 *
 * Users export (JSON), Transactions & Crops reports (in-page JSON preview +
 * CSV download via the shared download() helper), the Financial report
 * (GET /admin/reports/financial — JSON view + CSV), plus the subscriptions
 * registry and escrow holdings monitor.
 */

export const ReportsPanel: React.FC = () => {
  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <UsersExportCard />
        <TransactionsReportCard />
        <CropsReportCard />
        <FinancialReportCard />
      </div>
      <SubscriptionsCard />
      <EscrowHoldingsCard />
    </>
  );
};

/** Trigger a browser download for a Blob returned by the download() helper. */
const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const today = () => new Date().toISOString().slice(0, 10);

const UsersExportCard: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const data = await admin.users.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      saveBlob(blob, `agrovercity-users-${today()}.json`);
    } catch (e) {
      setMsg(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Users export"
      subtitle="Full user roster from GET /admin/users/export — downloads as JSON."
      icon={Users}
    >
      {msg && <Banner kind="error">{msg}</Banner>}
      <Btn tone="primary" busy={busy} onClick={run}>
        <Download className="w-3.5 h-3.5" /> Export users (JSON)
      </Btn>
    </PanelShell>
  );
};

const TransactionsReportCard: React.FC = () => {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const params = { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  const preview = useAsync(
    () => admin.finance.transactionsReport({ ...params, format: 'json' }),
    [from, to]
  );
  const rows = (preview.data ?? []) as Row[];

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await download('/admin/reports/transactions', { ...params, format: 'csv' });
      saveBlob(blob, `transactions_${from || 'start'}_${to || 'end'}.csv`);
    } catch (e) {
      setMsg(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Transactions report"
      subtitle="Bookings + marketplace orders + settlements in the date range (GET /admin/reports/transactions)."
      icon={ArrowLeftRight}
      loading={preview.loading}
      error={preview.error}
      onRefresh={preview.reload}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <Field label="From" className="w-36">
            <TextInput type="date" value={from} onChange={setFrom} />
          </Field>
          <Field label="To" className="w-36">
            <TextInput type="date" value={to} onChange={setTo} />
          </Field>
          <Btn tone="primary" busy={busy} onClick={run}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Btn>
        </div>
      }
    >
      {msg && <Banner kind="error">{msg}</Banner>}
      <DataTable
        rows={rows}
        empty="No transactions in this range."
        columns={[
          { header: 'Kind', cell: (r) => <span className="font-semibold">{str(r, 'kind')}</span> },
          { header: 'Ref', cell: (r) => <span className="font-mono text-[10px] text-slate-500">{str(r, 'refId')}</span> },
          { header: 'Date', cell: (r) => <span className="text-slate-500">{str(r, 'date')}</span> },
          {
            header: 'Amount',
            cell: (r) => <span className="font-bold">{money((num(r, 'amountPaise') ?? 0) / 100)}</span>,
          },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status')} /> },
        ]}
      />
    </PanelShell>
  );
};

const CropsReportCard: React.FC = () => {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const report = useAsync(() => admin.finance.cropsReport({ format: 'json' }), []);
  const rows = (report.data ?? []) as Row[];

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await download('/admin/reports/crops', { format: 'csv' });
      saveBlob(blob, 'crops_report.csv');
    } catch (e) {
      setMsg(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Crops report"
      subtitle="Crop-wise listed volumes and values aggregated from market lots (GET /admin/reports/crops)."
      icon={Sprout}
      loading={report.loading}
      error={report.error}
      onRefresh={report.reload}
      actions={
        <Btn tone="primary" busy={busy} onClick={run}>
          <Download className="w-3.5 h-3.5" /> CSV
        </Btn>
      }
    >
      {msg && <Banner kind="error">{msg}</Banner>}
      <DataTable
        rows={rows}
        empty="No market lots aggregated yet."
        columns={[
          { header: 'Crop', cell: (r) => <span className="font-bold text-slate-900">{str(r, 'crop')}</span> },
          { header: 'Lots', cell: (r) => <span>{num(r, 'lots') ?? '—'}</span> },
          { header: 'Volume (q)', cell: (r) => <span className="font-semibold">{num(r, 'volumeQuintals') ?? '—'}</span> },
          { header: 'Value', cell: (r) => <span className="font-bold">{money(num(r, 'valueRupees'))}</span> },
          { header: 'Avg ₹/q', cell: (r) => <span className="text-slate-600">{money(num(r, 'averageRatePerQuintal'))}</span> },
        ]}
      />
    </PanelShell>
  );
};

const FinancialReportCard: React.FC = () => {
  const [month, setMonth] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const report = useAsync(
    () => admin.finance.financialReports({ ...(month ? { month } : {}) }),
    [month]
  );
  const row = asRow(report.data);

  const run = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const blob = await download('/admin/reports/financial', { ...(month ? { month } : {}), format: 'csv' });
      saveBlob(blob, `financial_report_${month || 'latest'}.csv`);
    } catch (e) {
      setMsg(apiErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelShell
      title="Financial report"
      subtitle="Consolidated GMV, commission, GST and TDS (GET /admin/reports/financial)."
      icon={Landmark}
      loading={report.loading}
      error={report.error}
      onRefresh={report.reload}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Month" className="w-36">
            <TextInput type="month" value={month} onChange={setMonth} placeholder="2026-10" />
          </Field>
          <Btn tone="primary" busy={busy} onClick={run}>
            <Download className="w-3.5 h-3.5" /> CSV
          </Btn>
        </div>
      }
    >
      {msg && <Banner kind="error">{msg}</Banner>}
      {row && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <FinStat label="Trade GMV" value={money(num(row, 'totalTradeGmv'))} />
          <FinStat label="Transport GMV" value={money(num(row, 'totalTransportGmv'))} />
          <FinStat label="Total GMV" value={money(num(row, 'totalGmv'))} />
          <FinStat label="Commission" value={money(num(row, 'platformCommission'))} />
          <FinStat label="GST collected" value={money(num(row, 'gstCollected'))} />
          <FinStat label="TDS deducted" value={money(num(row, 'tdsDeducted'))} />
          <FinStat label="Trades completed" value={String(num(row, 'tradesCompleted') ?? 0)} />
          <FinStat label="Trips delivered" value={String(num(row, 'tripsDelivered') ?? 0)} />
          <FinStat label="Month" value={str(row, 'month')} />
        </div>
      )}
    </PanelShell>
  );
};

const FinStat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
    <p className="text-sm font-extrabold text-slate-900">{value}</p>
  </div>
);

const SUB_STATUSES = ['active', 'past_due', 'cancelled', 'expired'];

const SubscriptionsCard: React.FC = () => {
  const [status, setStatus] = useState('');
  const [persona, setPersona] = useState('');
  const subs = useAsync(
    () =>
      admin.finance.subscriptions({
        ...(status ? { status } : {}),
        ...(persona ? { persona } : {}),
      }),
    [status, persona]
  );
  const rows = (subs.data ?? []) as Row[];

  return (
    <PanelShell
      title="Subscriptions"
      subtitle="Every user subscription joined with the subscriber and plan snapshot (GET /admin/subscriptions)."
      icon={CreditCard}
      loading={subs.loading}
      error={subs.error}
      onRefresh={subs.reload}
      actions={
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Status" className="w-36">
            <Select
              value={status}
              onChange={setStatus}
              options={[{ value: '', label: 'All' }, ...SUB_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]}
            />
          </Field>
          <Field label="Persona" className="w-36">
            <Select
              value={persona}
              onChange={setPersona}
              options={[
                { value: '', label: 'All' },
                { value: 'farmer', label: 'Farmer' },
                { value: 'seller', label: 'Seller' },
                { value: 'transporter', label: 'Transporter' },
                { value: 'equipmentOwner', label: 'Equipment owner' },
              ]}
            />
          </Field>
        </div>
      }
    >
      <DataTable
        rows={rows}
        empty="No subscriptions match these filters."
        columns={[
          {
            header: 'Subscriber',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'userName')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'userPhone')} • {str(r, 'persona')}</p>
              </div>
            ),
          },
          {
            header: 'Plan',
            cell: (r) => {
              const plan = asRow(r.plan as Row);
              return (
                <div>
                  <p className="font-semibold text-slate-700">{plan ? str(plan, 'name', 'title', 'planId') : str(r, 'planId')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{str(r, 'planId')}</p>
                </div>
              );
            },
          },
          { header: 'Provider', cell: (r) => <span className="text-slate-600">{str(r, 'provider')}</span> },
          { header: 'Period ends', cell: (r) => <span className="text-slate-500">{str(r, 'currentPeriodEnd')}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status')} /> },
          { header: 'Since', cell: (r) => <span className="text-slate-500">{str(r, 'createdAt')}</span> },
        ]}
      />
    </PanelShell>
  );
};

const EscrowHoldingsCard: React.FC = () => {
  const holdings = useAsync(() => admin.finance.escrowHoldings(), []);
  const data = asRow(holdings.data);
  const rows = Array.isArray(data?.data) ? (data!.data as Row[]) : [];
  const totals = asRow(data?.totals);
  const byKind = asRow(totals?.byKind);

  const totalPaise = num(totals, 'totalAmountPaise') ?? 0;

  return (
    <PanelShell
      title="Escrow Holdings"
      subtitle="In-escrow money across trade purchases and transport trips (GET /admin/escrow/holdings)."
      icon={Vault}
      loading={holdings.loading}
      error={holdings.error}
      onRefresh={holdings.reload}
    >
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <FinStat label="Held total" value={money(totalPaise / 100)} />
          <FinStat label="Holdings" value={String(num(totals, 'count') ?? rows.length)} />
          <FinStat label="Dispute-paused" value={String(num(totals, 'pausedCount') ?? 0)} />
          <FinStat
            label="By kind"
            value={Object.entries(byKind ?? {})
              .map(([k, v]) => {
                const b = asRow(v);
                return `${k}: ${money((num(b, 'amountPaise') ?? 0) / 100)}`;
              })
              .join(' • ') || '—'}
          />
        </div>
      )}
      <DataTable
        rows={rows}
        empty="Nothing is sitting in escrow."
        columns={[
          {
            header: 'Holding',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'kind')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{str(r, 'refId')}</p>
              </div>
            ),
          },
          { header: 'Holder', cell: (r) => <span className="text-slate-700">{str(r, 'holderName')}</span> },
          { header: 'Counterparty', cell: (r) => <span className="text-slate-500">{str(r, 'counterpartyName')}</span> },
          {
            header: 'Amount',
            cell: (r) => <span className="font-bold">{money((num(r, 'amountPaise') ?? 0) / 100)}</span>,
          },
          { header: 'Held since', cell: (r) => <span className="text-slate-500">{str(r, 'heldSince')}</span> },
          {
            header: 'State',
            cell: (r) =>
              r.paused ? (
                <StatusBadge status="dispute_paused" />
              ) : (
                <StatusBadge status={str(r, 'status')} />
              ),
          },
        ]}
      />
    </PanelShell>
  );
};
