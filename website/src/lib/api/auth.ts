import { api } from './client';
import type { AuthResponse, AuthUser, RegisterPayload } from './types';

/** Auth endpoints — contract verified against backend/app/routers/auth.py. */

export async function firebaseVerify(idToken: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/firebase-verify', { idToken });
  return data;
}

export async function loginWithPhoneMpin(phone: string, mpin: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', { phone, mpin });
  return data;
}

export async function setMpin(mpin: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>('/auth/mpin/set', { mpin });
  return data;
}

export async function resetMpin(idToken: string, newMpin: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>('/auth/mpin/reset', { idToken, newMpin });
  return data;
}

export async function verifyMpin(mpin: string): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>('/auth/mpin/verify', { mpin });
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse & { referral?: { applied: boolean } }> {
  const { data } = await api.post<AuthResponse & { referral?: { applied: boolean } }>('/auth/register', payload);
  return data;
}

export async function fetchMe(): Promise<AuthUser> {
  const { data } = await api.get<AuthUser>('/users/me');
  return data;
}
