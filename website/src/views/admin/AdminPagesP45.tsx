import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n';
import { adminGet, adminPost, adminPut, mutationHeaders } from '../../lib/api/admin';
import { GridPage, useRole } from './adminShared';
import ConfirmActionModal from './components/ConfirmActionModal';

export function BankingPage() {
  return (
    <div>
      <GridPage
        titleKey="admin.banking.accounts"
        url="/admin/finance/bank-accounts"
        statusChips={['all', 'failed', 'verified']}
        params={{ verification: 'failed' }}
        columns={[
          { key: 'id', labelKey: 'admin.banking.id', sortable: true },
          { key: 'userId', labelKey: 'admin.banking.user' },
          { key: 'verifyStatus', labelKey: 'admin.banking.status' },
        ]}
        actions={[
          {
            labelKey: 'admin.banking.override',
            destructive: true,
            path: (r) => `/admin/finance/bank-accounts/${String(r.id)}/override-verify`,
          },
        ]}
      />
      <GridPage
        titleKey="admin.banking.kcc"
        url="/admin/finance/kcc"
        statusChips={['all']}
        columns={[
          { key: 'id', labelKey: 'admin.banking.id', sortable: true },
          { key: 'userId', labelKey: 'admin.banking.user' },
          { key: 'limitPaisa', labelKey: 'admin.banking.limit' },
        ]}
      />
    </div>
  );
}

export function LoansPage() {
  return (
    <GridPage
      titleKey="admin.nav.loans"
      url="/admin/finance/loans"
      statusChips={['all', 'submitted', 'under_review', 'approved', 'rejected', 'disbursed']}
      columns={[
        { key: 'applicationId', labelKey: 'admin.loans.id', sortable: true },
        { key: 'farmerName', labelKey: 'admin.loans.farmer' },
        { key: 'amount', labelKey: 'admin.loans.amount' },
        { key: 'status', labelKey: 'admin.loans.status' },
      ]}
      actions={[
        {
          labelKey: 'admin.loans.approve',
          destructive: true,
          method: 'put',
          path: (r) => `/admin/finance/loans/${String(r.applicationId)}/status`,
          body: () => ({ status: 'approved' }),
          fields: [{ key: 'note', labelKey: 'admin.loans.note' }],
        },
      ]}
    />
  );
}

export function InsuranceClaimsPage() {
  return (
    <GridPage
      titleKey="admin.nav.insurance"
      url="/admin/insurance/claims"
      statusChips={['all', 'intimated', 'under_survey', 'approved', 'rejected']}
      columns={[
        { key: 'id', labelKey: 'admin.insurance.id', sortable: true },
        { key: 'farmerName', labelKey: 'admin.insurance.farmer' },
        { key: 'surveyorName', labelKey: 'admin.insurance.surveyor' },
        { key: 'approvedAmount', labelKey: 'admin.insurance.approved' },
        { key: 'status', labelKey: 'admin.insurance.status' },
      ]}
    />
  );
}

export function InsuranceRatesPage() {
  const t = useT();
  const role = useRole();
  const [showModal, setShowModal] = useState(false);
  return (
    <div>
      <h2>{t('admin.nav.rates')}</h2>
      <button className="admin-button" onClick={() => setShowModal(true)}>
        {t('admin.rates.add')}
      </button>
      <GridPage
        titleKey="admin.rates.table"
        url="/admin/insurance/rates"
        statusChips={['all']}
        columns={[
          { key: 'product', labelKey: 'admin.rates.product', sortable: true },
          { key: 'rate', labelKey: 'admin.rates.rate' },
          { key: 'effectiveFrom', labelKey: 'admin.rates.from' },
          { key: 'effectiveTo', labelKey: 'admin.rates.to' },
          { key: 'createdBy', labelKey: 'admin.rates.by' },
        ]}
      />
      {showModal && (
        <ConfirmActionModal
          title={t('admin.rates.add')}
          fields={[
            { key: 'product', labelKey: 'admin.rates.product' },
            { key: 'rate', labelKey: 'admin.rates.rate' },
            { key: 'effectiveFrom', labelKey: 'admin.rates.from' },
          ]}
          onConfirm={async (reason, extra) => {
            await adminPost(
              '/admin/insurance/rates',
              { product: extra.product, rate: Number(extra.rate || 0), effectiveFrom: extra.effectiveFrom },
              mutationHeaders(role, reason)
            );
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export function FpoPage() {
  const t = useT();
  return (
    <div>
      <h2>{t('admin.nav.fpos')}</h2>
      <GridPage
        titleKey="admin.fpo.list"
        url="/admin/fpos"
        statusChips={['all', 'pending', 'verified', 'rejected']}
        params={{ status: 'pending' }}
        columns={[
          { key: 'id', labelKey: 'admin.fpo.id', sortable: true },
          { key: 'name', labelKey: 'admin.fpo.name' },
          { key: 'rocCertificate', labelKey: 'admin.fpo.roc' },
          { key: 'status', labelKey: 'admin.fpo.status' },
        ]}
        actions={[
          { labelKey: 'admin.fpo.verify', path: (r) => `/admin/fpos/${String(r.id)}/verify` },
          {
            labelKey: 'admin.fpo.reject',
            destructive: true,
            path: (r) => `/admin/fpos/${String(r.id)}/reject`,
            fields: [{ key: 'reason', labelKey: 'admin.fpo.reason' }],
          },
        ]}
      />
    </div>
  );
}

export function VetsPage() {
  const t = useT();
  return (
    <div>
      <h2>{t('admin.nav.vets')}</h2>
      <GridPage
        titleKey="admin.vets.list"
        url="/admin/vets"
        statusChips={['all', 'pending', 'verified', 'rejected']}
        params={{ status: 'pending' }}
        columns={[
          { key: 'id', labelKey: 'admin.vets.id', sortable: true },
          { key: 'name', labelKey: 'admin.vets.name' },
          { key: 'degree', labelKey: 'admin.vets.degree' },
          { key: 'councilRegNo', labelKey: 'admin.vets.council' },
          { key: 'status', labelKey: 'admin.vets.status' },
        ]}
        actions={[
          { labelKey: 'admin.vets.verify', path: (r) => `/admin/vets/${String(r.id)}/verify` },
          {
            labelKey: 'admin.vets.reject',
            destructive: true,
            path: (r) => `/admin/vets/${String(r.id)}/reject`,
            fields: [{ key: 'reason', labelKey: 'admin.vets.reason' }],
          },
        ]}
      />
      <GridPage titleKey="admin.vets.gaushalas" url="/admin/gaushalas" statusChips={['all']} columns={[{ key: 'id', labelKey: 'admin.vets.id' }, { key: 'name', labelKey: 'admin.vets.name' }]} />
      <GridPage titleKey="admin.vets.nurseries" url="/admin/nurseries" statusChips={['all']} columns={[{ key: 'id', labelKey: 'admin.vets.id' }, { key: 'name', labelKey: 'admin.vets.name' }]} />
    </div>
  );
}

export function ContentCmsPage() {
  const t = useT();
  const role = useRole();
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div>
      <h2>{t('admin.nav.content')}</h2>
      <button className="admin-button" onClick={() => setShowModal(true)}>
        {t('admin.content.publish')}
      </button>
      <GridPage
        key={refreshKey}
        titleKey="admin.content.news"
        url="/admin/content/news"
        statusChips={['all']}
        columns={[
          { key: 'id', labelKey: 'admin.content.id', sortable: true },
          { key: 'title', labelKey: 'admin.content.title' },
          { key: 'breaking', labelKey: 'admin.content.breaking' },
          { key: 'status', labelKey: 'admin.content.status' },
        ]}
      />
      <GridPage titleKey="admin.content.workshops" url="/admin/content/workshops" statusChips={['all']} columns={[{ key: 'id', labelKey: 'admin.content.id' }, { key: 'title', labelKey: 'admin.content.title' }]} />
      {showModal && (
        <ConfirmActionModal
          title={t('admin.content.publish')}
          fields={[
            { key: 'title', labelKey: 'admin.content.title' },
            { key: 'body', labelKey: 'admin.content.body' },
          ]}
          onConfirm={async (reason, extra) => {
            await adminPost(
              '/admin/content/news',
              { title: extra.title, body: extra.body, breaking: false },
              mutationHeaders(role, reason)
            );
            setRefreshKey((k) => k + 1);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export function TreesPage() {
  return (
    <div>
      <GridPage
        titleKey="admin.trees.ngos"
        url="/admin/ngos"
        statusChips={['all', 'pending', 'verified', 'rejected']}
        params={{ status: 'pending' }}
        columns={[
          { key: 'id', labelKey: 'admin.trees.id', sortable: true },
          { key: 'name', labelKey: 'admin.trees.name' },
          { key: 'status', labelKey: 'admin.trees.status' },
        ]}
        actions={[{ labelKey: 'admin.trees.verify', path: (r) => `/admin/ngos/${String(r.id)}/verify` }]}
      />
      <GridPage
        titleKey="admin.trees.saplings"
        url="/admin/sapling-requests"
        statusChips={['all', 'pending', 'approved', 'rejected']}
        columns={[
          { key: 'id', labelKey: 'admin.trees.id', sortable: true },
          { key: 'status', labelKey: 'admin.trees.status' },
        ]}
      />
      <GridPage titleKey="admin.trees.biofuel" url="/admin/biofuel-trees" statusChips={['all']} columns={[{ key: 'id', labelKey: 'admin.trees.id' }, { key: 'species', labelKey: 'admin.trees.species' }]} />
    </div>
  );
}

export function GamificationPage() {
  const t = useT();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    adminGet<{ data?: Record<string, unknown>[] }>('/admin/gamification/circulation')
      .then((r) => setRows(r.data ?? []))
      .catch(() => setRows([]));
  }, []);
  return (
    <div>
      <h2>{t('admin.nav.gamification')}</h2>
      <table className="admin-grid">
        <thead>
          <tr>
            <th>{t('admin.gamification.date')}</th>
            <th>{t('admin.gamification.minted')}</th>
            <th>{t('admin.gamification.burned')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.date)}>
              <td>{String(row.date)}</td>
              <td>{String(row.minted)}</td>
              <td>{String(row.burned)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <GridPage
        titleKey="admin.gamification.referralFraud"
        url="/admin/gamification/referral-fraud"
        statusChips={['all']}
        columns={[{ key: 'id', labelKey: 'admin.gamification.id' }]}
      />
    </div>
  );
}

export function ShgPage() {
  return (
    <GridPage
      titleKey="admin.nav.shg"
      url="/admin/shgs"
      statusChips={['all', 'pending', 'verified', 'rejected']}
      params={{ status: 'pending' }}
      columns={[
        { key: 'id', labelKey: 'admin.shg.id', sortable: true },
        { key: 'name', labelKey: 'admin.shg.name' },
        { key: 'status', labelKey: 'admin.shg.status' },
      ]}
      actions={[
        { labelKey: 'admin.shg.verify', path: (r) => `/admin/shgs/${String(r.id)}/verify` },
        {
          labelKey: 'admin.shg.reject',
          destructive: true,
          path: (r) => `/admin/shgs/${String(r.id)}/reject`,
          fields: [{ key: 'reason', labelKey: 'admin.shg.reason' }],
        },
      ]}
    />
  );
}

export function CoursesPage() {
  const t = useT();
  const [report, setReport] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    adminGet<Record<string, unknown>>('/admin/courses/report').then(setReport).catch(() => setReport(null));
  }, []);
  return (
    <div>
      <h2>{t('admin.nav.courses')}</h2>
      <div className="admin-kpi">
        <div className="admin-kpi-card">
          <div className="label">{t('admin.courses.gmv')}</div>
          <div className="value">{String(report?.grossMerchandiseValueRupees ?? '—')}</div>
        </div>
        <div className="admin-kpi-card">
          <div className="label">{t('admin.courses.commission')}</div>
          <div className="value">{String(report?.platformCommissionRupees ?? '—')}</div>
        </div>
        <div className="admin-kpi-card">
          <div className="label">{t('admin.courses.earnings')}</div>
          <div className="value">{String(report?.instructorEarningsRupees ?? '—')}</div>
        </div>
      </div>
      <GridPage
        titleKey="admin.courses.queue"
        url="/admin/courses/queue"
        statusChips={['all', 'pendingReview', 'published', 'rejected']}
        columns={[
          { key: 'id', labelKey: 'admin.courses.id', sortable: true },
          { key: 'title', labelKey: 'admin.courses.title' },
          { key: 'status', labelKey: 'admin.courses.status' },
        ]}
        actions={[
          {
            labelKey: 'admin.courses.publish',
            path: (r) => `/admin/courses/${String(r.id)}/review`,
            body: () => ({ action: 'publish' }),
          },
          {
            labelKey: 'admin.courses.reject',
            destructive: true,
            path: (r) => `/admin/courses/${String(r.id)}/review`,
            body: () => ({ action: 'reject' }),
            fields: [{ key: 'reason', labelKey: 'admin.courses.reason' }],
          },
        ]}
      />
    </div>
  );
}

interface AiHealthMetric {
  questionSetId?: string;
  accuracy?: number;
  fallbackRate?: number;
  costPerModule?: number;
  trendVsPreviousWeek?: number;
  regressionAlert?: boolean;
  confidenceBucketReliability?: Record<string, number>;
}

export function AiHealthPage() {
  const t = useT();
  const [metrics, setMetrics] = useState<AiHealthMetric[]>([]);
  const [golden, setGolden] = useState<string[]>([]);
  useEffect(() => {
    adminGet<{ metrics?: AiHealthMetric[]; goldenSets?: string[] }>('/admin/ai/health')
      .then((r) => {
        setMetrics(r.metrics ?? []);
        setGolden(r.goldenSets ?? []);
      })
      .catch(() => setMetrics([]));
  }, []);
  return (
    <div>
      <h2>{t('admin.nav.aihealth')}</h2>
      {metrics.length === 0 ? (
        <p className="admin-nav-group-label">{t('admin.grid.empty')}</p>
      ) : (
        <table className="admin-grid">
          <thead>
            <tr>
              <th>{t('admin.aihealth.questionSet')}</th>
              <th>{t('admin.aihealth.accuracy')}</th>
              <th>{t('admin.aihealth.fallbackRate')}</th>
              <th>{t('admin.aihealth.cost')}</th>
              <th>{t('admin.aihealth.trend')}</th>
              <th>{t('admin.aihealth.regression')}</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.questionSetId}>
                <td>{metric.questionSetId}</td>
                <td>{metric.accuracy}</td>
                <td>{metric.fallbackRate}</td>
                <td>{metric.costPerModule}</td>
                <td>{metric.trendVsPreviousWeek}</td>
                <td>{metric.regressionAlert ? '⚠' : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h4>{t('admin.aihealth.goldenSets')}</h4>
      <ul>
        {golden.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
