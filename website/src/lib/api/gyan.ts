import { api } from './client';

/**
 * Gyan Hub API wrapper (phase-04 WS-04 — knowledge home).
 *
 * Mirrors backend/app/routers/gyan.py (mounted at /v1, no own prefix).
 *
 * Backend quirks documented inline:
 * - Workshop enrollment validates `1 ≤ coinsToRedeem ≤ min(coinsDiscountAllowed,
 *   feeRupees, 50%-of-order)` server-side; a partial redemption returns a
 *   Razorpay `paymentOrderId` for the remainder, a full one returns
 *   `enrolled: true`.
 * - `POST /workshops/{id}/enroll/verify` is idempotent — a duplicate verify is
 *   a no-op (no double `enrolledCount`).
 * - Expert-talk registration awards a nominal +25 AgriCoins; the actual credit
 *   is throttled by the 200/day earn cap server-side.
 * - List endpoints return the `{ data, page, pageSize, total }` envelope.
 */

export interface Paged<T> {
  data: T[];
  page?: number;
  pageSize?: number;
  total: number;
}

export interface WorkshopSummary {
  id: string;
  title: string;
  instructor: string;
  instructorRole?: string;
  institution?: string;
  feeRupees: number;
  coinsDiscountAllowed: number;
  duration?: string;
  batchDate?: string;
  timing?: string;
  rating?: number;
  enrolledCount: number;
  totalSeats: number;
  isCertified?: boolean;
  certificateTitle?: string;
  syllabusModules?: string[];
  deliverables?: string[];
  isEnrolled: boolean;
  /** Optional back-reference to the instructor's academy courses (WS-01). */
  instructorId?: string;
  createdAt?: string;
}

export interface EnrollWorkshopOpts {
  useCoins: boolean;
  coinsToRedeem: number;
}

export interface WorkshopEnrollResult {
  enrolled: boolean;
  paymentOrderId?: string;
  amountDue?: number;
}

export interface VerifyWorkshopBody {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface ExpertTalk {
  id: string;
  expertName: string;
  institution: string;
  topic: string;
  scheduledTime: string;
  isLive: boolean;
  registeredCount: number;
  description: string;
  isRegistered?: boolean;
  instructorId?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  instructor: string;
  duration: string;
  views: string;
  category: string;
  videoUrl: string;
  summary: string;
  keyPoints: string[];
  createdAt?: string;
}

export interface BlogItem {
  id: string;
  title: string;
  author: string;
  authorRole: string;
  readTimeMinutes: string;
  category: string;
  summary: string;
  content: string;
  publishedDate: string;
  likesCount: number;
  isBookmarked: boolean;
  createdAt?: string;
}

/** `GET /v1/workshops` — workshop catalog with the caller's enrollment flag. */
export async function listWorkshops(): Promise<Paged<WorkshopSummary>> {
  const res = await api.get<Paged<WorkshopSummary>>('/workshops');
  return res.data;
}

/**
 * `POST /v1/workshops/{id}/enroll` — coin redemption lives here; returns
 * `enrolled: true` when the fee is covered, else a `paymentOrderId` for the
 * remaining amount (integer paisa is derived server-side).
 */
export async function enrollWorkshop(
  workshopId: string,
  opts: EnrollWorkshopOpts,
): Promise<WorkshopEnrollResult> {
  const res = await api.post<WorkshopEnrollResult>(`/workshops/${workshopId}/enroll`, {
    useCoins: opts.useCoins,
    coinsToRedeem: opts.coinsToRedeem,
  });
  return res.data;
}

/** `POST /v1/workshops/{id}/enroll/verify` — Razorpay signature verify (idempotent). */
export async function verifyWorkshopEnroll(
  workshopId: string,
  body: VerifyWorkshopBody,
): Promise<{ enrolled: boolean }> {
  const res = await api.post<{ enrolled: boolean }>(
    `/workshops/${workshopId}/enroll/verify`,
    body,
  );
  return res.data;
}

/** `GET /v1/expert-talks` — scheduled/live expert talks. */
export async function listExpertTalks(): Promise<Paged<ExpertTalk>> {
  const res = await api.get<Paged<ExpertTalk>>('/expert-talks');
  return res.data;
}

/** `POST /v1/expert-talks/{id}/register` — response carries `agriCoinsEarned`. */
export async function registerExpertTalk(
  talkId: string,
): Promise<{ registered: boolean; agriCoinsEarned: number }> {
  const res = await api.post<{ registered: boolean; agriCoinsEarned: number }>(
    `/expert-talks/${talkId}/register`,
  );
  return res.data;
}

/** `POST /v1/expert-talks/{id}/questions` — pre-talk question submission. */
export async function postTalkQuestion(
  talkId: string,
  question: string,
): Promise<{ asked: boolean }> {
  const res = await api.post<{ asked: boolean }>(`/expert-talks/${talkId}/questions`, {
    question,
  });
  return res.data;
}

/** `GET /v1/videos` — video library (optional category filter). */
export async function listVideos(category?: string): Promise<Paged<VideoItem>> {
  const res = await api.get<Paged<VideoItem>>('/videos', { params: { category } });
  return res.data;
}

/** `GET /v1/blogs` — blog list with the caller's bookmark flag. */
export async function listBlogs(category?: string): Promise<Paged<BlogItem>> {
  const res = await api.get<Paged<BlogItem>>('/blogs', { params: { category } });
  return res.data;
}

/** `POST /v1/blogs/{id}/bookmark` — toggle bookmark, returns the new state. */
export async function bookmarkBlog(blogId: string): Promise<{ isBookmarked: boolean }> {
  const res = await api.post<{ isBookmarked: boolean }>(`/blogs/${blogId}/bookmark`);
  return res.data;
}

/** `POST /v1/blogs/{id}/like` — idempotent like, returns the current count. */
export async function likeBlog(blogId: string): Promise<{ likesCount: number }> {
  const res = await api.post<{ likesCount: number }>(`/blogs/${blogId}/like`);
  return res.data;
}
