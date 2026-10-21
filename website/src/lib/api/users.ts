import { del, post, put, readList, readOne } from './http';
import type { PersonaType, UserProfile } from '../../types';

export interface UserSettings {
  language?: string;
  preferredLanguage?: string;
  womenMode?: boolean;
  highContrast?: boolean;
  darkMode?: boolean;
  /** Account visibility — false hides the profile from search/discovery. */
  discoverable?: boolean;
  notifications?: Record<string, boolean>;
  [key: string]: unknown;
}

export interface UserConsents {
  [key: string]: boolean | undefined;
}

/** Users namespace — /users/me surface. */
export const users = {
  /** GET /users/me */
  getMe: (): Promise<UserProfile> => readOne<UserProfile>('/users/me'),

  /** PUT /users/me — accepts the typed core plus loose backend extras (tehsil, addressLine, …). */
  updateMe: (updates: Partial<UserProfile> & Record<string, unknown>): Promise<UserProfile> =>
    put<UserProfile>('/users/me', updates),

  /** PUT /users/me/persona-setup */
  personaSetup: (payload: Record<string, unknown>): Promise<UserProfile> =>
    put<UserProfile>('/users/me/persona-setup', payload),

  /** PUT /users/me/farm-boundary */
  saveFarmBoundary: (boundary: Record<string, unknown>): Promise<{ success: boolean }> =>
    put<{ success: boolean }>('/users/me/farm-boundary', boundary),

  /** POST /users/me/profiles — link a new persona profile. */
  linkProfile: (profileType: PersonaType, payload: Record<string, unknown> = {}): Promise<UserProfile> =>
    post<UserProfile>('/users/me/profiles', { profileType, ...payload }),

  /** POST /users/me/profiles/{type}/activate */
  activateProfile: (profileType: PersonaType): Promise<UserProfile> =>
    post<UserProfile>(`/users/me/profiles/${profileType}/activate`),

  /** PUT /users/me/profiles/{type}/primary */
  setPrimaryProfile: (profileType: PersonaType): Promise<UserProfile> =>
    put<UserProfile>(`/users/me/profiles/${profileType}/primary`),

  /** DELETE /users/me/profiles/{type} — unlink. */
  unlinkProfile: (profileType: PersonaType): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/users/me/profiles/${profileType}`),

  /** GET /users/me/profiles — linked/active/primary + per-persona flags. */
  myProfiles: (): Promise<unknown> => readOne<unknown>('/users/me/profiles'),

  /** PUT /users/me/profiles/{type}/visibility — hide/show a persona (hide ≠ unlink). */
  setPersonaVisibility: (
    profileType: PersonaType,
    enabled: boolean
  ): Promise<{
    persona: string;
    enabled: boolean;
    activeProfile: string;
    disabledProfiles: string[];
  }> =>
    put<{
      persona: string;
      enabled: boolean;
      activeProfile: string;
      disabledProfiles: string[];
    }>(`/users/me/profiles/${profileType}/visibility`, { enabled }),

  /** GET /users/me/settings */
  getSettings: (): Promise<UserSettings> => readOne<UserSettings>('/users/me/settings'),

  /** PUT /users/me/settings */
  updateSettings: (settings: UserSettings): Promise<UserSettings> =>
    put<UserSettings>('/users/me/settings', settings),

  /** GET /users/me/consents */
  getConsents: (): Promise<UserConsents> => readOne<UserConsents>('/users/me/consents'),

  /** PUT /users/me/consents */
  updateConsents: (consents: UserConsents): Promise<UserConsents> =>
    put<UserConsents>('/users/me/consents', consents),

  /** POST /users/me/data-export — request a GDPR-style data export. */
  requestDataExport: (): Promise<{ success: boolean }> =>
    post<{ success: boolean }>('/users/me/data-export'),

  /** GET /users/me/data-export/latest */
  latestDataExport: (): Promise<unknown> => readOne<unknown>('/users/me/data-export/latest'),

  /** GET /users/me/bookings */
  myBookings: (): Promise<unknown[]> => readList<unknown[]>('/users/me/bookings'),

  /** POST /devices — register FCM device token. */
  registerDevice: (token: string, platform: string): Promise<{ success: boolean }> =>
    post<{ success: boolean }>('/devices', { token, platform }),

  /** DELETE /devices/{token_hash} */
  unregisterDevice: (tokenHash: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/devices/${tokenHash}`),

  /** GET /users/me/saved — saved items, optionally filtered by kind (mandi-rate | tree | article | ad). */
  savedItems: (kind?: string): Promise<unknown[]> =>
    readList<unknown[]>('/users/me/saved', { params: kind ? { kind } : {} }),

  /** POST /users/me/saved — save an item. */
  saveItem: (body: { kind: string; refId: string; title?: string; snapshot?: Record<string, unknown> }): Promise<unknown> =>
    post<unknown>('/users/me/saved', body),

  /** DELETE /users/me/saved/{kind}/{refId} — remove a saved item. */
  unsaveItem: (kind: string, refId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/users/me/saved/${kind}/${encodeURIComponent(refId)}`),

  /** POST /users/{user_id}/report */
  reportUser: (userId: string, reason: string): Promise<{ success: boolean }> =>
    post<{ success: boolean }>(`/users/${userId}/report`, { reason }),

  /** GET /users/me/blocks */
  blocks: (): Promise<unknown[]> => readList<unknown[]>('/users/me/blocks'),

  /** POST /users/me/blocks */
  blockUser: (userId: string): Promise<{ success: boolean }> =>
    post<{ success: boolean }>('/users/me/blocks', { userId }),

  /** DELETE /users/me/blocks/{user_id} */
  unblockUser: (userId: string): Promise<{ success: boolean }> =>
    del<{ success: boolean }>(`/users/me/blocks/${userId}`),

  /** DELETE /users/me — account deletion. */
  deleteMe: (): Promise<{ success: boolean }> => del<{ success: boolean }>('/users/me'),
};
