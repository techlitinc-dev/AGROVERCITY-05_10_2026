import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../../components/trade/EmptyState';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import {
  askSupport,
  getTicketMessages,
  listFaq,
  listTickets,
  postTicketMessage,
  searchFaq,
  type FaqArticle,
  type SupportAnswer,
  type SupportTicket,
  type TicketMessage,
} from '../../lib/api/support';
import { useT } from '../../lib/i18n';
import { useOnboardingStore } from '../../stores/onboarding';
import '../../theme/trade.css';

/**
 * Help center (WS-05 F20 + M30): FAQ browse/search, an AI ask box that cites
 * its sources, and expert_tickets as in-app support threads.
 */
export default function HelpCenterPage() {
  const t = useT();
  const lang = useOnboardingStore((s) => s.language) || 'en';

  const [faq, setFaq] = useState<FaqArticle[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<SupportAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const loadFaq = useCallback(
    (q: string) => {
      (q ? searchFaq(lang, q) : listFaq(lang)).then(setFaq).catch(() => setFailed(true));
    },
    [lang]
  );

  useEffect(() => {
    loadFaq('');
  }, [loadFaq]);

  useEffect(() => {
    listTickets()
      .then(setTickets)
      .catch(() => undefined);
  }, []);

  const openTicket = useCallback((id: string) => {
    setActiveTicket(id);
    getTicketMessages(id)
      .then(setMessages)
      .catch(() => undefined);
  }, []);

  const sendReply = async () => {
    if (!activeTicket || !reply.trim()) return;
    try {
      await postTicketMessage(activeTicket, reply.trim());
      setReply('');
      openTicket(activeTicket);
    } catch {
      toast(t('actionFailed'), { error: true });
    }
  };

  const ask = async () => {
    if (!question.trim()) return;
    setBusy(true);
    try {
      setAnswer(await askSupport(question.trim(), lang));
    } catch {
      toast(t('actionFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell toolId="helpSupport" backTo="/dashboard">
      <h2 className="trade-card-title">{t('support.title')}</h2>

      <div className="trade-card" style={{ cursor: 'default' }}>
        <input
          className="av-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t('support.askPlaceholder')}
        />
        <button type="button" className="av-btn av-btn-primary" disabled={busy} onClick={() => void ask()}>
          {busy ? <span className="av-spinner" aria-hidden /> : t('support.send')}
        </button>
        {answer ? (
          answer.kind === 'answer' && answer.sources.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <p className="trade-card-sub">{answer.answer}</p>
              <p className="trade-card-sub">
                {t('support.sources')}: {answer.sources.join(', ')}
              </p>
            </div>
          ) : (
            // Defensive: no cited source → treat as escalation, never render bare.
            <p className="trade-card-sub" style={{ marginTop: 8 }}>
              {t('support.ticketCreated')}
            </p>
          )
        ) : null}
      </div>

      <h3 className="trade-section-title">{t('support.faq')}</h3>
      <input
        className="av-input"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          loadFaq(e.target.value);
        }}
        placeholder={t('support.search')}
      />
      {failed ? <EmptyState icon="📡" titleKey="tradeLoadFailed" /> : null}
      <div className="trade-list">
        {faq.map((article) => (
          <div
            key={article.id}
            className="trade-card"
            role="button"
            tabIndex={0}
            onClick={() => setExpanded(expanded === article.id ? null : article.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setExpanded(expanded === article.id ? null : article.id);
            }}
          >
            <div className="trade-card-title">{article.title}</div>
            {expanded === article.id ? (
              <p className="trade-card-sub">{article.body}</p>
            ) : null}
          </div>
        ))}
      </div>

      <h3 className="trade-section-title">{t('support.threads')}</h3>
      <div className="trade-list">
        {tickets.map((ticket) => (
          <div
            key={ticket.id}
            className="trade-card"
            role="button"
            tabIndex={0}
            onClick={() => openTicket(ticket.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') openTicket(ticket.id);
            }}
          >
            <div className="trade-card-row">
              <span className="trade-card-title">{ticket.query}</span>
              <span className="trade-pill">{ticket.status}</span>
            </div>
          </div>
        ))}
      </div>

      {activeTicket ? (
        <div className="trade-card" style={{ cursor: 'default' }}>
          {messages.map((message) => (
            <p key={message.id} className="trade-card-sub">
              <strong>{message.authorRole}</strong>: {message.text}
            </p>
          ))}
          <input
            className="av-input"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={t('support.send')}
          />
          <button type="button" className="av-btn av-btn-ghost" onClick={() => void sendReply()}>
            {t('support.send')}
          </button>
        </div>
      ) : null}
    </ToolShell>
  );
}
