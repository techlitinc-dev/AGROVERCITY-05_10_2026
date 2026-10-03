import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { listChatRooms, type ChatRoom } from '../../lib/api/chat';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

/** Compact relative timestamp ("5m" / "2h 15m" / "3d"), mirroring offerTimeLeft. */
const fmtRelative = (iso?: string | null): string => {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  const m = Math.floor(ms / 60000);
  if (m < 1) return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d`;
};

/**
 * Chats inbox — every negotiation (offer) and booking (purchase) thread in
 * one list. Tapping a card opens the matching chat room; unread rooms show a
 * dot and the crop + counterparty identify the deal.
 */
export default function ChatListPage() {
  const t = useT();
  const navigate = useNavigate();

  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    listChatRooms()
      .then((res) => setRooms(res.data))
      .catch(() => setFailed(true));
  }, []);

  useEffect(load, [load]);

  return (
    <ToolShell toolId="chats">
      {rooms === null && !failed ? <p className="trade-hint">{t('commonLoading')}</p> : null}

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

      {rooms !== null && rooms.length === 0 ? (
        <EmptyState
          icon="💬"
          titleKey="chatsEmpty"
          bodyKey="chatsEmptyBody"
          action={
            <button
              type="button"
              className="av-btn av-btn-primary"
              onClick={() => navigate('/dashboard/p/browseLots')}
            >
              {t('tool_browseLots')}
            </button>
          }
        />
      ) : null}

      <div className="trade-list">
        {rooms?.map((room) => {
          const kind = room.kind ?? 'purchase';
          const color = kind === 'offer' ? '#7C3AED' : kind === 'direct' ? '#0284C7' : '#16A34A';
          const to =
            kind === 'offer'
              ? `/dashboard/p/myOffers/${room.offerId ?? room.id}/chat`
              : kind === 'direct'
                ? `/dashboard/p/chats/${room.id}`
                : `/dashboard/p/purchases/${room.purchaseId ?? room.id}/chat`;
          return (
            <div
              key={room.id}
              className="trade-card"
              role="button"
              tabIndex={0}
              onClick={() => navigate(to)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(to);
              }}
            >
              <div className="trade-card-row">
                <span className="trade-card-title">{room.counterpartyName ?? room.crop}</span>
                <span
                  className="trade-pill"
                  style={{ background: `${color}1A`, color, borderColor: `${color}55` }}
                >
                  {t(
                    kind === 'offer'
                      ? 'chatsOfferTag'
                      : kind === 'direct'
                        ? 'chatDirectTag'
                        : 'chatsPurchaseTag'
                  )}
                </span>
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">
                  {room.crop}
                  {room.lastMessageText ? ` · ${room.lastMessageText}` : ` · ${t('chatEmpty')}`}
                </span>
                <span className="trade-card-sub" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {fmtRelative(room.lastMessageAt)}
                  {room.unread ? (
                    <span
                      aria-label={t('chatUnreadBadge', { count: 1 })}
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: 'var(--av-primary)',
                        display: 'inline-block',
                      }}
                    />
                  ) : null}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </ToolShell>
  );
}
