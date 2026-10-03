import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ChatLockNotice from './ChatLockNotice';
import { listChatRooms, type ChatRoom } from '../../lib/api/chat';
import type { Deal } from '../../lib/api/broker';
import { useT } from '../../lib/i18n';

interface DealChatDoorProps {
  deal: Deal;
  viewer: 'broker' | 'farmer';
}

const CHAT_OPEN_STATUSES: Array<Deal['status']> = ['accepted', 'in_transit'];

/**
 * Spec D1 — chat is a door that opens, not a form to find. Below `accepted`
 * the lock notice shows; once accepted/in_transit we look for the platform
 * chat room with the counterparty (rooms are booking-created server-side —
 * chat.ts has no open-by-user-id, so we can only enter an existing room).
 */
export default function DealChatDoor({ deal, viewer }: DealChatDoorProps) {
  const t = useT();
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [searched, setSearched] = useState(false);

  const unlocked = CHAT_OPEN_STATUSES.includes(deal.status);
  const counterpartyUid = viewer === 'broker' ? (deal.sellerUid ?? deal.buyerUid) : deal.brokerId;

  useEffect(() => {
    if (!unlocked || !counterpartyUid) return;
    let live = true;
    listChatRooms()
      .then((res) => {
        if (!live) return;
        const match = res.data.find(
          (r) => r.farmerId === counterpartyUid || r.buyerId === counterpartyUid
        );
        setRoom(match ?? null);
        setSearched(true);
      })
      .catch(() => live && setSearched(true));
    return () => {
      live = false;
    };
  }, [unlocked, counterpartyUid]);

  if (!unlocked) return <ChatLockNotice />;
  if (!counterpartyUid) return <p className="trade-hint">{t('chatUnavailable')}</p>;
  if (!searched) return <p className="trade-hint">{t('commonLoading')}</p>;
  if (!room) return <p className="trade-hint">{t('chatUnavailable')}</p>;

  return (
    <Link className="av-btn av-btn-primary broker-chat-cta" to={`/dashboard/p/chats/${room.id}`}>
      🔓 {t('chatUnlockedCta')}
    </Link>
  );
}
