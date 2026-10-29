import { create } from 'zustand';
import type { UserProfile, PersonaType } from '../types';
import { auth, users, type AuthTokens } from '../lib/api';
import { normalizePersona } from '../lib/personas';
import { setPendingPersonaSync } from '../lib/personaSync';

/** Track the activation so the API gate serializes fetches behind it; errors stay swallowed (legacy behavior). */
const activatePersona = (persona: PersonaType): void => {
  setPendingPersonaSync(users.activateProfile(persona).catch(() => undefined));
};

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

  // Handle wrapped payloads e.g. { activeProfile, defaultHomeRoute, user: { ... } }
  const source =
    rawUser.user && typeof rawUser.user === 'object'
      ? { ...rawUser.user, ...rawUser }
      : rawUser;

  const rawActive =
    source.activePersona ||
    source.activeProfile ||
    source.primaryProfile ||
    rawUser.activePersona ||
    rawUser.activeProfile ||
    rawUser.primaryProfile ||
    'farmer';
  const activePersona: PersonaType = normalizePersona(rawActive);

  const rawAvailable =
    source.availablePersonas ||
    source.linkedProfiles ||
    source.profiles ||
    rawUser.availablePersonas ||
    rawUser.linkedProfiles ||
    rawUser.profiles ||
    [activePersona];

  const availableList = Array.isArray(rawAvailable) ? rawAvailable : [rawAvailable];
  const availablePersonas: PersonaType[] = Array.from(
    new Set(availableList.filter(Boolean).map(normalizePersona))
  );

  if (activePersona && !availablePersonas.includes(activePersona)) {
    availablePersonas.unshift(activePersona);
  }

  // Personas the user hid (hide ≠ unlink). Stored backend-side as
  // `disabledProfiles`; normalise every entry like any other persona alias.
  const rawDisabled =
    source.disabledProfiles || source.disabledPersonas || rawUser.disabledProfiles || [];
  const disabledList = Array.isArray(rawDisabled) ? rawDisabled : [];
  const disabledPersonas: PersonaType[] = Array.from(
    new Set(disabledList.filter(Boolean).map(normalizePersona))
  );

  // Self-heal: if the stored active persona was hidden, fall back to the first
  // enabled one (primary first when available) — mirrors the backend rule.
  let effectiveActive = activePersona;
  if (disabledPersonas.includes(effectiveActive)) {
    const primaryNorm = normalizePersona(source.primaryProfile || '');
    const fallback =
      (primaryNorm && !disabledPersonas.includes(primaryNorm) && availablePersonas.includes(primaryNorm)
        ? primaryNorm
        : undefined) ||
      availablePersonas.find((p) => !disabledPersonas.includes(p)) ||
      effectiveActive;
    effectiveActive = fallback;
  }

  return {
    id: source.id || source.uid || 'usr_default',
    phone: source.phone ? String(source.phone).replace(/^\+91/, '') : '9876543210',
    name: source.name || 'Kisan User',
    state: source.state || 'Maharashtra',
    district: source.district || 'Nashik',
    village: source.village || 'Pimpalgaon Baswant',
    pincode: source.pincode || '422006',
    activePersona: effectiveActive,
    availablePersonas,
    disabledPersonas,
    kycStatus: source.kycStatus || 'verified',
    hasMpin: source.hasMpin ?? true,
    avatarUrl: source.avatarUrl || '',
    farmSizeAcres: source.farmSizeAcres ?? source.landAreaAcres ?? 4.5,
    kisanCoins: source.kisanCoins ?? source.agriCoins ?? 15,
  };
}

const savedAccessToken = localStorage.getItem(ACCESS_KEY);
const savedRefreshToken = localStorage.getItem(REFRESH_KEY);

const rawSavedPersona = localStorage.getItem(PERSONA_KEY);
const savedPersona: PersonaType =
  rawSavedPersona && rawSavedPersona !== 'undefined' && rawSavedPersona !== 'null'
    ? normalizePersona(rawSavedPersona)
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

export const useAuthStore = create<AuthState>((set, get) => ({
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
    if (user.activePersona) {
      activatePersona(user.activePersona);
    }
  },

  logout: () => {
    const refreshToken = get().refreshToken ?? localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      auth.logout(refreshToken).catch(() => undefined);
    }
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
    const norm = normalizePersona(persona);
    // hidden personas cannot be activated from any UI surface
    if ((get().user?.disabledPersonas ?? []).includes(norm)) return;
    localStorage.setItem(PERSONA_KEY, norm);
    activatePersona(norm);
    set((state) => {
      const updatedUser = state.user
        ? {
            ...state.user,
            activePersona: norm,
            availablePersonas: state.user.availablePersonas.includes(norm)
              ? state.user.availablePersonas
              : [...state.user.availablePersonas, norm],
          }
        : null;
      if (updatedUser) {
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser));
      }
      return {
        activePersona: norm,
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

// Boot-time re-sync: a refresh/direct-URL visit restores the client persona
// from localStorage but the server may still hold another profile (previous
// tab, expired switch) — every gated call would 403 until the next manual
// switch. Re-activate the restored persona so the gate above can serialize
// the page's first fetches behind it. Skipped for personas the user has not
// linked (activation would silently link them server-side) or has hidden.
const hasValidSession =
  !!savedAccessToken && savedAccessToken !== 'undefined' && savedAccessToken !== 'null';
if (hasValidSession && savedUser) {
  const bootPersona = savedUser.activePersona || savedPersona;
  if (
    savedUser.availablePersonas.includes(bootPersona) &&
    !(savedUser.disabledPersonas ?? []).includes(bootPersona)
  ) {
    activatePersona(bootPersona);
  }
}
