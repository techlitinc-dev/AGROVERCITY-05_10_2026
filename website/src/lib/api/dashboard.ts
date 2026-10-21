import { post, readList, readOne } from './http';
import { apiClient } from './client';
import { unwrapList } from './http';
import type { PersonaType } from '../../types';

/** One open buyer demand surfaced on the farmer home. */
export interface BuyerOffer {
  id?: string;
  crop?: string;
  quantity?: number;
  unit?: string;
  budgetPerQuintal?: number;
  location?: string;
  offersCount?: number;
  createdAt?: string;
}

/** A published course recommended for the signed-in farmer. */
export interface CourseRec {
  id?: string;
  title?: string;
  instructorName?: string;
  category?: string;
  priceRupees?: number;
  thumbnailUrl?: string;
  ratingAverage?: number | null;
  ratingCount?: number;
  isFeatured?: boolean;
  createdAt?: string;
}

/** One active order/booking row inside a PendingOrdersGroup. */
export interface PendingOrderItem {
  id?: string;
  label?: string;
  status?: string;
  createdAt?: string;
  linkHint?: string;
}

export interface PendingOrdersGroup {
  count: number;
  items: PendingOrderItem[];
}

/** Active purchases + transport/equipment bookings on the farmer home. */
export interface PendingOrders {
  purchases: PendingOrdersGroup;
  transport: PendingOrdersGroup;
  equipment: PendingOrdersGroup;
}

/** GET /dashboard/home — persona-aware home dashboard payload. */
export interface DashboardHome {
  weather?: unknown;
  urgentTask?: unknown;
  mandiRates?: unknown[];
  banners?: unknown[];
  buyerOffers?: BuyerOffer[];
  learningRecommendations?: CourseRec[];
  pendingOrders?: PendingOrders;
  [key: string]: unknown;
}

/**
 * GET /courses/recommendations — per-farmer AI ranking rows
 * (`{courseId, relevance, badges}`). Lives here (not courses.ts) so the
 * dashboard/academy surfaces have one shared caller.
 */
export const getCourseRecommendations = async (): Promise<CourseRec[]> => {
  const res = await apiClient.get('/courses/recommendations');
  return unwrapList<CourseRec>(res.data?.data ?? res.data);
};

/** Dashboard namespace — home fan-out + per-persona dashboard widgets + tasks. */
export const dashboard = {
  /** GET /dashboard/home — persona-aware home dashboard. */
  home: (): Promise<DashboardHome> => readOne<DashboardHome>('/dashboard/home'),

  /** GET /users/me/dashboard/{type} — per-persona dashboard payload. */
  persona: (type: PersonaType): Promise<unknown> => readOne<unknown>(`/users/me/dashboard/${type}`),

  // --- fan-out helpers ---
  /** GET /weather */
  weather: (params?: Record<string, unknown>): Promise<unknown> => readOne<unknown>('/weather', { params }),

  /** GET /tasks/today */
  tasksToday: (): Promise<unknown[]> => readList<unknown[]>('/tasks/today'),

  /** GET /tasks */
  tasks: (params?: Record<string, unknown>): Promise<unknown[]> =>
    readList<unknown[]>('/tasks', { params }),

  /** GET /tasks/summary */
  tasksSummary: (): Promise<unknown> => readOne<unknown>('/tasks/summary'),

  /** POST /tasks/{taskId}/done */
  completeTask: (taskId: string): Promise<unknown> => post<unknown>(`/tasks/${taskId}/done`),

  /** POST /tasks/{taskId}/dismiss */
  dismissTask: (taskId: string): Promise<unknown> => post<unknown>(`/tasks/${taskId}/dismiss`),
};
