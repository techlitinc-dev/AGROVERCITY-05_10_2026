import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, User, Headset, Stethoscope, AlertCircle, CheckCircle2 } from 'lucide-react';
import { apiErrorMessage, chatbot } from '../../lib/api';
import { cn } from '../../lib/utils';
import { asRecord, asRecords, pickStr, str } from '../shared/records';

interface ChatMsg {
  sender: 'ai' | 'user';
  text: string;
  time: string;
}

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const GREETING: ChatMsg = {
  sender: 'ai',
  text: 'Namaste! 🙏 I am your dedicated AI Agronomist & ICAR Farming Assistant. Ask me anything about crop nutrition, soil pest diagnosis, mandi price projections, or PM-KISAN schemes in Hindi or English!',
  time: now(),
};

const SAMPLE_QUESTIONS = [
  'What is the recommended seed rate for Lokwan wheat per acre?',
  'How to cure yellow mosaic virus in soybean?',
  'Best organic remedy for whitefly infestation in cotton?',
  'How do I test my soil N-P-K levels at home?',
];

/** POST /chatbot/messages returns ChatMessageOut {id, role, text, ...} — tolerate variants. */
function extractReply(payload: unknown): string {
  const rec = asRecord(payload);
  return (
    pickStr(rec, 'reply', 'text', 'message', 'answer', 'content', 'response') ||
    'I could not generate a recommendation for that. Please rephrase or hand off to a human expert.'
  );
}

export const AiAgronomistView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [experts, setExperts] = useState<Record<string, unknown>[]>([]);
  const [expertsOpen, setExpertsOpen] = useState(false);
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [category, setCategory] = useState('crop-advisory');
  const [urgency, setUrgency] = useState('normal');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load chatbot history on mount (newest last, matching the backend sort).
  useEffect(() => {
    let alive = true;
    chatbot
      .history({ limit: 50 })
      .then((rows) => {
        if (!alive) return;
        const history = asRecords(rows)
          .map((r) => ({
            sender: (pickStr(r, 'role', 'sender') === 'user' ? 'user' : 'ai') as 'ai' | 'user',
            text: pickStr(r, 'text', 'message', 'body') || str(r),
            time: pickStr(r, 'timestamp', 'createdAt', 'time') || now(),
          }))
          .filter((m) => m.text);
        if (history.length > 0) {
          setMessages([GREETING, ...history.slice(-30)]);
        }
      })
      .catch(() => undefined); // history is a read — dev mock fallback or silent skip
    return () => {
      alive = false;
    };
  }, []);

  // Keep the thread pinned to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, isTyping]);

  const loadExperts = async () => {
    setExpertsOpen((o) => !o);
    if (experts.length > 0) return;
    try {
      const rows = await chatbot.experts();
      setExperts(asRecords(rows));
    } catch {
      // experts panel is optional — leave empty
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isTyping) return;

    setMessages((prev) => [...prev, { sender: 'user', text: query, time: now() }]);
    setInput('');
    setIsTyping(true);
    setNotice(null);
    try {
      const res = await chatbot.sendMessage(query);
      setMessages((prev) => [...prev, { sender: 'ai', text: extractReply(res), time: now() }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ ${apiErrorMessage(err)} — you can retry, or hand this question off to a human agronomist below.`,
          time: now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleHandoff = async () => {
    const query = [...messages].reverse().find((m) => m.sender === 'user')?.text;
    if (!query || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await chatbot.expertHandoff({ query, category, urgency, notes });
      const rec = asRecord(res);
      setNotice({
        kind: 'ok',
        text: `Expert ticket ${pickStr(rec, 'ticketId', 'id') || 'created'} raised (${pickStr(rec, 'status') || 'open'}). Estimated wait: ${pickStr(rec, 'estimatedWaitMinutes') || '15'} min. Track it under Support → My Expert Tickets.`,
      });
      setHandoffOpen(false);
      setNotes('');
    } catch (err) {
      setNotice({ kind: 'err', text: apiErrorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Bot className="w-7 h-7 text-emerald-600" />
            AI Agronomist & Farming Intelligence (Kisan Mitra)
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            24×7 crop advisory, disease diagnostics, and ICAR agronomist recommendations
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => void loadExperts()}
            className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5 transition-colors"
            title="View available agronomist experts"
          >
            <Stethoscope className="w-4 h-4 text-emerald-600" /> Experts
          </button>
          <button
            onClick={() => setHandoffOpen(true)}
            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs transition-colors"
            title="Hand this conversation to a human expert"
          >
            <Headset className="w-4 h-4" /> Ask Expert
          </button>
        </div>
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

      {expertsOpen && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-5 space-y-3">
          <h3 className="font-bold text-sm text-slate-900">Available Agronomist Experts</h3>
          {experts.length === 0 ? (
            <p className="text-xs text-slate-400">
              No live expert directory right now — use "Ask Expert" to raise a ticket.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {experts.map((e, i) => (
                <div
                  key={pickStr(e, 'id') || i}
                  className="p-3 rounded-2xl border border-slate-100 bg-slate-50/60 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      {pickStr(e, 'name', 'fullName', 'title') || 'Agronomist'}
                    </p>
                    <p className="text-[11px] text-slate-500">
                      {pickStr(e, 'specialization', 'speciality', 'role') || 'Crop advisory'} ·{' '}
                      {pickStr(e, 'languages', 'language') || 'hi / en'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 capitalize">
                    {pickStr(e, 'status', 'availability') || 'online'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs h-[600px] flex flex-col overflow-hidden">
        {/* Quick prompt bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80 overflow-x-auto flex gap-2 no-scrollbar">
          {SAMPLE_QUESTIONS.map((q, i) => (
            <button
              key={i}
              onClick={() => void handleSend(q)}
              className="whitespace-nowrap px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-full text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/40">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={cn(
                'flex gap-3 max-w-[85%]',
                m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
              )}
            >
              <div
                className={cn(
                  'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold mt-1',
                  m.sender === 'user' ? 'bg-slate-800 text-white' : 'bg-emerald-600 text-white shadow-sm'
                )}
              >
                {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div
                className={cn(
                  'p-4 rounded-2xl text-xs leading-relaxed shadow-xs whitespace-pre-line',
                  m.sender === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                )}
              >
                <p>{m.text}</p>
                <span
                  className={cn(
                    'block text-[10px] mt-2 text-right',
                    m.sender === 'user' ? 'text-emerald-100' : 'text-slate-400'
                  )}
                >
                  {m.time}
                </span>
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center gap-2 text-slate-400 text-xs italic p-2">
              <Bot className="w-4 h-4 text-emerald-600 animate-spin" />
              Agronomist is generating tailored recommendations...
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="p-4 bg-white border-t border-slate-200 flex items-center gap-3"
        >
          <input
            type="text"
            placeholder="Type your question in Hindi, English, or Marathi..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 px-4 py-3 text-xs rounded-2xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="p-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 text-white rounded-2xl shadow-md transition-all flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* Expert handoff sheet */}
      {handoffOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setHandoffOpen(false)} />
          <div className="relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200/80 max-h-[90vh] overflow-hidden flex flex-col z-10">
            <div className="px-6 pt-4 pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Hand off to a Human Expert</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Your last question is sent to the agronomist desk along with the details below.
              </p>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white"
                  >
                    <option value="crop-advisory">Crop Advisory</option>
                    <option value="pest-disease">Pest / Disease</option>
                    <option value="soil-health">Soil Health</option>
                    <option value="mandi-prices">Mandi / Prices</option>
                    <option value="scheme">Government Scheme</option>
                    <option value="livestock">Livestock</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Urgency</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 bg-white"
                  >
                    <option value="low">Low — within a day</option>
                    <option value="normal">Normal — within a few hours</option>
                    <option value="high">High — crop loss risk</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Notes for the expert (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Yellowing seen on 2-acre soybean plot near Niphad after recent rainfall..."
                  className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={() => setHandoffOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleHandoff()}
                  disabled={busy}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold shadow-xs"
                >
                  {busy ? 'Raising ticket…' : 'Raise Expert Ticket'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
