import React, { useEffect, useRef, useState } from 'react';
import { MessageCircle, Send, Users } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { chat } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { cn, formatDateTime } from '../../lib/utils';
import { asRecords, pickStr } from './records';

interface Room {
  id: string;
  name: string;
  subtitle: string;
}

interface Msg {
  id: string;
  mine: boolean;
  sender: string;
  text: string;
  time: string;
}

export const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load rooms; honor the ?room= query param as the initial selection.
  useEffect(() => {
    let alive = true;
    chat
      .rooms()
      .then((rows) => {
        if (!alive) return;
        const list = asRecords(rows).map((r): Room => {
          const id = pickStr(r, 'id', 'roomId');
          return {
            id,
            name:
              pickStr(r, 'name', 'title') ||
              pickStr(r, 'otherPartyName', 'peerName') ||
              `Room ${id.slice(0, 6)}`,
            subtitle: pickStr(r, 'lastMessage', 'subtitle', 'context') || 'Chat room',
          };
        });
        setRooms(list);
        const fromQuery = searchParams.get('room');
        if (fromQuery && list.some((r) => r.id === fromQuery)) {
          setActiveRoom(fromQuery);
        } else if (list.length > 0) {
          setActiveRoom(list[0].id);
        }
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load messages for the active room.
  useEffect(() => {
    if (!activeRoom) return;
    let alive = true;
    chat
      .messages(activeRoom)
      .then((rows) => {
        if (!alive) return;
        setMessages(
          asRecords(rows).map((m): Msg => {
            const senderId = pickStr(m, 'senderId');
            return {
              id: pickStr(m, 'id') || `${senderId}-${pickStr(m, 'timestamp', 'createdAt')}`,
              mine: !!user && senderId === user.id,
              sender: pickStr(m, 'senderName', 'sender') || 'Member',
              text: pickStr(m, 'text', 'body', 'message'),
              time: pickStr(m, 'timestamp', 'createdAt'),
            };
          })
        );
      })
      .catch(() => setMessages([]));
    chat.markRead(activeRoom).catch(() => undefined);
    setSearchParams((prev) => {
      prev.set('room', activeRoom);
      return prev;
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || !activeRoom || sending) return;
    setSending(true);
    try {
      await chat.send(activeRoom, text);
      setInput('');
      const rows = await chat.messages(activeRoom).catch(() => []);
      setMessages(
        asRecords(rows).map((m): Msg => {
          const senderId = pickStr(m, 'senderId');
          return {
            id: pickStr(m, 'id') || `${senderId}-${pickStr(m, 'timestamp', 'createdAt')}`,
            mine: !!user && senderId === user.id,
            sender: pickStr(m, 'senderName', 'sender') || 'Member',
            text: pickStr(m, 'text', 'body', 'message'),
            time: pickStr(m, 'timestamp', 'createdAt'),
          };
        })
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="border-b border-slate-200 pb-4">
        <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
          <MessageCircle className="w-7 h-7 text-emerald-600" />
          Chats
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Trade, transport, and deal conversations across all your personas
        </p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col sm:flex-row" style={{ height: '600px' }}>
        {/* Room list */}
        <div className="sm:w-72 border-b sm:border-b-0 sm:border-r border-slate-100 overflow-y-auto flex-shrink-0">
          {rooms.length === 0 ? (
            <div className="p-6 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                No chat rooms yet — rooms open automatically when a trade, booking, or deal starts.
              </p>
            </div>
          ) : (
            rooms.map((r) => (
              <button
                key={r.id}
                onClick={() => setActiveRoom(r.id)}
                className={cn(
                  'w-full px-4 py-3 text-left border-l-4 transition-colors',
                  activeRoom === r.id
                    ? 'border-emerald-600 bg-emerald-50/60'
                    : 'border-transparent hover:bg-slate-50'
                )}
              >
                <p className="text-xs font-bold text-slate-900 truncate">{r.name}</p>
                <p className="text-[11px] text-slate-400 truncate">{r.subtitle}</p>
              </button>
            ))
          )}
        </div>

        {/* Thread */}
        <div className="flex-1 flex flex-col min-w-0">
          {!activeRoom ? (
            <div className="flex-1 flex items-center justify-center p-6">
              <p className="text-xs text-slate-400">Select a conversation to start messaging.</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40">
                {messages.length === 0 && (
                  <p className="text-center text-xs text-slate-400 pt-8">
                    No messages yet — say namaste and start the conversation.
                  </p>
                )}
                {messages.map((m) => (
                  <div key={m.id} className={cn('flex', m.mine ? 'justify-end' : 'justify-start')}>
                    <div
                      className={cn(
                        'max-w-[75%] px-3 py-2 rounded-2xl text-xs leading-relaxed shadow-xs',
                        m.mine
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : 'bg-white text-slate-800 border border-slate-200/80 rounded-tl-none'
                      )}
                    >
                      {!m.mine && <p className="text-[10px] font-bold text-emerald-700 mb-0.5">{m.sender}</p>}
                      <p>{m.text}</p>
                      <span
                        className={cn(
                          'block text-[9px] mt-1 text-right',
                          m.mine ? 'text-emerald-100' : 'text-slate-400'
                        )}
                      >
                        {formatDateTime(m.time) || ''}
                      </span>
                    </div>
                  </div>
                ))}
                <div ref={bottomRef} />
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="p-3 border-t border-slate-100 flex items-center gap-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message…"
                  className="flex-1 px-3 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-emerald-600"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || sending}
                  className="p-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white rounded-xl shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
