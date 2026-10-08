import { useEffect, useState } from 'react';
import { useT } from '../../../lib/i18n';
import { getAudit, type AuditEntry } from '../../../lib/api/admin';

export interface DrawerAction {
  labelKey: string;
  destructive?: boolean;
  onConfirm: (reason: string, extra: Record<string, string>) => Promise<void>;
  fields?: { key: string; labelKey: string; placeholderKey?: string }[];
}

interface Props {
  targetId: string;
  title: string;
  fetchEntity: () => Promise<Record<string, unknown>>;
  actions?: DrawerAction[];
  renderExtra?: (entity: Record<string, unknown>) => React.ReactNode;
  onClose: () => void;
  ConfirmComponent: React.ComponentType<{
    title: string;
    fields?: { key: string; labelKey: string; placeholderKey?: string }[];
    onConfirm: (reason: string, extra: Record<string, string>) => Promise<void>;
    onClose: () => void;
  }>;
}

/** Right-side drawer: raw entity JSON + audit history + action buttons. */
export default function DetailDrawer({
  targetId,
  title,
  fetchEntity,
  actions = [],
  renderExtra,
  onClose,
  ConfirmComponent,
}: Props) {
  const t = useT();
  const [entity, setEntity] = useState<Record<string, unknown> | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [activeAction, setActiveAction] = useState<DrawerAction | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchEntity()
      .then((data) => !cancelled && setEntity(data))
      .catch(() => !cancelled && setEntity({}));
    getAudit({ targetId })
      .then((res) => !cancelled && setAudit(res.data))
      .catch(() => !cancelled && setAudit([]));
    return () => {
      cancelled = true;
    };
  }, [targetId, fetchEntity]);

  return (
    <aside className="admin-drawer" role="complementary">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <button className="admin-button secondary" onClick={onClose}>
          {t('admin.drawer.close')}
        </button>
      </div>

      {entity && renderExtra && renderExtra(entity)}

      <h4>{t('admin.drawer.rawJson')}</h4>
      <pre className="admin-pre">{JSON.stringify(entity, null, 2)}</pre>

      <h4>{t('admin.drawer.auditHistory')}</h4>
      {audit.length === 0 ? (
        <p className="admin-nav-group-label">{t('admin.drawer.noAudit')}</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, fontSize: 12 }}>
          {audit.map((entry) => (
            <li key={entry.id} style={{ borderBottom: '1px solid var(--admin-border)', padding: '6px 0' }}>
              <strong>{entry.action}</strong> · {entry.module} · {entry.timestamp}
              <div className="admin-nav-group-label">{entry.reason}</div>
            </li>
          ))}
        </ul>
      )}

      {actions.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {actions.map((action) => (
            <button
              key={action.labelKey}
              className={action.destructive ? 'admin-button danger' : 'admin-button'}
              onClick={() => setActiveAction(action)}
            >
              {t(action.labelKey)}
            </button>
          ))}
        </div>
      )}

      {activeAction && (
        <ConfirmComponent
          title={t(activeAction.labelKey)}
          fields={activeAction.fields}
          onConfirm={activeAction.onConfirm}
          onClose={() => setActiveAction(null)}
        />
      )}
    </aside>
  );
}
