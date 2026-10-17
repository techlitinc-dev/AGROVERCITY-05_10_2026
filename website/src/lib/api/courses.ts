import { post, readList, readOne } from './http';
import type { CourseItem } from '../../types';

/** Courses namespace — catalog, learning, reviews, Q&A, modules. */
export const courses = {
  // --- catalog ---
  /** GET /courses */
  list: (params?: Record<string, unknown>): Promise<CourseItem[]> =>
    readList<CourseItem>('/courses', { params }),

  /** GET /courses/{id} */
  get: (courseId: string): Promise<CourseItem> => readOne<CourseItem>(`/courses/${courseId}`),

  /** GET /courses/recommendations */
  recommendations: (): Promise<CourseItem[]> => readList<CourseItem>('/courses/recommendations'),

  /** GET /courses/{id}/curriculum */
  curriculum: (courseId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/courses/${courseId}/curriculum`),

  // --- enroll & learn ---
  /** POST /courses/{id}/enroll */
  enroll: (courseId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/enroll`, payload),

  /** POST /courses/{id}/purchase */
  purchase: (courseId: string, payload: Record<string, unknown> = {}): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/purchase`, payload),

  /** POST /courses/purchases/verify */
  verifyPurchase: (payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>('/courses/purchases/verify', payload),

  /** GET /courses/purchased/list */
  purchased: (): Promise<unknown[]> => readList<unknown[]>('/courses/purchased/list'),

  /** GET /courses/my-learning */
  myLearning: (): Promise<unknown[]> => readList<unknown[]>('/courses/my-learning'),

  /** GET /courses/{id}/learn */
  learn: (courseId: string): Promise<unknown> => readOne<unknown>(`/courses/${courseId}/learn`),

  /** POST /courses/{id}/lessons/{lessonId}/progress */
  lessonProgress: (courseId: string, lessonId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/lessons/${lessonId}/progress`, payload),

  /** GET /courses/{id}/progress */
  progress: (courseId: string): Promise<unknown> => readOne<unknown>(`/courses/${courseId}/progress`),

  /** GET /courses/{id}/certificate */
  certificate: (courseId: string): Promise<unknown> => readOne<unknown>(`/courses/${courseId}/certificate`),

  // --- reviews & Q&A ---
  /** GET /courses/{id}/reviews */
  reviews: (courseId: string): Promise<unknown[]> => readList<unknown[]>(`/courses/${courseId}/reviews`),

  /** POST /courses/{id}/reviews */
  addReview: (courseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/reviews`, payload),

  /** GET /courses/{id}/questions */
  questions: (courseId: string): Promise<unknown[]> =>
    readList<unknown[]>(`/courses/${courseId}/questions`),

  /** POST /courses/{id}/questions */
  askQuestion: (courseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/questions`, payload),

  /** POST /courses/{id}/questions/{questionId}/answers */
  answerQuestion: (courseId: string, questionId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/questions/${questionId}/answers`, payload),

  // --- instructor authoring ---
  /** GET /courses/mine */
  mine: (): Promise<CourseItem[]> => readList<CourseItem>('/courses/mine'),

  /** POST /courses */
  create: (payload: Record<string, unknown>): Promise<CourseItem> =>
    post<CourseItem>('/courses', payload),

  /** PUT /courses/{id} */
  update: (courseId: string, updates: Record<string, unknown>): Promise<CourseItem> =>
    post<CourseItem>(`/courses/${courseId}`, updates),

  /** DELETE /courses/{id} */
  remove: (courseId: string): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(`/courses/${courseId}`),

  /** POST /courses/{id}/modules */
  addModule: (courseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/modules`, payload),

  /** PUT /courses/{id}/modules/{moduleId} */
  updateModule: (courseId: string, moduleId: string, updates: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/modules/${moduleId}`, updates),

  /** DELETE /courses/{id}/modules/{moduleId} */
  removeModule: (courseId: string, moduleId: string): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(`/courses/${courseId}/modules/${moduleId}`),

  /** POST /courses/{id}/assignments */
  addAssignment: (courseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/assignments`, payload),

  /** POST /assignments/{id}/submissions */
  submitAssignment: (assignmentId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/assignments/${assignmentId}/submissions`, payload),

  /** POST /sessions/{id}/check-in */
  sessionCheckIn: (sessionId: string): Promise<unknown> => post<unknown>(`/sessions/${sessionId}/check-in`),

  /** POST /courses/{id}/enquiries */
  sendEnquiry: (courseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/enquiries`, payload),

  // --- purchase support ---
  /** GET /courses/purchases/{id}/contract */
  purchaseContract: (purchaseId: string): Promise<unknown> =>
    readOne<unknown>(`/courses/purchases/${purchaseId}/contract`),

  /** POST /courses/purchases/{id}/cancel */
  cancelPurchase: (purchaseId: string, reason?: string): Promise<unknown> =>
    post<unknown>(`/courses/purchases/${purchaseId}/cancel`, reason ? { reason } : {}),

  /** POST /courses/purchases/{id}/disputes */
  disputePurchase: (purchaseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/purchases/${purchaseId}/disputes`, payload),

  /** POST /courses/{id}/chat */
  courseChat: (courseId: string, payload: Record<string, unknown>): Promise<unknown> =>
    post<unknown>(`/courses/${courseId}/chat`, payload),
};
