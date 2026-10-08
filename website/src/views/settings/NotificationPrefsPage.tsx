import { useEffect, useState } from 'react';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  getPreferences,
  putPreferences,
  type NotificationPrefs,
} from '../../lib/api/notifications';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const CATEGORIES = ['tasks', 'trade', 'payments', 'social', 'marketing'] as const;
const CHANNELS = ['push', 'sms', 'inApp'] as const;

/**
 * Notification preferences center (WS-02 G6) — per-category + per-channel
 * toggles, a quiet-hours override and digest-mode opt-in. Backed by
 * GET/PUT /v1/notifications/preferences.
 */
export default function NotificationPrefsPage() {
  const t = useT();
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getPreferences()
      .then(setPrefs)
      .catch(() => toast(t('actionFailed'), { error: true }));
  }, [t]);

  const save = async (next: NotificationPrefs) => {
    setPrefs(next);
    setSaving(true);
    try {
      const saved = await putPreferences(next);
      setPrefs(saved);
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setSaving(false);
    }
  };

  if (!prefs) {
    return (
      <ToolShell toolId="settings" backTo="/dashboard">
        <p className="trade-hint">{t('commonLoading')}</p>
      </ToolShell>
    );
  }

  const toggleCategory = (key: string) =>
    void save({ ...prefs, categories: { ...prefs.categories, [key]: !prefs.categories[key] } });
  const toggleChannel = (key: string) =>
    void save({ ...prefs, channels: { ...prefs.channels, [key]: !prefs.channels[key] } });

  return (
    <ToolShell toolId="settings" backTo="/dashboard">
      <h2 className="trade-card-title">{t('notif.prefs.title')}</h2>

      <div className="trade-card" style={{ cursor: 'default' }}>
        <p className="trade-card-sub">{t('notif.prefs.categories')}</p>
        {CATEGORIES.map((key) => (
          <label key={key} className="trade-card-row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={prefs.categories[key] ?? true}
              disabled={saving}
              onChange={() => toggleCategory(key)}
            />
            <span>{t(`notif.prefs.${key}`)}</span>
          </label>
        ))}
      </div>

      <div className="trade-card" style={{ cursor: 'default' }}>
        <p className="trade-card-sub">{t('notif.prefs.channels')}</p>
        {CHANNELS.map((key) => (
          <label key={key} className="trade-card-row" style={{ gap: 8 }}>
            <input
              type="checkbox"
              checked={prefs.channels[key] ?? true}
              disabled={saving}
              onChange={() => toggleChannel(key)}
            />
            <span>{t(`notif.prefs.${key}`)}</span>
          </label>
        ))}
      </div>

      <div className="trade-card" style={{ cursor: 'default' }}>
        <label className="trade-card-row" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={prefs.quietHoursOverride}
            disabled={saving}
            onChange={() => void save({ ...prefs, quietHoursOverride: !prefs.quietHoursOverride })}
          />
          <span>{t('notif.prefs.quietHours')}</span>
        </label>
        <label className="trade-card-row" style={{ gap: 8 }}>
          <input
            type="checkbox"
            checked={prefs.digestMode}
            disabled={saving}
            onChange={() => void save({ ...prefs, digestMode: !prefs.digestMode })}
          />
          <span>{t('notif.prefs.digest')}</span>
        </label>
      </div>
    </ToolShell>
  );
}
