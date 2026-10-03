import { useCallback, useEffect, useRef, useState } from 'react';
import ModalSheet from '../ModalSheet';
import { toast } from '../toast';
import {
  getHistory,
  listHandoffs,
  requestHandoff,
  sendMessage,
  type ChatbotHistoryRecord,
  type ExpertTicket,
} from '../../lib/api/chatbot';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';

interface KisanMitraSheetProps {
  open: boolean;
  onClose: () => void;
}

type Bubble = { key: string; sender: 'user' | 'bot'; text: string };

function toBubbles(records: ChatbotHistoryRecord[]): Bubble[] {
  const bubbles: Bubble[] = [];
  for (const record of records) {
    bubbles.push({ key: `${record.id}-u`, sender: 'user', text: record.userQuery });
    bubbles.push({ key: `${record.id}-b`, sender: 'bot', text: record.botResponse });
  }
  return bubbles;
}

/**
 * Kisan Mitra 2.0 chat sheet (phase-01 WS-04): message list, send, typing
 * state, and the persistent expert-handoff thread (history-backed so the
 * thread is visible on return). All strings via t(); no alert().
 */
export default function KisanMitraSheet({ open, onClose }: KisanMitraSheetProps) {
  const t = useT();
  const language = useOnboardingStore((s) => s.language);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [tickets, setTickets] = useState<ExpertTicket[]>([]);
  const sessionRef = useRef<string | undefined>(undefined);
  const listRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(() => {
    getHistory()
      .then((res) => {
        const records = res.data ?? [];
        setBubbles(toBubbles(records));
        const last = records[records.length - 1];
        if (last?.sessionId) sessionRef.current = last.sessionId;
      })
      .catch(() => toast(t('kmHistoryFailed'), { error: true }));
    listHandoffs()
      .then((res) => setTickets(res.data ?? []))
      .catch(() => setTickets([]));
  }, [t]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [bubbles, sending]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    const localKey = `local-${Date.now()}`;
    setBubbles((prev) => [...prev, { key: localKey, sender: 'user', text }]);
    try {
      const reply = await sendMessage(text, sessionRef.current, language);
      sessionRef.current = reply.sessionId;
      setBubbles((prev) => [...prev, { key: reply.id, sender: 'bot', text: reply.text }]);
      if (reply.richCardType === 'expert_handoff') {
        listHandoffs()
          .then((res) => setTickets(res.data ?? []))
          .catch(() => setTickets([]));
      }
    } catch {
      toast(t('kmSendFailed'), { error: true });
    } finally {
      setSending(false);
    }
  };

  const handoff = async () => {
    const lastUser = [...bubbles].reverse().find((bubble) => bubble.sender === 'user');
    try {
      await requestHandoff({
        query: lastUser?.text || input.trim() || t('kmFab'),
        sessionId: sessionRef.current,
        urgency: 'medium',
      });
      toast(t('kmHandoffRequested'));
      const res = await listHandoffs();
      setTickets(res.data ?? []);
    } catch {
      toast(t('kmHandoffFailed'), { error: true });
    }
  };

  const activeTicket = tickets[0];

  return (
    <ModalSheet open={open} onClose={onClose} title={t('kmTitle')}>
      {activeTicket ? (
        <div className="km-thread">
          <span className="km-thread-icon">🧑‍🌾</span>
          <div>
            <div className="km-thread-title">{t('kmHandoffThreadTitle')}</div>
            <div className="km-thread-meta">
              {t('kmHandoffStatus', { status: activeTicket.status })} ·{' '}
              {t('kmHandoffDesk', { desk: activeTicket.assignedDesk })}
            </div>
          </div>
        </div>
      ) : null}

      <div className="km-list" ref={listRef}>
        {bubbles.length === 0 && !sending ? (
          <p className="km-empty">{t('kmEmpty')}</p>
        ) : (
          bubbles.map((bubble) => (
            <div key={bubble.key} className={`km-bubble ${bubble.sender}`}>
              {bubble.text}
            </div>
          ))
        )}
        {sending ? <div className="km-bubble bot km-typing">{t('kmTyping')}</div> : null}
      </div>

      <div className="km-input-row">
        <input
          className="av-input km-input"
          value={input}
          placeholder={t('kmInputPlaceholder')}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void send();
          }}
        />
        <button
          type="button"
          className="av-btn av-btn-primary km-send"
          disabled={sending || !input.trim()}
          onClick={() => void send()}
        >
          {t('kmSend')}
        </button>
      </div>

      <button type="button" className="av-btn av-btn-ghost km-handoff" onClick={() => void handoff()}>
        👩‍🔬 {t('kmHandoffOffer')}
      </button>
    </ModalSheet>
  );
}
