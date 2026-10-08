import { useEffect, useState } from 'react';
import { useT } from '../../lib/i18n';
import { adminGet, adminPost, adminPut, mutationHeaders } from '../../lib/api/admin';
import { GridPage, useRole } from './adminShared';
import type { GridColumn } from './components/DataGrid';
import ConfirmActionModal from './components/ConfirmActionModal';

const USER_COLUMNS: GridColumn[] = [
  { key: 'id', labelKey: 'admin.users.id', sortable: true },
  { key: 'name', labelKey: 'admin.users.name' },
  { key: 'phone', labelKey: 'admin.users.phone' },
  { key: 'status', labelKey: 'admin.users.status' },
];

export function UsersPage() {
  return (
    <GridPage
      titleKey="admin.nav.users"
      url="/admin/users"
      columns={USER_COLUMNS}
      statusChips={['all', 'active', 'suspended', 'banned']}
      detailUrl={(id) => `/admin/users/${id}/role-profiles`}
      actions={[
        {
          labelKey: 'admin.users.suspend',
          destructive: true,
          path: (r) => `/admin/users/${String(r.id)}/status`,
          body: () => ({ status: 'suspended' }),
        },
        {
          labelKey: 'admin.users.ban',
          destructive: true,
          path: (r) => `/admin/users/${String(r.id)}/status`,
          body: () => ({ status: 'banned' }),
        },
      ]}
    />
  );
}

export function SessionsPage() {
  return (
    <GridPage
      titleKey="admin.nav.auth"
      url="/admin/auth/users"
      columns={[
        { key: 'uid', labelKey: 'admin.sessions.uid', sortable: true },
        { key: 'kind', labelKey: 'admin.sessions.kind' },
        { key: 'lastLoginAt', labelKey: 'admin.sessions.lastLogin' },
        { key: 'ip', labelKey: 'admin.sessions.ip' },
      ]}
      statusChips={['all']}
      actions={[
        {
          labelKey: 'admin.sessions.resetMpin',
          destructive: true,
          path: (r) => `/admin/auth/users/${String(r.uid)}/reset-mpin`,
        },
        {
          labelKey: 'admin.sessions.revoke',
          destructive: true,
          path: (r) => `/admin/auth/users/${String(r.uid)}/revoke-sessions`,
        },
      ]}
    />
  );
}

export function KycQueuePage() {
  return (
    <GridPage
      titleKey="admin.nav.kyc"
      url="/admin/kyc/pending"
      columns={[
        { key: 'docType', labelKey: 'admin.kyc.docType', sortable: true },
        { key: 'userId', labelKey: 'admin.kyc.user' },
        { key: 'riskScore', labelKey: 'admin.kyc.risk' },
        { key: 'status', labelKey: 'admin.kyc.status' },
      ]}
      statusChips={['all', 'pending']}
      params={{ status: 'pending' }}
      detailUrl={(id) => `/admin/kyc/${encodeURIComponent(id)}/history`}
      actions={[
        {
          labelKey: 'admin.kyc.verify',
          path: (r) => `/admin/kyc/${encodeURIComponent(String(r.id))}/verify`,
        },
        {
          labelKey: 'admin.kyc.reject',
          destructive: true,
          path: (r) => `/admin/kyc/${encodeURIComponent(String(r.id))}/reject`,
          fields: [{ key: 'rejectionReason', labelKey: 'admin.kyc.rejectionReason' }],
        },
      ]}
    />
  );
}

interface AppConfigShape {
  minSupportedVersion?: string;
  forceUpdate?: boolean;
  maintenanceMode?: boolean;
  featureFlags?: Record<string, unknown>;
}

export function ConfigPage() {
  const t = useT();
  const role = useRole();
  const [config, setConfig] = useState<AppConfigShape>({});
  const [showModal, setShowModal] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    adminGet<AppConfigShape>('/admin/app-config').then(setConfig).catch(() => setConfig({}));
  }, []);

  return (
    <div>
      <h2>{t('admin.nav.config')}</h2>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span className="admin-nav-group-label">{t('admin.config.minVersion')}</span>
        <input
          className="admin-input"
          value={config.minSupportedVersion ?? ''}
          onChange={(e) => setConfig({ ...config, minSupportedVersion: e.target.value })}
        />
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={config.forceUpdate ?? false}
          onChange={(e) => setConfig({ ...config, forceUpdate: e.target.checked })}
        />{' '}
        {t('admin.config.forceUpdate')}
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <input
          type="checkbox"
          checked={config.maintenanceMode ?? false}
          onChange={(e) => setConfig({ ...config, maintenanceMode: e.target.checked })}
        />{' '}
        {t('admin.config.maintenance')}
      </label>
      <label style={{ display: 'block', marginBottom: 8 }}>
        <span className="admin-nav-group-label">{t('admin.config.featureFlags')}</span>
        <textarea
          className="admin-textarea"
          rows={6}
          value={JSON.stringify(config.featureFlags ?? {}, null, 2)}
          onChange={(e) => {
            try {
              setConfig({ ...config, featureFlags: JSON.parse(e.target.value) });
            } catch {
              /* keep typing */
            }
          }}
        />
      </label>
      {message && <p className="admin-nav-group-label">{message}</p>}
      <button className="admin-button" onClick={() => setShowModal(true)}>
        {t('admin.config.save')}
      </button>
      {showModal && (
        <ConfirmActionModal
          title={t('admin.config.save')}
          onConfirm={async (reason) => {
            const res = await adminPut<{ requiresApproval?: boolean }>(
              '/admin/app-config',
              {
                minSupportedVersion: config.minSupportedVersion ?? '1.0.0',
                forceUpdate: config.forceUpdate ?? false,
                maintenanceMode: config.maintenanceMode ?? false,
                featureFlags: config.featureFlags ?? {},
              },
              mutationHeaders(role, reason)
            );
            setMessage(res.requiresApproval ? t('admin.config.pendingApproval') : t('admin.config.saved'));
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

export function BroadcastPage() {
  const t = useT();
  const role = useRole();
  const [form, setForm] = useState({ persona: '', district: '', crop: '', titleEn: '', titleHi: '', bodyEn: '', bodyHi: '' });
  const [showModal, setShowModal] = useState(false);
  const [ok, setOk] = useState(false);
  return (
    <div>
      <h2>{t('admin.nav.broadcasts')}</h2>
      {(['persona', 'district', 'crop', 'titleEn', 'titleHi', 'bodyEn', 'bodyHi'] as const).map((field) => (
        <label key={field} style={{ display: 'block', marginBottom: 8 }}>
          <span className="admin-nav-group-label">{t(`admin.broadcast.${field}`)}</span>
          <input
            className="admin-input"
            value={form[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
          />
        </label>
      ))}
      {ok && <p className="admin-nav-group-label">{t('admin.broadcast.sent')}</p>}
      <button className="admin-button" onClick={() => setShowModal(true)}>
        {t('admin.broadcast.send')}
      </button>
      {showModal && (
        <ConfirmActionModal
          title={t('admin.broadcast.send')}
          onConfirm={async (reason) => {
            await adminPost(
              '/admin/broadcasts',
              {
                segment: { persona: form.persona || undefined, district: form.district || undefined, crop: form.crop || undefined },
                titleEn: form.titleEn,
                titleHi: form.titleHi,
                bodyEn: form.bodyEn,
                bodyHi: form.bodyHi,
              },
              mutationHeaders(role, reason)
            );
            setOk(true);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}

interface ModerationSections {
  userReports?: Record<string, unknown>[];
  ugcFlags?: Record<string, unknown>[];
  fraudHolds?: Record<string, unknown>[];
}

export function ModerationPage() {
  const t = useT();
  const role = useRole();
  const [data, setData] = useState<ModerationSections>({});
  const [pending, setPending] = useState<{ id: string; action: string } | null>(null);

  const load = () => adminGet<ModerationSections>('/admin/moderation/queue').then(setData).catch(() => setData({}));
  useEffect(() => {
    load();
  }, []);

  const sections: { key: keyof ModerationSections; labelKey: string; emptyKey: string }[] = [
    { key: 'userReports', labelKey: 'admin.moderation.reports', emptyKey: 'admin.moderation.empty' },
    { key: 'ugcFlags', labelKey: 'admin.moderation.ugc', emptyKey: 'admin.moderation.empty' },
    { key: 'fraudHolds', labelKey: 'admin.moderation.fraud', emptyKey: 'admin.moderation.empty' },
  ];

  return (
    <div>
      <h2>{t('admin.nav.moderation')}</h2>
      {sections.map((section) => {
        const rows = data[section.key] ?? [];
        return (
          <section key={section.key} style={{ marginBottom: 20 }}>
            <h4>{t(section.labelKey)}</h4>
            {rows.length === 0 ? (
              <p className="admin-nav-group-label">{t(section.emptyKey)}</p>
            ) : (
              <table className="admin-grid">
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={String(row.id ?? index)}>
                      <td>{String(row.id ?? index)}</td>
                      <td style={{ display: 'flex', gap: 6 }}>
                        {(['dismiss', 'warn', 'suspend'] as const).map((action) => (
                          <button
                            key={action}
                            className="admin-chip"
                            onClick={() => setPending({ id: String(row.id ?? index), action })}
                          >
                            {t(`admin.moderation.${action}`)}
                          </button>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        );
      })}
      {pending && (
        <ConfirmActionModal
          title={t(`admin.moderation.${pending.action}`)}
          onConfirm={async (reason) => {
            await adminPost(
              `/admin/moderation/${encodeURIComponent(pending.id)}/action`,
              { action: pending.action },
              mutationHeaders(role, reason)
            );
            load();
          }}
          onClose={() => setPending(null)}
        />
      )}
    </div>
  );
}

export function ConsentAuditPage() {
  const t = useT();
  const [uid, setUid] = useState('');
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState('');
  return (
    <div>
      <h2>{t('admin.nav.consents')}</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <input className="admin-input" style={{ maxWidth: 260 }} value={uid} onChange={(e) => setUid(e.target.value)} placeholder={t('admin.consents.uid')} />
        <button
          className="admin-button"
          onClick={() =>
            adminGet<Record<string, unknown>>(`/admin/consents/${encodeURIComponent(uid)}`)
              .then((r) => {
                setResult(r);
                setError('');
              })
              .catch(() => {
                setResult(null);
                setError(t('admin.consents.notFound'));
              })
          }
        >
          {t('admin.grid.search')}
        </button>
      </div>
      {error && <p className="admin-error">{error}</p>}
      {result && <pre className="admin-pre">{JSON.stringify(result, null, 2)}</pre>}
    </div>
  );
}
