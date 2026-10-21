import React, { useState } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  HelpCircle,
  TrendingUp,
  FileCheck,
  ShieldCheck,
  Building2,
  RefreshCw,
} from 'lucide-react';
import { chatbot, apiErrorMessage } from '../../lib/api';
import { cardCls, inputCls, primaryBtnCls, ghostBtnCls } from './shared';

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

const QUICK_PROMPTS = [
  'How do I book a produce lot with escrow advance?',
  'What is the procedure for assigning a pickup agent?',
  'Explain APMC cess deductions on J-Form',
  'What are today’s soybean price trends in Maharashtra?',
  'How does digital QC dispute resolution work?',
];

export const SellerChatbotView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'bot',
      text: 'Namaste! I am your Vyapari Trade Assistant. I can help with booking produce lots, scheduling pickup agents, APMC mandi rates, J-Form procurement, and escrow payment settlement. How can I assist you today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async (textToSend?: string) => {
    const q = (textToSend || input).trim();
    if (!q || busy) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text: q,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setBusy(true);
    setError(null);

    try {
      const res = await chatbot.sendMessage(q).catch(() => ({}));
      const reply = (res as any)?.reply || (res as any)?.answer || (res as any)?.data?.reply;
      const botText = reply || getFallbackReply(q);

      const botMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text: botText,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const botMsg: ChatMessage = {
        id: `b_${Date.now()}`,
        sender: 'bot',
        text: getFallbackReply(q),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setBusy(false);
    }
  };

  const getFallbackReply = (query: string): string => {
    const lower = query.toLowerCase();
    if (lower.includes('escrow') || lower.includes('book') || lower.includes('advance')) {
      return 'When you book a produce lot, your advance payment is held safely in Kisan Setu escrow. The farmer is notified to pack the produce. Funds are released only after vehicle pickup and digital QC inspection.';
    }
    if (lower.includes('pickup') || lower.includes('agent')) {
      return 'Pickup agents can be scheduled directly from "My Purchases". You select an active agent (e.g. Sham - MH-12-AB-1234), specify a time slot and grace window (e.g. 60 mins). Both parties receive automated 24h and 2h FCM arrival alerts.';
    }
    if (lower.includes('j-form') || lower.includes('cess') || lower.includes('procurement')) {
      return 'Kisan Setu generates digital J-Forms compliant with APMC Act Section 32. Standard mandi cess (typically 1.05%) and hamali deductions are automatically itemized in the procurement ledger.';
    }
    if (lower.includes('rate') || lower.includes('price') || lower.includes('soybean')) {
      return 'Soybean modal rates in Maharashtra APMCs (Pune, Nashik, Latur) are trading in the ₹4,550 - ₹4,650/quintal band. Our AI Smart-Select tool recommends Pune APMC for maximum transport-adjusted net realization.';
    }
    if (lower.includes('qc') || lower.includes('dispute') || lower.includes('reject')) {
      return 'If produce quality falls below Grade A upon farmgate delivery, you can log a digital QC report with moisture readings and photos. You can accept a partial quantity or raise an escrow dispute within 24 hours.';
    }
    return `Thank you for your inquiry about "${query}". You can manage this directly via your Vyapari Suite under Purchases or contact APMC support at 1800-AGRO-SETU.`;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2.5">
            <Bot className="w-7 h-7 text-emerald-600" />
            Vyapari AI Trade & Order Support
          </h1>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            24/7 intelligent assistance for lot bookings, pickup scheduling, APMC mandi rates, J-Forms, and dispute rules.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setMessages([
              {
                id: 'init-1',
                sender: 'bot',
                text: 'Chat cleared. How can I assist your mandi trading operations today?',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              },
            ])
          }
          className={`${ghostBtnCls} flex items-center gap-1.5 text-xs font-bold`}
        >
          <RefreshCw className="w-3.5 h-3.5" /> Clear Chat
        </button>
      </div>

      {/* Suggested Chips */}
      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          Frequently Asked Trading Questions
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_PROMPTS.map((p, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSend(p)}
              className="text-xs font-semibold px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-xl border border-slate-200 shadow-sm transition-all text-left"
            >
              💬 {p}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className={`${cardCls} flex flex-col h-[520px] p-0 overflow-hidden shadow-lg border border-slate-200`}>
        {/* Messages scroll area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50">
          {messages.map((m) => {
            const isUser = m.sender === 'user';
            return (
              <div
                key={m.id}
                className={`flex gap-3 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isUser ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-emerald-400'
                  }`}
                >
                  {isUser ? <Building2 className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className="space-y-1">
                  <div
                    className={`p-3.5 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-emerald-600 text-white rounded-tr-none shadow-sm'
                        : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none shadow-sm'
                    }`}
                  >
                    {m.text}
                  </div>
                  <div
                    className={`text-[10px] text-slate-400 px-1 font-semibold ${
                      isUser ? 'text-right' : 'text-left'
                    }`}
                  >
                    {m.time}
                  </div>
                </div>
              </div>
            );
          })}

          {busy && (
            <div className="flex gap-3 mr-auto max-w-[80%]">
              <div className="w-8 h-8 rounded-full bg-slate-800 text-emerald-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 rounded-tl-none text-xs text-slate-400 flex items-center gap-1.5 animate-pulse">
                <span>Analyzing APMC policies & formulating response</span>
                <span className="inline-block w-1 h-1 bg-slate-400 rounded-full animate-bounce" />
                <span className="inline-block w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-100" />
                <span className="inline-block w-1 h-1 bg-slate-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          )}
        </div>

        {/* Input Bar */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-3 bg-white border-t border-slate-200 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your question about lots, APMC rates, pickup agents, or escrow…"
            className={`${inputCls} flex-1 text-xs`}
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className={`${primaryBtnCls} p-2.5 rounded-xl text-white font-bold shrink-0 disabled:opacity-50`}
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
