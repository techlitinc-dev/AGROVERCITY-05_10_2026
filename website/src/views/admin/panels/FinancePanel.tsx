import React, { useState } from 'react';
import { Landmark, BarChart3, CreditCard, Wallet } from 'lucide-react';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { admin } from '../../../lib/api';
import {
  PanelShell,
  DataTable,
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
 * SOP-14 — Banking & Loan Underwriting.
 * Loan application queue + status transitions, bank account override-verification,
 * credit-score histogram and KCC view.
 */
export const FinancePanel: React.FC = () => {
  const [tab, setTab] = useState('loans');
  return (
    <>
      <Tabs
        active={tab}
        onChange={setTab}
        tabs={[
          { id: 'loans', label: 'Loan queue' },
          { id: 'accounts', label: 'Bank accounts' },
          { id: 'credit', label: 'Credit scores' },
          { id: 'kcc', label: 'KCC' },
        ]}
      />
      {tab === 'loans' && <LoansCard />}
      {tab === 'accounts' && <BankAccountsCard />}
      {tab === 'credit' && <CreditScoresCard />}
      {tab === 'kcc' && <KccCard />}
    </>
  );
};

const LOAN_STATUSES = ['submitted', 'under_review', 'info_requested', 'approved', 'rejected', 'disbursed'];

const LoansCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const loans = useAsync(() => admin.finance.loans(), []);

  return (
    <PanelShell
      title="SOP-14: Loan Underwriting Queue"
      subtitle="Bank-linked loan applications routed through the platform. Advance status or send back for info."
      icon={Landmark}
      loading={loans.loading}
      error={loans.error}
      onRefresh={loans.reload}
    >
      <DataTable
        rows={(loans.data ?? []) as Row[]}
        empty="No loan applications in the queue."
        columns={[
          {
            header: 'Applicant',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'applicantName', 'farmerName', 'userName', 'name')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{str(r, 'userId', 'uid', 'applicationId', 'id')}</p>
              </div>
            ),
          },
          {
            header: 'Amount / Tenure',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{money(num(r, 'amount', 'requestedAmount', 'principal'))}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'tenureMonths', 'tenure', 'duration')} months @ {str(r, 'interestRate', 'rate')}%</p>
              </div>
            ),
          },
          {
            header: 'Purpose',
            cell: (r) => <span className="text-slate-600">{str(r, 'purpose', 'crop', 'category', 'type')}</span>,
          },
          {
            header: 'Bank',
            cell: (r) => <span className="text-slate-500">{str(r, 'bankName', 'bank', 'lender')}</span>,
          },
          {
            header: 'Status',
            cell: (r) => <StatusBadge status={str(r, 'status', 'state')} />,
          },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Field label="" className="w-40 ml-auto">
                <Select
                  value=""
                  onChange={(v) =>
                    v &&
                    request({
                      title: `Loan ${idOf(r)} → ${v}`,
                      confirmLabel: 'Update',
                      tone: v === 'rejected' ? 'danger' : 'primary',
                      action: (reason) => admin.finance.setLoanStatus(idOf(r), { status: v, reason }, reason),
                      onDone: loans.reload,
                    })
                  }
                  options={[{ value: '', label: 'Advance…' }, ...LOAN_STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') }))]}
                />
              </Field>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const BankAccountsCard: React.FC = () => {
  const { request, modal } = useReasonModal();
  const accounts = useAsync(() => admin.finance.bankAccounts(), []);

  return (
    <PanelShell
      title="SOP-14: Bank Account Verification"
      subtitle="Accounts pending penny-drop or manual verification. Override-verify only with documentary proof."
      icon={CreditCard}
      loading={accounts.loading}
      error={accounts.error}
      onRefresh={accounts.reload}
    >
      <DataTable
        rows={(accounts.data ?? []) as Row[]}
        empty="No bank accounts pending."
        columns={[
          {
            header: 'Account holder',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'holderName', 'accountName', 'name', 'userName')}</p>
                <p className="text-[10px] text-slate-400">{str(r, 'userId', 'uid')}</p>
              </div>
            ),
          },
          {
            header: 'Bank / IFSC',
            cell: (r) => (
              <div>
                <p className="font-semibold text-slate-700">{str(r, 'bankName', 'bank')}</p>
                <p className="text-[10px] font-mono text-slate-400">{str(r, 'ifsc', 'ifscCode')} • {str(r, 'accountNumber', 'accountNo', 'maskedAccount')}</p>
              </div>
            ),
          },
          {
            header: 'Verification',
            cell: (r) => (
              <div>
                <StatusBadge status={str(r, 'verificationStatus', 'status', 'state')} />
                <p className="text-[10px] text-slate-400 mt-0.5">{str(r, 'verificationMethod', 'method')}</p>
              </div>
            ),
          },
          {
            header: 'Action',
            className: 'text-right',
            cell: (r) => (
              <Btn
                tone="primary"
                onClick={() =>
                  request({
                    title: `Override-verify account ${str(r, 'accountNumber', 'accountNo', 'maskedAccount')}`,
                    description: 'Use only when manual documentary verification is on file.',
                    confirmLabel: 'Override verify',
                    action: (reason) => admin.finance.overrideVerifyAccount(idOf(r), { reason }, reason),
                    onDone: accounts.reload,
                  })
                }
              >
                Override verify
              </Btn>
            ),
          },
        ]}
      />
      {modal}
    </PanelShell>
  );
};

const CreditScoresCard: React.FC = () => {
  const scores = useAsync(() => admin.finance.creditScores(), []);

  const rows = (scores.data ?? []) as Row[];
  const values = rows
    .map((r) => num(r, 'score', 'creditScore', 'value'))
    .filter((v): v is number => v !== null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const buckets = [0, 0, 0, 0, 0];
  values.forEach((v) => {
    const idx = Math.min(4, Math.floor(((v - min) / Math.max(1, max - min)) * 5));
    buckets[idx] += 1;
  });
  const peak = Math.max(1, ...buckets);

  return (
    <PanelShell
      title="SOP-14: Credit Score Distribution"
      subtitle="Alternate-data credit scores across the farmer base (GET /admin/finance/credit-scores)."
      icon={BarChart3}
      loading={scores.loading}
      error={scores.error}
      onRefresh={scores.reload}
    >
      {values.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-end gap-2 h-32">
            {buckets.map((b, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-emerald-500 rounded-t-xl transition-all"
                  style={{ height: `${Math.max(4, (b / peak) * 100)}%` }}
                  title={`${b} users`}
                />
                <span className="text-[10px] font-bold text-slate-500">{b}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-semibold text-slate-400">
            <span>{min}</span>
            <span>score range</span>
            <span>{max}</span>
          </div>
        </div>
      )}
      <DataTable
        rows={rows.slice(0, 20)}
        empty="No credit scores computed yet."
        columns={[
          {
            header: 'User',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'name', 'userName', 'farmerName')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{str(r, 'userId', 'uid')}</p>
              </div>
            ),
          },
          { header: 'Score', cell: (r) => <span className="font-bold text-slate-900">{num(r, 'score', 'creditScore', 'value') ?? '—'}</span> },
          { header: 'Band', cell: (r) => <StatusBadge status={str(r, 'band', 'grade', 'rating')} /> },
          { header: 'Updated', cell: (r) => <span className="text-slate-500">{str(r, 'updatedAt', 'computedAt', 'createdAt')}</span> },
        ]}
      />
    </PanelShell>
  );
};

const KccCard: React.FC = () => {
  const kcc = useAsync(() => admin.finance.kcc(), []);
  return (
    <PanelShell
      title="SOP-14: Kisan Credit Card Applications"
      subtitle="KCC applications routed via the platform."
      icon={Wallet}
      loading={kcc.loading}
      error={kcc.error}
      onRefresh={kcc.reload}
    >
      <DataTable
        rows={(kcc.data ?? []) as Row[]}
        empty="No KCC applications."
        columns={[
          {
            header: 'Applicant',
            cell: (r) => (
              <div>
                <p className="font-bold text-slate-900">{str(r, 'applicantName', 'name', 'userName')}</p>
                <p className="text-[10px] text-slate-400 font-mono">{idOf(r)}</p>
              </div>
            ),
          },
          { header: 'Limit', cell: (r) => <span className="font-bold">{money(num(r, 'limit', 'sanctionedLimit', 'amount'))}</span> },
          { header: 'Bank', cell: (r) => <span className="text-slate-600">{str(r, 'bankName', 'bank')}</span> },
          { header: 'Status', cell: (r) => <StatusBadge status={str(r, 'status', 'state')} /> },
        ]}
      />
    </PanelShell>
  );
};
