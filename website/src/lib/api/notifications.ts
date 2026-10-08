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
  data?: { deepLink?: string; type?: string } & Record<string, unknown>;
}

export interface NotificationPrefs {
  categories: Record<string, boolean>;
  channels: Record<string, boolean>;
  quietHoursOverride: boolean;
  digestMode: boolean;
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

/** Register a device (web push) token with the backend devices endpoint. */
export async function registerDevice(
  token: string,
  platform: string,
  locale = 'en'
): Promise<unknown> {
  const { data } = await api.post('/devices', { fcmToken: token, platform, locale });
  return data;
}

export async function getPreferences(): Promise<NotificationPrefs> {
  const { data } = await api.get<NotificationPrefs>('/notifications/preferences');
  return data;
}

export async function putPreferences(prefs: NotificationPrefs): Promise<NotificationPrefs> {
  const { data } = await api.put<NotificationPrefs>('/notifications/preferences', prefs);
  return data;
}
