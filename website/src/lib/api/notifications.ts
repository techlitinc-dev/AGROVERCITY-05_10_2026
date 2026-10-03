import { api } from './client';
import type { Paged } from './trade';

/**
 * Notification inbox — verified against backend/app/routers/notifications.py.
 */

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body?: string;
  type?: string;
  read: boolean;
  createdAt: string;
  /** Deep link into the app (e.g. /dashboard/p/purchases/pur_xxx). */
  data?: { path?: string; type?: string } & Record<string, unknown>;
}

export async function listNotifications(params?: {
  page?: number;
  pageSize?: number;
}): Promise<Paged<AppNotification>> {
  const { data } = await api.get<Paged<AppNotification>>('/notifications', { params });
  return data;
}

export async function markRead(notificationId: string): Promise<unknown> {
  const { data } = await api.post(`/notifications/${notificationId}/read`);
  return data;
}

export async function markAllRead(): Promise<{ updated: number }> {
  const { data } = await api.put<{ updated: number }>('/notifications/read-all');
  return data;
}
