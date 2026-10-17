import { create } from 'zustand';
import type { UserProfile, PersonaType } from '../types';
import { INITIAL_USER } from '../lib/api';

interface AuthState {
  user: UserProfile | null;
  token: string | null;
  activePersona: PersonaType;
  isAuthenticated: boolean;
  login: (user: UserProfile, token: string) => void;
  logout: () => void;
  switchPersona: (persona: PersonaType) => void;
  updateCoins: (delta: number) => void;
  setKycStatus: (status: UserProfile['kycStatus']) => void;
}

const savedToken = localStorage.getItem('agrovercity_access_token');
const savedPersona = (localStorage.getItem('agrovercity_active_persona') as PersonaType) || 'farmer';

export const useAuthStore = create<AuthState>((set) => ({
  user: INITIAL_USER,
  token: savedToken || 'dev_session_token',
  activePersona: savedPersona,
  isAuthenticated: true,

  login: (user, token) => {
    localStorage.setItem('agrovercity_access_token', token);
    localStorage.setItem('agrovercity_active_persona', user.activePersona);
    set({
      user,
      token,
      activePersona: user.activePersona,
      isAuthenticated: true,
    });
  },

  logout: () => {
    localStorage.removeItem('agrovercity_access_token');
    localStorage.removeItem('agrovercity_refresh_token');
    localStorage.removeItem('agrovercity_active_persona');
    set({
      user: null,
      token: null,
      activePersona: 'farmer',
      isAuthenticated: false,
    });
  },

  switchPersona: (persona) => {
    localStorage.setItem('agrovercity_active_persona', persona);
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
