import { post, put, readList, readOne } from './http';

/** Content namespace — news, videos, blogs, channels, workshops, expert talks. */
export const content = {
  // --- news & blogs & videos ---
  /** GET /news */
  news: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/news', { params }),

  /** GET /blogs */
  blogs: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/blogs', { params }),

  /** POST /blogs/{id}/bookmark */
  bookmarkBlog: (blogId: string): Promise<unknown> => post<unknown>(`/blogs/${blogId}/bookmark`),

  /** POST /blogs/{id}/like */
  likeBlog: (blogId: string): Promise<unknown> => post<unknown>(`/blogs/${blogId}/like`),

  /** GET /videos */
  videos: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/videos', { params }),

  // --- workshops & expert talks ---
  /** GET /workshops */
  workshops: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/workshops', { params }),

  /** POST /workshops/{id}/enroll */
  enrollWorkshop: (workshopId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/workshops/${workshopId}/enroll`, payload),

  /** POST /workshops/{id}/enroll/verify */
  verifyWorkshopEnrollment: (workshopId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/workshops/${workshopId}/enroll/verify`, payload),

  /** GET /expert-talks */
  expertTalks: (): Promise<unknown[]> => readList<unknown[]>('/expert-talks'),

  /** POST /expert-talks/{id}/register */
  registerTalk: (talkId: string): Promise<unknown> => post<unknown>(`/expert-talks/${talkId}/register`),

  /** POST /expert-talks/{id}/questions */
  askTalkQuestion: (talkId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/expert-talks/${talkId}/questions`, payload),

  // --- channels ---
  /** GET /channels */
  channels: (): Promise<unknown[]> => readList<unknown[]>('/channels'),

  /** POST /channels */
  createChannel: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/channels', payload),

  /** GET /channels/schedule */
  channelSchedule: (): Promise<unknown[]> => readList<unknown[]>('/channels/schedule'),

  /** POST /channels/schedule/{bcastId}/remind */
  remindBroadcast: (bcastId: string): Promise<unknown> =>
    post<unknown>(`/channels/schedule/${bcastId}/remind`),

  /** GET /channels/{id}/chat */
  channelChat: (channelId: string, params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>(`/channels/${channelId}/chat`, { params }),

  /** POST /channels/{id}/chat */
  postChannelChat: (channelId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/channels/${channelId}/chat`, payload),

  /** PUT /channels/{id}/pin */
  pinChannelMessage: (channelId: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/channels/${channelId}/pin`, payload),

  /** GET /channels/{id}/polls */
  polls: (channelId: string): Promise<unknown[]> => readList<unknown[]>(`/channels/${channelId}/polls`),

  /** POST /channels/{id}/polls */
  createPoll: (channelId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/channels/${channelId}/polls`, payload),

  /** POST /channels/{id}/polls/{pollId}/vote */
  votePoll: (channelId: string, pollId: string, optionId: string): Promise<unknown> =>
    post<unknown>(`/channels/${channelId}/polls/${pollId}/vote`, { optionId }),

  /** GET /channels/{id}/questions */
  channelQuestions: (channelId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/channels/${channelId}/questions`),

  /** POST /channels/{id}/questions */
  askChannelQuestion: (channelId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/channels/${channelId}/questions`, payload),

  /** POST /channels/{id}/questions/{qId}/upvote */
  upvoteQuestion: (channelId: string, qId: string): Promise<unknown> =>
    post<unknown>(`/channels/${channelId}/questions/${qId}/upvote`),

  /** PUT /channels/{id}/questions/{qId}/answer */
  answerQuestion: (channelId: string, qId: string, payload: Record<string, unknown>): Promise<unknown> =>
    put<unknown>(`/channels/${channelId}/questions/${qId}/answer`, payload),

  /** POST /channels/{id}/gift */
  giftChannel: (channelId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/channels/${channelId}/gift`, payload),
};
