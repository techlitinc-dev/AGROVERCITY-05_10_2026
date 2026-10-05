import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Hls from 'hls.js';
import ToolShell from '../../components/trade/ToolShell';
import { toast } from '../../components/toast';
import { isApiError } from '../../lib/api/client';
import {
  getChannelChat,
  getChannelSchedule,
  getPolls,
  getQuestions,
  listChannels,
  postChannelChat,
  postQuestion,
  toggleScheduleReminder,
  upvoteQuestion,
  votePoll,
  type ChannelBroadcast,
  type ChannelChatMessage,
  type ChannelPoll,
  type ChannelQuestion,
  type LiveChannel,
} from '../../lib/api/content';
import { useT } from '../../lib/i18n';
import '../../theme/trade.css';

const CHAT_POLL_MS = 5000;

/**
 * Channel player (task 5.15) — HLS playback (hls.js with a native fallback),
 * pinned announcement, schedule with a remind-me toggle, moderated live chat,
 * polls and viewer Q&A. X16: licensed embedded streams only.
 */
export default function ChannelPlayerPage() {
  const t = useT();
  const { channelId } = useParams();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [channel, setChannel] = useState<LiveChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [schedule, setSchedule] = useState<ChannelBroadcast[]>([]);
  const [messages, setMessages] = useState<ChannelChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [polls, setPolls] = useState<ChannelPoll[]>([]);
  const [questions, setQuestions] = useState<ChannelQuestion[]>([]);
  const [questionDraft, setQuestionDraft] = useState('');

  const loadChannel = useCallback(() => {
    setLoading(true);
    listChannels()
      .then((res) => setChannel(res.data.find((entry) => entry.id === channelId) ?? null))
      .catch(() => {
        setChannel(null);
        toast(t('channelsLoadFailed'), { error: true });
      })
      .finally(() => setLoading(false));
  }, [channelId, t]);

  useEffect(() => {
    loadChannel();
  }, [loadChannel]);

  // HLS playback: hls.js when supported, native HLS otherwise.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !channel) return undefined;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(channel.streamUrl);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = channel.streamUrl;
    }
    return undefined;
  }, [channel]);

  // Schedule + reminder state.
  const loadSchedule = useCallback(() => {
    getChannelSchedule()
      .then((res) => setSchedule(res.data))
      .catch(() => setSchedule([]));
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Live chat (polled) + polls + Q&A.
  const loadChat = useCallback(() => {
    if (!channelId) return;
    getChannelChat(channelId)
      .then((res) => setMessages(res.data))
      .catch(() => setMessages([]));
  }, [channelId]);

  const loadPolls = useCallback(() => {
    if (!channelId) return;
    getPolls(channelId)
      .then((res) => setPolls(res.data))
      .catch(() => setPolls([]));
  }, [channelId]);

  const loadQuestions = useCallback(() => {
    if (!channelId) return;
    getQuestions(channelId)
      .then((res) => setQuestions(res.data))
      .catch(() => setQuestions([]));
  }, [channelId]);

  useEffect(() => {
    loadChat();
    loadPolls();
    loadQuestions();
  }, [loadChat, loadPolls, loadQuestions]);

  useEffect(() => {
    const timer = window.setInterval(loadChat, CHAT_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loadChat]);

  const send = async () => {
    const text = draft.trim();
    if (!channelId || !text || sending) return;
    setSending(true);
    try {
      await postChannelChat(channelId, text);
      setDraft('');
      loadChat();
    } catch (err) {
      if (isApiError(err) && err.code === 'MODERATION_BLOCKED') {
        toast(t('channelsModerationBlocked'), { error: true });
      } else if (isApiError(err) && err.code === 'CHAT_MUTED') {
        toast(t('channelsModerationBlocked'), { error: true });
      } else {
        toast(t('channelsLoadFailed'), { error: true });
      }
    } finally {
      setSending(false);
    }
  };

  const toggleReminder = async (bcastId: string) => {
    try {
      await toggleScheduleReminder(bcastId);
      loadSchedule();
    } catch {
      toast(t('channelsLoadFailed'), { error: true });
    }
  };

  const vote = async (pollId: string, optionIndex: number) => {
    if (!channelId) return;
    try {
      await votePoll(channelId, pollId, optionIndex);
      loadPolls();
    } catch {
      toast(t('channelsLoadFailed'), { error: true });
    }
  };

  const ask = async () => {
    const text = questionDraft.trim();
    if (!channelId || !text) return;
    try {
      await postQuestion(channelId, text);
      setQuestionDraft('');
      loadQuestions();
    } catch {
      toast(t('channelsLoadFailed'), { error: true });
    }
  };

  const upvote = async (qId: string) => {
    if (!channelId) return;
    try {
      await upvoteQuestion(channelId, qId);
      loadQuestions();
    } catch {
      toast(t('channelsLoadFailed'), { error: true });
    }
  };

  return (
    <ToolShell toolId="liveChannels" backTo="/dashboard/p/liveChannels">
      <section className="dash-section">
        <Link to="/dashboard/p/liveChannels" style={{ fontSize: 13 }}>
          ← {t('channelsBackToGrid')}
        </Link>

        {loading ? (
          <p className="dash-empty-line">…</p>
        ) : channel === null ? (
          <p className="dash-empty-line">📺 {t('channelsEmpty')}</p>
        ) : (
          <>
            <h3 style={{ marginTop: 8 }}>{channel.channelName}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {channel.isLiveNow ? (
                <span
                  className="av-chip"
                  style={{ background: '#FEE2E2', color: '#B91C1C', fontSize: 12, padding: '2px 8px', borderRadius: 999 }}
                >
                  ● {t('channelsLive')}
                </span>
              ) : (
                <span className="av-chip" style={{ fontSize: 12 }}>
                  {t('channelsOffline')}
                </span>
              )}
              <span style={{ fontSize: 13 }}>{channel.programTitle}</span>
              <span style={{ fontSize: 13, color: '#374151' }}>
                👁️ {t('channelsViewers', { count: channel.liveViewersCount })}
              </span>
            </div>

            <video
              ref={videoRef}
              controls
              playsInline
              style={{ width: '100%', maxWidth: 720, marginTop: 12, background: '#000', borderRadius: 12 }}
            />

            {channel.pinnedAnnouncement ? (
              <div
                style={{
                  marginTop: 12,
                  padding: '8px 12px',
                  background: '#FEF3C7',
                  color: '#92400E',
                  borderRadius: 10,
                  fontSize: 14,
                }}
              >
                📌 {t('channelsPinned')}: {channel.pinnedAnnouncement}
              </div>
            ) : null}
          </>
        )}
      </section>

      <section className="dash-section">
        <h4>{t('channelsSchedule')}</h4>
        {schedule.length === 0 ? (
          <p className="dash-empty-line">{t('channelsNoPolls')}</p>
        ) : (
          schedule.map((bcast) => (
            <div
              key={bcast.id}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}
            >
              <span>
                <strong>{bcast.programTitle}</strong>
                <br />
                <span style={{ fontSize: 13, color: '#6B7280' }}>
                  {bcast.channelName} · {bcast.scheduledStart}
                </span>
              </span>
              <button type="button" className="av-chip" onClick={() => void toggleReminder(bcast.id)}>
                {bcast.hasReminder ? `🔔 ${t('channelsRemindMe')} ✓` : `🔕 ${t('channelsRemindMe')}`}
              </button>
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h4>{t('channelsPolls')}</h4>
        {polls.length === 0 ? (
          <p className="dash-empty-line">{t('channelsNoPolls')}</p>
        ) : (
          polls.map((poll) => (
            <div key={poll.id} style={{ padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}>
              <div style={{ fontWeight: 600 }}>{poll.question}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 6 }}>
                {poll.options.map((option, index) => (
                  <button
                    key={option}
                    type="button"
                    className="av-chip"
                    aria-pressed={poll.userVotedOption === index}
                    disabled={!poll.isActive}
                    onClick={() => void vote(poll.id, index)}
                  >
                    {option}
                    {poll.votes?.[String(index)] !== undefined ? ` (${poll.votes[String(index)]})` : ''}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h4>{t('channelsQuestions')}</h4>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input
            aria-label={t('channelsAskPlaceholder')}
            placeholder={t('channelsAskPlaceholder')}
            value={questionDraft}
            onChange={(e) => setQuestionDraft(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="av-chip" onClick={() => void ask()}>
            {t('channelsAsk')}
          </button>
        </div>
        {questions.length === 0 ? (
          <p className="dash-empty-line">{t('channelsNoQuestions')}</p>
        ) : (
          questions.map((question) => (
            <div
              key={question.id}
              style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderBottom: '1px solid #F3F4F6' }}
            >
              <span>
                <strong>{question.userName}</strong>
                {question.isAnswered ? ` · ${t('channelsAnswered')}` : ''}
                <br />
                <span style={{ fontSize: 14 }}>{question.questionText}</span>
              </span>
              <button
                type="button"
                className="av-chip"
                aria-pressed={question.userHasUpvoted}
                onClick={() => void upvote(question.id)}
              >
                ▲ {question.upvotesCount} {t('channelsUpvote')}
              </button>
            </div>
          ))
        )}
      </section>

      <section className="dash-section">
        <h4>{t('channelsChatPlaceholder').replace('…', '')}</h4>
        <div style={{ maxHeight: 260, overflowY: 'auto', padding: '4px 0' }}>
          {messages.length === 0 ? (
            <p className="dash-empty-line">{t('channelsEmptyChat')}</p>
          ) : (
            messages.map((message) => (
              <div key={message.id} style={{ padding: '4px 0' }}>
                <strong>{message.userName}</strong>{' '}
                <span style={{ fontSize: 14 }}>{message.text}</span>
              </div>
            ))
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input
            aria-label={t('channelsChatPlaceholder')}
            placeholder={t('channelsChatPlaceholder')}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="button" className="av-chip" disabled={sending} onClick={() => void send()}>
            {t('channelsSend')}
          </button>
        </div>
      </section>
    </ToolShell>
  );
}
