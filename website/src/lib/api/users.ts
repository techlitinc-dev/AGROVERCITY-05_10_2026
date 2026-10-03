import { api } from './client';
import type { AuthUser, FarmBoundaryPoint, PersonaSetupPayload } from './types';

/** User endpoints — contract verified against backend/app/routers/users.py. */

export async function saveFarmBoundary(
  points: FarmBoundaryPoint[],
  landAreaAcres: number,
  khasraNumber?: string
): Promise<{ ok: boolean }> {
  await api.put('/users/me/farm-boundary', {
    farmBoundaryPoints: points,
    landAreaAcres,
    khasraNumber: khasraNumber ?? null,
  });
  return { ok: true };
}

/** Complete persona/profile selection after registration (deferred flow). */
export async function savePersonaSetup(payload: PersonaSetupPayload): Promise<AuthUser> {
  const { data } = await api.put<AuthUser>('/users/me/persona-setup', payload);
  return data;
}

export async function updateSettings(patch: {
  language?: string;
  preferredLanguage?: string;
  womenMode?: boolean;
  highContrast?: boolean;
  darkMode?: boolean;
}): Promise<unknown> {
  const { data } = await api.put('/users/me/settings', patch);
  return data;
}

/**
 * Persist the active persona server-side — backend role checks read
 * user.activeProfile (backend/app/routers/users.py:331).
 */
export async function activateProfile(profileType: string): Promise<AuthUser> {
  const { data } = await api.post<{ user: AuthUser }>(`/users/me/profiles/${profileType}/activate`);
  return data.user;
}

/** Link an additional persona (e.g. a Vyapari adding directBuyer). */
export async function linkProfile(profileType: string): Promise<AuthUser> {
  const { data } = await api.post<AuthUser>('/users/me/profiles', { profileType });
  return data;
}

/** Unlink a persona (backend guards the last remaining profile with 409). */
export async function unlinkProfile(profileType: string): Promise<AuthUser> {
  const { data } = await api.delete<AuthUser>(`/users/me/profiles/${profileType}`);
  return data;
}
