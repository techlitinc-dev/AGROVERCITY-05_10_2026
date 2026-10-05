import { api } from './client';

/**
 * Courses API wrapper (phase-04 WS-01 — Krishi Academy learner side).
 *
 * Mirrors backend/app/routers/courses.py (mounted at /v1, no own prefix) and
 * the coin balance from backend/app/routers/gamification.py.
 *
 * Backend quirks documented inline:
 * - `priceRupees` is a rupee float on the doc; the purchase/enroll order is
 *   created with integer paisa via `int(remaining * 100)` server-side.
 * - `coinsDiscountAllowed` is the max coins the instructor permits on a course;
 *   the ≤50%-of-order cap is enforced server-side on the enroll endpoint.
 * - List endpoints return the `{ data, page, pageSize, total }` envelope.
 */

export interface InstructorCredential {
  type: string;
  verifiedAt?: string;
}

export interface CourseSummary {
  id: string;
  title: string;
  subtitle?: string;
  category: string;
  level: string;
  language: string;
  priceRupees: number;
  coinsDiscountAllowed: number;
  ratingAverage?: number;
  ratingCount?: number;
  instructorId: string;
  instructorName: string;
  instructorCredentials?: InstructorCredential[];
  status: string;
  isPurchased?: boolean;
}

export interface CourseLesson {
  id: string;
  title: string;
  description?: string;
  kind?: string;
  durationMinutes?: number;
  mediaUrl?: string | null;
  previewUrl?: string | null;
  isPreviewFree?: boolean;
  order?: number;
}

export interface CourseModule {
  id: string;
  title: string;
  description?: string;
  order?: number;
  lessons: CourseLesson[];
}

export interface CourseDetail extends CourseSummary {
  description?: string;
  thumbnailUrl?: string | null;
  certificateEnabled?: boolean;
  certificateTitle?: string;
  whatYouWillLearn?: string[];
  requirements?: string[];
  targetAudience?: string[];
  modules?: CourseModule[];
  tags?: string[];
  isOwner?: boolean;
}

export interface CourseReview {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  rating: number;
  reviewText: string;
  createdAt: string;
}

export interface CourseAnswer {
  id: string;
  userId: string;
  userName: string;
  isInstructor: boolean;
  answer: string;
  createdAt: string;
}

export interface CourseQuestion {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  question: string;
  answers: CourseAnswer[];
  createdAt: string;
}

export interface Paged<T> {
  data: T[];
  page?: number;
  pageSize?: number;
  total: number;
}

export interface ListCoursesParams {
  category?: string;
  level?: string;
  language?: string;
  maxPrice?: number;
  freeOnly?: boolean;
  search?: string;
  page?: number;
  pageSize?: number;
}

/** `GET /v1/courses` — published catalog with server-side filtering. */
export async function listCourses(params: ListCoursesParams = {}): Promise<Paged<CourseSummary>> {
  const res = await api.get<Paged<CourseSummary>>('/courses', {
    params: {
      category: params.category,
      level: params.level,
      language: params.language,
      // Backend param name is `priceMax` (rupees).
      priceMax: params.maxPrice,
      // Backend param name is `isFree` (true = free only, false = paid only).
      isFree: params.freeOnly,
      search: params.search,
      page: params.page,
      pageSize: params.pageSize,
    },
  });
  return res.data;
}

/** `GET /v1/courses/{id}` — detail; modules/lessons hidden until entitled. */
export async function getCourse(courseId: string): Promise<CourseDetail> {
  const res = await api.get<CourseDetail>(`/courses/${courseId}`);
  return res.data;
}

export interface CourseRecommendation {
  courseId: string;
  relevance: number;
  badges: string[];
}

export interface CourseRecommendations {
  data: CourseRecommendation[];
  source: 'ai' | 'fallback';
}

/**
 * `GET /v1/courses/recommendations` — per-farmer course relevance (WS-06).
 * `suggest` level: annotate only. Backend quirk: on shim/flag-off/outage the
 * body is `source: 'fallback'` but the SAME `{ data, source }` shape with the
 * deterministic crop-category ordering — render identically with no badge.
 */
export async function getCourseRecommendations(): Promise<CourseRecommendations> {
  const res = await api.get<CourseRecommendations>('/courses/recommendations');
  return res.data;
}

/** `GET /v1/courses/my-learning` — learner's in-progress library. */
export async function getMyLearning(): Promise<Paged<CourseSummary & {
  progressPercent?: number;
  isCompleted?: boolean;
  certificateId?: string | null;
}>> {
  const res = await api.get<Paged<CourseSummary & {
    progressPercent?: number;
    isCompleted?: boolean;
    certificateId?: string | null;
  }>>('/courses/my-learning');
  return res.data;
}

/** `GET /v1/courses/purchased/list` — paid library incl. certificateId. */
export async function getPurchasedCourses(): Promise<Paged<CourseSummary & {
  purchasedAt?: string;
  progressPercent?: number;
  isCompleted?: boolean;
  certificateId?: string | null;
}>> {
  const res = await api.get<Paged<CourseSummary & {
    purchasedAt?: string;
    progressPercent?: number;
    isCompleted?: boolean;
    certificateId?: string | null;
  }>>('/courses/purchased/list');
  return res.data;
}

interface GamificationStatus {
  agriCoins: number;
}

/** `GET /v1/gamification/status` — current AgriCoins balance. */
export async function getCoinBalance(): Promise<number> {
  const res = await api.get<GamificationStatus>('/gamification/status');
  return res.data.agriCoins;
}

export interface PurchaseResult {
  purchased: boolean;
  courseId: string;
  paymentOrderId?: string;
  amountDue?: number;
}

export interface EnrollResult {
  enrolled: boolean;
  courseId: string;
  alreadyEnrolled?: boolean;
  amountPaid?: number;
  paymentOrderId?: string;
  amountDue?: number;
}

/**
 * `POST /v1/courses/{id}/purchase` — free courses flip to `purchased: true`
 * immediately; paid courses return a Razorpay `paymentOrderId` (backend quirk:
 * this endpoint takes NO body — coin redemption is a separate enroll call).
 */
export async function purchaseCourse(courseId: string): Promise<PurchaseResult> {
  const res = await api.post<PurchaseResult>(`/courses/${courseId}/purchase`);
  return res.data;
}

/**
 * `POST /v1/courses/{id}/enroll` — coin redemption lives HERE (backend quirk:
 * `/purchase` takes no body). Server validates
 * `coinsToRedeem ≤ min(coinsDiscountAllowed, fee, 50%-of-order)` and returns
 * `enrolled: true` (fee fully covered by coins) or a `paymentOrderId` for the
 * remaining amount. The client wrapper must never pre-round the coin maths.
 */
export async function enrollCourse(
  courseId: string,
  opts: { useCoins: boolean; coinsToRedeem: number },
): Promise<EnrollResult> {
  const res = await api.post<EnrollResult>(`/courses/${courseId}/enroll`, {
    useCoins: opts.useCoins,
    coinsToRedeem: opts.coinsToRedeem,
  });
  return res.data;
}

export interface VerifyPurchaseBody {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

/** `POST /v1/courses/purchases/verify` — Razorpay signature verify (idempotent). */
export async function verifyCoursePurchase(body: VerifyPurchaseBody): Promise<{ purchased: boolean; courseId: string }> {
  const res = await api.post<{ purchased: boolean; courseId: string }>('/courses/purchases/verify', body);
  return res.data;
}

export interface UserProgress {
  completedLessonIds: string[];
  progressPercent: number;
  isCompleted: boolean;
  certificateId: string | null;
  lastAccessedAt?: string;
}

export interface CourseLearning extends CourseDetail {
  userProgress: UserProgress;
}

/** `GET /v1/courses/{id}/learn` — classroom payload; all mediaUrls unlocked. */
export async function getCourseLearning(courseId: string): Promise<CourseLearning> {
  const res = await api.get<CourseLearning>(`/courses/${courseId}/learn`);
  return res.data;
}

export interface LessonProgressResult {
  success: boolean;
  completedLessonIds: string[];
  progressPercent: number;
  isCompleted: boolean;
  certificateId: string | null;
}

/** `POST /v1/courses/{id}/lessons/{lesson_id}/progress` — mark lesson complete. */
export async function postLessonProgress(
  courseId: string,
  lessonId: string,
  body: { completed: boolean },
): Promise<LessonProgressResult> {
  const res = await api.post<LessonProgressResult>(
    `/courses/${courseId}/lessons/${lessonId}/progress`,
    body,
  );
  return res.data;
}

export interface CertificateResult {
  certificateId: string;
  courseId: string;
  courseTitle: string;
  certificateTitle: string;
  studentId: string;
  studentName: string;
  instructorName: string;
  instructorHeadline: string;
  issuedAt: string;
  institution: string;
  verificationUrl: string;
  /** WS-06 learning-path suggestion attached when the certificate is issued. */
  learningPath?: { courseIds: string[]; source: 'ai' | 'fallback' } | null;
}

/** `GET /v1/courses/{id}/certificate` — response includes `verificationUrl`. */
export async function getCertificate(courseId: string): Promise<CertificateResult> {
  const res = await api.get<CertificateResult>(`/courses/${courseId}/certificate`);
  return res.data;
}

/** `GET /v1/courses/{id}/reviews` — newest-first learner reviews. */
export async function listReviews(courseId: string): Promise<Paged<CourseReview>> {
  const res = await api.get<Paged<CourseReview>>(`/courses/${courseId}/reviews`);
  return res.data;
}

/**
 * `POST /v1/courses/{id}/reviews` — one review per learner (id derives from
 * uid+course). Caller passes `comment`; the backend field is `reviewText`.
 */
export async function addReview(
  courseId: string,
  body: { rating: number; comment: string },
): Promise<CourseReview> {
  const res = await api.post<CourseReview>(`/courses/${courseId}/reviews`, {
    rating: body.rating,
    reviewText: body.comment,
  });
  return res.data;
}

/** `GET /v1/courses/{id}/questions` — newest-first Q&A threads. */
export async function listQuestions(courseId: string): Promise<Paged<CourseQuestion>> {
  const res = await api.get<Paged<CourseQuestion>>(`/courses/${courseId}/questions`);
  return res.data;
}

/** `POST /v1/courses/{id}/questions` — ask a question on the course. */
export async function postQuestion(
  courseId: string,
  body: { question: string },
): Promise<CourseQuestion> {
  const res = await api.post<CourseQuestion>(`/courses/${courseId}/questions`, body);
  return res.data;
}

/** `POST /v1/courses/{id}/questions/{qid}/answers` — instructor or learner answer. */
export async function postAnswer(
  courseId: string,
  questionId: string,
  body: { answer: string },
): Promise<CourseAnswer> {
  const res = await api.post<CourseAnswer>(
    `/courses/${courseId}/questions/${questionId}/answers`,
    body,
  );
  return res.data;
}

export interface CertificateVerificationPublic {
  isValid: boolean;
  certificateId: string;
  recipientName: string;
  courseTitle: string;
  issuedAt: string;
  credential?: string;
}

/**
 * `GET /v1/teachers/certificates/verify/{id}` — PUBLIC endpoint (employers and
 * third parties verify a certificate). No auth header is required, so this is
 * safe to call while logged out on /verify/cert/:certificateId. Unknown ids
 * return a 404 with the standard `{ error: { code, ... } }` envelope.
 */
export async function verifyCertificatePublic(certificateId: string): Promise<CertificateVerificationPublic> {
  const res = await api.get<CertificateVerificationPublic>(
    `/teachers/certificates/verify/${certificateId}`,
  );
  return res.data;
}
