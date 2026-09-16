import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Lang } from '@/i18n';
import { clearTokens, setTokens } from '@/api/http';
import type { AuthTokens, FarmerProfile } from '@/api/types';

export type { ProfileType } from '@/api/types';
import type { ProfileType } from '@/api/types';

export interface SessionUser {
  id: string;
  name: string;
  vernacularName: string;
  phone: string;
  village: string;
  district: string;
  state: string;
  landAreaAcres: number;
  agriCoins: number;
  krishiRatnaLevel: number;
  krishiRatnaTitle: string;
  streakDays: number;
}

interface SessionState {
  user: SessionUser | null;
  language: Lang;
  womenMode: boolean;
  highContrast: boolean;
  activeProfile: ProfileType;
  linkedProfiles: ProfileType[];
  isAuthenticated: boolean;
  signInDemo: () => void;
  signInWithApi: (profile: FarmerProfile, tokens: AuthTokens) => void;
  signOut: () => void;
  switchProfile: (p: ProfileType) => void;
  setLanguage: (l: Lang) => void;
  toggleWomenMode: () => void;
  toggleHighContrast: () => void;
}

const STORAGE_KEY = 'ks.session';

const ALL_PROFILES: ProfileType[] = [
  'farmer',
  'farmLandlord',
  'transport',
  'seller',
  'equipmentRental',
  'broker',
];

const DEMO_USER: SessionUser = {
  id: 'demo-farmer-1',
  name: 'Ram Singh',
  vernacularName: 'राम सिंह',
  phone: '+919876543210',
  village: 'नाशिक',
  district: 'Nashik',
  state: 'Maharashtra',
  landAreaAcres: 5.5,
  agriCoins: 1250,
  krishiRatnaLevel: 4,
  krishiRatnaTitle: 'Krishi Daksh',
  streakDays: 12,
};

interface PersistedSession {
  user: SessionUser | null;
  language: Lang;
  womenMode: boolean;
  highContrast: boolean;
  activeProfile: ProfileType;
  linkedProfiles: ProfileType[];
  isAuthenticated: boolean;
}

function loadSession(): PersistedSession {
  const empty: PersistedSession = {
    user: null,
    language: 'hi',
    womenMode: false,
    highContrast: false,
    activeProfile: 'farmer',
    linkedProfiles: [],
    isAuthenticated: false,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return empty;
    return { ...empty, ...(JSON.parse(raw) as Partial<PersistedSession>) };
  } catch {
    return empty;
  }
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PersistedSession>(loadSession);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [session]);

  const signInDemo = useCallback(() => {
    setSession((s) => ({
      ...s,
      user: DEMO_USER,
      isAuthenticated: true,
      activeProfile: 'farmer',
      linkedProfiles: [...ALL_PROFILES],
    }));
  }, []);

  const signInWithApi = useCallback((profile: FarmerProfile, tokens: AuthTokens) => {
    setTokens(tokens);
    localStorage.setItem('ks.lang', 'hi');
    setSession((s) => ({
      ...s,
      user: {
        id: profile.id,
        name: profile.name,
        vernacularName: profile.vernacularName,
        phone: profile.phone,
        village: profile.village,
        district: profile.district,
        state: profile.state,
        landAreaAcres: profile.landAreaAcres,
        agriCoins: profile.agriCoins,
        krishiRatnaLevel: profile.krishiRatnaLevel,
        krishiRatnaTitle: profile.krishiRatnaTitle,
        streakDays: profile.streakDays,
      },
      isAuthenticated: true,
      activeProfile: profile.activeProfile,
      linkedProfiles: profile.linkedProfiles,
    }));
  }, []);

  useEffect(() => {
    const onLogout = () =>
      setSession((s) => ({
        ...s,
        user: null,
        isAuthenticated: false,
        activeProfile: 'farmer',
        linkedProfiles: [],
      }));
    window.addEventListener('ks:logout', onLogout);
    return () => window.removeEventListener('ks:logout', onLogout);
  }, []);

  const signOut = useCallback(() => {
    clearTokens();
    setSession((s) => ({
      ...s,
      user: null,
      isAuthenticated: false,
      activeProfile: 'farmer',
      linkedProfiles: [],
    }));
  }, []);

  const switchProfile = useCallback((p: ProfileType) => {
    setSession((s) =>
      s.linkedProfiles.includes(p) ? { ...s, activeProfile: p } : s,
    );
  }, []);

  const setLanguage = useCallback((language: Lang) => {
    localStorage.setItem('ks.lang', language);
    setSession((s) => ({ ...s, language }));
  }, []);

  const toggleWomenMode = useCallback(() => {
    setSession((s) => ({ ...s, womenMode: !s.womenMode }));
  }, []);

  const toggleHighContrast = useCallback(() => {
    setSession((s) => ({ ...s, highContrast: !s.highContrast }));
  }, []);

  const value = useMemo<SessionState>(
    () => ({ ...session, signInDemo, signInWithApi, signOut, switchProfile, setLanguage, toggleWomenMode, toggleHighContrast }),
    [session, signInDemo, signInWithApi, signOut, switchProfile, setLanguage, toggleWomenMode, toggleHighContrast],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
