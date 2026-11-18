import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, X } from 'lucide-react';
import { chat } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { asRecords, pickNum, pickStr } from '../../views/shared/records';

const POLL_MS = 30_000;
const AUTO_DISMISS_MS = 10_000;
const MAX_POPUPS = 3;

interface ChatAlert {
  roomId: string;
  name: string;
  text: string;
}

/**
 * Global chat-message popups — mounted once in AppShell so an incoming
 * message alerts the user on ANY persona dashboard. Polls /chat/rooms and
 * fires a popup only when a room's unread count increases between polls
 * (the first poll is a silent baseline, so login never blasts old threads).
 */
export const ChatAlerts: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [alerts, setAlerts] = useState<ChatAlert[]>([]);
  const lastCounts = useRef<Map<string, number>>(new Map());
  const baselineDone = useRef(false);

  const dismiss = (roomId: string) =>
    setAlerts((prev) => prev.filter((a) => a.roomId !== roomId));

  const poll = useCallback(async () => {
    try {
      const rows = asRecords(await chat.rooms());
      const openRoom = location.pathname === '/chat' ? new URLSearchParams(location.search).get('room') : null;
      const next = new Map<string, number>();
      const fresh: ChatAlert[] = [];
      for (const r of rows) {
        const roomId = pickStr(r, 'id', 'roomId');
        if (!roomId) continue;
        const unread = pickNum(r, 'unreadCount');
        next.set(roomId, unread);
        if (!baselineDone.current) continue; // first pass only records the baseline
        const prev = lastCounts.current.get(roomId) ?? 0;
        if (unread > prev && openRoom !== roomId) {
          fresh.push({
            roomId,
            name: pickStr(r, 'counterpartyName') || 'a member',
            text: pickStr(r, 'lastMessageText'),
          });
        }
      }
      lastCounts.current = next;
      baselineDone.current = true;
      if (fresh.length > 0) {
        setAlerts((prev) => [...fresh, ...prev].slice(0, MAX_POPUPS));
      }
    } catch {
      // Polling must never break the page — fail silently.
    }
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void poll();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onFocus = () => void poll();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [isAuthenticated, poll]);

  // Auto-dismiss the oldest popup on a rolling timer.
  useEffect(() => {
    if (alerts.length === 0) return;
    const timer = window.setTimeout(() => setAlerts((prev) => prev.slice(0, -1)), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [alerts]);

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-20 right-4 z-50 space-y-2 w-80 max-w-[calc(100vw-2rem)]">
      {alerts.map((a) => (
        <div
          key={a.roomId}
          className="bg-white rounded-2xl border border-slate-200 shadow-2xl p-3 flex items-start gap-3 animate-in slide-in-from-bottom"
        >
          <div className="p-2 rounded-xl bg-emerald-50 flex-shrink-0">
            <MessageCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-slate-900 truncate">
              New message from {a.name}
            </p>
            {a.text && <p className="text-[11px] text-slate-500 truncate mt-0.5">{a.text}</p>}
            <button
              onClick={() => {
                dismiss(a.roomId);
                navigate(`/chat?room=${a.roomId}`);
              }}
              className="text-[11px] font-bold text-emerald-700 mt-1 hover:underline"
            >
              View
            </button>
          </div>
          <button
            onClick={() => dismiss(a.roomId)}
            className="p-1 text-slate-400 hover:text-slate-600 flex-shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
