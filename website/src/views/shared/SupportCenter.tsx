import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LifeBuoy,
  ChevronDown,
  ChevronRight,
  Send,
  Headset,
  AlertCircle,
  CheckCircle2,
  MessageSquareText,
  Bot,
} from 'lucide-react';
import { apiErrorMessage, chatbot, support } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { cn, formatDateTime } from '../../lib/utils';
import { asRecord, asRecords, pickStr } from './records';

export const SupportCenter: React.FC = () => {
  const { user } = useAuthStore();
  const [faqs, setFaqs] = useState<Record<string, unknown>[]>([]);
  const [openFaq, setOpenFaq] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [tickets, setTickets] = useState<Record<string, unknown>[]>([]);
  const [activeTicket, setActiveTicket] = useState<string | null>(null);
  const [ticketMessages, setTicketMessages] = useState<Record<string, unknown>[]>([]);
  const [reply, setReply] = useState('');

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [f, t] = await Promise.all([
        support.faq().catch(() => []),
        chatbot.expertTickets().catch(() => []),
      ]);
      if (!alive) return;
      setFaqs(asRecords(f));
      setTickets(asRecords(t));
    };
    void load();
    return () => {
      alive = false;
    };
  }, []);

  const flash = (kind: 'ok' | 'err', text: string) => {
    setNotice({ kind, text });
    window.setTimeout(() => setNotice(null), 5000);
  };

  const handleAsk = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    try {
      await support.ask({
        subject: subject.trim() || undefined,
        question: question.trim(),
        category: 'general',
      });
      flash('ok', 'Question submitted — the support desk replies within 24 hours on your registered number.');
      setSubject('');
      setQuestion('');
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleHandoff = async () => {
    if (!question.trim() || busy) return;
    setBusy(true);
    try {
      const res = await chatbot.expertHandoff({
        query: question.trim(),
        category: 'general',
        urgency: 'normal',
        notes: subject.trim() || undefined,
      });
      const rec = asRecord(res);
      flash(
        'ok',
        `Expert ticket ${pickStr(rec, 'ticketId', 'id') || 'created'} raised. An agronomist will call you back — track it below.`
      );
      setSubject('');
      setQuestion('');
      const rows = await chatbot.expertTickets().catch(() => []);
      setTickets(asRecords(rows));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const openTicket = async (ticketId: string) => {
    setActiveTicket(ticketId);
    try {
      const rows = await chatbot.ticketMessages(ticketId);
      setTicketMessages(asRecords(rows));
    } catch {
      setTicketMessages([]);
    }
  };

  const sendReply = async () => {
    if (!activeTicket || !reply.trim() || busy) return;
    setBusy(true);
    try {
      await chatbot.postTicketMessage(activeTicket, { text: reply.trim() });
      setReply('');
      const rows = await chatbot.ticketMessages(activeTicket).catch(() => []);
      setTicketMessages(asRecords(rows));
    } catch (err) {
      flash('err', apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <LifeBuoy className="w-7 h-7 text-sky-600" />
          Help & Support Center
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          FAQs, support tickets, and direct handoff to human agronomists — in your language
        </p>
      </div>

      {notice && (
        <div
          className={cn(
            'rounded-2xl border p-3 text-xs flex items-start gap-2',
            notice.kind === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          )}
        >
          {notice.kind === 'ok' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Chatbot widget entry */}
      <Link
        to="/community/ai"
        className="flex items-center justify-between gap-4 p-4 rounded-3xl bg-gradient-to-r from-emerald-700 to-teal-800 text-white shadow-md hover:from-emerald-800 hover:to-teal-900 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-extrabold">Ask Kisan Mitra AI — instant answers, 24×7</p>
            <p className="text-[11px] text-emerald-200">
              Crop advisory, pest diagnosis, mandi prices and scheme guidance in your language
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 flex-shrink-0" />
      </Link>

      {/* FAQ */}
      <div className="space-y-2">
        <h3 className="font-bold text-sm text-slate-900">Frequently Asked Questions</h3>
        {faqs.length === 0 && (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
            FAQ articles load here once the knowledge base is seeded.
          </p>
        )}
        {faqs.slice(0, 12).map((f, i) => {
          const id = pickStr(f, 'id', 'faqId') || String(i);
          const open = openFaq === id;
          return (
            <div key={id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <button
                onClick={() => setOpenFaq(open ? null : id)}
                className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
              >
                <span className="text-xs font-bold text-slate-900">
                  {pickStr(f, 'question', 'title') || 'FAQ'}
                </span>
                <ChevronDown
                  className={cn('w-4 h-4 text-slate-400 transition-transform', open && 'rotate-180')}
                />
              </button>
              {open && (
                <div className="px-4 pb-3 text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                  {pickStr(f, 'answer', 'body', 'content')}
                  <p className="text-[10px] text-slate-400 mt-2 capitalize">
                    {pickStr(f, 'category', 'topic') || 'general'}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ask form */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <h3 className="font-bold text-sm text-slate-900">Ask a Question</h3>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (e.g. Payment not settled for soybean lot)"
          className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-sky-600"
        />
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={4}
          placeholder="Describe your issue in Hindi, English or Marathi…"
          className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-sky-600"
        />
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => void handleAsk()}
            disabled={!question.trim() || busy}
            className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Send className="w-3.5 h-3.5" /> Submit to Support Desk
          </button>
          <button
            onClick={() => void handleHandoff()}
            disabled={!question.trim() || busy}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Headset className="w-3.5 h-3.5" /> Hand off to Agronomist Expert
          </button>
        </div>
      </div>

      {/* My expert tickets */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900">My Expert Tickets</h3>
        {tickets.length === 0 ? (
          <p className="text-xs text-slate-400 bg-white rounded-3xl border border-slate-200/80 p-6 text-center">
            No expert tickets yet — use "Hand off to Agronomist Expert" above when the chatbot can't help.
          </p>
        ) : (
          <div className="space-y-2">
            {tickets.map((t, i) => {
              const id = pickStr(t, 'id', 'ticketId') || String(i);
              const open = activeTicket === id;
              return (
                <div key={id} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
                  <button
                    onClick={() => (open ? setActiveTicket(null) : void openTicket(id))}
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">
                        {pickStr(t, 'query', 'subject') || 'Expert ticket'}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {pickStr(t, 'category') || 'general'} ·{' '}
                        {formatDateTime(pickStr(t, 'createdAt')) || '—'} · assigned to{' '}
                        {pickStr(t, 'assignedDesk') || 'agronomist desk'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-[10px] font-bold px-2 py-0.5 rounded-full capitalize',
                        pickStr(t, 'status') === 'resolved'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      )}
                    >
                      {pickStr(t, 'status') || 'open'}
                    </span>
                  </button>
                  {open && (
                    <div className="px-4 pb-4 border-t border-slate-100 pt-3 space-y-3">
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {ticketMessages.length === 0 ? (
                          <p className="text-[11px] text-slate-400">No messages yet — the expert will reply here.</p>
                        ) : (
                          ticketMessages.map((m, j) => {
                            const mine = pickStr(m, 'senderRole', 'from') === 'farmer' ||
                              (user !== null && pickStr(m, 'senderId') === user.id);
                            return (
                              <div key={pickStr(m, 'id') || j} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
                                <div
                                  className={cn(
                                    'max-w-[80%] px-3 py-2 rounded-2xl text-xs leading-relaxed',
                                    mine
                                      ? 'bg-sky-600 text-white rounded-tr-none'
                                      : 'bg-slate-100 text-slate-800 rounded-tl-none'
                                  )}
                                >
                                  {pickStr(m, 'text', 'body', 'message')}
                                  <span className={cn('block text-[9px] mt-1 text-right', mine ? 'text-sky-100' : 'text-slate-400')}>
                                    {formatDateTime(pickStr(m, 'createdAt', 'timestamp')) || ''}
                                  </span>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={reply}
                          onChange={(e) => setReply(e.target.value)}
                          placeholder="Reply to the expert…"
                          className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-sky-600"
                        />
                        <button
                          onClick={() => void sendReply()}
                          disabled={!reply.trim() || busy}
                          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl"
                        >
                          <MessageSquareText className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
