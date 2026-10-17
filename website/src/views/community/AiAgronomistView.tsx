import React, { useState } from 'react';
import { Bot, Send, Sparkles, User, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export const AiAgronomistView: React.FC = () => {
  const [messages, setMessages] = useState<
    { sender: 'ai' | 'user'; text: string; time: string }[]
  >([
    {
      sender: 'ai',
      text: 'Namaste! 🙏 I am your dedicated AI Agronomist & ICAR Farming Assistant. Ask me anything about crop nutrition, soil pest diagnosis, mandi price projections, or PM-KISAN schemes in Hindi or English!',
      time: '10:00 AM',
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const sampleQuestions = [
    'What is the recommended seed rate for Lokwan wheat per acre?',
    'How to cure yellow mosaic virus in soybean?',
    'Best organic remedy for whitefly infestation in cotton?',
    'How do I test my soil N-P-K levels at home?',
  ];

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    setMessages((prev) => [
      ...prev,
      { sender: 'user', text: query, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
    ]);
    setInput('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = '';
      const q = query.toLowerCase();
      if (q.includes('seed rate') || q.includes('wheat')) {
        reply =
          'Recommended Wheat Seed Rate (Lokwan / Sharbati):\n• Normal sowing (November): 40–45 kg/acre.\n• Late sowing (December): 50–55 kg/acre.\n• Row-to-row spacing: 20–22.5 cm with depth 4–5 cm in moist soil.\nAlways treat seeds with Carbendazim (2g/kg) followed by Azotobacter (25g/kg).';
      } else if (q.includes('mosaic') || q.includes('yellow')) {
        reply =
          'Yellow Mosaic Virus (YMV) Management in Soybean:\n1. YMV is transmitted by Whiteflies (Bemisia tabaci). Controlling whiteflies early is vital.\n2. Rogue out and destroy initial infected plants.\n3. Install yellow sticky traps @ 10 traps/acre.\n4. Spray Acetamiprid 20% SP @ 50g/acre or Thiamethoxam 25% WG @ 40g/acre in 200L water.';
      } else {
        reply =
          'Based on ICAR Package of Practices and current agro-climatic conditions in Maharashtra:\nEnsure proper drainage in black cotton soil, maintain 1:3:1 NPK balance during vegetative growth, and avoid excessive urea top-dressing during humid periods to prevent fungal blight.';
      }

      setMessages((prev) => [
        ...prev,
        { sender: 'ai', text: reply, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
      ]);
      setIsTyping(false);
    }, 700);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <Bot className="w-7 h-7 text-emerald-600" />
          AI Agronomist & Farming Intelligence (Kisan Mitra)
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          24×7 crop advisory, disease diagnostics, and ICAR agronomist recommendations
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs h-[650px] flex flex-col overflow-hidden">
        {/* Quick prompt bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80 overflow-x-auto flex gap-2 no-scrollbar">
          {sampleQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              className="whitespace-nowrap px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-full text-slate-700 hover:border-emerald-500 hover:bg-emerald-50 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/40">
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
            handleSend();
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
            disabled={!input.trim()}
            className="p-3 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 text-white rounded-2xl shadow-md transition-all flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
