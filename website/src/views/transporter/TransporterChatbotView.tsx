import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bot, Camera, Mic, MicOff, RefreshCw, Send, User, X } from 'lucide-react';
import { chatbot, uploads, apiErrorMessage } from '../../lib/api';
import { cn, formatDateTime } from '../../lib/utils';
import { asArr, asRec, firstStr, str, type Rec } from './utils';

interface Turn {
  id: string;
  who: 'user' | 'bot';
  text: string;
  time: string;
}

/** SpeechRecognition is not in TS DOM lib — declare the bits we use. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const getSpeechRecognition = (): (new () => SpeechRecognitionLike) | null => {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as new () => SpeechRecognitionLike) ?? (w.webkitSpeechRecognition as new () => SpeechRecognitionLike) ?? null;
};

/** /transporter/chatbot — Kisan Mitra assistant for the transporter persona. */
export const TransporterChatbotView: React.FC = () => {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const speechSupported = typeof window !== 'undefined' && getSpeechRecognition() !== null;

  useEffect(() => {
    let alive = true;
    chatbot
      .history({ limit: 50 })
      .then((rows) => {
        if (!alive) return;
        const parsed = asArr(rows)
          .map(asRec)
          .flatMap((r): Turn[] => {
            const time = firstStr(r, ['timestamp', 'createdAt'], '');
            const out: Turn[] = [];
            const query = firstStr(r, ['userQuery', 'text', 'message'], '');
            const reply = firstStr(r, ['botResponse'], '');
            if (query !== '—') out.push({ id: `${str(r.id)}-q`, who: 'user', text: query, time });
            if (reply !== '—') out.push({ id: `${str(r.id)}-a`, who: 'bot', text: reply, time });
            return out;
          });
        setTurns(parsed);
        if (parsed.length > 0) {
          // Carry the latest session forward for multi-turn context.
          const last = asArr(rows).map(asRec).pop();
          if (last) setSessionId(firstStr(last, ['sessionId'], '') || null);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns]);

  const send = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if ((!text && !pendingImage) || sending) return;
    setSending(true);
    setError(null);
    const userTurn: Turn = {
      id: `local-${Date.now()}`,
      who: 'user',
      text: text || '[photo]',
      time: new Date().toISOString(),
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput('');
    const image = pendingImage;
    setPendingImage(null);
    try {
      const res = asRec(
        await chatbot.sendMessage(text || 'photo attached', {
          ...(sessionId ? { sessionId } : {}),
          ...(image ? { imageUrl: image } : {}),
          language: 'hi',
          context: { persona: 'transporter' },
        })
      );
      const reply = firstStr(res, ['text'], '');
      setSessionId(firstStr(res, ['sessionId'], '') || sessionId);
      if (reply !== '—') {
        setTurns((prev) => [
          ...prev,
          {
            id: firstStr(res, ['id'], `bot-${Date.now()}`),
            who: 'bot',
            text: reply,
            time: firstStr(res, ['timestamp'], new Date().toISOString()),
          },
        ]);
      }
    } catch (e) {
      setTurns((prev) => prev.filter((t) => t.id !== userTurn.id));
      setError(apiErrorMessage(e));
    } finally {
      setSending(false);
    }
  };

  const attachImage = async (file: File | undefined) => {
    if (!file) return;
    setUploadBusy(true);
    setError(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'chatbot', purpose: 'chatbot-image' })) as {
        url?: string;
        fileUrl?: string;
      };
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (url) setPendingImage(url);
      else setError('Upload succeeded but no URL was returned.');
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setUploadBusy(false);
    }
  };

  const toggleMic = () => {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = 'hi-IN';
    rec.continuous = false;
    rec.interimResults = false;
    rec.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) setInput((prev) => `${prev} ${transcript}`.trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <Link to="/transporter" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3.5 h-3.5" /> Transporter Home
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Bot className="w-7 h-7 text-emerald-600" />
            Kisan Mitra — Transport Assistant
          </h1>
          <p className="text-xs text-slate-500 mt-1">Ask about fares, documentation, diesel prices, toll rules, and trip planning</p>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-xs font-bold text-rose-800 flex items-center justify-between gap-2">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-100 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col" style={{ height: '620px' }}>
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
          {turns.length === 0 && (
            <div className="text-center pt-10 space-y-2">
              <Bot className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-400">
                Namaste! Ask anything — e.g. "NH-48 pe toll kitna lagega?" or attach a photo of a document.
              </p>
            </div>
          )}
          {turns.map((t) => (
            <div key={t.id} className={cn('flex', t.who === 'user' ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed shadow-xs whitespace-pre-wrap',
                  t.who === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-none'
                    : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                )}
              >
                <p className={cn('flex items-center gap-1 mb-0.5', t.who === 'user' ? 'text-emerald-100' : 'text-emerald-700')}>
                  {t.who === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                  <span className="text-[10px] font-bold">{t.who === 'user' ? 'You' : 'Kisan Mitra'}</span>
                </p>
                <p>{t.text}</p>
                <span className={cn('block text-[9px] mt-1 text-right', t.who === 'user' ? 'text-emerald-100' : 'text-slate-400')}>
                  {formatDateTime(t.time) || ''}
                </span>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {pendingImage && (
          <div className="px-4 py-2 border-t border-slate-100 flex items-center gap-2 text-xs">
            <Camera className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-mono text-slate-600 truncate flex-1">{pendingImage.split('/').pop()}</span>
            <button onClick={() => setPendingImage(null)} className="p-1 text-slate-400 hover:text-rose-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
          className="p-3 border-t border-slate-100 flex items-center gap-2"
        >
          <input
            type="file"
            accept="image/*"
            disabled={uploadBusy}
            onChange={(e) => {
              void attachImage(e.target.files?.[0]);
              e.target.value = '';
            }}
            className="hidden"
            id="chatbot-image-input"
          />
          <label
            htmlFor="chatbot-image-input"
            title={uploadBusy ? 'Uploading…' : 'Attach a photo'}
            className={cn('p-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 cursor-pointer', uploadBusy && 'opacity-50')}
          >
            <Camera className="w-4 h-4" />
          </label>
          <button
            type="button"
            onClick={toggleMic}
            disabled={!speechSupported}
            title={speechSupported ? (listening ? 'Stop listening' : 'Speak (hi-IN)') : 'Voice input is not supported in this browser'}
            className={cn(
              'p-2.5 rounded-xl border',
              listening
                ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50',
              !speechSupported && 'opacity-40 cursor-not-allowed'
            )}
          >
            {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
          </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={listening ? 'Listening… bolo' : 'Type a message…'}
            className="flex-1 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
          />
          <button
            type="submit"
            disabled={(!input.trim() && !pendingImage) || sending}
            className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl shadow-xs"
          >
            {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
