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
  /** Persist tokens & profile to localStorage. */
  login: (user: UserProfile, tokens?: AuthTokens) => void;
  logout: () => void;
  switchPersona: (persona: PersonaType) => void;
  updateCoins: (delta: number) => void;
  setKycStatus: (status: UserProfile['kycStatus']) => void;
  setUser: (user: UserProfile) => void;
}

const ACCESS_KEY = 'agrovercity_access_token';
const REFRESH_KEY = 'agrovercity_refresh_token';
const PERSONA_KEY = 'agrovercity_active_persona';
const USER_KEY = 'agrovercity_user';

export function normalizeUserProfile(rawUser: any): UserProfile {
  if (!rawUser) {
    return {
      id: 'usr_default',
      phone: '9876543210',
      name: 'Kisan User',
      state: 'Maharashtra',
      district: 'Nashik',
      village: 'Pimpalgaon Baswant',
      pincode: '422006',
      activePersona: 'farmer',
      availablePersonas: ['farmer'],
      kycStatus: 'verified',
      hasMpin: true,
      farmSizeAcres: 4.5,
      kisanCoins: 15,
    };
  }

  const activePersona: PersonaType = (
    rawUser.activePersona ||
    rawUser.activeProfile ||
    rawUser.primaryProfile ||
    'farmer'
  ) as PersonaType;

  const availablePersonas: PersonaType[] = (
    rawUser.availablePersonas ||
    rawUser.linkedProfiles ||
    [activePersona]
  ) as PersonaType[];

  return {
    id: rawUser.id || rawUser.uid || 'usr_default',
    phone: rawUser.phone ? String(rawUser.phone).replace(/^\+91/, '') : '9876543210',
    name: rawUser.name || 'Kisan User',
    state: rawUser.state || 'Maharashtra',
    district: rawUser.district || 'Nashik',
    village: rawUser.village || 'Pimpalgaon Baswant',
    pincode: rawUser.pincode || '422006',
    activePersona,
    availablePersonas,
    kycStatus: rawUser.kycStatus || 'verified',
    hasMpin: rawUser.hasMpin ?? true,
    avatarUrl: rawUser.avatarUrl || '',
    farmSizeAcres: rawUser.farmSizeAcres ?? rawUser.landAreaAcres ?? 4.5,
    kisanCoins: rawUser.kisanCoins ?? rawUser.agriCoins ?? 15,
  };
}

const savedAccessToken = localStorage.getItem(ACCESS_KEY);
const savedRefreshToken = localStorage.getItem(REFRESH_KEY);

const rawSavedPersona = localStorage.getItem(PERSONA_KEY);
const savedPersona: PersonaType =
  rawSavedPersona && rawSavedPersona !== 'undefined' && rawSavedPersona !== 'null'
    ? (rawSavedPersona as PersonaType)
    : 'farmer';

let savedUser: UserProfile | null = null;
try {
  const rawUserJson = localStorage.getItem(USER_KEY);
  if (rawUserJson && rawUserJson !== 'undefined' && rawUserJson !== 'null') {
    savedUser = normalizeUserProfile(JSON.parse(rawUserJson));
  }
} catch {
  savedUser = null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: savedUser,
  accessToken: savedAccessToken,
  refreshToken: savedRefreshToken,
  activePersona: savedUser?.activePersona || savedPersona,
  isAuthenticated: !!(savedAccessToken && (savedAccessToken !== 'undefined' && savedAccessToken !== 'null')),

  login: (rawUser, tokens) => {
    const user = normalizeUserProfile(rawUser);

    if (tokens?.accessToken) {
      localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    }
    if (tokens?.refreshToken) {
      localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
    }
    localStorage.setItem(PERSONA_KEY, user.activePersona);
    localStorage.setItem(USER_KEY, JSON.stringify(user));

    set({
      user,
      accessToken: tokens?.accessToken ?? savedAccessToken,
      refreshToken: tokens?.refreshToken ?? savedRefreshToken,
      activePersona: user.activePersona,
      isAuthenticated: true,
    });
  },

  logout: () => {
    auth.logout().catch(() => undefined);
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(PERSONA_KEY);
    localStorage.removeItem(USER_KEY);
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
    set((state) => {
      const updatedUser = state.user ? { ...state.user, activePersona: persona } : null;
      if (updatedUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      }
      return {
        activePersona: persona,
        user: updatedUser,
      };
    });
  },

  updateCoins: (delta) => {
    set((state) => {
      const updatedUser = state.user
        ? { ...state.user, kisanCoins: Math.max(0, state.user.kisanCoins + delta) }
        : null;
      if (updatedUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      }
      return { user: updatedUser };
    });
  },

  setKycStatus: (status) => {
    set((state) => {
      const updatedUser = state.user ? { ...state.user, kycStatus: status } : null;
      if (updatedUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      }
      return { user: updatedUser };
    });
  },

  setUser: (rawUser) => {
    const user = normalizeUserProfile(rawUser);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(PERSONA_KEY, user.activePersona);
    set({
      user,
      activePersona: user.activePersona,
    });
  },
}));
