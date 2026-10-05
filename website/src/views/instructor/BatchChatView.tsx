import { useCallback, useEffect, useState } from 'react';
import { toast } from '../../components/toast';
import {
  getBatchRoom,
  listMessages,
  postBatchMessage,
  type ChatMessage,
  type ChatRoom,
} from '../../lib/api/chat';
import { getCourse, type CourseLesson } from '../../lib/api/courses';
import type { CourseBatch } from '../../lib/api/instructorAcademy';
import { useT } from '../../lib/i18n';

/**
 * Minimal batch chat (WS-02 task 2.40) — instructor broadcast compose box plus a
 * read-only message list for the batch room. The instructor is admin and may
 * only broadcast text + an optional in-platform lesson card; there is no
 * attachment or voice UI (server-enforced by task 2.36). All strings via t()
 * (instructor locale pair, en + hi).
 */
export default function BatchChatView({ batch }: { batch: CourseBatch }) {
  const t = useT();
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [lessons, setLessons] = useState<CourseLesson[]>([]);
  const [text, setText] = useState('');
  const [lessonCardId, setLessonCardId] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    getBatchRoom(batch.id)
      .then(setRoom)
      .catch(() => setRoom(null));
    listMessages(batch.id)
      .then((res) => setMessages(res.data))
      .catch(() => setMessages([]));
    if (batch.courseId) {
      getCourse(batch.courseId)
        .then((detail) =>
          setLessons((detail.modules ?? []).flatMap((module) => module.lessons ?? []))
        )
        .catch(() => setLessons([]));
    } else {
      setLessons([]);
    }
  }, [batch.id, batch.courseId]);

  useEffect(() => {
    load();
  }, [load]);

  const sealed = room?.sealed === true;

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim() && !lessonCardId) return;
    setBusy(true);
    try {
      await postBatchMessage(batch.id, text.trim(), lessonCardId || undefined);
      setText('');
      setLessonCardId('');
      load();
    } catch {
      toast(t('instructorChatFailed'), { error: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ fontSize: 13, color: '#6B7280' }}>{t('instructorBroadcastNote')}</div>
      {sealed && <p className="dash-empty-line">{t('instructorChatSealed')}</p>}
      <div style={{ maxHeight: 260, overflowY: 'auto', marginTop: 8 }}>
        {messages.length === 0 ? (
          <p className="dash-empty-line">{t('instructorNoMessages')}</p>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              style={{ padding: '6px 0', borderBottom: '1px solid #F3F4F6' }}
            >
              <strong style={{ fontSize: 13 }}>{message.fromName}</strong>
              <div>{message.text || '📎'}</div>
            </div>
          ))
        )}
      </div>
      {!sealed && (
        <form onSubmit={send} style={{ display: 'grid', gap: 8, marginTop: 8 }}>
          <input
            className="av-input"
            placeholder={t('instructorChatPlaceholder')}
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label={t('instructorChatPlaceholder')}
          />
          <select
            className="av-input"
            value={lessonCardId}
            onChange={(event) => setLessonCardId(event.target.value)}
            aria-label={t('instructorLessonCard')}
          >
            <option value="">{t('instructorNoLessonCard')}</option>
            {lessons.map((lesson) => (
              <option key={lesson.id} value={lesson.id}>
                {lesson.title}
              </option>
            ))}
          </select>
          <button type="submit" className="av-btn" disabled={busy}>
            {t('instructorChatSend')}
          </button>
        </form>
      )}
    </div>
  );
}
