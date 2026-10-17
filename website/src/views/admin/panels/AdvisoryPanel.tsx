import React, { useState } from 'react';
import { ScanSearch, Bug, FlaskConical, Target, FileUp } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Field,
  TextInput,
  Banner,
  idOf,
  str,
  num,
  pct,
  useAsync,
  useReasonModal,
  asRow,
  type Row,
} from './shared';

/**
 * SOP-11 — AI Advisory & Soil Labs.
 * Advisory scan accuracy watch, geofenced pest-alert broadcast, and the
 * soil-test queue with lab-result upload (POST /admin/soil-tests/{id}/results)
 * plus validation.
 */
export const AdvisoryPanel: React.FC = () => {
  const { request, modal } = useReasonModal();

  const scans = useAsync(() => admin.fieldOps.advisoryScans(), []);
  const accuracy = useAsync(() => admin.fieldOps.advisoryAccuracy().catch(() => null), []);
  const soilTests = useAsync(() => admin.fieldOps.soilTests(), []);

  return (
    <>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <PanelShell
          title="SOP-11: Advisory Scan Accuracy"
          subtitle="Model precision / recall on pest & disease scans (GET /admin/advisory/scans/accuracy)."
          icon={Target}
          loading={accuracy.loading}
          onRefresh={accuracy.reload}
        >
          <KV record={asRow(accuracy.data)} compact />
        </PanelShell>
        <div className="xl:col-span-2">
          <PanelShell
            title="SOP-11: Broadcast Pest Alert"
            subtitle="Push a district-level pest / disease early warning to all farmers."
            icon={Bug}
            actions={
              <Btn
                tone="warn"
                onClick={() =>
                  request({
                    title: 'Broadcast pest alert',
                    description: 'Creates an advisory alert visible to every farmer in the target scope.',
                    confirmLabel: 'Broadcast alert',
                    tone: 'warn',
                    defaultReason: 'Pest early-warning from SOP-11 desk',
                    action: (reason) => admin.fieldOps.broadcastPestAlert({ reason, scope: 'all' }, reason),
                  })
                }
              >
                Broadcast alert
              </Btn>
            }
          >
            <p className="text-xs text-slate-500">
              Sends a real advisory alert (POST /admin/advisory/pest-alerts). Use after model confirmation or field
              verification of an outbreak.
            </p>
          </PanelShell>
        </div>
      </div>

      <PanelShell
        title="SOP-11: AI Advisory Scans"
        subtitle="Pest / disease / deficiency scans submitted by farmers — under 0.7 confidence is flagged low."
        icon={ScanSearch}
        loading={scans.loading}
        error={scans.error}
        onRefresh={scans.reload}
      >
        <DataTable
          rows={(scans.data ?? []) as Row[]}
          empty="No advisory scans."
          columns={[
            {
              header: 'Scan',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'detection', 'diagnosis', 'issue', 'title', 'type')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
                </div>
              ),
            },
            { header: 'Farmer', cell: (r) => <span className="text-slate-600">{str(r, 'farmerName', 'userName', 'userId')}</span> },
            { header: 'Crop', cell: (r) => <span className="text-slate-600">{str(r, 'crop', 'commodity')}</span> },
            {
              header: 'Confidence',
              cell: (r) => {
                const c = num(r, 'confidence', 'confidencePct') ?? 0;
                return (
                  <div className="w-28">
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full ${c < 0.7 ? 'bg-rose-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, c * (c <= 1 ? 100 : 1))}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">{pct(c)}</p>
                  </div>
                );
              },
            },
            { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
            { header: 'Scanned', cell: (r) => <span className="text-slate-500">{str(r, 'createdAt', 'scannedAt')}</span> },
          ]}
        />
      </PanelShell>

      <SoilTestsCard />
      {modal}
    </>
  );
};

const SoilTestsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const soilTests = useAsync(() => admin.fieldOps.soilTests(), []);

  const [resultsFor, setResultsFor] = useState<string | null>(null);
  const [ph, setPh] = useState('');
  const [npk, setNpk] = useState('');
  const [reportUrl, setReportUrl] = useState('');
  const [submitBusy, setSubmitBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'error' | 'success'; text: string } | null>(null);

  const rows = (soilTests.data ?? []) as Row[];
  const resultsRow = resultsFor ? rows.find((r) => idOf(r) === resultsFor) ?? null : null;

  const submitResults = async (reason: string) => {
    if (!resultsFor) return;
    setSubmitBusy(true);
    setMsg(null);
    try {
      await admin.fieldOps.submitSoilResults(
        resultsFor,
        {
          ph: ph ? Number(ph) : undefined,
          npk: npk.trim() || undefined,
          reportUrl: reportUrl.trim() || undefined,
          reason,
        },
        reason
      );
      setMsg({ kind: 'success', text: `Lab results uploaded for ${resultsFor} — farmer notified (reportReady).` });
      setResultsFor(null);
      setPh('');
      setNpk('');
      setReportUrl('');
      soilTests.reload();
    } finally {
      setSubmitBusy(false);
    }
  };

  return (
    <PanelShell
      title="SOP-11: Soil Test Queue"
      subtitle="Pending soil-sample tests across users. Upload lab results (PDF + NPK/pH) to notify the farmer, or validate a lab-uploaded card."
      icon={FlaskConical}
      loading={soilTests.loading}
      error={soilTests.error}
      onRefresh={soilTests.reload}
    >
      {msg && <Banner kind={msg.kind}>{msg.text}</Banner>}

      {resultsRow && (
        <div className="p-3 border border-emerald-200 bg-emerald-50/40 rounded-2xl space-y-3">
          <p className="text-xs font-bold text-slate-700">
            Upload lab results — {str(resultsRow, 'testId', 'id', 'labName')} ({str(resultsRow, 'farmerName', 'userName', 'userId')})
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="pH">
              <TextInput type="number" value={ph} onChange={setPh} placeholder="6.8" />
            </Field>
            <Field label="NPK">
              <TextInput value={npk} onChange={setNpk} placeholder="12-32-16" />
            </Field>
            <Field label="Report PDF URL" className="col-span-2">
              <TextInput value={reportUrl} onChange={setReportUrl} placeholder="https://…/report.pdf" />
            </Field>
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => setResultsFor(null)}>Cancel</Btn>
            <Btn
              tone="primary"
              busy={submitBusy}
              disabled={!ph && !npk.trim() && !reportUrl.trim()}
              onClick={() =>
                request({
                  title: `Upload soil-test results — ${idOf(resultsRow)}`,
                  confirmLabel: 'Upload results',
                  action: submitResults,
                  onDone: soilTests.reload,
                })
              }
            >
              <FileUp className="w-3.5 h-3.5" /> Upload results (audited)
            </Btn>
          </div>
        </div>
      )}

      <DataTable
        rows={rows}
        empty="No soil tests in the queue."
        columns={[
          {
            header: 'Test',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'labName', 'lab', 'testId', 'id')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'farmerName', 'userName', 'userId')}</p>
              </div>
            ),
          },
          { header: 'pH / NPK', cell: (r) => (
            <span className="text-slate-600">
              pH {num(r, 'ph') ?? '—'} • {str(r, 'npk', 'npkRatio', 'nutrients')}
            </span>
          ) },
          { header: 'Organic carbon', cell: (r) => <span className="text-slate-500">{str(r, 'organicCarbon', 'oc', 'carbon')}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
          {
            header: 'Actions',
            className: 'text-right',
            cell: (r) => (
              <div className="flex justify-end gap-1.5">
                <Btn onClick={() => { setResultsFor(idOf(r)); setMsg(null); }}>Results</Btn>
                <Btn
                  tone="primary"
                  onClick={() =>
                    request({
                      title: `Validate soil test ${idOf(r)}`,
                      defaultReason: 'Lab report matches sample chain',
                      confirmLabel: 'Validate',
                      action: (reason) => admin.fieldOps.validateSoilTest(idOf(r), { reason, validated: true }, reason),
                      onDone: soilTests.reload,
                    })
                  }
                >
                  Validate
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
