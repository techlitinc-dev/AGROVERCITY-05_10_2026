import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageCircle,
  Send,
  Users,
  Paperclip,
  Mic,
  Square,
  ArrowLeft,
  MoreVertical,
  Flag,
  Ban,
  ShieldCheck,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { chat, uploads, users, apiErrorMessage } from '../../lib/api';
import { useAuthStore } from '../../stores/authStore';
import { cn, formatDateTime } from '../../lib/utils';
import { ModalSheet } from '../../components/common/ModalSheet';
import { asRecords, pickStr } from './records';

interface Room {
  id: string;
  name: string;
  subtitle: string;
  otherUserId?: string;
  verified?: boolean;
  /** Counterparty persona bucket (transport / academy / farmer / …) — groups
   *  the room list so one persona's chats don't merge into another's. */
  persona?: string;
  updatedAt?: string;
}

interface Msg {
  id: string;
  mine: boolean;
  sender: string;
  text: string;
  image?: string;
  audio?: string;
  time: string;
}

/** Persona bucket → display label (fallbacks for legacy/unknown buckets). */
const PERSONA_LABEL: Record<string, string> = {
  transport: 'Transporter',
  academy: 'Academy / Gurukul',
  farmer: 'Farmers',
  farmLandlord: 'Farm Landlords',
  seller: 'Agri Vyapari',
  directBuyer: 'Industrial Buyers',
  exporter: 'Exporters',
  equipmentRental: 'Equipment Owners',
  milkVendor: 'Milk Vendors',
  dairyManager: 'Dairy',
  instructor: 'Instructors',
  transporter: 'Transporter',
  nursery: 'Nursery',
  broker: 'Brokers',
};
const personaLabel = (bucket: string): string => PERSONA_LABEL[bucket] || 'Other chats';

export const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeRoom, setActiveRoom] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [recording, setRecording] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportBusy, setReportBusy] = useState(false);
  const [blockedIds, setBlockedIds] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);
  /** Transient popup for incoming messages while the user is elsewhere in the app. */
  const [popup, setPopup] = useState<{ sender: string; text: string } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const lastSeenRef = useRef<string>('');

  const mapMessages = (rows: unknown[]): Msg[] =>
    asRecords(rows).map((m): Msg => {
      const senderId = pickStr(m, 'senderId', 'fromId');
      return {
        id: pickStr(m, 'id') || `${senderId}-${pickStr(m, 'timestamp', 'createdAt')}`,
        mine: !!user && senderId === user.id,
        sender: pickStr(m, 'senderName', 'sender') || 'Member',
        text: pickStr(m, 'text', 'body', 'message'),
        image: pickStr(m, 'imageUrl', 'image', 'attachmentUrl'),
        audio: pickStr(m, 'audioUrl', 'audio', 'voiceUrl'),
        time: pickStr(m, 'timestamp', 'createdAt'),
      };
    });

  const showPopup = (sender: string, text: string) => {
    setPopup({ sender, text });
    window.setTimeout(() => setPopup((p) => (p && p.text === text ? null : p)), 5000);
  };

  // Load rooms; honor the ?room= query param as the initial selection.
  useEffect(() => {
    let alive = true;
    chat
      .rooms()
      .then((rows) => {
        if (!alive) return;
        const myId = user?.id;
        const list = asRecords(rows).map((r): Room => {
          const id = pickStr(r, 'id', 'roomId');
          const farmerId = pickStr(r, 'farmerId');
          const buyerId = pickStr(r, 'buyerId');
          const otherUserId =
            farmerId && buyerId
              ? farmerId === myId
                ? buyerId
                : farmerId
              : pickStr(r, 'counterpartyId', 'otherPartyId', 'peerId', 'otherUserId') || undefined;
          return {
            id,
            name:
              pickStr(r, 'name', 'title') ||
              pickStr(r, 'counterpartyName', 'otherPartyName', 'peerName') ||
              `Room ${id.slice(0, 6)}`,
            subtitle: pickStr(r, 'lastMessage', 'subtitle', 'context') || 'Chat room',
            otherUserId,
            verified: (r as Record<string, unknown>).counterpartyVerified === true,
            persona: pickStr(r, 'counterpartyPersona', 'persona') || undefined,
            updatedAt: pickStr(r, 'lastMessageAt', 'updatedAt', 'createdAt'),
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
    users
      .blocks()
      .then((rows) => {
        if (!alive) return;
        setBlockedIds(new Set(asRecords(rows).map((b) => pickStr(b, 'userId', 'id')).filter(Boolean)));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load messages for the active room; remember the newest id so the poller
  // can tell "new message arrived" from the initial load.
  useEffect(() => {
    if (!activeRoom) return;
    let alive = true;
    chat
      .messages(activeRoom)
      .then((rows) => {
        if (!alive) return;
        const mapped = mapMessages(rows);
        setMessages(mapped);
        lastSeenRef.current = mapped.length > 0 ? mapped[mapped.length - 1].id : '';
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

  // Lightweight poll (no websocket in this stack): refresh the open thread and
  // the room list every 6s; surface an in-app popup when the OTHER party sends
  // something new — this is the "notification while chatting" the manual pass
  // flagged as missing.
  useEffect(() => {
    if (!activeRoom) return;
    const t = window.setInterval(() => {
      chat
        .messages(activeRoom)
        .then((rows) => {
          const mapped = mapMessages(rows);
          setMessages((prev) => {
            const fresh = mapped.filter((m) => !prev.some((p) => p.id === m.id));
            const incoming = fresh.filter((m) => !m.mine);
            if (incoming.length > 0 && lastSeenRef.current) {
              const latest = incoming[incoming.length - 1];
              showPopup(latest.sender, latest.text || (latest.image ? 'Sent a photo' : latest.audio ? 'Sent a voice note' : 'New message'));
            }
            if (mapped.length > 0) lastSeenRef.current = mapped[mapped.length - 1].id;
            return mapped;
          });
          chat.markRead(activeRoom).catch(() => undefined);
        })
        .catch(() => undefined);
      chat
        .rooms()
        .then((rows) => {
          const myId = user?.id;
          setRooms(
            asRecords(rows).map((r): Room => {
              const id = pickStr(r, 'id', 'roomId');
              const farmerId = pickStr(r, 'farmerId');
              const buyerId = pickStr(r, 'buyerId');
              const otherUserId =
                farmerId && buyerId
                  ? farmerId === myId
                    ? buyerId
                    : farmerId
                  : pickStr(r, 'counterpartyId', 'otherPartyId', 'peerId', 'otherUserId') || undefined;
              return {
                id,
                name:
                  pickStr(r, 'name', 'title') ||
                  pickStr(r, 'counterpartyName', 'otherPartyName', 'peerName') ||
                  `Room ${id.slice(0, 6)}`,
                subtitle: pickStr(r, 'lastMessage', 'subtitle', 'context') || 'Chat room',
                otherUserId,
                verified: (r as Record<string, unknown>).counterpartyVerified === true,
                persona: pickStr(r, 'counterpartyPersona', 'persona') || undefined,
                updatedAt: pickStr(r, 'lastMessageAt', 'updatedAt', 'createdAt'),
              };
            })
          );
        })
        .catch(() => undefined);
    }, 6000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom, user?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const refreshMessages = async (roomId: string) => {
    const rows = await chat.messages(roomId).catch(() => []);
    setMessages(mapMessages(rows));
  };

  const activeOtherUserId = rooms.find((r) => r.id === activeRoom)?.otherUserId;
  const isBlocked = !!activeOtherUserId && blockedIds.has(activeOtherUserId);

  const send = async () => {
    const text = input.trim();
    if (!text || !activeRoom || sending) return;
    setSending(true);
    try {
      await chat.send(activeRoom, text);
      setInput('');
      await refreshMessages(activeRoom);
    } finally {
      setSending(false);
    }
  };

  const sendImage = async (file: File | undefined) => {
    if (!file || !activeRoom || uploadingImage) return;
    setUploadingImage(true);
    setNotice(null);
    try {
      const uploaded = (await uploads.upload(file, { folder: 'chat', purpose: 'chat-image' })) as {
        url?: string;
        fileUrl?: string;
      };
      const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
      if (!url) throw new Error('Upload did not return a URL');
      await chat.send(activeRoom, '', { imageUrl: url });
      await refreshMessages(activeRoom);
      setNotice('Photo sent.');
    } catch (err) {
      setNotice(apiErrorMessage(err));
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (!activeRoom || !navigator.mediaDevices?.getUserMedia) {
      setNotice('Voice recording is not supported on this device/browser.');
      return;
    }
    setNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg';
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];
        if (blob.size === 0 || !activeRoom) return;
        setUploadingImage(true);
        try {
          const uploaded = (await uploads.upload(new File([blob], 'voice-note.webm', { type: mimeType }), {
            purpose: 'chat-voice',
          })) as { url?: string; fileUrl?: string };
          const url = uploaded?.url ?? uploaded?.fileUrl ?? '';
          if (!url) throw new Error('Upload did not return a URL');
          await chat.send(activeRoom, '', { audioUrl: url });
          await refreshMessages(activeRoom);
          setNotice('Voice note sent.');
        } catch (err) {
          setNotice(apiErrorMessage(err));
        } finally {
          setUploadingImage(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setNotice('Microphone permission denied — allow mic access to send voice notes.');
    }
  };

  // Group rooms by counterparty persona so each persona's conversations live
  // under their own header instead of one merged list.
  const groupedRooms = useMemo(() => {
    const groups = new Map<string, Room[]>();
    for (const r of rooms) {
      const bucket = r.persona || 'other';
      if (!groups.has(bucket)) groups.set(bucket, []);
      groups.get(bucket)!.push(r);
    }
    return [...groups.entries()].map(([persona, list]) => ({
      persona,
      label: personaLabel(persona),
      list: [...list].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')),
    }));
  }, [rooms]);

  const toggleBlock = async () => {
    if (!activeOtherUserId) return;
    setMenuOpen(false);
    setNotice(null);
    try {
      if (isBlocked) {
        await users.unblockUser(activeOtherUserId);
        setBlockedIds((prev) => {
          const next = new Set(prev);
          next.delete(activeOtherUserId);
          return next;
        });
        setNotice('User unblocked.');
      } else {
        await users.blockUser(activeOtherUserId);
        setBlockedIds((prev) => new Set(prev).add(activeOtherUserId));
        setNotice('User blocked. They can no longer contact you.');
      }
    } catch (err) {
      setNotice(apiErrorMessage(err));
    }
  };

  const submitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOtherUserId || reportBusy) return;
    const reason = reportReason.trim();
    if (reason.length < 5) {
      setNotice('Please give a slightly longer reason (at least 5 characters).');
      return;
    }
    setReportBusy(true);
    try {
      await users.reportUser(activeOtherUserId, reason);
      setReportOpen(false);
      setReportReason('');
      setNotice('Report submitted. Our trust & safety team will review it.');
    } catch (err) {
      setNotice(apiErrorMessage(err));
    } finally {
      setReportBusy(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Transient new-message popup — the in-chat "notification" */}
      {popup && (
        <div className="fixed bottom-4 right-4 z-50 w-72 bg-white border border-emerald-200 rounded-2xl shadow-lg p-3 flex items-start gap-2.5 animate-pulse">
          <MessageCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[11px] font-bold text-slate-900 truncate">{popup.sender}</p>
            <p className="text-[11px] text-slate-600 truncate">{popup.text}</p>
          </div>
          <button onClick={() => setPopup(null)} className="ml-auto text-slate-400 hover:text-slate-700 text-xs font-bold">
            ×
          </button>
        </div>
      )}

      <div className="border-b border-slate-200 pb-4 flex items-center gap-3">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/dashboard'))}
          className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-emerald-600" />
            Chats
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Conversations grouped by persona — trade, transport, land, academy and more
          </p>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col sm:flex-row" style={{ height: '600px' }}>
        {/* Room list — grouped by counterparty persona */}
        <div className="sm:w-72 border-b sm:border-b-0 sm:border-r border-slate-100 overflow-y-auto flex-shrink-0">
          {rooms.length === 0 ? (
            <div className="p-6 text-center">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-400">
                No chat rooms yet — rooms open automatically when a trade, booking, or deal starts.
              </p>
            </div>
          ) : (
            groupedRooms.map((g) => (
              <div key={g.persona}>
                <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-slate-400 uppercase tracking-wide">{g.label}</p>
                {g.list.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => setActiveRoom(r.id)}
                    className={cn(
                      'w-full px-4 py-2.5 text-left border-l-4 transition-colors',
                      activeRoom === r.id
                        ? 'border-emerald-600 bg-emerald-50/60'
                        : 'border-transparent hover:bg-slate-50'
                    )}
                  >
                    <p className="text-xs font-bold text-slate-900 truncate">{r.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{r.subtitle}</p>
                  </button>
                ))}
              </div>
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
              {/* Conversation header with Report / Block menu */}
              <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-slate-100 bg-white">
                <p className="text-xs font-bold text-slate-900 truncate">
                  {rooms.find((r) => r.id === activeRoom)?.name ?? 'Conversation'}
                  {rooms.find((r) => r.id === activeRoom)?.verified && (
                    <span className="ml-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-sky-50 text-sky-700 border border-sky-200 rounded-full text-[9px] font-bold">
                      <ShieldCheck className="w-2.5 h-2.5" /> Verified
                    </span>
                  )}
                  {isBlocked && (
                    <span className="ml-2 px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[9px] font-bold">
                      Blocked
                    </span>
                  )}
                </p>
                {activeOtherUserId && (
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen((v) => !v)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                      title="Report / Block"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                    {menuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                        <div className="absolute right-0 top-9 z-20 w-44 bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden text-xs font-bold">
                          <button
                            onClick={() => {
                              setMenuOpen(false);
                              setReportReason('');
                              setReportOpen(true);
                            }}
                            className="w-full px-3 py-2.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            <Flag className="w-3.5 h-3.5 text-amber-600" /> Report User
                          </button>
                          <button
                            onClick={() => void toggleBlock()}
                            className="w-full px-3 py-2.5 text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                          >
                            {isBlocked ? (
                              <>
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Unblock User
                              </>
                            ) : (
                              <>
                                <Ban className="w-3.5 h-3.5 text-rose-600" /> Block User
                              </>
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {notice && (
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 text-[11px] font-semibold text-slate-600 flex items-center justify-between">
                  <span>{notice}</span>
                  <button onClick={() => setNotice(null)} className="font-bold hover:underline">Dismiss</button>
                </div>
              )}

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
                      {m.image && (
                        <a href={m.image} target="_blank" rel="noreferrer" className="block mb-1">
                          <img
                            src={m.image}
                            alt="Shared image"
                            className="max-w-[220px] w-full rounded-xl border border-slate-200 cursor-pointer"
                          />
                        </a>
                      )}
                      {m.audio && (
                        <audio controls src={m.audio} className="max-w-[220px] w-full block mb-1" />
                      )}
                      {m.text && <p className={cn((m.image || m.audio) && 'mt-1')}>{m.text}</p>}
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
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => void sendImage(e.target.files?.[0])}
                  className="hidden"
                />
                <button
                  type="button"
                  disabled={uploadingImage}
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 border border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-300 rounded-xl transition-colors disabled:opacity-40"
                  title={uploadingImage ? 'Uploading photo…' : 'Send a photo'}
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void toggleRecording()}
                  className={cn(
                    'p-2.5 border rounded-xl transition-colors',
                    recording
                      ? 'bg-rose-50 border-rose-300 text-rose-600 animate-pulse'
                      : 'border-slate-200 text-slate-500 hover:text-emerald-700 hover:border-emerald-300'
                  )}
                  title={recording ? 'Stop recording & send' : 'Record a voice note'}
                >
                  {recording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={recording ? 'Recording… tap the square to stop & send' : uploadingImage ? 'Uploading photo…' : 'Type a message…'}
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

      {/* Report reason modal */}
      <ModalSheet
        isOpen={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report User"
        description="Tell us what went wrong — fraud, abuse, spam, or a bad-faith deal. Min 5 characters."
        maxWidth="sm"
      >
        <form onSubmit={submitReport} className="space-y-3">
          <textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            rows={3}
            autoFocus
            placeholder="e.g. This user took advance payment and never picked up the load…"
            className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300"
            required
          />
          <button
            type="submit"
            disabled={reportBusy}
            className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md disabled:opacity-60"
          >
            {reportBusy ? 'Submitting…' : 'Submit Report'}
          </button>
        </form>
      </ModalSheet>
    </div>
  );
};
