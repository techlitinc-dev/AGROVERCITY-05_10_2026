import { api } from './client';

/**
 * Content API wrapper (phase-04 WS-05 — Agri News + Live Channels).
 *
 * Mirrors backend/app/routers/content.py (mounted at /v1, no own prefix).
 *
 * Backend quirks documented inline:
 * - `POST /v1/channels` (create) is ADMIN-ONLY after WS-05 task 5.7 (X16: v1
 *   ships embedded licensed streams only — no user-originated streams). This
 *   wrapper exposes no create helper; the consumer surfaces are read-only.
 * - List endpoints return the `{ data, page, pageSize, total }` envelope.
 * - Channel chat uses a Redis 2-second per-user rate limit; the server rejects
 *   messages matching phone/UPI/URL regexes (global rule 4).
 * - `POST .../pin` takes the pinned *text* (not a message id) — see
 *   `pinChannelMessage`.
 */

export interface Paged<T> {
  data: T[];
  page?: number;
  pageSize?: number;
  total: number;
}

export interface NewsItem {
  id: string;
  title: string;
  vernacularTitle: string;
  category: string;
  source: string;
  timestamp: string;
  summary: string;
  content: string;
  isBreaking: boolean;
  audioText: string;
  impactRating: string;
}

export interface LiveChannel {
  id: string;
  channelName: string;
  broadcaster: string;
  programTitle: string;
  currentSpeaker: string;
  liveViewersCount: number;
  isLiveNow: boolean;
  category: string;
  streamThumbnail: string;
  streamUrl: string;
  scheduleTime: string;
  pinnedAnnouncement: string;
  isBroadcasterHost?: boolean;
}

export interface ChannelBroadcast {
  id: string;
  channelName: string;
  programTitle: string;
  speakerName: string;
  speakerRole: string;
  scheduledStart: string;
  topic: string;
  reminderCount: number;
  hasReminder: boolean;
  thumbnailUrl: string;
}

export interface ChannelChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  sentAt: string;
}

export interface ChannelPoll {
  id: string;
  channelId: string;
  question: string;
  options: string[];
  votes: Record<string, number>;
  totalVotes: number;
  isActive: boolean;
  createdAt: string;
  userVotedOption?: number | null;
}

export interface ChannelQuestion {
  id: string;
  channelId: string;
  userId: string;
  userName: string;
  questionText: string;
  upvotesCount: number;
  isAnswered: boolean;
  createdAt: string;
  userHasUpvoted?: boolean;
}

// ---- Agri News (robust.md §7.18) ------------------------------------------

/** `GET /v1/news?category=` — newest-first, breaking items first. */
export async function listNews(category?: string): Promise<Paged<NewsItem>> {
  const res = await api.get<Paged<NewsItem>>('/news', {
    params: category ? { category } : undefined,
  });
  return res.data;
}

// ---- Live Channels (robust.md §7.19) --------------------------------------

/** `GET /v1/channels` — items carry the live viewer count (`liveViewersCount`). */
export async function listChannels(): Promise<Paged<LiveChannel>> {
  const res = await api.get<Paged<LiveChannel>>('/channels');
  return res.data;
}

/** `GET /v1/channels/schedule` — items carry `hasReminder` for the caller. */
export async function getChannelSchedule(): Promise<Paged<ChannelBroadcast>> {
  const res = await api.get<Paged<ChannelBroadcast>>('/channels/schedule');
  return res.data;
}

/** `POST /v1/channels/schedule/{bcast_id}/remind` — toggles the reminder. */
export async function toggleScheduleReminder(
  bcastId: string,
): Promise<{ broadcastId: string; hasReminder: boolean; reminderCount: number }> {
  const res = await api.post<{ broadcastId: string; hasReminder: boolean; reminderCount: number }>(
    `/channels/schedule/${bcastId}/remind`,
  );
  return res.data;
}

/** `GET /v1/channels/{id}/chat` — last 50 non-blocked messages, oldest first. */
export async function getChannelChat(channelId: string): Promise<Paged<ChannelChatMessage>> {
  const res = await api.get<Paged<ChannelChatMessage>>(`/channels/${channelId}/chat`);
  return res.data;
}

/** `POST /v1/channels/{id}/chat` — moderated (phone/UPI/URL regex + strike ladder). */
export async function postChannelChat(
  channelId: string,
  text: string,
): Promise<ChannelChatMessage> {
  const res = await api.post<ChannelChatMessage>(`/channels/${channelId}/chat`, { text });
  return res.data;
}

/**
 * `PUT /v1/channels/{id}/pin` — sets the pinned announcement. Backend quirk:
 * the body field is `pinnedText` (the announcement copy), not a message id.
 */
export async function pinChannelMessage(
  channelId: string,
  messageId: string,
): Promise<{ channelId: string; pinnedAnnouncement: string }> {
  const res = await api.put<{ channelId: string; pinnedAnnouncement: string }>(
    `/channels/${channelId}/pin`,
    { pinnedText: messageId },
  );
  return res.data;
}

/** `GET /v1/channels/{id}/polls` — newest-first, carries `userVotedOption`. */
export async function getPolls(channelId: string): Promise<Paged<ChannelPoll>> {
  const res = await api.get<Paged<ChannelPoll>>(`/channels/${channelId}/polls`);
  return res.data;
}

/** `POST /v1/channels/{id}/polls` — create a live poll. */
export async function createPoll(
  channelId: string,
  question: string,
  options: string[],
): Promise<ChannelPoll> {
  const res = await api.post<ChannelPoll>(`/channels/${channelId}/polls`, { question, options });
  return res.data;
}

/**
 * `POST /v1/channels/{id}/polls/{poll_id}/vote` — backend body field is
 * `optionIndex` (0-based), so `optionId` is the option's index.
 */
export async function votePoll(
  channelId: string,
  pollId: string,
  optionId: number,
): Promise<ChannelPoll> {
  const res = await api.post<ChannelPoll>(`/channels/${channelId}/polls/${pollId}/vote`, {
    optionIndex: optionId,
  });
  return res.data;
}

/** `GET /v1/channels/{id}/questions` — answered questions last, by upvotes. */
export async function getQuestions(channelId: string): Promise<Paged<ChannelQuestion>> {
  const res = await api.get<Paged<ChannelQuestion>>(`/channels/${channelId}/questions`);
  return res.data;
}

/** `POST /v1/channels/{id}/questions` — ask a viewer question. */
export async function postQuestion(
  channelId: string,
  questionText: string,
): Promise<ChannelQuestion> {
  const res = await api.post<ChannelQuestion>(`/channels/${channelId}/questions`, {
    questionText,
  });
  return res.data;
}

/** `POST /v1/channels/{id}/questions/{q_id}/upvote` — toggles the caller's upvote. */
export async function upvoteQuestion(
  channelId: string,
  qId: string,
): Promise<{ questionId: string; upvotesCount: number; userHasUpvoted: boolean }> {
  const res = await api.post<{ questionId: string; upvotesCount: number; userHasUpvoted: boolean }>(
    `/channels/${channelId}/questions/${qId}/upvote`,
  );
  return res.data;
}
