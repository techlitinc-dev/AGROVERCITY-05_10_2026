import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResponse, AuthUser } from '../lib/api/types';
import { useOnboardingStore } from './onboarding';

/** Apply the user's saved language so every page renders in it immediately. */
function applyUserLanguage(user: AuthUser | null | undefined): void {
  const lang = user?.preferredLanguage || user?.language;
  if (lang) useOnboardingStore.getState().setLanguage(lang);
}

interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isNewUser: boolean | null;
  mpinReentryRequired: boolean;
  setAuth: (r: AuthResponse) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  setUser: (user: AuthUser) => void;
  setMpinReentryRequired: (v: boolean) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isNewUser: null,
      mpinReentryRequired: false,
      setAuth: (r) => {
        applyUserLanguage(r.user);
        set({ accessToken: r.accessToken, refreshToken: r.refreshToken, user: r.user, isNewUser: r.isNewUser });
      },
      setTokens: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
      setUser: (user) => {
        applyUserLanguage(user);
        set({ user });
      },
      setMpinReentryRequired: (v) => set({ mpinReentryRequired: v }),
      clear: () => set({ accessToken: null, refreshToken: null, user: null, isNewUser: null, mpinReentryRequired: false }),
    }),
    { name: 'agvc-session' }
  )
);
