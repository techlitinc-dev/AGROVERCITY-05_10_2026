import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  listNotifications,
  markAllRead,
  markRead,
  type AppNotification,
} from '../../lib/api/notifications';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** One emoji per notification family — offer/booking/payment/escrow/chat/logistics/qc. */
const typeIcon = (type?: string): string => {
  if (!type) return '🔔';
  if (type.startsWith('offer_')) return '🤝';
  if (type.startsWith('booking_')) return '🧾';
  if (type.startsWith('payment_')) return '💵';
  if (type.startsWith('escrow_')) return '🔒';
  if (type === 'chat_message') return '💬';
  if (type.startsWith('pickup_') || type.startsWith('dispatch') || type.startsWith('deliver'))
    return '🚚';
  if (type === 'deal_completed') return '🎉';
  if (type === 'rated') return '⭐';
  if (type.startsWith('qc_')) return '⚖️';
  return '🔔';
};

/**
 * Notification inbox — unread-dot list, tap to mark one read,
 * "mark all read" for the whole inbox.
 */
export default function NotificationsPage() {
  const t = useT();

  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listNotifications({ page: 1, pageSize: 50 })
      .then((res) => setItems(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  const hasUnread = items?.some((n) => !n.read) ?? false;

  const openItem = async (notification: AppNotification) => {
    if (notification.read) return;
    setItems((prev) =>
      prev ? prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)) : prev
    );
    try {
      await markRead(notification.id);
    } catch {
      load();
    }
  };

  const markAll = async () => {
    setBusy(true);
    try {
      await markAllRead();
      toast(t('notifMarked'));
      load();
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="notifications">
      <div className="trade-actions" style={{ marginTop: 4 }}>
        <button
          type="button"
          className="av-btn av-btn-ghost"
          onClick={() => void markAll()}
          disabled={busy || !hasUnread}
        >
          {busy ? <span className="av-spinner" aria-hidden /> : t('notifMarkAll')}
        </button>
      </div>

      {items === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={load}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {items !== null && items.length === 0 ? (
        <EmptyState icon="🔔" titleKey="notifEmpty" />
      ) : null}

      <div className="trade-list">
        {items?.map((notification) => (
          <div
            key={notification.id}
            className="trade-card trade-notif"
            role="button"
            tabIndex={0}
            onClick={() => void openItem(notification)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void openItem(notification);
            }}
          >
            <span
              className={notification.read ? 'trade-notif-read' : 'trade-notif-unread'}
              aria-hidden
            />
            <span className="trade-notif-badge" aria-hidden>
              {typeIcon(notification.type)}
            </span>
            <div style={{ flex: 1 }}>
              <div className="trade-notif-title">{notification.title}</div>
              {notification.body ? (
                <div className="trade-notif-body">{notification.body}</div>
              ) : null}
              <div className="trade-notif-time">{fmtTime(notification.createdAt)}</div>
              {notification.data?.path ? (
                <Link className="av-link trade-notif-open" to={notification.data.path}>
                  {t('chatOpenCta')} →
                </Link>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToolShell>
  );
}
