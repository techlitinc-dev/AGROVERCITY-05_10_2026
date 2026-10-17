import React, { useState } from 'react';
import { Umbrella, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
  KV,
  Btn,
  Tabs,
  Field,
  Select,
  idOf,
  str,
  num,
  money,
  useAsync,
  useReasonModal,
  type Row,
} from './shared';

/**
 * SOP-15 — Insurance Claims & DBT Disbursal.
 * Claims queue with status advance + surveyor assignment, plus insurance rate cards.
 */
export const ClaimsPanel: React.FC = () => {
  const [tab, setTab] = useState('claims');

  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'claims', label: 'Claims queue' },
          { id: 'insurance', label: 'Insurance claims' },
          { id: 'rates', label: 'Insurance rates' },
        ]}
      />
      {tab === 'claims' && <ClaimsQueue source="claims" />}
      {tab === 'insurance' && <ClaimsQueue source="insurance" />}
      {tab === 'rates' && <InsuranceRatesCard />}
    </>
  );
};

const CLAIM_STATUSES = ['submitted', 'under_review', 'surveyor_assigned', 'approved', 'rejected', 'paid'];

const ClaimsQueue: React.FC<{ source: 'claims' | 'insurance' }> = ({ source }) => {
  const { request, modal } = useReasonModal();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const claims = useAsync(
    () => (source === 'claims' ? admin.claims.list() : admin.claims.insuranceClaims()),
    [source]
  );

  const rows = (claims.data ?? []) as Row[];
  const selected = selectedId ? rows.find((r) => idOf(r) === selectedId) ?? null : null;

  return (
    <>
      <PanelShell
        title={source === 'claims' ? 'SOP-15: Claims Queue' : 'SOP-15: Insurance Partner Claims'}
        subtitle="Advance claim status through the lifecycle or assign a surveyor. All transitions are audit-logged."
        icon={Umbrella}
        loading={claims.loading}
        error={claims.error}
        onRefresh={claims.reload}
      >
        <DataTable
          rows={rows}
          empty="No claims in this queue."
          columns={[
            {
              header: 'Claimant',
              cell: (r) => (
                <div>
                  <p className="font-bold text-slate-900">{str(r, 'claimantName', 'farmerName', 'userName', 'name')}</p>
                  <p className="text-[10px] text-slate-400 font-mono">{str(r, 'userId', 'uid', 'claimantId')}</p>
                </div>
              ),
            },
            {
              header: 'Crop / Scheme',
              cell: (r) => (
                <div>
                  <p className="font-semibold text-slate-700">{str(r, 'crop', 'commodity', 'scheme', 'schemeName')}</p>
                  <p className="text-[10px] text-slate-400">{str(r, 'reason', 'category', 'causeOfLoss')}</p>
                </div>
              ),
            },
            {
              header: 'Claimed amount',
              cell: (r) => <span className="font-bold text-slate-900">{money(num(r, 'claimedAmount', 'amount', 'sumInsured', 'claimAmount'))}</span>,
            },
            {
              header: 'Filed',
              cell: (r) => <span className="text-slate-500">{str(r, 'filedAt', 'createdAt', 'submittedAt')}</span>,
            },
            {
              header: 'Status',
              cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
            },
            {
              header: 'Action',
              className: 'text-right',
              cell: (r) => <Btn onClick={() => setSelectedId(idOf(r))}>Open claim</Btn>,
            },
          ]}
        />
      </PanelShell>

      {selected && (
        <PanelShell
          title={`Claim ${idOf(selected)} — ${str(selected, 'claimantName', 'farmerName', 'userName')}`}
          subtitle="Lifecycle controls and full claim record."
          icon={Umbrella}
          actions={
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Advance status" className="w-48">
                <Select
                  value=""
                  onChange={(v) =>
                    v &&
                    request({
                      title: `Advance claim → ${v}`,
                      confirmLabel: 'Update status',
                      tone: v === 'rejected' ? 'danger' : 'primary',
                      action: (reason) =>
                        admin.claims.update(
                          str(selected, 'userId', 'uid', 'claimantId'),
                          idOf(selected),
                          { status: v, reason },
                          reason
                        ),
                      onDone: claims.reload,
                    })
                  }
                  options={[{ value: '', label: 'Choose…' }, ...CLAIM_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]}
                />
              </Field>
              <Btn
                onClick={() =>
                  request({
                    title: `Assign surveyor — claim ${idOf(selected)}`,
                    confirmLabel: 'Assign',
                    action: (reason) => admin.claims.assignSurveyor(idOf(selected), { reason }, reason),
                    onDone: claims.reload,
                  })
                }
              >
                Assign surveyor
              </Btn>
            </div>
          }
        >
          <KV record={selected} />
        </PanelShell>
      )}
      {modal}
    </>
  );
};

const InsuranceRatesCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const rates = useAsync(() => admin.claims.insuranceRates(), []);

  return (
    <PanelShell
      title="SOP-15: Insurance Rate Cards"
      subtitle="Premium rates published to insurers (GET/POST/PUT /admin/insurance/rates)."
      icon={ShieldCheck}
      loading={rates.loading}
      error={rates.error}
      onRefresh={rates.reload}
      actions={
        <Btn
          tone="primary"
          onClick={() =>
            request({
              title: 'Publish new insurance rate',
              description: 'Sends a new rate card entry to POST /admin/insurance/rates.',
              confirmLabel: 'Publish',
              defaultReason: 'Season rate update',
              action: (reason) => admin.claims.addInsuranceRate({ reason, note: 'created-from-sop15' }, reason),
              onDone: rates.reload,
            })
          }
        >
          New rate card
        </Btn>
      }
    >
      <DataTable
        rows={(rates.data ?? []) as Row[]}
        empty="No insurance rate cards."
        columns={[
          {
            header: 'Crop / Scheme',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'crop', 'commodity', 'scheme', 'name')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'provider', 'insurer', 'company')}</p>
              </div>
            ),
          },
          {
            header: 'Premium',
            cell: (r) => (
              <div>
                <p className="font-semibold text-slate-800">{money(num(r, 'premium', 'premiumPerAcre', 'rate'))}</p>
                <p className="text-[10px] text-slate-400">sum insured {money(num(r, 'sumInsured', 'coverage'))}</p>
              </div>
            ),
          },
          {
            header: 'Season',
            cell: (r) => <span className="text-slate-500">{str(r, 'season', 'year', 'period')}</span>,
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};
