import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import ModalSheet from '../../components/ModalSheet';
import ConfirmSheet from '../../components/trade/ConfirmSheet';
import CounterOfferForm from '../../components/trade/CounterOfferForm';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  getChatRoom,
  listMessages,
  markRoomRead,
  postMessage,
  type ChatMessage,
  type ChatRoom,
} from '../../lib/api/chat';
import {
  acceptOffer,
  counterOffer,
  getOffer,
  rejectOffer,
  withdrawOffer,
  type Offer,
} from '../../lib/api/offers';
import { compressImage, uploadTradeImage } from '../../lib/firebase';
import { useT } from '../../lib/i18n';
import { useSessionStore } from '../../stores/session';
import '../../theme/trade.css';

const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });

const unitLabel = (t: (key: string) => string, unit: string): string =>
  unit === 'kg' ? t('unitKg') : t('unitQuintal');

interface AcceptResponse {
  purchase?: { id?: string };
}

/**
 * Chat room — serves both room kinds. Purchase rooms (keyed by purchaseId)
 * stay booking-gated; offer rooms (keyed by offerId) are the negotiation
 * thread created with each offer and carry a sticky deal bar with the same
 * accept / counter / decline / withdraw gating as OfferDetailPage. Messages
 * poll every 5s; sending text or a photo both go through postMessage.
 */
export default function ChatRoomPage() {
  const t = useT();
  const navigate = useNavigate();
  const { purchaseId, offerId, roomId: directRoomId, tripId } = useParams();
  const roomId = purchaseId ?? offerId ?? tripId ?? directRoomId ?? '';
  const kind: 'offer' | 'purchase' | 'direct' | 'transport' = offerId
    ? 'offer'
    : tripId
      ? 'transport'
      : directRoomId
        ? 'direct'
        : 'purchase';
  const uid = useSessionStore((s) => s.user?.id ?? s.user?.uid);

  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [locked, setLocked] = useState(false);
  const [closed, setClosed] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [offer, setOffer] = useState<Offer | null>(null);
  const [busyAction, setBusyAction] = useState<null | 'accept' | 'decline' | 'withdraw' | 'counter'>(
    null
  );
  const [counterOpen, setCounterOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const loadMessages = useCallback(() => {
    if (!roomId) return;
    listMessages(roomId, 1, 50)
      .then((res) => {
        setMessages(res.data);
        void markRoomRead(roomId).catch(() => undefined);
      })
      .catch((e) => {
        if (isApiError(e) && e.code === 'CHAT_LOCKED_FOR_BOOKING') setLocked(true);
        else if (isApiError(e) && e.code === 'CHAT_CLOSED') setClosed(true);
      });
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    setFailed(false);
    getChatRoom(roomId)
      .then((r) => {
        setRoom(r);
        loadMessages();
      })
      .catch((e) => {
        if (isApiError(e) && e.code === 'CHAT_LOCKED_FOR_BOOKING') {
          setLocked(true);
        } else {
          setFailed(true);
        }
      });
  }, [roomId, loadMessages]);

  const loadOffer = useCallback(() => {
    if (!offerId) return;
    getOffer(offerId)
      .then(setOffer)
      .catch(() => undefined);
  }, [offerId]);

  useEffect(loadOffer, [loadOffer]);

  const terminal = room?.terminal === true;
  const readOnly = terminal || closed;

  // Poll for new messages; cancelled on unmount or once the room goes read-only.
  useEffect(() => {
    if (!roomId || locked || readOnly) return;
    const id = window.setInterval(loadMessages, 5000);
    return () => window.clearInterval(id);
  }, [roomId, locked, readOnly, loadMessages]);

  const sendError = (e: unknown) => {
    if (isApiError(e) && e.code === 'RATE_LIMITED') {
      toast(t('chatRateLimited'), { error: true });
    } else if (isApiError(e) && e.code === 'CHAT_CLOSED') {
      setClosed(true);
      toast(t('chatClosedNote'), { error: true });
    } else if (isApiError(e) && e.code === 'CHAT_LOCKED_FOR_BOOKING') {
      setLocked(true);
      toast(t('chatLockedNote'), { error: true });
    } else {
      toast(t('actionFailed'), { error: true });
    }
  };

  const sendText = () => {
    const text = draft.trim();
    if (!roomId || !text || sending || uploading) return;
    setSending(true);
    postMessage(roomId, { text })
      .then(() => {
        setDraft('');
        loadMessages();
      })
      .catch(sendError)
      .finally(() => setSending(false));
  };

  const sendPhoto = (file: File) => {
    if (!roomId || !uid || sending || uploading) return;
    setUploading(true);
    compressImage(file)
      .then((blob) => uploadTradeImage(uid, blob))
      .then((imageUrl) => postMessage(roomId, { imageUrl }))
      .then(loadMessages)
      .catch(sendError)
      .finally(() => setUploading(false));
  };

  // ---- Deal bar (offer rooms only) — gating mirrors OfferDetailPage ----
  const isTarget = !!uid && offer?.toId === uid;
  const isMaker = !!uid && offer?.fromId === uid;
  const dealOpen = !!offer && (offer.status === 'pending' || offer.status === 'countered');
  const showAccept =
    !!offer && ((offer.status === 'pending' && isTarget) || (offer.status === 'countered' && isMaker));
  const showCounter = !!offer && offer.status === 'pending' && isTarget;
  const showDecline = !!offer && offer.status === 'pending' && isTarget;
  const showWithdraw =
    !!offer && (offer.status === 'pending' || offer.status === 'countered') && isMaker;

  const failToast = (e: unknown) => {
    if (isApiError(e) && e.code === 'NEGOTIATION_CLOSED') {
      toast(t('offerOneRoundHint'), { error: true });
    } else {
      toast(t('actionFailed'), { error: true });
    }
  };

  const doAccept = async () => {
    if (!offer) return;
    setBusyAction('accept');
    try {
      const res = (await acceptOffer(offer.id)) as AcceptResponse | undefined;
      toast(t('offerAcceptedToast'));
      if (res?.purchase?.id) {
        navigate(`/dashboard/p/purchases/${res.purchase.id}/chat`);
      } else {
        navigate('/dashboard/p/purchases');
      }
    } catch (e) {
      failToast(e);
    } finally {
      setBusyAction(null);
    }
  };

  const doDecline = async () => {
    if (!offer) return;
    setBusyAction('decline');
    try {
      await rejectOffer(offer.id);
      toast(t('offerDeclinedToast'));
      setDeclineOpen(false);
      loadOffer();
    } catch (e) {
      failToast(e);
    } finally {
      setBusyAction(null);
    }
  };

  const doWithdraw = async () => {
    if (!offer) return;
    setBusyAction('withdraw');
    try {
      await withdrawOffer(offer.id);
      toast(t('offerWithdrawnToast'));
      setWithdrawOpen(false);
      loadOffer();
    } catch (e) {
      failToast(e);
    } finally {
      setBusyAction(null);
    }
  };

  const submitCounter = async (pricePerUnit: number, note: string) => {
    if (!offer) return;
    setBusyAction('counter');
    try {
      await counterOffer(offer.id, { pricePerUnit, note: note || undefined });
      toast(t('offerCounteredToast'));
      setCounterOpen(false);
      loadOffer();
    } catch (e) {
      failToast(e);
    } finally {
      setBusyAction(null);
    }
  };

  const composerDisabled = readOnly || sending || uploading;
  const kindColor =
    kind === 'offer' ? '#7C3AED' : kind === 'transport' ? '#0E7490' : kind === 'direct' ? '#0284C7' : '#16A34A';
  const toolId =
    kind === 'offer' ? 'myOffers' : kind === 'transport' ? 'tripDetail' : kind === 'direct' ? 'chats' : 'purchases';
  const backTo =
    kind === 'offer'
      ? `/dashboard/p/myOffers/${offerId}`
      : kind === 'transport'
        ? `/dashboard/p/transport/trips/${tripId}`
        : kind === 'direct'
          ? '/dashboard/p/chats'
          : `/dashboard/p/purchases/${purchaseId}`;
  // Offer rooms surface the closed state through the deal bar; the room-level
  // banner is the fallback when the offer itself failed to load.
  const showTerminalBanner = terminal && !(kind === 'offer' && offer !== null);

  return (
    <ToolShell toolId={toolId} backTo={backTo}>
      {locked ? <EmptyState icon="🔒" titleKey="chatLockedNote" /> : null}

      {failed ? (
        <EmptyState
          icon="📡"
          titleKey="tradeLoadFailed"
          action={
            <button type="button" className="av-btn av-btn-ghost" onClick={() => window.location.reload()}>
              ↻ {t('retry')}
            </button>
          }
        />
      ) : null}

      {!locked && !failed ? (
        <>
          {room ? (
            <div className="trade-card" style={{ cursor: 'default' }}>
              <div className="trade-card-row">
                <span className="trade-card-title">
                  {room.counterpartyName ??
                    (room.farmerId === uid ? room.buyerName : room.farmerName)}
                </span>
                <span
                  className="trade-pill"
                  style={{
                    background: `${kindColor}1A`,
                    color: kindColor,
                    borderColor: `${kindColor}55`,
                  }}
                >
                  {t(
                    kind === 'offer'
                      ? 'chatsOfferTag'
                      : kind === 'transport'
                        ? 'chatsPurchaseTag'
                        : kind === 'direct'
                          ? 'chatDirectTag'
                          : 'chatsPurchaseTag'
                  )}
                </span>
              </div>
              {room.crop ? (
                <div className="trade-card-row">
                  <span className="trade-card-sub">{room.crop}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {showTerminalBanner ? (
            <p className="trade-hint">
              {t(kind === 'offer' ? 'chatDealClosed' : 'chatClosedNote')}
            </p>
          ) : null}
          {closed && !terminal ? <p className="trade-hint">{t('chatClosedNote')}</p> : null}

          <div className="chat-wrap">
            <div className="chat-scroll">
              {messages !== null && messages.length === 0 ? (
                <p className="trade-hint" style={{ textAlign: 'center' }}>
                  {t('chatEmpty')}
                </p>
              ) : null}
              {messages?.map((m) => {
                const mine = !!uid && m.fromId === uid;
                return (
                  <div key={m.id} className={`chat-bubble ${mine ? 'mine' : 'theirs'}`}>
                    {!mine ? <span className="chat-meta">{m.fromName}</span> : null}
                    {m.imageUrl ? <img className="chat-img" src={m.imageUrl} alt="" /> : null}
                    {m.text ? <span>{m.text}</span> : null}
                    <span className="chat-meta">{fmtTime(m.createdAt)}</span>
                  </div>
                );
              })}
            </div>

            <div style={{ position: 'sticky', bottom: 0, background: 'var(--av-bg)' }}>
              {kind === 'offer' && offer ? (
                dealOpen && !(showAccept || showCounter || showDecline || showWithdraw) ? (
                  offer.status === 'countered' && isTarget ? (
                    <p className="trade-hint" style={{ margin: '4px 0 0' }}>
                      {t('offerOneRoundHint')}
                    </p>
                  ) : null
                ) : dealOpen ? (
                  <div className="trade-card" style={{ cursor: 'default', margin: '4px 0 0' }}>
                    <p className="trade-hint" style={{ margin: '0 0 8px' }}>
                      {t('chatDealHint')}
                    </p>
                    <div className="trade-actions-row">
                      {showAccept ? (
                        <button
                          type="button"
                          className="av-btn av-btn-primary"
                          onClick={() => void doAccept()}
                          disabled={busyAction !== null}
                        >
                          {busyAction === 'accept' ? (
                            <span className="av-spinner" aria-hidden />
                          ) : (
                            t('offerAccept')
                          )}
                        </button>
                      ) : null}
                      {showCounter ? (
                        <button
                          type="button"
                          className="av-btn av-btn-ghost"
                          onClick={() => setCounterOpen(true)}
                          disabled={busyAction !== null}
                        >
                          {t('offerCounter')}
                        </button>
                      ) : null}
                      {showDecline ? (
                        <button
                          type="button"
                          className="av-btn av-btn-plain"
                          style={{ background: 'var(--av-error)' }}
                          onClick={() => setDeclineOpen(true)}
                          disabled={busyAction !== null}
                        >
                          {t('offerDecline')}
                        </button>
                      ) : null}
                      {showWithdraw ? (
                        <button
                          type="button"
                          className="av-btn av-btn-plain"
                          style={{ background: 'var(--av-error)' }}
                          onClick={() => setWithdrawOpen(true)}
                          disabled={busyAction !== null}
                        >
                          {t('offerWithdraw')}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="trade-card" style={{ cursor: 'default', margin: '4px 0 0' }}>
                    <p className="trade-hint" style={{ margin: 0 }}>
                      {t('chatDealClosed')}
                    </p>
                    {offer.status === 'accepted' ? (
                      <div className="trade-actions-row" style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="av-btn av-btn-primary"
                          onClick={() => navigate('/dashboard/p/purchases')}
                        >
                          {t('chatViewBooking')}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )
              ) : null}

              <div className="chat-composer" style={{ paddingTop: 8 }}>
                <input
                  className="av-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={t('chatInputPlaceholder')}
                  disabled={composerDisabled}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') sendText();
                  }}
                />
                <button
                  type="button"
                  className="av-btn av-btn-ghost"
                  onClick={() => fileRef.current?.click()}
                  disabled={composerDisabled}
                  aria-label={t('chatAttachPhoto')}
                  title={t('chatAttachPhoto')}
                >
                  📷
                </button>
                <button
                  type="button"
                  className="av-btn av-btn-primary"
                  onClick={sendText}
                  disabled={composerDisabled || !draft.trim()}
                >
                  {sending ? <span className="av-spinner" aria-hidden /> : t('chatSend')}
                </button>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) sendPhoto(file);
                e.target.value = '';
              }}
            />
          </div>

          {kind === 'offer' && offer ? (
            <>
              <ModalSheet
                open={counterOpen}
                onClose={() => setCounterOpen(false)}
                title={t('offerCounterTitle')}
              >
                <CounterOfferForm
                  currentPrice={offer.counter?.pricePerUnit ?? offer.pricePerUnit}
                  unit={unitLabel(t, offer.unit)}
                  onSubmit={(price, note) => void submitCounter(price, note)}
                  onCancel={() => setCounterOpen(false)}
                  busy={busyAction === 'counter'}
                />
              </ModalSheet>

              <ConfirmSheet
                open={declineOpen}
                title={t('offerDecline')}
                confirmLabel={t('offerDecline')}
                onConfirm={() => void doDecline()}
                onClose={() => setDeclineOpen(false)}
                busy={busyAction === 'decline'}
              />

              <ConfirmSheet
                open={withdrawOpen}
                title={t('offerWithdraw')}
                confirmLabel={t('offerWithdraw')}
                onConfirm={() => void doWithdraw()}
                onClose={() => setWithdrawOpen(false)}
                busy={busyAction === 'withdraw'}
              />
            </>
          ) : null}
        </>
      ) : null}
    </ToolShell>
  );
}
