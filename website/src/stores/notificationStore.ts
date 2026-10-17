import { create } from 'zustand';
import type { AppNotification } from '../types';
import { notifications as notificationsApi } from '../lib/api';

interface NotificationState {
  notifications: AppNotification[];
  isOpen: boolean;
  loaded: boolean;
  /** Fetch the paged inbox from the backend (no marking read). */
  refresh: () => Promise<void>;
  /** Open/close the drawer; opening loads the inbox and batch-reads unread items. */
  setIsOpen: (open: boolean) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (notification: AppNotification) => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  isOpen: false,
  loaded: false,

  refresh: async () => {
    try {
      // Unread-only fetch — the bell badge only needs these, and opening the
      // drawer re-lists the full inbox via setIsOpen(true).
      const items = await notificationsApi.list({ page: 1, pageSize: 50, unread: true });
      set({ notifications: items, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },

  setIsOpen: (open) => {
    set({ isOpen: open });
    if (!open) return;
    void (async () => {
      try {
        const items = await notificationsApi.list({ page: 1, pageSize: 50 });
        const unreadIds = items.filter((n) => !n.read).map((n) => n.id);
        set({ notifications: items, loaded: true });
        if (unreadIds.length > 0) {
          try {
            await notificationsApi.batchRead(unreadIds);
            set((state) => ({
              notifications: state.notifications.map((n) =>
                unreadIds.includes(n.id) ? { ...n, read: true } : n
              ),
            }));
          } catch {
            // Batch read failed — badges stay until the next open.
          }
        }
      } catch {
        set({ loaded: true });
      }
    })();
  },

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
    notificationsApi.markRead(id).catch(() => undefined);
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
    notificationsApi.markAllRead().catch(() => undefined);
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
    }));
  },

  getUnreadCount: () => get().notifications.filter((n) => !n.read).length,
}));
