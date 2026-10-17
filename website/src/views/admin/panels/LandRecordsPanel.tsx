import React, { useState } from 'react';
import { FileCheck2, Download, Database } from 'lucide-react';
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
  str,
  useAsync,
  useReasonModal,
  asRow,
  asRows,
  type Row,
} from './shared';

/**
 * SOP-16 — Land Records Registry Sync.
 * Registry health, seed from source data (MPIN step-up), audit log and CSV export.
 */
export const LandRecordsPanel: React.FC = () => {
  const [tab, setTab] = useState('health');
  const { request, modal } = useReasonModal();

  const health = useAsync(() => admin.fieldOps.landRecordsHealth().catch(() => null), []);
  const status = useAsync(() => admin.fieldOps.landRecordsStatus().catch(() => null), []);
  const auditLog = useAsync(() => admin.fieldOps.landRecordsAuditLog(), []);

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const exportAudit = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await apiClient.get('/admin/land-records/audit-log/export', { responseType: 'blob' });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `land-records-audit-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setExportMsg(apiErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'health', label: 'Registry health' },
          { id: 'audit', label: 'Audit log' },
          { id: 'seed', label: 'Seed registry' },
        ]}
      />
      {tab === 'health' && (
        <PanelShell
          title="SOP-16: Land Records Registry Health"
          subtitle="Document counts, sync drift and verification coverage vs the source registry."
          icon={Database}
          loading={health.loading || status.loading}
          actions={
            <Btn busy={exporting} onClick={exportAudit}>
              <Download className="w-3.5 h-3.5" /> Export audit CSV
            </Btn>
          }
        >
          {exportMsg && <Banner kind="error">{exportMsg}</Banner>}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div>
              <h4 className="text-xs font-extrabold text-slate-700 mb-2">Health</h4>
              {health.error ? <Banner kind="error">{health.error}</Banner> : <KV record={asRow(health.data)} />}
            </div>
            <div>
              <h4 className="text-xs font-extrabold text-slate-700 mb-2">Status</h4>
              {status.error ? <Banner kind="error">{status.error}</Banner> : <KV record={asRow(status.data)} />}
            </div>
          </div>
        </PanelShell>
      )}
      {tab === 'audit' && (
        <PanelShell
          title="SOP-16: Registry Audit Log"
          subtitle="Every mutation of the land-records mirror."
          icon={FileCheck2}
          loading={auditLog.loading}
          error={auditLog.error}
          onRefresh={auditLog.reload}
        >
          <DataTable
            rows={asRows(auditLog.data)}
            empty="No registry mutations logged."
            columns={[
              { header: 'When', cell: (r) => <span className="text-slate-500">{str(r, 'at', 'createdAt', 'timestamp')}</span> },
              { header: 'Actor', cell: (r) => <span className="font-mono text-slate-700">{str(r, 'actor', 'actorId', 'adminUid')}</span> },
              { header: 'Action', cell: (r) => <span className="font-semibold text-slate-800">{str(r, 'action', 'op', 'event')}</span> },
              { header: 'Record', cell: (r) => <span className="text-slate-500">{str(r, 'recordId', 'docId', 'gatNo', 'surveyNo')}</span> },
            ]}
          />
        </PanelShell>
      )}
      {tab === 'seed' && <SeedCard request={request} />}
      {modal}
    </>
  );
};

const SeedCard: React.FC<{ request: (r: import('./shared').ReasonRequest) => void }> = ({ request }) => {
  const [district, setDistrict] = useState('');
  const [count, setCount] = useState('50');

  return (
    <PanelShell
      title="SOP-16: Seed Land Records"
      subtitle="Pull records from the source registry into the platform mirror. MPIN step-up required."
      icon={Database}
    >
      <div className="flex flex-wrap items-end gap-2 max-w-xl">
        <Field label="District" className="flex-1 min-w-40">
          <TextInput value={district} onChange={setDistrict} placeholder="Nashik" />
        </Field>
        <Field label="Max records" className="w-32">
          <TextInput type="number" value={count} onChange={setCount} />
        </Field>
        <Btn
          tone="warn"
          disabled={!district.trim()}
          onClick={() =>
            request({
              title: `Seed land records — ${district.trim()}`,
              confirmLabel: 'Run seed',
              requireMpin: true,
              tone: 'warn',
              defaultReason: `Registry seed for ${district.trim()}`,
              action: (reason) =>
                admin.fieldOps.seedLandRecords({ district: district.trim(), limit: Number(count) || 50 }, reason),
            })
          }
        >
          Run seed
        </Btn>
      </div>
    </PanelShell>
  );
};
