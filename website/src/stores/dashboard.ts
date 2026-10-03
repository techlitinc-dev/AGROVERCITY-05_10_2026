import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { activateProfile, linkProfile, unlinkProfile } from '../lib/api/users';
import type { AuthUser } from '../lib/api/types';
import { VALID_PROFILE_TYPES } from '../lib/personas';
import { t } from '../lib/i18n';
import { toast } from '../components/toast';
import { useOnboardingStore } from './onboarding';
import { useSessionStore } from './session';

/**
 * Dashboard state — active persona + linked profiles for the web dashboard.
 * Hydrated from the session user / onboarding selection.
 *
 * Switching is PERSISTED server-side (backend role checks read
 * user.activeProfile): linking an unlinked persona happens automatically
 * (POST /users/me/profiles) before activation. Local state updates
 * optimistically and rolls back with a toast on failure.
 */
interface DashboardState {
  activeProfile: string | null;
  linkedProfiles: string[];
  /** User identity the state was last synced for (re-sync on user change). */
  syncedFor: string | null;
  setActiveProfile: (type: string) => Promise<boolean>;
  toggleLinked: (type: string) => void;
  syncFromUser: (user?: AuthUser | null) => void;
}

function resolveLinked(user?: AuthUser | null): string[] {
  const fromUser = user?.linkedProfiles ?? [];
  const fromOnboarding = useOnboardingStore.getState().personas;
  const source = fromUser.length > 0 ? fromUser : fromOnboarding;
  const linked = (source.length > 0 ? source : ['farmer']).filter((p) =>
    VALID_PROFILE_TYPES.includes(p)
  );
  return linked.length > 0 ? linked : ['farmer'];
}

function resolveActive(user: AuthUser | null | undefined, linked: string[]): string {
  const candidate =
    user?.primaryProfile ?? user?.activeProfile ?? useOnboardingStore.getState().primaryPersona;
  return candidate && linked.includes(candidate) ? candidate : linked[0];
}

async function persistActive(type: string): Promise<AuthUser> {
  const session = useSessionStore.getState();
  const linked = useDashboardStore.getState().linkedProfiles;
  let user: AuthUser;
  if (!linked.includes(type)) {
    user = await linkProfile(type); // link-then-activate (mirrors mobile linkNewProfile)
    session.setUser(user);
    useDashboardStore.setState({ linkedProfiles: resolveLinked(user) });
  }
  user = await activateProfile(type);
  session.setUser(user);
  return user;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      activeProfile: null,
      linkedProfiles: [],
      syncedFor: null,
      setActiveProfile: (type) => {
        if (!VALID_PROFILE_TYPES.includes(type)) return Promise.resolve(false);
        const previous = get().activeProfile;
        set({ activeProfile: type });
        return persistActive(type)
          .then((user) => {
            set({ linkedProfiles: resolveLinked(user) });
            return true;
          })
          .catch(() => {
            set({ activeProfile: previous });
            toast(t('profileSwitchFailed'), { error: true });
            return false;
          });
      },
      toggleLinked: (type) => {
        const wasLinked = get().linkedProfiles.includes(type);
        const previousLinked = get().linkedProfiles;
        const previousActive = get().activeProfile;
        set((s) => {
          const has = s.linkedProfiles.includes(type);
          const linkedProfiles = has
            ? s.linkedProfiles.filter((p) => p !== type)
            : [...s.linkedProfiles, type];
          const activeProfile =
            s.activeProfile === type && has
              ? (linkedProfiles[0] ?? 'farmer')
              : (s.activeProfile ?? linkedProfiles[0] ?? 'farmer');
          return { linkedProfiles, activeProfile };
        });
        (async () => {
          try {
            const user = wasLinked ? await unlinkProfile(type) : await linkProfile(type);
            useSessionStore.getState().setUser(user);
            set({ linkedProfiles: resolveLinked(user) });
            if (!wasLinked) toast(t('profileAdded', { persona: t(`persona_${type}`) }));
          } catch {
            set({ linkedProfiles: previousLinked, activeProfile: previousActive });
            toast(t('profileSwitchFailed'), { error: true });
          }
        })();
      },
      syncFromUser: (user) => {
        // Manual switches win for the same user; re-sync when the user changes.
        const uid = user?.id ?? user?.uid ?? user?.phone ?? 'anon';
        if (get().activeProfile && get().syncedFor === uid) return;
        const linkedProfiles = resolveLinked(user);
        set({ linkedProfiles, activeProfile: resolveActive(user, linkedProfiles), syncedFor: uid });
      },
    }),
    { name: 'agvc-dashboard' }
  )
);

/**
 * Ensure a backend role is active before opening a role-gated tool.
 *
 * Compares against the SESSION USER (backend truth as last hydrated), not
 * the local preference — the two can diverge when another client (e.g. the
 * mobile app) changes activeProfile. Activation is idempotent, so when in
 * doubt we always make the cheap confirm call rather than trust local state.
 */
export async function ensureProfile(type: string): Promise<boolean> {
  const session = useSessionStore.getState();
  if (!session.accessToken) {
    useDashboardStore.getState().setActiveProfile(type);
    return true;
  }
  if (session.user?.activeProfile === type) {
    if (useDashboardStore.getState().activeProfile !== type) {
      useDashboardStore.setState({ activeProfile: type });
    }
    return true;
  }
  return useDashboardStore.getState().setActiveProfile(type);
}
