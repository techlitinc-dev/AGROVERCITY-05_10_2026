import { create } from 'zustand';
import type { UserProfile, PersonaType } from '../types';
import type { AuthTokens } from '../lib/api';
import { auth } from '../lib/api';

interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  refreshToken: string | null;
  activePersona: PersonaType;
  isAuthenticated: boolean;
  /** Persist tokens to localStorage (the axios interceptor reads them from there). */
  login: (user: UserProfile, tokens?: AuthTokens) => void;
  logout: () => void;
  switchPersona: (persona: PersonaType) => void;
  updateCoins: (delta: number) => void;
  setKycStatus: (status: UserProfile['kycStatus']) => void;
}

const ACCESS_KEY = 'agrovercity_access_token';
const REFRESH_KEY = 'agrovercity_refresh_token';
const PERSONA_KEY = 'agrovercity_active_persona';

const savedAccessToken = localStorage.getItem(ACCESS_KEY);
const savedRefreshToken = localStorage.getItem(REFRESH_KEY);
const savedPersona = (localStorage.getItem(PERSONA_KEY) as PersonaType) || 'farmer';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: savedAccessToken,
  refreshToken: savedRefreshToken,
  activePersona: savedPersona,
  isAuthenticated: !!savedAccessToken,

  login: (user, tokens) => {
    if (tokens?.accessToken) {
      localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    }
    if (tokens?.refreshToken) {
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    }
    localStorage.setItem(PERSONA_KEY, user.activePersona);
    set({
      user,
      accessToken: tokens?.accessToken ?? savedAccessToken,
      refreshToken: tokens?.refreshToken ?? savedRefreshToken,
      activePersona: user.activePersona,
      isAuthenticated: true,
    });
  },

  logout: () => {
    // Best-effort server-side session invalidation; local state clears regardless.
    auth.logout().catch(() => undefined);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(PERSONA_KEY);
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      activePersona: 'farmer',
      isAuthenticated: false,
    });
  },

  switchPersona: (persona) => {
    localStorage.setItem(PERSONA_KEY, persona);
    set((state) => ({
      activePersona: persona,
      user: state.user ? { ...state.user, activePersona: persona } : null,
    }));
  },

  updateCoins: (delta) => {
    set((state) => ({
      user: state.user
        ? { ...state.user, kisanCoins: Math.max(0, state.user.kisanCoins + delta) }
        : null,
    }));
  },

  setKycStatus: (status) => {
    set((state) => ({
      user: state.user ? { ...state.user, kycStatus: status } : null,
    }));
  },
}));
