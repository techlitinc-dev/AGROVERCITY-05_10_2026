import React, { useEffect, useRef, useState } from 'react';
import { Bot, Send, X, Sparkles, User, Paperclip, AlertCircle, Mic } from 'lucide-react';
import { apiErrorMessage, chatbot, uploads } from '../../lib/api';
import { cn } from '../../lib/utils';

interface ChatMsg {
  sender: 'ai' | 'user';
  text: string;
  time: string;
  /** SR 18 — attached farm photo URL (rendered as an image bubble). */
  imageUrl?: string;
}

/** Minimal Web Speech API shape — the dom lib ships result types but not the ctor. */
interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResult>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const rec = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

/** First present string among candidates — backend field names vary per endpoint. */
const pickStr = (record: Record<string, unknown>, ...keys: string[]): string => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value) return value;
    if (typeof value === 'number') return String(value);
  }
  return '';
};

/** POST /chatbot/messages returns ChatMessageOut — tolerate reply-field variants. */
const extractReply = (payload: unknown): string =>
  pickStr(rec(payload), 'reply', 'text', 'message', 'answer', 'content', 'response') ||
  'I could not generate a recommendation for that. Please rephrase or hand off to a human expert.';

/** Signed https / blob / data URLs render; bare storage paths show an attachment chip. */
const ChatImage: React.FC<{ url: string }> = ({ url }) => {
  if (/^(https?:|blob:|data:)/.test(url)) {
    return (
      <img
        src={url}
        alt="Attached farm photo"
        className="mb-2 max-h-36 rounded-xl border border-slate-200 object-cover"
      />
    );
  }
  return (
    <span className="inline-flex items-center gap-1 mb-2 px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[10px] font-bold">
      <Paperclip className="w-3 h-3" /> Photo attached
    </span>
  );
};

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const GREETING: ChatMsg = {
  sender: 'ai',
  text: 'Namaste Ramesh ji! 🙏 I am your Agrovercity AI Agronomist (Kisan Mitra). Ask me anything about crop diseases, mandi price forecasts, fertilizer schedules, or government subsidies!',
  time: 'Just now',
};

export const AiChatbotDrawer: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([GREETING]);
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<{ url: string; preview: string } | null>(null);
  const [attachBusy, setAttachBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const historyLoaded = useRef(false);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  // SR 22 — Web Speech API voice input; hidden when the browser lacks support.
  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean((window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition ||
      (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const interimRef = useRef('');

  useEffect(
    () => () => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // mic cleanup must never throw
      }
    },
    []
  );

  const quickPrompts = [
    'How to control Soybean Pod Borer naturally?',
    'Expected price trend for Wheat next month?',
    'Fertilizer dosage for 1 acre wheat at sowing?',
    'Documents needed for PMFBY insurance claim?',
  ];

  // Load real chat history once on first open (backend pairs query+reply per doc).
  useEffect(() => {
    if (!isOpen || historyLoaded.current) return;
    historyLoaded.current = true;
    chatbot
      .history({ limit: 50 })
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        const history: ChatMsg[] = list.flatMap((row) => {
          const r = rec(row);
          const image = pickStr(r, 'imageUrl', 'photoUrl') || undefined;
          const time = pickStr(r, 'timestamp', 'createdAt', 'time') || now();
          const pair: ChatMsg[] = [];
          const query = pickStr(r, 'userQuery', 'text', 'message', 'body');
          if (query) pair.push({ sender: 'user', text: query, time, imageUrl: image });
          const reply = pickStr(r, 'botResponse', 'reply', 'answer', 'response');
          if (reply) pair.push({ sender: 'ai', text: reply, time });
          return pair;
        });
        if (history.length > 0) setMessages([GREETING, ...history.slice(-30)]);
      })
      .catch(() => undefined); // history is a read — silent skip on failure
  }, [isOpen]);

  const handleAttachImage = async (file: File | undefined) => {
    if (!file) return;
    setAttachBusy(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'chatbot', purpose: 'chatbot-photo' })) as
        | Array<{ url?: string; storagePath?: string }>
        | { url?: string; storagePath?: string }
        | undefined;
      const first = Array.isArray(uploaded) ? uploaded[0] : uploaded;
      const url = first?.url ?? first?.storagePath ?? '';
      if (!url) throw new Error('Upload succeeded but no URL was returned.');
      if (pendingImage) URL.revokeObjectURL(pendingImage.preview);
      setPendingImage({ url, preview: URL.createObjectURL(file) });
    } catch (err) {
      setError(`Photo upload failed: ${apiErrorMessage(err)}`);
    } finally {
      setAttachBusy(false);
      if (attachInputRef.current) attachInputRef.current.value = '';
    }
  };

  const toggleListening = () => {
    try {
      if (listening) {
        recognitionRef.current?.stop();
        return;
      }
      const w = window as unknown as {
        webkitSpeechRecognition?: new () => SpeechRecognitionLike;
        SpeechRecognition?: new () => SpeechRecognitionLike;
      };
      const Ctor = w.webkitSpeechRecognition || w.SpeechRecognition;
      if (!Ctor) return;
      const recognition = new Ctor();
      recognition.lang = 'hi-IN';
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.onresult = (event) => {
        let interim = '';
        let finalText = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0]?.transcript ?? '';
          if (event.results[i].isFinal) finalText += transcript;
          else interim += transcript;
        }
        if (finalText) {
          setInput((prev) => `${prev.replace(interimRef.current, '')}${finalText}`.trimStart());
          interimRef.current = '';
        } else {
          setInput((prev) => prev.replace(interimRef.current, '') + interim);
          interimRef.current = interim;
        }
      };
      recognition.onend = () => {
        setListening(false);
        interimRef.current = '';
      };
      recognition.onerror = () => {
        setListening(false);
        interimRef.current = '';
      };
      recognitionRef.current = recognition;
      interimRef.current = '';
      setListening(true);
      recognition.start();
    } catch {
      setListening(false);
      setError('Voice input is not available on this device/browser — please type instead.');
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    const image = pendingImage;
    if ((!query && !image) || isTyping) return;

    const userMsg: ChatMsg = {
      sender: 'user',
      text: query || '(Photo attached)',
      time: now(),
      imageUrl: image?.preview,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setPendingImage(null);
    setIsTyping(true);
    setError(null);
    try {
      const res = await chatbot.sendMessage(query || 'Photo attached — please analyse.', {
        ...(image ? { imageUrl: image.url } : {}),
      });
      setMessages((prev) => [...prev, { sender: 'ai', text: extractReply(res), time: now() }]);
    } catch (err) {
      const message = apiErrorMessage(err);
      setError(message);
      setMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: `⚠️ ${message} — please retry, or ask via the AI Agronomist page for expert handoff.`,
          time: now(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
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
                onClick={() => void handleSend(p)}
                className="whitespace-nowrap px-2.5 py-1 text-[11px] font-medium bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 text-slate-700 rounded-full transition-colors flex-shrink-0"
              >
                {p}
              </button>
            ))}
          </div>

          {/* Messages Stream */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
            {error && (
              <div className="flex items-center gap-2 text-[11px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {error}
              </div>
            )}
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
                  {m.imageUrl && <ChatImage url={m.imageUrl} />}
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
              void handleSend();
            }}
            className="p-3 bg-white border-t border-slate-200 space-y-2"
          >
            {pendingImage && (
              <div className="flex items-center gap-2">
                <img
                  src={pendingImage.preview}
                  alt="Photo to attach"
                  className="h-12 w-12 rounded-xl border border-slate-200 object-cover"
                />
                <span className="text-[10px] text-slate-500 font-semibold flex-1 truncate">
                  Photo ready — sent with your next message.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(pendingImage.preview);
                    setPendingImage(null);
                  }}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="Remove photo"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={attachInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => void handleAttachImage(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                disabled={attachBusy || isTyping}
                className="p-2.5 rounded-xl border border-slate-300 text-slate-500 hover:text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50 disabled:opacity-40 transition-all flex items-center justify-center"
                title={attachBusy ? 'Uploading photo…' : 'Attach a crop / pest photo'}
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="text"
                placeholder="Ask anything in English or Hindi..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 px-4 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20"
              />
              {speechSupported && (
                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={attachBusy || isTyping}
                  className={cn(
                    'p-2.5 rounded-xl border transition-all flex items-center justify-center disabled:opacity-40',
                    listening
                      ? 'border-rose-500 bg-rose-50 text-rose-600 animate-pulse'
                      : 'border-slate-300 text-slate-500 hover:text-emerald-700 hover:border-emerald-500 hover:bg-emerald-50'
                  )}
                  title={listening ? 'Stop listening' : 'Speak your question'}
                >
                  <Mic className="w-4 h-4" />
                </button>
              )}
              <button
                type="submit"
                disabled={(!input.trim() && !pendingImage) || isTyping}
                className="p-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-40 text-white rounded-xl shadow-md transition-all flex items-center justify-center"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
};
