import { useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { getConsents, putConsents, type Consents } from '../../lib/api/consents';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const FIELDS = ['dataSharing', 'location', 'marketing'] as const;

/**
 * Consent center (WS-04 X17) — one toggle per consent field with purpose text,
 * persisted via PUT /users/me/consents on every change.
 */
export default function ConsentCenterPage() {
  const t = useT();
  const [consents, setConsents] = useState<Consents | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getConsents()
      .then(setConsents)
      .catch(() => toast(t('actionFailed'), { error: true }));
  }, [t]);

  const toggle = async (field: (typeof FIELDS)[number]) => {
    if (!consents) return;
    const next = { ...consents, [field]: !consents[field] };
    setConsents(next);
    setSaving(true);
    try {
      await putConsents(next);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ToolShell toolId="settings" backTo="/dashboard">
      <h2 className="trade-card-title">{t('consent.title')}</h2>
      {consents === null ? (
        <p className="trade-hint">{t('commonLoading')}</p>
      ) : (
        <div className="trade-list">
          {FIELDS.map((field) => (
            <label key={field} className="trade-card" style={{ cursor: 'default', gap: 8 }}>
              <div className="trade-card-row" style={{ gap: 8 }}>
                <input
                  type="checkbox"
                  checked={consents[field]}
                  disabled={saving}
                  onChange={() => void toggle(field)}
                />
                <span className="trade-card-title">{t(`consent.${field}`)}</span>
              </div>
              <span className="trade-card-sub">{t(`consent.${field}.purpose`)}</span>
            </label>
          ))}
        </div>
      )}
    </ToolShell>
  );
}
