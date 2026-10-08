import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n';
import { adminGet, adminPost, adminPut, mutationHeaders } from '../../lib/api/admin';
import { GridPage, useRole } from './adminShared';
import ConfirmActionModal from './components/ConfirmActionModal';

export function LandLeasesPage() {
  return (
    <GridPage
      titleKey="admin.nav.land"
      url="/admin/land/leases"
      statusChips={['all', 'active', 'pending', 'closed']}
      columns={[
        { key: 'id', labelKey: 'admin.land.id', sortable: true },
        { key: 'surveyNumber', labelKey: 'admin.land.survey' },
        { key: 'recordMismatch', labelKey: 'admin.land.mismatch', render: (r) => (r.recordMismatch ? '⚠ mismatch' : '') },
        { key: 'status', labelKey: 'admin.land.status' },
      ]}
    />
  );
}

export function AdvisoryOpsPage() {
  const t = useT();
  const [accuracy, setAccuracy] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    adminGet<Record<string, unknown>>('/admin/advisory/scans/accuracy').then(setAccuracy).catch(() => setAccuracy(null));
  }, []);
  return (
    <div>
      <h2>{t('admin.nav.advisory')}</h2>
      <div className="admin-kpi">
        <div className="admin-kpi-card">
          <div className="label">{t('admin.advisory.falsePositiveRate')}</div>
          <div className="value">{String(accuracy?.falsePositiveRate ?? '—')}</div>
        </div>
        <div className="admin-kpi-card">
          <div className="label">{t('admin.advisory.totalScans')}</div>
          <div className="value">{String(accuracy?.totalScans ?? '—')}</div>
        </div>
      </div>
      <GridPage
        titleKey="admin.advisory.soilTests"
        url="/admin/advisory/soil-tests"
        statusChips={['all', 'pending', 'validated']}
        params={{ status: 'pending' }}
        columns={[
          { key: 'id', labelKey: 'admin.advisory.id', sortable: true },
          { key: 'status', labelKey: 'admin.advisory.status' },
        ]}
        actions={[
          { labelKey: 'admin.advisory.validate', path: (r) => `/admin/advisory/soil-tests/${String(r.id)}/validate` },
        ]}
      />
    </div>
  );
}

export function ChatbotOpsPage() {
  return (
    <div>
      <GridPage
        titleKey="admin.chatbot.sessions"
        url="/admin/chatbot/sessions"
        statusChips={['all']}
        columns={[
          { key: 'id', labelKey: 'admin.chatbot.id', sortable: true },
          { key: 'userId', labelKey: 'admin.chatbot.user' },
        ]}
        detailUrl={(id) => `/admin/chatbot/sessions/${id}`}
      />
      <GridPage
        titleKey="admin.chatbot.experts"
        url="/admin/experts"
        statusChips={['all']}
        columns={[
          { key: 'id', labelKey: 'admin.chatbot.expertId', sortable: true },
          { key: 'name', labelKey: 'admin.chatbot.expertName' },
        ]}
      />
      <GridPage
        titleKey="admin.chatbot.handoffs"
        url="/admin/expert-handoffs"
        statusChips={['all', 'queued', 'resolved']}
        columns={[
          { key: 'id', labelKey: 'admin.chatbot.id', sortable: true },
          { key: 'slaDueAt', labelKey: 'admin.chatbot.sla' },
          { key: 'slaBreached', labelKey: 'admin.chatbot.breached', render: (r) => (r.slaBreached ? '⚠ breached' : '') },
        ]}
      />
    </div>
  );
}

export function LandRecordsHealthPage() {
  const t = useT();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    adminGet<{ data?: Record<string, unknown>[] }>('/admin/land-records/health')
      .then((r) => setRows(r.data ?? []))
      .catch(() => setRows([]));
  }, []);
  return (
    <div>
      <h2>{t('admin.nav.landrecords')}</h2>
      {rows.length === 0 ? (
        <p className="admin-nav-group-label">{t('admin.grid.empty')}</p>
      ) : (
        <table className="admin-grid">
          <thead>
            <tr>
              <th>{t('admin.landrecords.checkedAt')}</th>
              <th>{t('admin.landrecords.available')}</th>
              <th>{t('admin.landrecords.latency')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                <td>{String(row.checkedAt ?? '')}</td>
                <td>{String(row.available ?? '')}</td>
                <td>{String(row.latencyMs ?? '')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export function WaterSchedulesPage() {
  const t = useT();
  const role = useRole();
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);

  const load = () =>
    adminGet<{ canal?: Record<string, unknown>[]; water?: Record<string, unknown>[] }>('/admin/water/schedules')
      .then((r) => setRows([...(r.canal ?? []), ...(r.water ?? [])]))
      .catch(() => setRows([]));
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2>{t('admin.nav.water')}</h2>
      <table className="admin-grid">
        <thead>
          <tr>
            <th>{t('admin.water.id')}</th>
            <th>{t('admin.water.rotation')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row.id)}>
              <td>{String(row.id)}</td>
              <td>
                {String(row.rotationStart ?? '')} – {String(row.rotationEnd ?? '')}
              </td>
              <td>
                <button className="admin-chip" onClick={() => setEditing(row)}>
                  {t('admin.water.edit')}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {editing && (
        <ConfirmActionModal
          title={t('admin.water.edit')}
          fields={[
            { key: 'rotationStart', labelKey: 'admin.water.start' },
            { key: 'rotationEnd', labelKey: 'admin.water.end' },
          ]}
          onConfirm={async (reason, extra) => {
            await adminPut(
              `/admin/water/schedules/${String(editing.id)}`,
              { rotationStart: extra.rotationStart, rotationEnd: extra.rotationEnd },
              mutationHeaders(role, reason)
            );
            load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

export function ColdStoragePage() {
  const t = useT();
  const role = useRole();
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  return (
    <div>
      <h2>{t('admin.nav.climate')}</h2>
      <button className="admin-button" onClick={() => setShowModal(true)}>
        {t('admin.climate.add')}
      </button>
      <GridPage
        titleKey="admin.climate.directory"
        url="/admin/cold-storages"
        statusChips={['all']}
        columns={[
          { key: 'id', labelKey: 'admin.climate.id', sortable: true },
          { key: 'name', labelKey: 'admin.climate.name' },
          { key: 'capacityMT', labelKey: 'admin.climate.capacity' },
          { key: 'monthlyRatePaise', labelKey: 'admin.climate.rate' },
        ]}
      />
      <GridPage
        titleKey="admin.climate.varieties"
        url="/admin/climate/varieties"
        statusChips={['all']}
        columns={[
          { key: 'id', labelKey: 'admin.climate.id', sortable: true },
          { key: 'crop', labelKey: 'admin.climate.crop' },
        ]}
      />
      {showModal && (
        <ConfirmActionModal
          title={t('admin.climate.add')}
          fields={[
            { key: 'name', labelKey: 'admin.climate.name' },
            { key: 'capacityMT', labelKey: 'admin.climate.capacity' },
            { key: 'monthlyRatePaise', labelKey: 'admin.climate.rate' },
          ]}
          onConfirm={async (reason, extra) => {
            await adminPost(
              '/admin/cold-storages',
              { name: extra.name, capacityMT: Number(extra.capacityMT || 0), monthlyRatePaise: Number(extra.monthlyRatePaise || 0) },
              mutationHeaders(role, reason)
            );
            setRefreshKey((k) => k + 1);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
      <span style={{ display: 'none' }}>{refreshKey}</span>
    </div>
  );
}

export function DisputesInboxPage() {
  const t = useT();
  return (
    <div>
      <h2>{t('admin.nav.disputes')}</h2>
      <GridPage
        titleKey="admin.disputes.inbox"
        url="/admin/disputes"
        params={{ status: 'open' }}
        statusChips={['all', 'open', 'resolved']}
        columns={[
          { key: 'id', labelKey: 'admin.disputes.id', sortable: true },
          { key: 'source', labelKey: 'admin.disputes.source' },
          { key: 'category', labelKey: 'admin.disputes.category' },
          { key: 'urgency', labelKey: 'admin.disputes.urgency' },
          { key: 'routedRole', labelKey: 'admin.disputes.queue' },
          { key: 'slaDueAt', labelKey: 'admin.disputes.sla' },
          { key: 'slaBreached', labelKey: 'admin.disputes.breached', render: (r) => (r.slaBreached ? '⚠' : '') },
        ]}
        detailUrl={(id) => `/admin/disputes/${id}`}
        actions={[
          {
            labelKey: 'admin.disputes.resolve',
            path: (r) => `/admin/disputes/${String(r.id)}/resolve`,
            fields: [{ key: 'resolution', labelKey: 'admin.disputes.resolution' }],
          },
        ]}
      />
    </div>
  );
}
