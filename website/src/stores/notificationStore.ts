import { create } from 'zustand';
import type { AppNotification } from '../types';
import { MOCK_NOTIFICATIONS } from '../lib/api';

interface NotificationState {
  notifications: AppNotification[];
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  markAsRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (notification: AppNotification) => void;
  getUnreadCount: () => number;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: MOCK_NOTIFICATIONS,
  isOpen: false,

  setIsOpen: (open) => set({ isOpen: open }),

  markAsRead: (id) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
    }));
  },

  markAllRead: () => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    }));
  },

  addNotification: (notification) => {
    set((state) => ({
      notifications: [notification, ...state.notifications],
    }));
  },

  getUnreadCount: () => {
    return get().notifications.filter((n) => !n.read).length;
  },
}));
