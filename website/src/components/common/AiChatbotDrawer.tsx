import React, { useState } from 'react';
import { Bot, Send, X, Sparkles, User, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';

export const AiChatbotDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<
    { sender: 'ai' | 'user'; text: string; time: string }[]
  >([
    {
      sender: 'ai',
      text: 'Namaste Ramesh ji! 🙏 I am your Agrovercity AI Agronomist (Kisan Mitra). Ask me anything about crop diseases, mandi price forecasts, fertilizer schedules, or government subsidies!',
      time: 'Just now',
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);

  const quickPrompts = [
    'How to control Soybean Pod Borer naturally?',
    'Expected price trend for Wheat next month?',
    'Fertilizer dosage for 1 acre wheat at sowing?',
    'Documents needed for PMFBY insurance claim?',
  ];

  const handleSend = (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim()) return;

    const userMsg = {
      sender: 'user' as const,
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    // Smart simulated agronomist response generator
    setTimeout(() => {
      let reply = '';
      const q = query.toLowerCase();

      if (q.includes('soybean') || q.includes('borer') || q.includes('pest')) {
        reply =
          'For Soybean Pod Borer (Helicoverpa armigera):\n1. Spray 5% Neem Seed Kernel Extract (NSKE) or Neem Oil 10,000 PPM (2 ml/L).\n2. If infestation is above ETL (>2 larvae/meter row), spray Chlorantraniliprole 18.5% SC @ 60 ml/acre in 200L water.\n3. Install pheromone traps @ 5 traps/acre for adult monitoring.';
      } else if (q.includes('wheat') || q.includes('price') || q.includes('mandi')) {
        reply =
          'Wheat Market Intelligence (Nashik & MP APMCs):\nModal price currently ranges between ₹2,650 – ₹2,780/quintal against MSP of ₹2,275/q. Due to strong mill demand and reduced arrivals, prices are projected to remain firm near ₹2,850/q in the upcoming 3 weeks.';
      } else if (q.includes('fertilizer') || q.includes('dosage')) {
        reply =
          'Recommended Basal Dose for Wheat (per acre):\n• Urea: 30 kg\n• DAP: 50 kg (or NPK 12:32:16 @ 65 kg)\n• MOP (Potash): 20 kg\n• Zinc Sulphate (21%): 10 kg applied at final plowing.\nTop-dress remaining Urea (35 kg/acre) in two split doses at CRI (21 days) and late tillering (45 days) before irrigation.';
      } else if (q.includes('pmfby') || q.includes('insurance') || q.includes('claim')) {
        reply =
          'PMFBY Claim Filing Protocol:\n1. Intimate crop loss within 72 hours of calamity via the Agrovercity Insurance desk or toll-free 14447.\n2. Upload geo-tagged photos of field waterlogging/hail damage.\n3. Keep 7/12 land record, bank passbook, and sowing certificate ready for surveyor inspection.';
      } else {
        reply =
          'I have analyzed your query against our Indian ICAR agronomy database and satellite weather radar. Soil moisture in Nashik is currently optimal (68%). Ensure weed removal before top-dressing nitrogen for maximum nutrient efficiency.';
      }

      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: reply,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
      setIsTyping(false);
    }, 800);
  };

  return (
    <>
      {/* Floating Action Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-5 z-40 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white p-3.5 sm:px-5 sm:py-3.5 rounded-full shadow-xl hover:shadow-2xl flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 border-2 border-emerald-400/40"
        >
          <Bot className="w-6 h-6 animate-pulse" />
          <span className="hidden sm:inline font-bold text-sm tracking-wide">
            AI Agronomist (Kisan Mitra)
          </span>
          <span className="flex h-2.5 w-2.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-200 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-100"></span>
          </span>
        </button>
      )}

      {/* Slide-over Chat Box */}
      {isOpen && (
        <div className="fixed bottom-0 sm:bottom-6 right-0 sm:right-6 z-50 w-full sm:w-[420px] h-[90vh] sm:h-[620px] bg-white sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-700 to-teal-800 p-4 text-white flex items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                <Bot className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h4 className="font-bold text-sm flex items-center gap-1.5">
                  Kisan Mitra AI <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                </h4>
                <p className="text-[11px] text-emerald-100/80">
                  ICAR Certified Agronomy Intelligence
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-full hover:bg-white/10 text-white/80 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Prompts Chips */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-200/80 overflow-x-auto flex gap-1.5 no-scrollbar">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(p)}
                className="whitespace-nowrap px-2.5 py-1 text-[11px] font-medium bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-700 rounded-full transition-colors flex-shrink-0"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={cn(
                  'flex gap-2 max-w-[85%]',
                  m.sender === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                )}
              >
                <div
                  className={cn(
                    'w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 text-xs font-bold mt-1',
                    m.sender === 'user'
                      ? 'bg-slate-700 text-white'
                      : 'bg-emerald-600 text-white shadow-sm'
                  )}
                >
                  {m.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={cn(
                    'p-3 rounded-2xl text-xs leading-relaxed shadow-sm whitespace-pre-line',
                    m.sender === 'user'
                      ? 'bg-emerald-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                  )}
                >
                  <p>{m.text}</p>
                  <span
                    className={cn(
                      'block text-[9px] mt-1 text-right',
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
                Kisan Mitra is researching ICAR guidelines...
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
              placeholder="Ask anything in English or Hindi..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="p-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 text-white rounded-xl shadow-md transition-all flex items-center justify-center"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </>
  );
};
