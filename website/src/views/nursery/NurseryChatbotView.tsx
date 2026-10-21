import React, { useState } from 'react';
import { Bot, Send, Sparkles, User, HelpCircle, Sprout } from 'lucide-react';
import { chatbot } from '../../lib/api';

const QUICK_SUGGESTIONS = [
  'How to prevent root rot & fungal wilting in polyhouse nursery beds?',
  'NHB (National Horticulture Board) nursery accreditation & subsidy norms',
  'Ideal potting mix ratio: cocopeat, vermicompost & red soil for saplings',
  'Packaging instructions for dispatching fruit grafts via courier safely',
  'Best season and rootstock for high-success Kesar Mango grafting',
];

interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  time: string;
}

export const NurseryChatbotView: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      sender: 'bot',
      text: 'नमस्ते! I am your AI Horticulture & Nursery Assistant. Ask me anything about plant propagation, grafting techniques, pest remedies, NHB subsidies, or order dispatch rules.',
      time: 'Just now',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendMessage = async (queryText: string) => {
    if (!queryText.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: queryText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await chatbot.sendMessage(queryText, { context: 'nursery' });
      const botResponse =
        (res as Record<string, unknown>)?.answer ||
        (res as Record<string, unknown>)?.reply ||
        'For healthy nursery saplings, ensure well-draining soil, apply Trichoderma viride bio-fungicide to root zone, and provide 50% shade netting during peak summer heat.';

      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'bot',
          text: String(botResponse),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'bot',
          text: 'Thank you for your inquiry. For specific nursery subsidies, please refer to NHB guidelines or consult your local Krishi Vigyan Kendra (KVK).',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
          <Bot className="w-6 h-6 text-emerald-700" />
          Nursery AI Assistant & Plant Care Desk
        </h1>
        <p className="text-xs text-slate-500">
          24/7 technical advice on sapling nutrition, grafting success, pest management, and horticulture subsidies.
        </p>
      </div>

      {/* Suggestion Chips */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
          Recommended Nursery Topics
        </span>
        <div className="flex flex-wrap gap-2">
          {QUICK_SUGGESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => sendMessage(q)}
              className="text-left px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-[11px] font-medium text-slate-700 transition"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Container */}
      <div className="rounded-3xl bg-white border border-slate-200 overflow-hidden shadow-sm flex flex-col h-[520px]">
        {/* Messages list */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4">
          {messages.map((m) => {
            const isBot = m.sender === 'bot';
            return (
              <div
                key={m.id}
                className={`flex items-start gap-3 ${isBot ? '' : 'flex-row-reverse'}`}
              >
                <div
                  className={`p-2 rounded-2xl shrink-0 ${
                    isBot ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-900 text-white'
                  }`}
                >
                  {isBot ? <Sprout className="w-4 h-4" /> : <User className="w-4 h-4" />}
                </div>

                <div
                  className={`p-4 rounded-2xl max-w-lg text-xs leading-relaxed space-y-1 ${
                    isBot
                      ? 'bg-slate-50 text-slate-800 border border-slate-100'
                      : 'bg-emerald-700 text-white'
                  }`}
                >
                  <p>{m.text}</p>
                  <span
                    className={`text-[9px] block ${
                      isBot ? 'text-slate-400' : 'text-emerald-200'
                    }`}
                  >
                    {m.time}
                  </span>
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold p-2">
              <Bot className="w-4 h-4 animate-spin text-emerald-700" />
              <span>Analyzing horticulture knowledge base…</span>
            </div>
          )}
        </div>

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-slate-50 border-t border-slate-100 flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about grafting, fungicides, NHB subsidies, irrigation, packing…"
            className="flex-1 px-4 py-2.5 rounded-2xl border border-slate-200 bg-white text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white transition disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
