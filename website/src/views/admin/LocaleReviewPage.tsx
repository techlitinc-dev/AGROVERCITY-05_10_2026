import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  decideLocaleApproval,
  getLocaleDrafts,
  type LocaleDraft,
} from '../../lib/api/admin';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const LOCALES = ['ta', 'mr', 'gu', 'pa', 'te', 'bn', 'kn', 'ml'];

/**
 * Locale review console (WS-07 M32) — draft keys side-by-side (en source vs
 * draft) with approve/reject. Phase-07 restyles the console.
 */
export default function LocaleReviewPage() {
  const t = useT();
  const [locale, setLocale] = useState('ta');
  const [items, setItems] = useState<LocaleDraft[]>([]);
  const [failed, setFailed] = useState(false);

  const load = useCallback((code: string) => {
    getLocaleDrafts(code)
      .then((page) => {
        setItems(page.data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load(locale);
  }, [locale, load]);

  const decide = async (key: string, action: 'approve' | 'reject') => {
    try {
      await decideLocaleApproval(locale, key, action);
      setItems((prev) => prev.filter((item) => item.key !== key));
    } catch {
      toast(t('actionFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="settings" backTo="/dashboard">
      <h2 className="trade-card-title">{t('admin.localeReview.title')}</h2>

      <select
        className="av-input"
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {code}
          </option>
        ))}
      </select>

      {failed ? <EmptyState icon="📡" titleKey="tradeLoadFailed" /> : null}
      {!failed && items.length === 0 ? (
        <EmptyState icon="🌐" titleKey="admin.localeReview.empty" />
      ) : null}

      <div className="trade-list">
        {items.map((item) => (
          <div key={item.key} className="trade-card">
            <div className="trade-card-title">{item.key}</div>
            <div className="trade-card-sub">EN: {item.enSource}</div>
            <div className="trade-card-sub">→ {item.draft}</div>
            <div className="trade-actions-row">
              <button
                type="button"
                className="av-btn av-btn-primary"
                onClick={() => void decide(item.key, 'approve')}
              >
                {t('admin.localeReview.approve')}
              </button>
              <button
                type="button"
                className="av-btn av-btn-plain"
                style={{ background: 'var(--av-error)' }}
                onClick={() => void decide(item.key, 'reject')}
              >
                {t('admin.localeReview.reject')}
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
