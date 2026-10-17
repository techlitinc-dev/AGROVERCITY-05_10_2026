import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Plus, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { teachers, chat, apiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { ModalSheet } from '../../components/common/ModalSheet';
import { formatDateTime } from '../../lib/utils';
import { nameOf, recArr, strOf } from './helpers';

interface RoomRow {
  roomId: string;
  studentId: string;
  studentName: string;
  courseTitle: string;
  lastMessageAt?: string;
  unreadByInstructor?: boolean;
}

/**
 * Instructor doubt-solving chat — one stable 1:1 room per enrolled student
 * (teachers.chatRooms), messages via the shared chat namespace. Chat unlocks
 * only for students with a paid purchase (server-enforced).
 */
export const TeacherChatPage: React.FC = () => {
  const myId = useAuthStore((s) => s.user?.id) ?? '';
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeRoom, setActiveRoom] = useState<RoomRow | null>(null);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  const [openOpen, setOpenOpen] = useState(false);
  const [studentId, setStudentId] = useState('');
  const [openSaving, setOpenSaving] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  const reloadRooms = async () => {
    setError(null);
    try {
      const raw = recArr(await teachers.chatRooms());
      setRooms(
        raw.map((r) => ({
          roomId: strOf(r.roomId),
          studentId: strOf(r.studentId),
          studentName: strOf(r.studentName),
          courseTitle: strOf(r.courseTitle),
          lastMessageAt: strOf(r.lastMessageAt),
          unreadByInstructor: Boolean(r.unreadByInstructor),
        })),
      );
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reloadRooms();
  }, []);

  const loadMessages = async (room: RoomRow) => {
    setMessagesLoading(true);
    try {
      setMessages(recArr(await chat.messages(room.roomId)));
      await chat.markRead(room.roomId).catch(() => undefined);
    } catch (e) {
      setError(apiErrorMessage(e));
    } finally {
      setMessagesLoading(false);
    }
  };

  useEffect(() => {
    if (!activeRoom) return;
    loadMessages(activeRoom);
    const t = window.setInterval(() => {
      loadMessages(activeRoom);
      reloadRooms();
    }, 8000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.roomId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeRoom || !draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      await chat.send(activeRoom.roomId, draft.trim());
      setDraft('');
      await loadMessages(activeRoom);
      await reloadRooms();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const openChat = async (e: React.FormEvent) => {
    e.preventDefault();
    setOpenSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await teachers.openChat({ studentId: studentId.trim() });
      const roomId = strOf(res && (res as Record<string, unknown>).roomId);
      setOpenOpen(false);
      setStudentId('');
      setNotice('Chat room opened with the student.');
      await reloadRooms();
      if (roomId) {
        const row = rooms.find((r) => r.roomId === roomId) || {
          roomId,
          studentId: studentId.trim(),
          studentName: studentId.trim(),
          courseTitle: '',
        };
        setActiveRoom(row);
      }
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setOpenSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-7 h-7 text-emerald-600" />
            Student Doubt Chat
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            1:1 doubt-solving windows — unlocked only for students with a paid enrollment
          </p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button
            onClick={reloadRooms}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold text-[11px] inline-flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
          <button
            onClick={() => setOpenOpen(true)}
            className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Open Chat
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Room list */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden lg:col-span-1">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900">Chat Rooms ({rooms.length})</h3>
          </div>
          {loading ? (
            <p className="p-5 text-xs text-slate-400">Loading rooms…</p>
          ) : rooms.length === 0 ? (
            <p className="p-5 text-xs text-slate-400">
              No chat rooms yet — open one with an enrolled student.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 max-h-[480px] overflow-y-auto">
              {rooms.map((r) => (
                <li key={r.roomId}>
                  <button
                    onClick={() => setActiveRoom(r)}
                    className={`w-full text-left px-5 py-3 hover:bg-slate-50 transition-colors ${
                      activeRoom?.roomId === r.roomId ? 'bg-emerald-50/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 truncate">
                        {r.studentName || nameOf(r, r.studentId)}
                      </span>
                      {r.unreadByInstructor && <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />}
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">{r.courseTitle || '—'}</span>
                    {r.lastMessageAt && (
                      <span className="text-[10px] text-slate-300">{formatDateTime(r.lastMessageAt)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Active conversation */}
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden lg:col-span-2 flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900">
              {activeRoom ? activeRoom.studentName || activeRoom.studentId : 'Select a room'}
            </h3>
            {activeRoom && <p className="text-[11px] text-slate-400">{activeRoom.courseTitle}</p>}
          </div>

          <div className="flex-1 p-5 space-y-3 overflow-y-auto min-h-[320px] max-h-[420px] bg-slate-50/50">
            {!activeRoom ? (
              <p className="text-xs text-slate-400 text-center pt-16">Pick a chat room to start replying.</p>
            ) : messagesLoading ? (
              <p className="text-xs text-slate-400">Loading messages…</p>
            ) : messages.length === 0 ? (
              <p className="text-xs text-slate-400 text-center pt-16">No messages yet — say hello.</p>
            ) : (
              messages.map((m, i) => {
                const mine = strOf(m.fromId) === myId && myId !== '';
                const body = strOf(m.text) || strOf(m.body);
                return (
                  <div key={strOf(m.id) || i} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] px-3.5 py-2 rounded-2xl text-xs leading-relaxed ${
                        mine
                          ? 'bg-emerald-600 text-white rounded-br-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                      }`}
                    >
                      <p>{body}</p>
                      <span className={`block text-[9px] mt-1 ${mine ? 'text-emerald-100' : 'text-slate-400'}`}>
                        {formatDateTime(strOf(m.createdAt))}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {activeRoom && (
            <form onSubmit={sendMessage} className="p-3 border-t border-slate-100 flex items-center gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a reply…"
                className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs inline-flex items-center gap-1"
              >
                <Send className="w-3.5 h-3.5" /> Send
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Open new chat modal */}
      <ModalSheet
        isOpen={openOpen}
        onClose={() => setOpenOpen(false)}
        title="Open Chat With Student"
        description="The student must hold a paid purchase with you — otherwise the server rejects with CHAT_LOCKED_FOR_ENROLLMENT."
        maxWidth="sm"
      >
        <form onSubmit={openChat} className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Student User ID *</label>
            <input
              type="text"
              value={studentId}
              onChange={(e) => setStudentId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono"
              placeholder="usr_…"
              required
            />
          </div>
          <button
            type="submit"
            disabled={openSaving}
            className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-xs shadow-md"
          >
            {openSaving ? 'Opening…' : 'Open Room'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};

export default TeacherChatPage;
