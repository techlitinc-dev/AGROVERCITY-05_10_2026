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

/** Update the user profile (PUT /users/me). */
export async function updateProfile(patch: {
  name?: string;
  email?: string;
  language?: string;
  preferredLanguage?: string;
}): Promise<unknown> {
  const { data } = await api.put('/users/me', patch);
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

// ---- Trust & safety (WS-03 X9) ----

export async function reportUser(userId: string, reason: string): Promise<unknown> {
  const { data } = await api.post(`/users/${userId}/report`, { reason });
  return data;
}

export async function blockUser(userId: string): Promise<unknown> {
  const { data } = await api.post('/users/me/blocks', { userId });
  return data;
}

export async function unblockUser(userId: string): Promise<unknown> {
  const { data } = await api.delete(`/users/me/blocks/${userId}`);
  return data;
}

export async function getBlockedIds(): Promise<string[]> {
  const { data } = await api.get<{ data: Array<{ id: string }> }>('/users/me/blocks');
  return (data.data ?? []).map((b) => b.id);
}

/** Verified account deletion (WS-04) — requires the MPIN for re-auth. */
export async function deleteAccount(mpin: string): Promise<{ deleted: boolean }> {
  const { data } = await api.delete<{ deleted: boolean }>('/users/me', { data: { mpin } });
  return data;
}
