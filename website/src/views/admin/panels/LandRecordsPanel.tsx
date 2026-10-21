import React, { useState } from 'react';
import { FileCheck2, Download, Database, Plug } from 'lucide-react';
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
  str,
  num,
  useAsync,
  useReasonModal,
  asRow,
  asRows,
  type Row,
} from './shared';

/**
 * SOP-16 — Land Records Registry Sync.
 * Registry health, integration config (provider + credentials, apiKey is
 * write-only), seed from source data (MPIN step-up), audit log and CSV export.
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
          { id: 'config', label: 'Integration config' },
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
      {tab === 'config' && <IntegrationConfigCard />}
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

/**
 * 7/12 source-registry integration config. The stored apiKey is write-only:
 * GET returns only apiKeyMasked, and a typed key is sent on PUT once — it is
 * never re-displayed or echoed back into the form.
 */
const IntegrationConfigCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const cfgRes = useAsync(() => admin.fieldOps.landRecordsConfig().catch(() => null), []);
  const cfg = asRow(cfgRes.data);

  const [provider, setProvider] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [syncEnabled, setSyncEnabled] = useState<boolean | null>(null);
  const [syncCron, setSyncCron] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('');
  const dirty =
    provider.trim() !== '' || apiUrl.trim() !== '' || apiKey.trim() !== '' || syncEnabled !== null || syncCron.trim() !== '' || timeoutMs !== '';

  const save = async (reason: string) => {
    await admin.fieldOps.updateLandRecordsConfig(
      {
        ...(provider.trim() ? { provider: provider.trim() } : {}),
        ...(apiUrl.trim() ? { apiUrl: apiUrl.trim() } : {}),
        // Write-only: send the new key only when the admin typed one.
        ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
        ...(syncEnabled !== null ? { syncEnabled } : {}),
        ...(syncCron.trim() ? { syncCron: syncCron.trim() } : {}),
        ...(timeoutMs !== '' ? { timeoutMs: Number(timeoutMs) } : {}),
      },
      reason
    );
    setProvider('');
    setApiUrl('');
    setApiKey('');
    setSyncEnabled(null);
    setSyncCron('');
    setTimeoutMs('');
    cfgRes.reload();
  };

  return (
    <PanelShell
      title="SOP-16: Land Records Integration Config"
      subtitle="Source registry connection for 7/12 sync (GET/PUT /admin/land-records/config). The API key is write-only — it is sent on save only when you type a new one, and reads return just the last-4 mask."
      icon={Plug}
      loading={cfgRes.loading}
      onRefresh={cfgRes.reload}
      actions={
        dirty ? (
          <div className="flex gap-2">
            <Btn
              onClick={() => {
                setProvider('');
                setApiUrl('');
                setApiKey('');
                setSyncEnabled(null);
                setSyncCron('');
                setTimeoutMs('');
              }}
            >
              Cancel
            </Btn>
            <Btn
              tone="primary"
              onClick={() =>
                request({
                  title: 'Update land-records integration config',
                  defaultReason: 'Land-records integration update',
                  confirmLabel: 'Save config',
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={`Provider — current ${str(cfg, 'provider')}`}>
              <TextInput value={provider} onChange={setProvider} placeholder={str(cfg, 'provider') === '—' ? 'mahabhulekh / bhoomi / …' : str(cfg, 'provider')} />
            </Field>
            <Field label={`API URL — current ${str(cfg, 'apiUrl')}`}>
              <TextInput value={apiUrl} onChange={setApiUrl} placeholder={str(cfg, 'apiUrl')} />
            </Field>
            <Field
              label={
                str(cfg, 'apiKeyMasked') !== '—'
                  ? `API key — currently set (${str(cfg, 'apiKeyMasked')})`
                  : 'API key — not set'
              }
            >
              <TextInput type="password" value={apiKey} onChange={setApiKey} placeholder="Type a new key to replace — never displayed back" autoComplete="new-password" />
            </Field>
            <Field label={`Sync enabled — currently ${String(cfg.syncEnabled ?? false)}`}>
              <Select
                value={syncEnabled === null ? '' : String(syncEnabled)}
                onChange={(v) => setSyncEnabled(v === '' ? null : v === 'true')}
                options={[
                  { value: '', label: 'Keep current' },
                  { value: 'true', label: 'Enabled' },
                  { value: 'false', label: 'Disabled' },
                ]}
              />
            </Field>
            <Field label={`Sync cron — current ${str(cfg, 'syncCron')}`}>
              <TextInput value={syncCron} onChange={setSyncCron} placeholder={str(cfg, 'syncCron') === '—' ? '0 2 * * *' : str(cfg, 'syncCron')} />
            </Field>
            <Field label={`Timeout (ms) — current ${num(cfg, 'timeoutMs') ?? '—'}`}>
              <TextInput type="number" inputMode="numeric" value={timeoutMs} onChange={setTimeoutMs} placeholder={String(num(cfg, 'timeoutMs') ?? 10000)} />
            </Field>
          </div>
          <p className="text-[11px] text-slate-400">
            Last updated {str(cfg, 'updatedAt')} by {str(cfg, 'updatedBy')}.
            {str(cfg, 'apiKeyMasked') !== '—' && (
              <span className="ml-1 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                key set {str(cfg, 'apiKeyMasked')}
              </span>
            )}
          </p>
        </>
      )}
    </PanelShell>
  );
};
