import React, { useState } from 'react';
import { FileSpreadsheet, RefreshCw, Radio } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin, apiErrorMessage } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
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
  type Row,
} from './shared';

/**
 * SOP-04 — Mandi Rate Sync & Price Anomaly Approvals.
 * Pending rate approvals, flagged outliers, manual rate entry, mandi sync trigger.
 */
export const RatesPanel: React.FC = () => {
  const [tab, setTab] = useState('pending');
  const { request, modal } = useReasonModal();

  const pending = useAsync(() => admin.rates.pending(), []);
  const flagged = useAsync(() => admin.rates.flagged(), []);
  const mandiRates = useAsync(() => admin.rates.mandiRates(), []);

  const reloadAll = () => {
    pending.reload();
    flagged.reload();
    mandiRates.reload();
  };

  const rows = tab === 'pending' ? pending : tab === 'flagged' ? flagged : mandiRates;

  return (
    <>
      <PanelShell
        title="SOP-04: Mandi Rate Sync & Price Anomaly Approvals"
        subtitle="Approve crowd-sourced rate submissions, investigate flagged outliers, push manual APMC rates and trigger upstream sync."
        icon={FileSpreadsheet}
        loading={rows.loading}
        error={rows.error}
        onRefresh={rows.reload}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs
              active={tab}
              onChange={setTab}
              tabs={[
                { id: 'pending', label: 'Pending approvals' },
                { id: 'flagged', label: 'Flagged outliers' },
                { id: 'mandi', label: 'Mandi rates' },
                { id: 'manual', label: 'Manual entry' },
              ]}
            />
            <Btn
              tone="warn"
              onClick={() =>
                request({
                  title: 'Trigger mandi rate sync',
                  description: 'Pulls latest rates from the upstream APMC feed for all mapped mandis.',
                  confirmLabel: 'Run sync',
                  tone: 'warn',
                  defaultReason: 'Manual sync from SOP-04 desk',
                  action: (reason) => admin.rates.syncMandi(reason),
                  onDone: reloadAll,
                })
              }
            >
              <RefreshCw className="w-3.5 h-3.5" /> Sync mandis
            </Btn>
          </div>
        }
      >
        {tab !== 'manual' ? (
          <DataTable
            rows={(rows.data ?? []) as Row[]}
            empty="Nothing here — queue is clear."
            columns={[
              {
                header: 'Mandi / Market',
                cell: (r) => (
                  <div>
                    <p className="font-bold text-slate-900">{str(r, 'mandi', 'mandiName', 'market', 'marketName')}</p>
                    <p className="text-[10px] text-slate-400">{str(r, 'district', 'state', 'region')}</p>
                  </div>
                ),
              },
              {
                header: 'Commodity',
                cell: (r) => (
                  <div>
                    <p className="font-semibold text-slate-700">{str(r, 'commodity', 'crop', 'cropName', 'item')}</p>
                    <p className="text-[10px] text-slate-400">{str(r, 'variety', 'grade', 'quality')}</p>
                  </div>
                ),
              },
              {
                header: 'Rate',
                cell: (r) => {
                  const n = num(r, 'price', 'rate', 'modalPrice', 'value');
                  return (
                    <div>
                      <p className="font-bold text-slate-900">{money(n)}<span className="text-[10px] font-semibold text-slate-400"> /{str(r, 'unit') === '—' ? 'q' : str(r, 'unit')}</span></p>
                      {num(r, 'changePct', 'change', 'delta') !== null && (
                        <p className="text-[10px] font-semibold text-amber-600">Δ {num(r, 'changePct', 'change', 'delta')}%</p>
                      )}
                    </div>
                  );
                },
              },
              {
                header: 'Source / Flag',
                cell: (r) => (
                  <div>
                    <p className="text-slate-500">{str(r, 'source', 'submittedBy', 'reportedBy')}</p>
                    <p className="text-[10px] text-amber-600 font-semibold">{str(r, 'flagReason', 'reason', 'anomalyReason', 'note')}</p>
                  </div>
                ),
              },
              {
                header: 'Status',
                cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
              },
              ...(tab !== 'mandi'
                ? [
                    {
                      header: 'Action',
                      className: 'text-right',
                      cell: (r: Row) => (
                        <div className="flex justify-end gap-1.5">
                          <Btn
                            tone="danger"
                            onClick={() =>
                              request({
                                title: `Reject rate — ${str(r, 'commodity', 'crop')} @ ${str(r, 'mandi', 'mandiName')}`,
                                confirmLabel: 'Reject',
                                tone: 'danger',
                                action: (reason) => admin.rates.reject(idOf(r), { reason }, reason),
                                onDone: reloadAll,
                              })
                            }
                          >
                            Reject
                          </Btn>
                          <Btn
                            tone="primary"
                            onClick={() =>
                              request({
                                title: `Approve rate — ${str(r, 'commodity', 'crop')} @ ${str(r, 'mandi', 'mandiName')}`,
                                defaultReason: 'Cross-checked against adjacent mandi range',
                                confirmLabel: 'Approve',
                                action: (reason) => admin.rates.approve(idOf(r), reason),
                                onDone: reloadAll,
                              })
                            }
                          >
                            Approve
                          </Btn>
                        </div>
                      ),
                    },
                  ]
                : []),
            ]}
          />
        ) : (
          <ManualRateForm onCreated={() => { setTab('mandi'); mandiRates.reload(); }} />
        )}
      </PanelShell>
      {modal}
    </>
  );
};

const ManualRateForm: React.FC<{ onCreated: () => void }> = ({ onCreated }) => {
  const [mandi, setMandi] = useState('');
  const [commodity, setCommodity] = useState('');
  const [price, setPrice] = useState('');
  const [unit, setUnit] = useState('quintal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mandi.trim() || !commodity.trim() || !price) return;
    setBusy(true);
    setError(null);
    try {
      await admin.rates.createMandiRate(
        { mandi: mandi.trim(), commodity: commodity.trim(), price: Number(price), unit },
        `Manual rate entry: ${commodity} @ ${mandi}`
      );
      setSent(true);
      setMandi('');
      setCommodity('');
      setPrice('');
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
      {sent && <Banner kind="success" className="sm:col-span-2">Rate submitted for approval.</Banner>}
      {error && <Banner kind="error" className="sm:col-span-2">{error}</Banner>}
      <Field label="Mandi / APMC market">
        <TextInput value={mandi} onChange={setMandi} placeholder="e.g. Lasalgaon APMC" required />
      </Field>
      <Field label="Commodity">
        <TextInput value={commodity} onChange={setCommodity} placeholder="e.g. Onion" required />
      </Field>
      <Field label="Price (₹)">
        <TextInput type="number" value={price} onChange={setPrice} placeholder="2950" required />
      </Field>
      <Field label="Unit">
        <Select
          value={unit}
          onChange={setUnit}
          options={[
            { value: 'quintal', label: 'Per quintal' },
            { value: 'kg', label: 'Per kg' },
            { value: 'tonne', label: 'Per tonne' },
            { value: 'dozen', label: 'Per dozen' },
          ]}
        />
      </Field>
      <div className="sm:col-span-2">
        <Btn type="submit" tone="primary" busy={busy} disabled={!mandi.trim() || !commodity.trim() || !price}>
          <Radio className="w-3.5 h-3.5" /> Submit rate (audited)
        </Btn>
      </div>
    </form>
  );
};
