import { post, put, readList, readOne } from './http';
import { MOCK_NOTIFICATIONS } from './mocks';
import type { AppNotification } from '../../types';

/** Notifications namespace — paged list, read/read-all/batch-read, preferences. */
export const notifications = {
  /** GET /notifications — paged list. */
  list: (params?: Record<string, unknown>): Promise<AppNotification[]> =>
    readList<AppNotification>('/notifications', { params, mock: MOCK_NOTIFICATIONS }),

  /** POST /notifications/{id}/read */
  markRead: (notificationId: string): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(`/notifications/${notificationId}/read`),

  /** PUT /notifications/read-all */
  markAllRead: (): Promise<{ success: boolean }> =>
    put<{ success: boolean }>('/notifications/read-all'),

  /** POST /notifications/read — batch mark-read by ID list (D3). */
  batchRead: (notificationIds: string[]): Promise<{ success: boolean }> =>
    post<{ success: boolean }>('/notifications/read', { notificationIds }),

  /** GET /notifications/preferences */
  getPreferences: (): Promise<Record<string, unknown>> =>
    readOne<Record<string, unknown>>('/notifications/preferences'),

  /** PUT /notifications/preferences */
  updatePreferences: (preferences: Record<string, unknown>): Promise<Record<string, unknown>> =>
    put<Record<string, unknown>>('/notifications/preferences', preferences),
};
