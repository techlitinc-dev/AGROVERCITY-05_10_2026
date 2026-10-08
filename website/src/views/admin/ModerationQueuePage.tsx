import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { getModerationQueue, type ModerationQueueItem } from '../../lib/api/admin';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/**
 * Minimal admin moderation queue (WS-01 task 1.25). Lists open UGC items
 * flagged by `content.moderation.v1`; phase-07 restyles the console.
 */
export default function ModerationQueuePage() {
  const t = useT();
  const [items, setItems] = useState<ModerationQueueItem[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  const load = useCallback((next?: string) => {
    getModerationQueue(next)
      .then((page) => {
        setItems((prev) => (next ? [...prev, ...page.data] : page.data));
        setCursor(page.nextCursor);
        setLoaded(true);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <ToolShell toolId="settings" backTo="/dashboard">
      <h2 className="trade-card-title">{t('admin.moderationQueue.title')}</h2>

      {failed ? <EmptyState icon="📡" titleKey="tradeLoadFailed" /> : null}
      {!failed && loaded && items.length === 0 ? (
        <EmptyState icon="🛡️" titleKey="admin.moderationQueue.empty" />
      ) : null}

      {items.length > 0 ? (
        <div className="trade-list">
          {items.map((item) => (
            <div key={`${item.contentType}-${item.contentId}`} className="trade-card">
              <div className="trade-card-row">
                <span className="trade-card-title">{item.contentType}</span>
                <span className="trade-pill">{item.reason}</span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">{item.contentId}</span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">{item.decisionId}</span>
                <span className="trade-card-sub">{item.createdAt}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {cursor ? (
        <button type="button" className="av-btn av-btn-ghost" onClick={() => load(cursor)}>
          {t('admin.moderationQueue.loadMore')}
        </button>
      ) : null}
    </ToolShell>
  );
}
