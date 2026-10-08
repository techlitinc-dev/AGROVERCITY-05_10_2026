import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { listRooms, type ChatRoom } from '../../lib/api/chat';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const fmtWhen = (iso?: string | null): string =>
  iso
    ? new Date(iso).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

/** Deep route for a room, matching the kind-specific ChatRoomPage routes. */
function roomPath(room: ChatRoom): string {
  switch (room.kind) {
    case 'offer':
      return `/dashboard/p/myOffers/${room.offerId ?? room.id}/chat`;
    case 'transport':
      return `/dashboard/p/transport/trips/${room.id}/chat`;
    case 'direct':
      return `/dashboard/p/chats/${room.id}`;
    default:
      return `/dashboard/p/purchases/${room.purchaseId ?? room.id}/chat`;
  }
}

/**
 * Chats hub (WS-01 task 1.21) — every deal conversation in one list, sorted by
 * last activity, with an unread badge cleared when the room is opened.
 */
export default function ChatsHubPage() {
  const t = useT();
  const [rooms, setRooms] = useState<ChatRoom[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    listRooms()
      .then(setRooms)
      .catch(() => setFailed(true));
  }, []);

  return (
    <ToolShell toolId="chats" backTo="/dashboard">
      {failed ? <EmptyState icon="📡" titleKey="tradeLoadFailed" /> : null}

      {!failed && rooms !== null && rooms.length === 0 ? (
        <EmptyState icon="💬" titleKey="chatsEmpty" bodyKey="chatsEmptyBody" />
      ) : null}

      {!failed && rooms !== null && rooms.length > 0 ? (
        <div className="trade-list">
          {rooms.map((room) => (
            <Link key={room.id} className="trade-card" to={roomPath(room)}>
              <div className="trade-card-row">
                <span className="trade-card-title">{room.counterpartyName ?? room.crop}</span>
                {room.unreadCount && room.unreadCount > 0 ? (
                  <span className="trade-pill">{t('chatUnreadBadge', { count: room.unreadCount })}</span>
                ) : null}
              </div>
              <div className="trade-card-row">
                <span className="trade-card-sub">{room.lastMessageText || room.crop}</span>
                <span className="trade-card-sub">{fmtWhen(room.lastMessageAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </ToolShell>
  );
}
